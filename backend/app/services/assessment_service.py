"""Assessment run lifecycle: create/enqueue, list, detail, events, cancel, delete, reconcile."""
from __future__ import annotations

import json
from datetime import timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.correlation import get_correlation_id
from app.core.errors import AppError
from app.core.security import sha256_canonical_json, utc_now
from app.models.assessment import AssessmentRun, RunEvent
from app.models.project import Project
from app.models.scope import ScopeVersion
from app.models.target import Target
from app.models.url_inventory import UrlInventory
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.queue.connection import get_rq_queue, set_cancel_signal
from app.services.audit_service import append_audit
from app.services.permissions import (
    APPROVER_ROLES,
    OPERATOR_ROLES,
    READ_ROLES,
    require_project_access,
)
from app.services.preflight_service import evaluate_preflight
from app.services.target_service import get_target_or_404


def _serialize_event(ev: RunEvent) -> dict:
    return {
        "id": ev.id,
        "event_type": ev.event_type,
        "timestamp": ev.created_at,
        "level": ev.level,
        "phase": ev.phase,
        "message": ev.message,
        "correlation_id": ev.correlation_id,
        "detail": ev.detail_json,
    }


def serialize_run_summary(db: Session, run: AssessmentRun) -> dict:
    project = db.scalar(select(Project).where(Project.id == run.project_id))
    target = db.scalar(select(Target).where(Target.id == run.target_id))
    scope = db.scalar(select(ScopeVersion).where(ScopeVersion.id == run.scope_version_id))
    initiator = db.scalar(select(User).where(User.id == run.initiated_by_id))
    events = list(
        db.scalars(
            select(RunEvent).where(RunEvent.run_id == run.id).order_by(RunEvent.created_at.asc())
        )
    )
    return {
        "id": run.id,
        "run_code": run.run_code,
        "project_id": run.project_id,
        "project_name": project.name if project else "Unknown",
        "target_id": run.target_id,
        "target_name": target.display_name if target else "Unknown",
        "base_url": target.normalized_base_url if target else "",
        "environment": target.environment if target else "local_lab",
        "scope_version_id": run.scope_version_id,
        "scope_version_label": scope.version_label if scope else "v1",
        "plan_hash": run.plan_hash,
        "modules": run.modules or ["url_discovery"],
        "state": run.state,
        "current_phase": run.current_phase,
        "progress_percent": run.progress_percent,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "duration_seconds": run.duration_seconds,
        "request_count": run.request_count,
        "request_budget": run.request_budget,
        "discovered_urls_count": run.discovered_urls_count,
        "in_scope_urls_count": run.in_scope_urls_count,
        "excluded_urls_count": run.excluded_urls_count,
        "duplicate_urls_count": run.duplicate_urls_count,
        "blocked_redirects_count": run.blocked_redirects_count,
        "operations_count": 0,
        "findings_count": 0,
        "observations_count": 0,
        "initiated_by": initiator.email if initiator else run.initiated_by_id,
        "selected_identity_ids": [],
        "phases": run.phases_json or [],
        "events": [_serialize_event(e) for e in events],
        "retained_summary": run.retained_summary,
    }


def _resolve_run_or_404(
    db: Session,
    *,
    user: User,
    run_identifier: str,
    allowed_roles: set[str] = READ_ROLES,
) -> tuple[AssessmentRun, Project, str]:
    run = db.scalar(
        select(AssessmentRun).where(
            or_(AssessmentRun.id == run_identifier, AssessmentRun.run_code == run_identifier)
        )
    )
    if run is None:
        raise AppError(code="NOT_FOUND", message="Assessment run not found.", status_code=404)
    project, role = require_project_access(
        db, user, run.project_id, allowed_roles=allowed_roles
    )
    return run, project, role


def list_runs(
    db: Session,
    *,
    user: User,
    project_id: str | None = None,
    state: str | None = None,
) -> list[dict]:
    if project_id:
        require_project_access(db, user, project_id, allowed_roles=READ_ROLES)
        stmt = select(AssessmentRun).where(AssessmentRun.project_id == project_id)
    else:
        ws_ids = list(
            db.scalars(
                select(WorkspaceMember.workspace_id).where(
                    WorkspaceMember.user_id == user.id,
                    WorkspaceMember.status == "active",
                )
            )
        )
        if not ws_ids:
            return []
        stmt = select(AssessmentRun).where(AssessmentRun.workspace_id.in_(ws_ids))

    if state:
        stmt = stmt.where(AssessmentRun.state == state)
    runs = list(db.scalars(stmt.order_by(AssessmentRun.created_at.desc())))
    return [serialize_run_summary(db, r) for r in runs]


