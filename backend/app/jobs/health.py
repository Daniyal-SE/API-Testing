"""Operational queue and worker health diagnostics (zero secrets exposed)."""
from __future__ import annotations

import time
from typing import Any

from redis import Redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.redis_config import RedisConfig
from app.jobs.heartbeat import list_worker_presences
from app.jobs.queues import get_assessment_queue
from app.models.assessment import AssessmentRun
from app.queue.connection import get_redis_client


def get_queue_diagnostics(
    db: Session | None = None,
    *,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
) -> dict[str, Any]:
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    t0 = time.monotonic()
    redis_ok = False
    latency_ms: float | None = None
    queue_depth = 0
    started_count = 0
    failed_count = 0
    active_workers = 0
    stale_workers = 0

    try:
        redis_ok = bool(conn.ping())
        latency_ms = round((time.monotonic() - t0) * 1000.0, 2)
        q = get_assessment_queue(conn, config=cfg)
        queue_depth = len(q)
        started_count = q.started_job_registry.count
        failed_count = q.failed_job_registry.count
        presences = list_worker_presences(redis_conn=conn, config=cfg)
        active_workers = sum(1 for p in presences if not p.is_stale)
        stale_workers = sum(1 for p in presences if p.is_stale)
    except Exception:
        redis_ok = False

    active_runs_db = 0
    if db is not None:
        active_runs_db = int(
            db.scalar(
                select(func.count())
                .select_from(AssessmentRun)
                .where(AssessmentRun.state.in_(["queued", "running", "cancellation_requested"]))
            )
            or 0
        )

    return {
        "redis_connected": redis_ok,
        "redis_latency_ms": latency_ms,
        "queue_name": cfg.queue_name,
        "queue_depth": queue_depth,
        "registries": {
            "started": started_count,
            "failed": failed_count,
        },
        "workers": {
            "active": active_workers,
            "stale": stale_workers,
        },
        "active_runs_db": active_runs_db,
    }
