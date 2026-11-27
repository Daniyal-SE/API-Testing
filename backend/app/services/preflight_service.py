"""Preflight evaluation service enforcing safety, governance, and Semester 7 boundaries."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import utc_now
from app.models.assessment import AssessmentRun
from app.models.scope import ScopeVersion
from app.models.user import User
from app.queue.connection import ping_redis
from app.services.permissions import OPERATOR_ROLES
from app.services.target_service import get_target_or_404

SEMESTER_7_MODULES = {"url_discovery"}
SEMESTER_8_MODULES = {
    "zap_scan",
    "openapi_import",
    "contract_test",
    "behavior_mining",
    "bola_test",
    "report_gen",
}


def evaluate_preflight(
    db: Session,
    *,
    user: User,
    target_id: str,
    scope_version_id: str | None = None,
    modules: list[str] | None = None,
    settings: Settings | None = None,
) -> dict:
    cfg = settings or get_settings()
    req_modules = modules or ["url_discovery"]
    target, _, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=OPERATOR_ROLES
    )

    blockers: list[dict] = []

    # 1. Semester 8 module gate
    unsupported = [m for m in req_modules if m not in SEMESTER_7_MODULES]
    if unsupported:
        blockers.append(
            {
                "code": "SEMESTER_8_MODULE_DEFERRED",
                "severity": "blocking",
                "title": "Semester 8 Module Requested",
                "detail": f"Modules {unsupported} are deferred to Semester 8 and disabled in this build.",
            }
        )

    # 2. Target authorization gate
    if target.authorization_status != "authorized":
        blockers.append(
            {
                "code": "MISSING_TARGET_AUTHORIZATION",
                "severity": "blocking",
                "title": "Target Authorization Required",
                "detail": f"Target authorization status is '{target.authorization_status}'. Owner approval is required.",
                "remediation_href": f"/targets/{target.id}",
                "remediation_label": "Approve Target Authorization",
            }
        )

    # 3. Approved scope version gate
    scope: ScopeVersion | None = None
    if scope_version_id:
        scope = db.scalar(
            select(ScopeVersion).where(
                ScopeVersion.id == scope_version_id,
                ScopeVersion.target_id == target.id,
            )
        )
    elif target.current_scope_version_id:
        scope = db.scalar(
            select(ScopeVersion).where(ScopeVersion.id == target.current_scope_version_id)
        )
    else:
        scope = db.scalar(
            select(ScopeVersion)
            .where(
                ScopeVersion.target_id == target.id,
                ScopeVersion.approval_state == "approved",
            )
            .order_by(ScopeVersion.version_number.desc())
            .limit(1)
        )

    if scope is None or scope.approval_state != "approved":
        blockers.append(
            {
                "code": "NO_APPROVED_SCOPE",
                "severity": "blocking",
                "title": "Approved Scope Version Required",
                "detail": "No approved scope version is bound to this target.",
                "remediation_href": f"/targets/{target.id}",
                "remediation_label": "Approve Scope",
            }
        )

    # 4. Single active run per target guard
    active_run = db.scalar(
        select(AssessmentRun).where(
            AssessmentRun.target_id == target.id,
            AssessmentRun.state.in_(["queued", "running", "cancellation_requested"]),
        )
    )
    if active_run is not None:
        blockers.append(
            {
                "code": "ACTIVE_RUN_CONFLICT",
                "severity": "blocking",
                "title": "Active Assessment Already Running",
                "detail": f"Run {active_run.run_code} is currently '{active_run.state}'.",
            }
        )

    redis_ok = ping_redis()
    if not redis_ok:
        blockers.append(
            {
                "code": "QUEUE_UNAVAILABLE",
                "severity": "blocking",
                "title": "Worker Queue Unavailable",
                "detail": "Redis/RQ queue did not respond to health check.",
            }
        )

    can_launch = not any(b["severity"] == "blocking" for b in blockers)
    readiness = {
        "overall_ready": can_launch,
        "controller_status": "ready",
        "worker_queue_status": "connected" if redis_ok else "unavailable",
        "runner_mode": cfg.runner_mode,
        "scope_validation_outcome": "passed" if scope and scope.approval_state == "approved" else "blocked",
        "dns_host_policy_outcome": "passed" if target.hostname else "blocked",
        "budget_validation_outcome": "passed" if scope else "blocked",
        "local_lab_exception_active": bool(scope.local_lab_exception_active) if scope else False,
        "last_health_check_at": utc_now(),
        "diagnostic_message": "All Semester 7 preflight safety gates passed."
        if can_launch
        else "One or more preflight safety gates blocked launch.",
    }
    return {
        "can_launch": can_launch,
        "target_id": target.id,
        "environment": target.environment,
        "scope_version_label": scope.version_label if scope else None,
        "blockers": blockers,
        "runner_readiness": readiness,
        "checked_at": utc_now(),
    }


def get_runner_health(settings: Settings | None = None) -> dict:
    cfg = settings or get_settings()
    redis_ok = ping_redis()
    return {
        "overall_ready": redis_ok,
        "controller_status": "ready",
        "worker_queue_status": "connected" if redis_ok else "unavailable",
        "runner_mode": cfg.runner_mode,
        "scope_validation_outcome": "ready",
        "dns_host_policy_outcome": "ready",
        "budget_validation_outcome": "ready",
        "local_lab_exception_active": False,
        "last_health_check_at": utc_now(),
        "diagnostic_message": "Runner controller and queue are ready."
        if redis_ok
        else "Redis queue is unavailable.",
    }

