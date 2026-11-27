from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel

HttpMethodLiteral = Literal["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]


class ScopeBudgetsSchema(CamelModel):
    max_crawl_depth: int = Field(default=3, ge=1, le=8)
    max_requests: int = Field(default=400, ge=1, le=5000)
    per_host_rate_rps: float = Field(default=2.0, ge=0.5, le=20.0)
    concurrency: int = Field(default=2, ge=1, le=10)
    max_wall_clock_seconds: int = Field(default=240, ge=10, le=3600)


class ScopeCreateRequest(CamelModel):
    allowed_hosts: list[str] = Field(..., min_length=1, max_length=25)
    allowed_ports: list[int] = Field(..., min_length=1, max_length=10)
    allowed_path_prefixes: list[str] = Field(default_factory=lambda: ["/"])
    excluded_paths: list[str] = Field(default_factory=list)
    follow_redirects_in_scope_only: bool = True
    allowed_methods: list[HttpMethodLiteral] = Field(default_factory=lambda: ["GET", "HEAD", "OPTIONS"])
    state_changing_methods_enabled: bool = False
    block_private_and_link_local: bool = True
    local_lab_exception_active: bool = False
    budgets: ScopeBudgetsSchema
    change_summary: str = Field(default="Updated target scope boundaries and budgets.", max_length=500)


class ScopeDecisionRequest(CamelModel):
    decision: Literal["approved", "rejected"]
    notes: str | None = Field(default=None, max_length=500)


class ScopePreviewOut(CamelModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    normalized_preview: str
    policy_hash: str


class ScopeVersionOut(CamelModel):
    id: str
    target_id: str
    version_number: int
    version_label: str
    approval_state: str
    allowed_hosts: list[str]
    allowed_ports: list[int]
    allowed_path_prefixes: list[str]
    excluded_paths: list[str]
    follow_redirects_in_scope_only: bool
    allowed_methods: list[str]
    state_changing_methods_enabled: bool
    block_private_and_link_local: bool
    local_lab_exception_active: bool
    budgets: ScopeBudgetsSchema
    normalized_preview: str
    policy_hash: str
    created_by: str
    created_at: datetime
    approved_by: str | None = None
    approved_at: datetime | None = None
    change_summary: str