def create_and_enqueue_run(
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
    target, project, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=OPERATOR_ROLES
    )
    preflight = evaluate_preflight(
        db,
        user=user,
        target_id=target_id,
        scope_version_id=scope_version_id,
        modules=req_modules,
        settings=cfg,
    )
    if not preflight["can_launch"]:
        blockers = preflight["blockers"]
        first = blockers[0]
        status_code = 409 if first["code"] == "ACTIVE_RUN_CONFLICT" else 422
        raise AppError(
            code=first["code"],
            message=first["detail"],
            status_code=status_code,
            details=blockers,
        )

    scope: ScopeVersion | None = None
    if scope_version_id:
        scope = db.scalar(select(ScopeVersion).where(ScopeVersion.id == scope_version_id))
    elif target.current_scope_version_id:
        scope = db.scalar(select(ScopeVersion).where(ScopeVersion.id == target.current_scope_version_id))
    assert scope is not None

    total_runs = int(db.scalar(select(func.count()).select_from(AssessmentRun)) or 0)
    run_code = f"RUN-{100 + total_runs + 1}"

    run_plan = {
        "target": {
            "id": target.id,
            "normalized_base_url": target.normalized_base_url,
            "scheme": target.scheme,
            "hostname": target.hostname,
            "port": target.port,
            "environment": target.environment,
        },
        "scope": {
            "id": scope.id,
            "version_label": scope.version_label,
            "policy_hash": scope.policy_hash,
            "allowed_hosts": scope.allowed_hosts,
            "allowed_ports": scope.allowed_ports,
            "allowed_path_prefixes": scope.allowed_path_prefixes,
            "excluded_paths": scope.excluded_paths,
            "allowed_methods": scope.allowed_methods,
            "follow_redirects_in_scope_only": scope.follow_redirects_in_scope_only,
            "block_private_and_link_local": scope.block_private_and_link_local,
            "local_lab_exception_active": scope.local_lab_exception_active,
            "budgets": scope.budgets,
        },
        "modules": req_modules,
    }
    plan_hash = sha256_canonical_json(json.dumps(run_plan, sort_keys=True))
    req_budget = int(scope.budgets.get("max_requests", 400))

    run = AssessmentRun(
        run_code=run_code,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
        scope_version_id=scope.id,
        initiated_by_id=user.id,
        modules=req_modules,
        run_plan_json=run_plan,
        plan_hash=plan_hash,
        state="queued",
        current_phase="Queued for Worker",
        phases_json=[
            {"id": "preflight", "label": "Preflight & Scope Snapshot", "status": "completed"},
            {"id": "crawl", "label": "Bounded Same-Origin URL Discovery", "status": "pending"},
            {"id": "persist", "label": "Inventory & Provenance Persistence", "status": "pending"},
        ],
        progress_percent=5,
        request_budget=req_budget,
    )
    db.add(run)
    db.flush()

    db.add(
        RunEvent(
            run_id=run.id,
            event_type="run.queued",
            level="info",
            phase="preflight",
            message=f"Assessment {run_code} queued with scope {scope.version_label} (plan={plan_hash[:12]}).",
            correlation_id=get_correlation_id(),
        )
    )
    append_audit(
        db,
        action="assessment.launched",
        resource_type="assessment_run",
        resource_id=run.id,
        detail=f"Launched assessment {run_code} on target '{target.display_name}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
        correlation_run_id=run.id,
        metadata={"plan_hash": plan_hash, "modules": req_modules},
    )
    db.commit()

    from app.queue.tasks import run_assessment_job

    queue = get_rq_queue()
    job = queue.enqueue(
        run_assessment_job,
        run.id,
        job_id=f"abm-run-{run.id}",
        job_timeout=int(scope.budgets.get("max_wall_clock_seconds", 240)) + 60,
    )
    run.rq_job_id = job.id
    db.commit()
    db.refresh(run)
    return serialize_run_summary(db, run)


