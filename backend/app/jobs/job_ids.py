"""Deterministic job IDs and strict non-secret payload validation."""
from __future__ import annotations

from typing import Any

from app.jobs.exceptions import InvalidJobPayloadError

FORBIDDEN_PAYLOAD_KEYS = {
    "password",
    "token",
    "secret",
    "cookie",
    "authorization",
    "api_key",
    "session_id",
    "raw_url",
}


def build_assessment_job_id(run_id: str) -> str:
    if not run_id or not isinstance(run_id, str) or len(run_id) > 128:
        raise InvalidJobPayloadError("run_id must be a non-empty string <= 128 chars.")
    return f"abm-run-{run_id}"


def validate_job_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Ensure only minimal JSON-safe identifiers are passed to RQ; never secrets or ORM objects."""
    if "run_id" not in payload or not isinstance(payload["run_id"], str):
        raise InvalidJobPayloadError("Job payload requires string 'run_id'.")
    for key in payload:
        k_lower = str(key).lower()
        if any(bad in k_lower for bad in FORBIDDEN_PAYLOAD_KEYS):
            raise InvalidJobPayloadError(f"Forbidden key '{key}' in RQ job payload.")
    return {
        "run_id": payload["run_id"],
        "correlation_id": str(payload.get("correlation_id", "req-background")),
        "task_version": int(payload.get("task_version", 1)),
    }
