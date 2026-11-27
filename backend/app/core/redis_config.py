"""Centralized, validated Redis & RQ configuration with credential redaction."""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class RedisConfig:
    url: str
    queue_name: str
    key_prefix: str
    socket_timeout: float = 5.0
    socket_connect_timeout: float = 5.0
    health_check_interval: int = 30
    heartbeat_interval_seconds: int = 5
    worker_stale_seconds: int = 30
    worker_unavailable_seconds: int = 60
    shutdown_grace_seconds: int = 30
    result_ttl_seconds: int = 3600
    failure_ttl_seconds: int = 86400

    @classmethod
    def from_settings(cls, settings: Settings | None = None) -> "RedisConfig":
        cfg = settings or get_settings()
        if not cfg.redis_url or not cfg.redis_url.startswith(("redis://", "rediss://")):
            raise ValueError("REDIS_URL must start with redis:// or rediss://")
        return cls(
            url=cfg.redis_url,
            queue_name=cfg.rq_queue_name,
            key_prefix=f"abm:{cfg.environment}",
        )

    def redacted_url(self) -> str:
        return redact_redis_url(self.url)


def redact_redis_url(raw_url: str) -> str:
    """Strip any embedded password/userinfo from a Redis URL before logging."""
    try:
        parts = urlsplit(raw_url)
        if parts.password or parts.username:
            host = parts.hostname or "localhost"
            port = f":{parts.port}" if parts.port else ""
            user_part = f"{parts.username}:***" if parts.username else "***"
            netloc = f"{user_part}@{host}{port}"
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
        return raw_url
    except Exception:
        return "redis://[REDACTED]"
