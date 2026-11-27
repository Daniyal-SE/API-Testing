"""Versioned scope configuration, preview, validation, and approval workflow."""
from __future__ import annotations

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import sha256_canonical_json, utc_now
from app.models.scope import ScopeVersion
from app.models.target import Target
from app.models.user import User
from app.schemas.scope import ScopeCreateRequest
from app.services.audit_service import append_audit
from app.services.permissions import APPROVER_ROLES, OPERATOR_ROLES, READ_ROLES
from app.services.target_service import get_target_or_404


def validate_scope_against_platform(payload: ScopeCreateRequest, settings: Settings) -> list[str]:
    errors: list[str] = []
    if not payload.allowed_hosts:
        errors.append("At least one allowed host is required.")
    if any("*" in h for h in payload.allowed_hosts):
        errors.append("Wildcard hostnames are prohibited.")
    if not payload.allowed_ports:
        errors.append("At least one allowed port is required.")
    if any(p < 1 or p > 65535 for p in payload.allowed_ports):
        errors.append("Allowed ports must be between 1 and 65535.")
    if payload.budgets.max_crawl_depth > settings.platform_max_crawl_depth:
        errors.append(
            f"maxCrawlDepth exceeds platform ceiling ({settings.platform_max_crawl_depth})."
        )
    if payload.budgets.max_requests > settings.platform_max_requests:
        errors.append(f"maxRequests exceeds platform ceiling ({settings.platform_max_requests}).")
    if payload.budgets.per_host_rate_rps > settings.platform_max_rate_rps:
        errors.append(
            f"perHostRateRps exceeds platform ceiling ({settings.platform_max_rate_rps})."
        )
    if payload.budgets.concurrency > settings.platform_max_concurrency:
        errors.append(
            f"concurrency exceeds platform ceiling ({settings.platform_max_concurrency})."
        )
    if payload.budgets.max_wall_clock_seconds > settings.platform_max_wall_clock_seconds:
        errors.append(
            f"maxWallClockSeconds exceeds platform ceiling ({settings.platform_max_wall_clock_seconds})."
        )
    return errors


def build_normalized_scope_preview(payload: ScopeCreateRequest) -> tuple[str, str, dict]:
    hosts = sorted({h.strip().lower() for h in payload.allowed_hosts if h.strip()})
    ports = sorted(set(payload.allowed_ports))
    prefixes = sorted({p.strip() if p.strip().startswith("/") else f"/{p.strip()}" for p in payload.allowed_path_prefixes})
    excluded = sorted({p.strip() if p.strip().startswith("/") else f"/{p.strip()}" for p in payload.excluded_paths})
    methods = sorted({m.upper() for m in payload.allowed_methods})
    budgets_dict = payload.budgets.model_dump()

    canonical_obj = {
        "allowed_hosts": hosts,
        "allowed_ports": ports,
        "allowed_path_prefixes": prefixes,
        "excluded_paths": excluded,
        "follow_redirects_in_scope_only": payload.follow_redirects_in_scope_only,
        "allowed_methods": methods,
        "state_changing_methods_enabled": payload.state_changing_methods_enabled,
        "block_private_and_link_local": payload.block_private_and_link_local,
        "local_lab_exception_active": payload.local_lab_exception_active,
        "budgets": budgets_dict,
    }
    canonical_json = json.dumps(canonical_obj, sort_keys=True)
    policy_hash = sha256_canonical_json(canonical_json)
    preview_text = (
        f"HOSTS={','.join(hosts)} | PORTS={','.join(map(str, ports))} | "
        f"PREFIXES={','.join(prefixes)} | EXCLUDED={','.join(excluded) or 'none'} | "
        f"METHODS={','.join(methods)} | MAX_REQ={payload.budgets.max_requests} | "
        f"MAX_DEPTH={payload.budgets.max_crawl_depth}"
    )
    return preview_text, policy_hash, canonical_obj


def serialize_scope_version(db: Session, sv: ScopeVersion) -> dict:
    creator = db.scalar(select(User).where(User.id == sv.created_by_id))
    approver = (
        db.scalar(select(User).where(User.id == sv.approved_by_id)) if sv.approved_by_id else None
    )
    return {
        "id": sv.id,
        "target_id": sv.target_id,
        "version_number": sv.version_number,
        "version_label": sv.version_label,
        "approval_state": sv.approval_state,
        "allowed_hosts": sv.allowed_hosts,
        "allowed_ports": sv.allowed_ports,
        "allowed_path_prefixes": sv.allowed_path_prefixes,
        "excluded_paths": sv.excluded_paths,
        "follow_redirects_in_scope_only": sv.follow_redirects_in_scope_only,
        "allowed_methods": sv.allowed_methods,
        "state_changing_methods_enabled": sv.state_changing_methods_enabled,
        "block_private_and_link_local": sv.block_private_and_link_local,
        "local_lab_exception_active": sv.local_lab_exception_active,
        "budgets": sv.budgets,
        "normalized_preview": sv.normalized_preview,
        "policy_hash": sv.policy_hash,
        "created_by": creator.email if creator else sv.created_by_id,
        "created_at": sv.created_at,
        "approved_by": approver.email if approver else None,
        "approved_at": sv.approved_at,
        "change_summary": sv.change_summary,
    }


