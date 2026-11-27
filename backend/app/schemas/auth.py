from __future__ import annotations

from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel


class AuthCapabilitiesOut(CamelModel):
    registration_mode: Literal["disabled", "invite_only", "self_service"]
    password_recovery_enabled: bool = False
    ai_advisor_enabled: bool = False
    semester8_enabled: bool = False


class UserProfileOut(CamelModel):
    id: str
    email: str
    username: str
    display_name: str
    role: str
    workspace_ids: list[str]
    department: str | None = None


class WorkspaceOut(CamelModel):
    id: str
    name: str
    slug: str
    description: str
    semester_label: str
    member_count: int


class LoginRequest(CamelModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=256)


SrsRoleLiteral = Literal["project_owner", "security_tester", "supervisor_evaluator", "system_admin"]
WorkspaceOptionLiteral = Literal["create_new", "join_lab"]


class RegisterRequest(CamelModel):
    email: EmailStr
    username: str | None = Field(default=None, min_length=3, max_length=64)
    display_name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=8, max_length=256)
    department: str | None = Field(default=None, max_length=120)
    role: SrsRoleLiteral = "project_owner"
    workspace_option: WorkspaceOptionLiteral = "create_new"
    workspace_name: str | None = Field(default=None, max_length=120)


class AuthSessionOut(CamelModel):
    user: UserProfileOut | None = None
    session_expired: bool = False
    capabilities: AuthCapabilitiesOut
    workspaces: list[WorkspaceOut] = Field(default_factory=list)
    csrf_token: str | None = None

