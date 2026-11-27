"""Versioned, sanitized progress event builder and best-effort Pub/Sub fan-out."""
from __future__ import annotations

import json
import uuid
from typing import Any

from redis import Redis

from app.core.logging import redact_dict, sanitize_log_string
from app.core.redis_config import RedisConfig
from app.core.security import utc_now
from app.queue.connection import get_redis_client


def build_progress_event(
    *,
    run_id: str,
    correlation_id: str,
    event_type: str,
    run_state: str,
    phase: str,
    requests_started: int,
    requests_completed: int,
    urls_discovered: int,
    requests_limit: int,
    detail: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Construct a versioned, bounded, sanitized progress payload without fabricated percentages."""
    return {
        "event_version": 1,
        "event_id": str(uuid.uuid4()),
        "run_id": run_id,
        "correlation_id": sanitize_log_string(correlation_id, 64),
        "event_type": sanitize_log_string(event_type, 64),
        "run_state": sanitize_log_string(run_state, 32),
        "phase": sanitize_log_string(phase, 64),
        "counters": {
            "requests_started": max(0, int(requests_started)),
            "requests_completed": max(0, int(requests_completed)),
            "urls_discovered": max(0, int(urls_discovered)),
        },
        "budget": {
            "requests_used": max(0, int(requests_completed)),
            "requests_limit": max(1, int(requests_limit)),
        },
        "detail": redact_dict(detail) if detail else None,
        "occurred_at": utc_now().isoformat(),
    }


def publish_live_progress(
    event_payload: dict[str, Any],
    *,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
) -> bool:
    """Best-effort non-durable Pub/Sub fan-out; PostgreSQL RunEvent remains authoritative."""
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    try:
        channel = f"{cfg.key_prefix}:run:events:{event_payload['run_id']}"
        conn.publish(channel, json.dumps(event_payload, default=str))
        return True
    except Exception:
        return False
