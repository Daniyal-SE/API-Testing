"""Domain exceptions for Redis/RQ dispatch and orchestration."""
from __future__ import annotations


class QueueUnavailableError(RuntimeError):
    """Raised when Redis/RQ cannot accept a job dispatch."""


class InvalidJobPayloadError(ValueError):
    """Raised when a job payload contains forbidden fields or invalid identifiers."""
