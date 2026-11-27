from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.schemas.common import CamelModel


class RunnerReadinessOut(CamelModel):
    overall_ready: bool
    controller_status: str
    worker_queue_status: str
    runner_mode: str
    scope_validation_outcome: str
    dns_host_policy_outcome: str
    budget_validation_outcome: str
    local_lab_exception_active: bool
    last_health_check_at: datetime
    diagnostic_message: str


class PreflightRequest(CamelModel):
    target_id: str = Field(..., min_length=1)
    scope_version_id: str | None = None
    modules: list[str] = Field(default_factory=lambda: ["url_discovery"], min_length=1)


class PreflightBlockerOut(CamelModel):
    code: str
    severity: Literal["blocking", "warning"]
    title: str
    detail: str
    remediation_href: str | None = None
    remediation_label: str | None = None


class PreflightResultOut(CamelModel):
    can_launch: bool
    target_id: str
    environment: str
    scope_version_label: str | None = None
    blockers: list[PreflightBlockerOut]
    runner_readiness: RunnerReadinessOut
    checked_at: datetime


class AssessmentCreateRequest(CamelModel):
    target_id: str = Field(..., min_length=1)
    scope_version_id: str | None = None
    modules: list[str] = Field(default_factory=lambda: ["url_discovery"], min_length=1)


class RunPhaseStepOut(CamelModel):
    id: str
    label: str
    status: str
    started_at: str | None = None
    completed_at: str | None = None
    detail: str | None = None


class RunLogEventOut(CamelModel):
    id: str
    event_type: str
    timestamp: datetime
    level: str
    phase: str
    message: str
    correlation_id: str
    detail: dict[str, Any] | None = None


class AssessmentRunOut(CamelModel):
    id: str
    run_code: str
    project_id: str
    project_name: str
    target_id: str
    target_name: str
    base_url: str
    environment: str
    scope_version_id: str
    scope_version_label: str
    plan_hash: str
    modules: list[str]
    state: str
    current_phase: str
    progress_percent: int | None = None
    started_at: datetime
    completed_at: datetime | None = None
    duration_seconds: int | None = None
    request_count: int
    request_budget: int
    discovered_urls_count: int
    in_scope_urls_count: int
    excluded_urls_count: int
    duplicate_urls_count: int
    blocked_redirects_count: int
    operations_count: int = 0
    findings_count: int = 0
    observations_count: int = 0
    initiated_by: str
    selected_identity_ids: list[str] = Field(default_factory=list)
    phases: list[RunPhaseStepOut] = Field(default_factory=list)
    events: list[RunLogEventOut] = Field(default_factory=list)
    retained_summary: str | None = None


class AssessmentDetailOut(CamelModel):
    run: AssessmentRunOut
    discovered_urls: list[dict[str, Any]]
    findings: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)

