"""Worker identity, 5-second heartbeat publishing, and stale-worker detection."""
from __future__ import annotations

import json
import os
import socket
import time
from dataclasses import dataclass

from redis import Redis

from app.core.redis_config import RedisConfig
from app.queue.connection import get_redis_client


@dataclass(frozen=True)
class WorkerPresence:
    worker_id: str
    active_run_id: str | None
    last_seen_epoch: float
    age_seconds: float
    is_stale: bool


def default_worker_id() -> str:
    host = socket.gethostname()[:32]
    return f"abm-worker-{host}-{os.getpid()}"


def heartbeat_key(worker_id: str, prefix: str = "abm:dev") -> str:
    return f"{prefix}:worker:hb:{worker_id}"


def publish_worker_heartbeat(
    worker_id: str,
    *,
    active_run_id: str | None = None,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
    now_epoch: float | None = None,
) -> None:
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    ts = now_epoch if now_epoch is not None else time.time()
    payload = json.dumps(
        {
            "worker_id": worker_id,
            "active_run_id": active_run_id,
            "last_seen_epoch": ts,
        }
    )
    conn.setex(heartbeat_key(worker_id, cfg.key_prefix), cfg.worker_stale_seconds * 2, payload)


def clear_worker_heartbeat(
    worker_id: str,
    *,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
) -> None:
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    conn.delete(heartbeat_key(worker_id, cfg.key_prefix))


def list_worker_presences(
    *,
    redis_conn: Redis | None = None,
    config: RedisConfig | None = None,
    now_epoch: float | None = None,
) -> list[WorkerPresence]:
    cfg = config or RedisConfig.from_settings()
    conn = redis_conn or get_redis_client()
    now = now_epoch if now_epoch is not None else time.time()
    pattern = f"{cfg.key_prefix}:worker:hb:*"
    presences: list[WorkerPresence] = []
    for key in conn.scan_iter(match=pattern):
        raw = conn.get(key)
        if not raw:
            continue
        try:
            data = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
            last_seen = float(data["last_seen_epoch"])
            age = max(0.0, now - last_seen)
            presences.append(
                WorkerPresence(
                    worker_id=str(data["worker_id"]),
                    active_run_id=data.get("active_run_id"),
                    last_seen_epoch=last_seen,
                    age_seconds=round(age, 2),
                    is_stale=age > cfg.worker_stale_seconds,
                )
            )
        except Exception:
            continue
    return presences
