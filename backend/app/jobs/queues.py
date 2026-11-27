"""RQ queue construction using restricted JSONSerializer (no arbitrary pickle)."""
from __future__ import annotations

from redis import Redis
from rq import Queue
from rq.serializers import JSONSerializer

from app.core.redis_config import RedisConfig
from app.queue.connection import get_redis_client


def get_assessment_queue(
    redis_conn: Redis | None = None,
    *,
    config: RedisConfig | None = None,
) -> Queue:
    """Return the Semester 7 assessment RQ queue configured with JSONSerializer."""
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    return Queue(
        name=cfg.queue_name,
        connection=conn,
        serializer=JSONSerializer,
    )