def get_run_detail(db: Session, *, user: User, run_identifier: str) -> dict:
    run, _, _ = _resolve_run_or_404(db, user=user, run_identifier=run_identifier)
    from app.services.url_inventory_service import serialize_url_item

    urls = [
        serialize_url_item(db, u, run.run_code)
        for u in db.scalars(
            select(UrlInventory)
            .where(UrlInventory.run_id == run.id)
            .order_by(UrlInventory.first_seen_at.asc())
            .limit(200)
        )
    ]
    return {
        "run": serialize_run_summary(db, run),
        "discovered_urls": urls,
        "findings": [],
        "evidence": [],
    }


def list_run_events(db: Session, *, user: User, run_identifier: str) -> list[dict]:
    run, _, _ = _resolve_run_or_404(db, user=user, run_identifier=run_identifier)
    events = list(
        db.scalars(
            select(RunEvent).where(RunEvent.run_id == run.id).order_by(RunEvent.created_at.asc())
        )
    )
    return [_serialize_event(e) for e in events]


def request_run_cancellation(db: Session, *, user: User, run_identifier: str) -> dict:
    run, project, _ = _resolve_run_or_404(
        db, user=user, run_identifier=run_identifier, allowed_roles=OPERATOR_ROLES
    )
    if run.state not in {"queued", "running", "cancellation_requested"}:
        raise AppError(
            code="RUN_NOT_CANCELLABLE",
            message=f"Cannot cancel run in state '{run.state}'.",
            status_code=409,
        )
    set_cancel_signal(run.id)
    run.state = "cancellation_requested"
    run.current_phase = "Cancellation Requested"
    db.add(
        RunEvent(
            run_id=run.id,
            event_type="run.cancellation_requested",
            level="warning",
            phase="control",
            message="Operator requested run cancellation.",
            correlation_id=get_correlation_id(),
        )
    )
    append_audit(
        db,
        action="assessment.cancellation_requested",
        resource_type="assessment_run",
        resource_id=run.id,
        detail=f"Requested cancellation of {run.run_code}.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=run.target_id,
        correlation_run_id=run.id,
    )
    db.commit()
    db.refresh(run)
    return serialize_run_summary(db, run)


def delete_run(db: Session, *, user: User, run_identifier: str) -> dict:
    run, project, _ = _resolve_run_or_404(
        db, user=user, run_identifier=run_identifier, allowed_roles=APPROVER_ROLES
    )
    if run.state in {"queued", "running", "cancellation_requested"}:
        raise AppError(
            code="RUN_ACTIVE",
            message="Cannot delete an active run. Cancel it first.",
            status_code=409,
        )
    run_id = run.id
    run_code = run.run_code
    target_id = run.target_id
    db.delete(run)
    append_audit(
        db,
        action="assessment.deleted",
        resource_type="assessment_run",
        resource_id=run_id,
        detail=f"Deleted assessment run {run_code}.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target_id,
    )
    db.commit()
    return {"deleted": True, "id": run_id}


def reconcile_stale_runs(
    db: Session,
    *,
    settings: Settings | None = None,
    user: User | None = None,
) -> int:
    cfg = settings or get_settings()
    cutoff = utc_now() - timedelta(seconds=cfg.stale_run_timeout_seconds)
    active = list(
        db.scalars(
            select(AssessmentRun).where(
                AssessmentRun.state.in_(["queued", "running", "cancellation_requested"])
            )
        )
    )
    count = 0
    for run in active:
        ref_dt = run.heartbeat_at or run.started_at or run.created_at
        if ref_dt.tzinfo is None:
            ref_dt = ref_dt.replace(tzinfo=timezone.utc)
        if ref_dt < cutoff:
            run.state = "interrupted"
            run.current_phase = "Recovered Stale Run"
            run.completed_at = utc_now()
            run.retained_summary = "Run marked interrupted after exceeding stale heartbeat timeout."
            db.add(
                RunEvent(
                    run_id=run.id,
                    event_type="run.stale_reconciled",
                    level="warning",
                    phase="recovery",
                    message="Orphaned run reconciled to failed state.",
                    correlation_id=get_correlation_id(),
                )
            )
            append_audit(
                db,
                action="assessment.stale_reconciled",
                resource_type="assessment_run",
                resource_id=run.id,
                detail=f"Reconciled stale run {run.run_code}.",
                actor_user=user,
                workspace_id=run.workspace_id,
                project_id=run.project_id,
                target_id=run.target_id,
                correlation_run_id=run.id,
            )
            count += 1
    if count:
        db.commit()
    return count
