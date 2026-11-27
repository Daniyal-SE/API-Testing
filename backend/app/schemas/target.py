from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class UrlNormalizePreviewRequest(CamelModel):
    base_url: str = Field(..., min_length=1, max_length=512)


class UrlNormalizePreviewOut(CamelModel):
    valid: bool
    normalized: str = ""
    scheme: str = ""
    host: str = ""
    port: int | None = None
    base_path: str = "/"
    reason: str | None = None


class TargetCreateRequest(CamelModel):
    project_id: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=3, max_length=80)
    base_url: str = Field(..., min_length=7, max_length=512)
    environment: Literal["local_lab", "staging"]
    description: str = Field(..., min_length=5, max_length=300)
    ownership_declaration: str = Field(..., min_length=10, max_length=1000)
    permission_reference: str = Field(..., min_length=4, max_length=128)


class TargetUpdateRequest(CamelModel):
    display_name: str | None = Field(default=None, min_length=3, max_length=80)
    base_url: str | None = Field(default=None, min_length=7, max_length=512)
    environment: Literal["local_lab", "staging"] | None = None
    description: str | None = Field(default=None, min_length=5, max_length=300)


class AuthorizationDeclarationRequest(CamelModel):
    ownership_declaration: str = Field(..., min_length=10, max_length=1000)
    permission_reference: str = Field(..., min_length=4, max_length=128)
    notes: str | None = Field(default=None, max_length=1000)
    expires_at: datetime | None = None


class AuthorizationDecisionRequest(CamelModel):
    state: Literal["authorized", "revoked", "needs_revalidation"]
    notes: str = Field(default="", max_length=1000)
    expires_at: datetime | None = None


class TargetAuthorizationRecordOut(CamelModel):
    id: str
    target_id: str
    permission_reference: str
    ownership_declaration: str
    declaration_hash: str
    declaring_user: str
    reviewed_by: str | None = None
    state: str
    scope_version_used: str | None = None
    timestamp: datetime
    effective_at: datetime | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    notes: str | None = None


class TargetOut(CamelModel):
    id: str
    project_id: str
    project_name: str
    display_name: str
    base_url: str
    normalized_base_url: str
    scheme: str
    hostname: str
    port: int
    base_path: str
    environment: str
    description: str
    authorization_status: str
    ownership_declaration: str
    permission_reference: str
    current_scope_version_id: str | None = None
    current_scope_version_label: str | None = None
    current_scope_approval_state: str | None = None
    latest_run_id: str | None = None
    latest_run_state: str | None = None
    last_authorization_review_at: datetime | None = None
    created_at: datetime


from app.schemas.assessment import AssessmentRunOut
from app.schemas.scope import ScopeVersionOut


class TargetDetailOut(CamelModel):
    target: TargetOut
    authorizations: list[TargetAuthorizationRecordOut]
    scope_versions: list[ScopeVersionOut]
    runs: list[AssessmentRunOut]

