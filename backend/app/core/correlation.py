from __future__ import annotations

import uuid
from contextvars import ContextVar

_correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """Return the active request/task correlation ID, generating one if unset."""
    cid = _correlation_id_ctx.get()
    if not cid:
        cid = f"req-{uuid.uuid4().hex[:12]}"
        _correlation_id_ctx.set(cid)
    return cid


def set_correlation_id(cid: str | None) -> str:
    """Set or generate a sanitized correlation ID for the current execution context."""
    cleaned = (cid or "").strip()
    if not cleaned or len(cleaned) > 64 or any(c for c in cleaned if not (c.isalnum() or c in "-_.")):
        cleaned = f"req-{uuid.uuid4().hex[:12]}"
    _correlation_id_ctx.set(cleaned)
    return cleaned

