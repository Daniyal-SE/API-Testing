"""Unit, integration, security, and failure-injection tests for Redis + Python RQ."""
from __future__ import annotations

import signal
import threading
import time
from datetime import timedelta

import fakeredis
import pytest
from rq import SimpleWorker
from rq.serializers import JSONSerializer

from app.core.redis_config import RedisConfig, redact_redis_url
from app.core.security import utc_now
from app.jobs.cancellation import request_cooperative_cancellation
from app.jobs.enqueue import enqueue_assessment_run
from app.jobs.exceptions import InvalidJobPayloadError, QueueUnavailableError
from app.jobs.health import get_queue_diagnostics
from app.jobs.heartbeat import (
    clear_worker_heartbeat,
    list_worker_presences,
    publish_worker_heartbeat,
)
from app.jobs.job_ids import build_assessment_job_id, validate_job_payload
from app.jobs.lifecycle_adapter import is_valid_app_transition, map_rq_status_to_app_state
from app.jobs.progress import build_progress_event, publish_live_progress
from app.jobs.queues import get_assessment_queue
from app.jobs.reconciliation import reconcile_active_runs
from app.models.assessment import AssessmentRun
from app.models.project import Project
from app.models.scope import ScopeVersion
from app.models.target import Target
from app.models.user import User
from app.queue.worker import install_shutdown_handler
from scripts.seed_demo import seed_database


def test_redis_config_redaction_and_payload_validation() -> None:
    redacted = redact_redis_url("redis://abm:SuperSecretPass@redis:6379/0")
    assert "SuperSecretPass" not in redacted
    assert "abm:***@" in redacted

    assert build_assessment_job_id("run-123") == "abm-run-run-123"
    valid = validate_job_payload({"run_id": "run-123", "correlation_id": "req-1"})
    assert valid["run_id"] == "run-123"

    with pytest.raises(InvalidJobPayloadError):
        validate_job_payload({"run_id": "run-123", "password": "secret"})
    with pytest.raises(InvalidJobPayloadError):
        validate_job_payload({"run_id": "run-123", "session_token": "tok"})


def test_lifecycle_adapter_and_progress_sanitization() -> None:
    assert map_rq_status_to_app_state("started") == "running"
    assert map_rq_status_to_app_state("failed") == "failed"
    assert map_rq_status_to_app_state(None) == "interrupted"

    assert is_valid_app_transition("queued", "running") is True
    assert is_valid_app_transition("completed", "running") is False
    assert is_valid_app_transition("cancelled", "completed") is False

    ev = build_progress_event(
        run_id="r-1",
        correlation_id="c-1",
        event_type="phase_progress",
        run_state="running",
        phase="url_discovery",
        requests_started=5,
        requests_completed=4,
        urls_discovered=12,
        requests_limit=100,
        detail={"cookie": "abm_session=secret", "note": "ok"},
    )
    assert ev["event_version"] == 1
    assert ev["detail"]["cookie"] == "[REDACTED]"
    assert ev["detail"]["note"] == "ok"


def test_idempotent_enqueue_json_serializer_and_redis_outage(fake_redis) -> None:
    q = get_assessment_queue(fake_redis)
    assert q.serializer is JSONSerializer

    r1 = enqueue_assessment_run("run-idem-1", correlation_id="req-1", redis_conn=fake_redis)
    assert r1.already_enqueued is False
    assert r1.job_id == "abm-run-run-idem-1"
    assert r1.dispatch_latency_ms >= 0.0

    # Duplicate enqueue does not create a second job
    r2 = enqueue_assessment_run("run-idem-1", correlation_id="req-1", redis_conn=fake_redis)
    assert r2.already_enqueued is True
    assert len(q) == 1

    # Redis outage raises QueueUnavailableError cleanly
    class _BrokenRedis:
        def ping(self) -> bool:
            raise ConnectionError("Redis down")

    with pytest.raises(QueueUnavailableError):
        enqueue_assessment_run("run-outage", redis_conn=_BrokenRedis())  # type: ignore[arg-type]


