from __future__ import annotations

from redis import Redis
from rq import Queue
from rq.serializers import JSONSerializer

from app.core.config import get_settings

_redis_override: Redis | None = None


def set_redis_client_override(client: Redis | None) -> None:
    """Allow tests to inject fakeredis without modifying production wiring."""
    global _redis_override
    _redis_override = client


def get_redis_client() -> Redis:
    """Return configured Redis connection (or injected test client)."""
    if _redis_override is not None:
        return _redis_override
    settings = get_settings()
    return Redis.from_url(settings.redis_url, decode_responses=False)


def get_rq_queue(redis_conn: Redis | None = None) -> Queue:
    """Return the RQ queue used for asynchronous assessment runs (JSONSerializer enforced)."""
    settings = get_settings()
    conn = redis_conn or get_redis_client()
    return Queue(name=settings.rq_queue_name, connection=conn, serializer=JSONSerializer)


def cancel_signal_key(run_id: str) -> str:
    return f"abm:run:cancel:{run_id}"


def set_cancel_signal(run_id: str, redis_conn: Redis | None = None) -> None:
    conn = redis_conn or get_redis_client()
    conn.setex(cancel_signal_key(run_id), 86400, b"1")


def is_cancel_signalled(run_id: str, redis_conn: Redis | None = None) -> bool:
    try:
        conn = redis_conn or get_redis_client()
        return bool(conn.get(cancel_signal_key(run_id)))
    except Exception:
        return False


def clear_cancel_signal(run_id: str, redis_conn: Redis | None = None) -> None:
    try:
        conn = redis_conn or get_redis_client()
        conn.delete(cancel_signal_key(run_id))
    except Exception:
        pass


check_cancel_signal = is_cancel_signalled


def ping_redis(redis_conn: Redis | None = None) -> bool:
    try:
        conn = redis_conn or get_redis_client()
        return bool(conn.ping())
    except Exception:
        return False


