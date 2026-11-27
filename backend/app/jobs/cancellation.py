"""Cooperative cancellation signaling and RQ stop command helpers."""
from __future__ import annotations

from redis import Redis
from rq.command import send_stop_job_command
from rq.job import Job

from app.core.redis_config import RedisConfig
from app.jobs.job_ids import build_assessment_job_id
from app.queue.connection import (
    clear_cancel_signal,
    get_redis_client,
    is_cancel_signalled,
    set_cancel_signal,
)


def request_cooperative_cancellation(
    run_id: str,
    *,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
) -> bool:
    """
    Set durable-TTL cancel key, publish non-durable wake-up, and stop queued/active RQ job if present.
    Returns True if Redis signal was written; False if Redis was unreachable (DB flag still covers polling).
    """
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    try:
        set_cancel_signal(run_id, redis_conn=conn)
        channel = f"{cfg.key_prefix}:run:cancel:{run_id}"
        conn.publish(channel, b"cancel")

        job_id = build_assessment_job_id(run_id)
        if Job.exists(job_id, connection=conn):
            job = Job.fetch(job_id, connection=conn)
            if job.get_status(refresh=False) == "queued":
                job.cancel()
            elif job.get_status(refresh=False) == "started":
                try:
                    send_stop_job_command(conn, job_id)
                except Exception:
                    pass
        return True
    except Exception:
        return False


__all__ = [
    "clear_cancel_signal",
    "is_cancel_signalled",
    "request_cooperative_cancellation",
    "set_cancel_signal",
]
