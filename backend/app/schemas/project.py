from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.audit import AuditLogEntryOut
from app.schemas.common import CamelModel


class ProjectCreateRequest(CamelModel):
    name: str = Field(..., min_length=3, max_length=80)
    description: str = Field(..., min_length=10, max_length=400)
    workspace_id: str = Field(..., min_length=1)
    environment_context: str = Field(default="local_lab", max_length=40)


class ProjectUpdateRequest(CamelModel):
    name: str | None = Field(default=None, min_length=3, max_length=80)
    description: str | None = Field(default=None, min_length=10, max_length=400)


class ProjectMemberOut(CamelModel):
    user_id: str
    display_name: str
    email: str
    role: str
    added_at: datetime
    can_approve_target: bool
    can_approve_scope: bool
    can_launch_assessment: bool


class ProjectOut(CamelModel):
    id: str
    workspace_id: str
    name: str
    description: str
    owner_id: str
    owner_name: str
    current_user_role: str
    target_count: int = 0
    latest_run_id: str | None = None
    latest_run_state: str | None = None
    updated_at: datetime
    created_at: datetime


class ProjectDetailOut(CamelModel):
    project: ProjectOut
    members: list[ProjectMemberOut]
    targets: list[dict]
    runs: list[dict]
    audit_logs: list[AuditLogEntryOut]

