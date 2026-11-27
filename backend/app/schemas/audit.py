from __future__ import annotations

from datetime import datetime
from typing import Any

from app.schemas.common import CamelModel


class AuditLogEntryOut(CamelModel):
    id: str
    timestamp: datetime
    actor_email: str
    actor_role: str
    action: str
    resource_type: str
    resource_id: str
    project_id: str | None = None
    project_name: str | None = None
    target_id: str | None = None
    target_name: str | None = None
    outcome: str
    correlation_id: str
    correlation_run_id: str | None = None
    detail: str
    metadata: dict[str, Any] = {}
    integrity_hash: str

