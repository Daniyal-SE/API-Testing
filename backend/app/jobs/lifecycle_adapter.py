"""Explicit mapping between RQ job statuses and canonical Semester 7 run states."""
from __future__ import annotations

RQ_TO_APP_STATE: dict[str, str] = {
    "queued": "queued",
    "scheduled": "queued",
    "deferred": "queued",
    "started": "running",
    "finished": "completed",
    "failed": "failed",
    "stopped": "cancelled",
    "canceled": "cancelled",
}

TERMINAL_APP_STATES = {"completed", "partial", "cancelled", "failed", "timed_out"}

ALLOWED_APP_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"running", "cancellation_requested", "cancelled", "failed", "interrupted"},
    "running": {"completed", "partial", "cancellation_requested", "cancelled", "failed", "timed_out", "interrupted"},
    "cancellation_requested": {"cancelled", "partial", "failed"},
    "interrupted": {"failed", "queued"},
    "completed": set(),
    "partial": set(),
    "cancelled": set(),
    "failed": set(),
    "timed_out": set(),
}


def map_rq_status_to_app_state(rq_status: str | None) -> str:
    if not rq_status:
        return "interrupted"
    return RQ_TO_APP_STATE.get(rq_status.lower(), "interrupted")


def is_valid_app_transition(current_state: str, next_state: str) -> bool:
    return next_state in ALLOWED_APP_TRANSITIONS.get(current_state, set())
