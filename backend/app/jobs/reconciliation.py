"""Idempotent run reconciler & NFR-OPS-007 zero-worker watchdog."""
from __future__ import annotations

from datetime import timedelta, timezone

from redis import Redis
from rq.job import Job
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.correlation import get_correlation_id
from app.core.redis_config import RedisConfig
from app.core.security import utc_now
from app.jobs.heartbeat import list_worker_presences
from app.jobs.job_ids import build_assessment_job_id
from app.models.assessment import AssessmentRun, RunEvent
from app.queue.connection import get_redis_client
from app.services.audit_service import append_audit


def reconcile_active_runs(
    db: Session,
    *,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
) -> list[dict[str, str]]:
    """
    Compare active PostgreSQL runs with RQ job state and worker heartbeats.
    - NFR-OPS-007: If active worker count == 0 for a running scan older than 60s -> failed ('Worker Unavailable').
    - FR-RUN-006: If RQ job is missing or worker is stale -> interrupted (never blindly replayed).
    Safe to run repeatedly (idempotent).
    """
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    now = utc_now()

    active_runs = list(
        db.scalars(
            select(AssessmentRun).where(
                AssessmentRun.state.in_(["queued", "running", "cancellation_requested"])
            )
        )
    )
    if not active_runs:
        return []

    presences = list_worker_presences(redis_conn=conn, config=cfg)
    healthy_workers = [p for p in presences if not p.is_stale]
    healthy_run_ids = {p.active_run_id for p in healthy_workers if p.active_run_id}

    outcomes: list[dict[str, str]] = []
    for run in active_runs:
        ref_dt = run.heartbeat_at or run.started_at or run.created_at
        if ref_dt.tzinfo is None:
            ref_dt = ref_dt.replace(tzinfo=timezone.utc)
        age_seconds = (now - ref_dt).total_seconds()

        job_id = run.rq_job_id or build_assessment_job_id(run.id)
        rq_exists = False
        rq_status: str | None = None
        try:
            if Job.exists(job_id, connection=conn):
                rq_exists = True
                rq_status = str(Job.fetch(job_id, connection=conn).get_status(refresh=False))
        except Exception:
            pass

        # NFR-OPS-007: Zero active workers while scan is running > 60s
        if run.state == "running" and len(healthy_workers) == 0 and age_seconds >= cfg.worker_unavailable_seconds:
            run.state = "failed"
            run.current_phase = "Worker Unavailable"
            run.completed_at = now
            run.retained_summary = "Worker Unavailable: zero active RQ workers detected during running scan."
            db.add(
                RunEvent(
                    run_id=run.id,
                    event_type="run.worker_unavailable",
                    level="error",
                    phase="recovery",
                    message="Worker Unavailable: active worker count dropped to zero.",
                    correlation_id=get_correlation_id(),
                )
            )
            append_audit(
                db,
                action="assessment.worker_unavailable",
                resource_type="assessment_run",
                resource_id=run.id,
                detail=f"Run {run.run_code} marked failed (Worker Unavailable).",
                workspace_id=run.workspace_id,
                project_id=run.project_id,
                target_id=run.target_id,
                outcome="failed",
                correlation_run_id=run.id,
            )
            outcomes.append({"run_id": run.id, "new_state": "failed", "reason": "Worker Unavailable"})
            continue

        # FR-RUN-006: Stale worker / missing RQ job while run is active -> interrupted
        worker_lost = (
            run.state == "running"
            and run.id not in healthy_run_ids
            and age_seconds >= cfg.worker_stale_seconds
        )
        missing_job = (not rq_exists) and age_seconds >= cfg.worker_stale_seconds
        failed_rq = rq_status == "failed"

        if worker_lost or missing_job or failed_rq:
            run.state = "interrupted"
            run.current_phase = "Interrupted (Reconciliation Required)"
            run.completed_at = now
            run.retained_summary = "Interrupted run reconciled; manual review required before any new run."
            db.add(
                RunEvent(
                    run_id=run.id,
                    event_type="run.interrupted_reconciled",
                    level="warning",
                    phase="recovery",
                    message="Run marked interrupted after worker/queue mismatch; blind replay suppressed.",
                    correlation_id=get_correlation_id(),
                )
            )
            append_audit(
                db,
                action="assessment.interrupted_reconciled",
                resource_type="assessment_run",
                resource_id=run.id,
                detail=f"Reconciled interrupted run {run.run_code}.",
                workspace_id=run.workspace_id,
                project_id=run.project_id,
                target_id=run.target_id,
                correlation_run_id=run.id,
            )
            outcomes.append({"run_id": run.id, "new_state": "interrupted", "reason": "Reconciled"})

    if outcomes:
        db.commit()
    return outcomes
