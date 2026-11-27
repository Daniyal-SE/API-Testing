from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.correlation import get_correlation_id

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "secret",
    "token",
    "session_token",
    "csrf_token",
    "cookie",
    "set-cookie",
    "authorization",
    "api_key",
    "apikey",
}

_COOKIE_RE = re.compile(r"(abm_session|abm_csrf|sessionid)=[^;\s]+", re.IGNORECASE)
_BEARER_RE = re.compile(r"Bearer\s+[A-Za-z0-9._\-+/=]+", re.IGNORECASE)


def sanitize_log_string(value: str, max_len: int = 512) -> str:
    """Strip control characters, redact cookie/bearer tokens, and bound string length."""
    cleaned = "".join(ch if ch >= " " and ch != "\x7f" else " " for ch in value)
    cleaned = _COOKIE_RE.sub(r"\1=[REDACTED]", cleaned)
    cleaned = _BEARER_RE.sub("Bearer [REDACTED]", cleaned)
    if len(cleaned) > max_len:
        return cleaned[: max_len - 3] + "..."
    return cleaned


def redact_dict(data: dict[str, Any] | None, max_items: int = 24) -> dict[str, Any]:
    """Return a bounded, secret-redacted copy of metadata dictionaries."""
    if not data:
        return {}
    result: dict[str, Any] = {}
    for idx, (k, v) in enumerate(data.items()):
        if idx >= max_items:
            result["_truncated"] = True
            break
        key_lower = str(k).lower()
        if any(s in key_lower for s in SENSITIVE_KEYS):
            result[str(k)] = "[REDACTED]"
        elif isinstance(v, dict):
            result[str(k)] = redact_dict(v, max_items=10)
        elif isinstance(v, list):
            result[str(k)] = [sanitize_log_string(str(item), 128) for item in v[:20]]
        elif isinstance(v, str):
            result[str(k)] = sanitize_log_string(v, 256)
        else:
            result[str(k)] = v
    return result


class JsonLogFormatter(logging.Formatter):
    """Structured JSON formatter with UTC timestamp, service name, and correlation ID."""

    def __init__(self, service_name: str = "abm-backend") -> None:
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "logger": record.name,
            "correlation_id": get_correlation_id(),
            "message": sanitize_log_string(record.getMessage(), max_len=1024),
        }
        extra_meta = getattr(record, "extra_meta", None)
        if isinstance(extra_meta, dict):
            payload["meta"] = redact_dict(extra_meta)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO", service_name: str = "abm-backend") -> None:
    """Configure root logger for structured JSON output without leaking secrets."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter(service_name=service_name))
    root.handlers.clear()
    root.addHandler(handler)
    for noisy in ("uvicorn.access", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named standard library logger."""
    return logging.getLogger(name)


