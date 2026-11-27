"""Idempotent RQ assessment job dispatch with latency measurement and outage safety."""
from __future__ import annotations

import time
from dataclasses import dataclass

from redis import Redis
from rq.job import Job
from rq.serializers import JSONSerializer

from app.core.redis_config import RedisConfig
from app.jobs.exceptions import QueueUnavailableError
from app.jobs.job_ids import build_assessment_job_id, validate_job_payload
from app.jobs.queues import get_assessment_queue
from app.queue.connection import get_redis_client


@dataclass(frozen=True)
class DispatchReceipt:
    job_id: str
    run_id: str
    already_enqueued: bool
    rq_status: str
    dispatch_latency_ms: float


def enqueue_assessment_run(
    run_id: str,
    *,
    correlation_id: str = "req-background",
    wall_clock_seconds: int = 240,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
) -> DispatchReceipt:
    """Idempotently enqueue an assessment run using minimal JSON-serializable arguments."""
    t0 = time.monotonic()
    cfg = config or RedisConfig.from_settings()
    payload = validate_job_payload(
        {"run_id": run_id, "correlation_id": correlation_id, "task_version": 1}
    )
    job_id = build_assessment_job_id(payload["run_id"])
    conn = redis_conn or get_redis_client()

    try:
        conn.ping()
        queue = get_assessment_queue(conn, config=cfg)

        # Idempotency: check if job already exists in RQ
        existing = (
            Job.fetch(job_id, connection=conn, serializer=JSONSerializer)
            if Job.exists(job_id, connection=conn)
            else None
        )
        if existing is not None:
            raw_status = existing.get_status(refresh=True)
            status = raw_status.value if hasattr(raw_status, "value") else str(raw_status)
            if status in {"queued", "started", "scheduled", "deferred", "finished"}:
                return DispatchReceipt(
                    job_id=job_id,
                    run_id=payload["run_id"],
                    already_enqueued=True,
                    rq_status=status,
                    dispatch_latency_ms=round((time.monotonic() - t0) * 1000.0, 2),
                )

        from app.queue.tasks import run_assessment_job

        job = queue.enqueue(
            run_assessment_job,
            payload["run_id"],
            job_id=job_id,
            job_timeout=int(wall_clock_seconds) + 60,
            result_ttl=cfg.result_ttl_seconds,
            failure_ttl=cfg.failure_ttl_seconds,
        )
        return DispatchReceipt(
            job_id=job.id,
            run_id=payload["run_id"],
            already_enqueued=False,
            rq_status=str(job.get_status(refresh=False) or "queued"),
            dispatch_latency_ms=round((time.monotonic() - t0) * 1000.0, 2),
        )
    except QueueUnavailableError:
        raise
    except Exception as exc:
        raise QueueUnavailableError(f"Redis/RQ dispatch unavailable: {type(exc).__name__}") from exc