def test_heartbeat_stale_detection_cancellation_and_diagnostics(fake_redis) -> None:
    cfg = RedisConfig(url="redis://localhost:6379/0", queue_name="abm_assessments", key_prefix="abm:test")
    now = time.time()
    publish_worker_heartbeat("w-healthy", active_run_id="r-1", redis_conn=fake_redis, config=cfg, now_epoch=now)
    publish_worker_heartbeat("w-stale", active_run_id="r-2", redis_conn=fake_redis, config=cfg, now_epoch=now - 45)

    presences = {p.worker_id: p for p in list_worker_presences(redis_conn=fake_redis, config=cfg, now_epoch=now)}
    assert presences["w-healthy"].is_stale is False
    assert presences["w-stale"].is_stale is True

    # Cooperative cancellation signal & Pub/Sub
    assert request_cooperative_cancellation("r-1", redis_conn=fake_redis, config=cfg) is True
    assert publish_live_progress(
        build_progress_event(
            run_id="r-1",
            correlation_id="c-1",
            event_type="phase_progress",
            run_state="running",
            phase="url_discovery",
            requests_started=1,
            requests_completed=1,
            urls_discovered=1,
            requests_limit=10,
        ),
        redis_conn=fake_redis,
        config=cfg,
    ) is True

    diag = get_queue_diagnostics(redis_conn=fake_redis, config=cfg)
    assert diag["redis_connected"] is True
    assert diag["workers"]["active"] == 1
    assert diag["workers"]["stale"] == 1

    clear_worker_heartbeat("w-healthy", redis_conn=fake_redis, config=cfg)


def test_reconciliation_nfr_ops_007_and_interrupted_no_blind_replay(db_session_factory, fake_redis) -> None:
    _, TestingSession = db_session_factory
    cfg = RedisConfig(url="redis://localhost:6379/0", queue_name="abm_assessments", key_prefix="abm:test")

    with TestingSession() as db:
        seed_database(db)
        proj = db.query(Project).first()
        tgt = db.query(Target).filter_by(authorization_status="authorized").first()
        scope = db.query(ScopeVersion).filter_by(target_id=tgt.id).first()
        owner = db.query(User).filter_by(email="owner@fyp-lab.edu").first()
        assert proj and tgt and scope and owner

        # 1. NFR-OPS-007: Zero active workers while scan is running > 60s -> failed ('Worker Unavailable')
        old_ts = utc_now() - timedelta(seconds=90)
        run_zero = AssessmentRun(
            run_code="RUN-ZERO-W",
            workspace_id=proj.workspace_id,
            project_id=proj.id,
            target_id=tgt.id,
            scope_version_id=scope.id,
            initiated_by_id=owner.id,
            modules=["url_discovery"],
            run_plan_json={},
            plan_hash="a" * 64,
            state="running",
            current_phase="Running",
            request_budget=50,
            started_at=old_ts,
            heartbeat_at=old_ts,
        )
        db.add(run_zero)
        db.commit()

        outcomes = reconcile_active_runs(db, redis_conn=fake_redis, config=cfg)
        assert len(outcomes) == 1
        assert outcomes[0]["new_state"] == "failed"
        assert outcomes[0]["reason"] == "Worker Unavailable"
        db.refresh(run_zero)
        assert run_zero.state == "failed"

        # 2. Healthy worker exists for another job, but this run's RQ job is missing -> interrupted (no blind replay)
        publish_worker_heartbeat("w-other", active_run_id="other-run", redis_conn=fake_redis, config=cfg)
        stale_ts = utc_now() - timedelta(seconds=45)
        run_lost = AssessmentRun(
            run_code="RUN-LOST-JOB",
            workspace_id=proj.workspace_id,
            project_id=proj.id,
            target_id=tgt.id,
            scope_version_id=scope.id,
            initiated_by_id=owner.id,
            modules=["url_discovery"],
            run_plan_json={},
            plan_hash="b" * 64,
            state="running",
            current_phase="Running",
            request_budget=50,
            started_at=stale_ts,
            heartbeat_at=stale_ts,
        )
        db.add(run_lost)
        db.commit()

        outcomes2 = reconcile_active_runs(db, redis_conn=fake_redis, config=cfg)
        assert len(outcomes2) == 1
        assert outcomes2[0]["new_state"] == "interrupted"
        db.refresh(run_lost)
        assert run_lost.state == "interrupted"


def test_worker_sigterm_graceful_shutdown_handler(fake_redis) -> None:
    cfg = RedisConfig(url="redis://localhost:6379/0", queue_name="abm_assessments", key_prefix="abm:test")
    stop_event = threading.Event()
    publish_worker_heartbeat("w-term", redis_conn=fake_redis, config=cfg)

    class _DummyWorker:
        stopped = False

        def request_stop(self, _signum: int, _frame: object) -> None:
            self.stopped = True

    dummy = _DummyWorker()
    install_shutdown_handler(dummy, "w-term", stop_event, fake_redis, cfg)  # type: ignore[arg-type]
    handler = signal.getsignal(signal.SIGTERM)
    assert callable(handler)
    handler(signal.SIGTERM, None)
    assert stop_event.is_set() is True
    assert dummy.stopped is True
    assert list_worker_presences(redis_conn=fake_redis, config=cfg) == []