def list_target_scopes(db: Session, *, user: User, target_id: str) -> list[dict]:
    target, _, _ = get_target_or_404(db, user=user, target_id=target_id, allowed_roles=READ_ROLES)
    rows = list(
        db.scalars(
            select(ScopeVersion)
            .where(ScopeVersion.target_id == target.id)
            .order_by(ScopeVersion.version_number.desc())
        )
    )
    return [serialize_scope_version(db, r) for r in rows]


def create_scope_version(
    db: Session,
    *,
    user: User,
    target_id: str,
    payload: ScopeCreateRequest,
    settings: Settings | None = None,
) -> dict:
    cfg = settings or get_settings()
    target, project, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=OPERATOR_ROLES
    )
    errors = validate_scope_against_platform(payload, cfg)
    if errors:
        raise AppError(
            code="INVALID_SCOPE_POLICY",
            message="; ".join(errors),
            status_code=422,
        )

    preview_text, policy_hash, canonical_obj = build_normalized_scope_preview(payload)
    max_ver = db.scalar(
        select(func.max(ScopeVersion.version_number)).where(ScopeVersion.target_id == target.id)
    )
    next_num = (int(max_ver) if max_ver is not None else 0) + 1
    version_label = f"v{next_num}"

    sv = ScopeVersion(
        target_id=target.id,
        version_number=next_num,
        version_label=version_label,
        approval_state="pending_approval",
        allowed_hosts=canonical_obj["allowed_hosts"],
        allowed_ports=canonical_obj["allowed_ports"],
        allowed_path_prefixes=canonical_obj["allowed_path_prefixes"],
        excluded_paths=canonical_obj["excluded_paths"],
        allowed_methods=canonical_obj["allowed_methods"],
        follow_redirects_in_scope_only=canonical_obj["follow_redirects_in_scope_only"],
        state_changing_methods_enabled=canonical_obj["state_changing_methods_enabled"],
        block_private_and_link_local=canonical_obj["block_private_and_link_local"],
        local_lab_exception_active=canonical_obj["local_lab_exception_active"],
        budgets=canonical_obj["budgets"],
        normalized_preview=preview_text,
        policy_hash=policy_hash,
        change_summary=payload.change_summary.strip(),
        created_by_id=user.id,
    )
    db.add(sv)
    db.flush()

    append_audit(
        db,
        action="scope.version_created",
        resource_type="scope_version",
        resource_id=sv.id,
        detail=f"Created scope {version_label} for target '{target.display_name}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
        metadata={"policy_hash": policy_hash, "version_label": version_label},
    )
    db.commit()
    db.refresh(sv)
    return serialize_scope_version(db, sv)


def decide_scope_version(
    db: Session,
    *,
    user: User,
    scope_id: str,
    decision: str,
) -> dict:
    sv = db.scalar(select(ScopeVersion).where(ScopeVersion.id == scope_id))
    if sv is None:
        raise AppError(code="NOT_FOUND", message="Scope version not found.", status_code=404)
    target, project, _ = get_target_or_404(
        db, user=user, target_id=sv.target_id, allowed_roles=APPROVER_ROLES
    )
    if sv.approval_state != "pending_approval":
        raise AppError(
            code="SCOPE_ALREADY_DECIDED",
            message=f"Scope {sv.version_label} is already in state '{sv.approval_state}'.",
            status_code=409,
        )

    now = utc_now()
    if decision == "approved":
        # Supersede any previously approved scopes on this target
        prev_approved = list(
            db.scalars(
                select(ScopeVersion).where(
                    ScopeVersion.target_id == target.id,
                    ScopeVersion.approval_state == "approved",
                    ScopeVersion.id != sv.id,
                )
            )
        )
        for prev in prev_approved:
            prev.approval_state = "superseded"
        sv.approval_state = "approved"
        sv.approved_by_id = user.id
        sv.approved_at = now
        target.current_scope_version_id = sv.id
    elif decision == "rejected":
        sv.approval_state = "rejected"
        sv.approved_by_id = user.id
        sv.approved_at = now
    else:
        raise AppError(code="INVALID_DECISION", message="Unsupported scope decision.", status_code=422)

    append_audit(
        db,
        action=f"SCOPE_{decision.upper()}",
        resource_type="scope_version",
        resource_id=sv.id,
        detail=f"Scope {sv.version_label} {decision}.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
        metadata={"policy_hash": sv.policy_hash},
    )
    db.commit()
    db.refresh(sv)
    return serialize_scope_version(db, sv)
