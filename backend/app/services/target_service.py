"""Target registration, URL normalization preview, and authorization governance."""
from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import sha256_canonical_json, utc_now
from app.models.assessment import AssessmentRun
from app.models.project import Project
from app.models.scope import ScopeVersion
from app.models.target import AuthorizationRecord, Target
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.runner.url_normalization import UrlNormalizationError, normalize_url
from app.services.audit_service import append_audit
from app.services.permissions import (
    APPROVER_ROLES,
    OPERATOR_ROLES,
    READ_ROLES,
    require_project_access,
)


def preview_normalize_target_url(raw_url: str) -> dict:
    try:
        norm = normalize_url(raw_url)
        return {
            "valid": True,
            "normalized": norm.inventory_url,
            "scheme": norm.scheme,
            "host": norm.hostname,
            "port": norm.port,
            "base_path": norm.path,
            "reason": None,
        }
    except UrlNormalizationError as exc:
        return {
            "valid": False,
            "normalized": "",
            "scheme": "",
            "host": "",
            "port": None,
            "base_path": "/",
            "reason": str(exc),
        }


def serialize_auth_record(db: Session, rec: AuthorizationRecord) -> dict:
    decl_user = db.scalar(select(User).where(User.id == rec.declaring_user_id))
    rev_user = (
        db.scalar(select(User).where(User.id == rec.reviewed_by_user_id))
        if rec.reviewed_by_user_id
        else None
    )
    return {
        "id": rec.id,
        "target_id": rec.target_id,
        "permission_reference": rec.permission_reference,
        "ownership_declaration": rec.ownership_declaration,
        "declaration_hash": rec.declaration_hash,
        "declaring_user": decl_user.email if decl_user else rec.declaring_user_id,
        "reviewed_by": rev_user.email if rev_user else None,
        "state": rec.state,
        "scope_version_used": rec.scope_version_label,
        "timestamp": rec.created_at,
        "effective_at": rec.effective_at,
        "expires_at": rec.expires_at,
        "revoked_at": rec.revoked_at,
        "notes": rec.notes,
    }


def serialize_target(db: Session, target: Target) -> dict:
    project = db.scalar(select(Project).where(Project.id == target.project_id))
    scope = (
        db.scalar(select(ScopeVersion).where(ScopeVersion.id == target.current_scope_version_id))
        if target.current_scope_version_id
        else None
    )
    latest_run = db.scalar(
        select(AssessmentRun)
        .where(AssessmentRun.target_id == target.id)
        .order_by(AssessmentRun.created_at.desc())
        .limit(1)
    )
    return {
        "id": target.id,
        "project_id": target.project_id,
        "project_name": project.name if project else "Unknown",
        "display_name": target.display_name,
        "base_url": target.base_url,
        "normalized_base_url": target.normalized_base_url,
        "scheme": target.scheme,
        "hostname": target.hostname,
        "port": target.port,
        "base_path": target.base_path,
        "environment": target.environment,
        "description": target.description,
        "authorization_status": target.authorization_status,
        "ownership_declaration": target.ownership_declaration,
        "permission_reference": target.permission_reference,
        "current_scope_version_id": target.current_scope_version_id,
        "current_scope_version_label": scope.version_label if scope else None,
        "current_scope_approval_state": scope.approval_state if scope else None,
        "latest_run_id": latest_run.id if latest_run else None,
        "latest_run_state": latest_run.state if latest_run else None,
        "last_authorization_review_at": target.last_authorization_review_at,
        "created_at": target.created_at,
    }


def get_target_or_404(
    db: Session,
    *,
    user: User,
    target_id: str,
    allowed_roles: set[str] = READ_ROLES,
) -> tuple[Target, Project, str]:
    target = db.scalar(select(Target).where(Target.id == target_id))
    if target is None:
        raise AppError(code="NOT_FOUND", message="Target not found.", status_code=404)
    project, role = require_project_access(
        db, user, target.project_id, allowed_roles=allowed_roles
    )
    return target, project, role


def list_targets(db: Session, *, user: User, project_id: str | None = None) -> list[dict]:
    if project_id:
        require_project_access(db, user, project_id, allowed_roles=READ_ROLES)
        targets = list(
            db.scalars(
                select(Target)
                .where(Target.project_id == project_id)
                .order_by(Target.created_at.desc())
            )
        )
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
        targets = list(
            db.scalars(
                select(Target)
                .where(Target.workspace_id.in_(ws_ids))
                .order_by(Target.created_at.desc())
            )
        )
    return [serialize_target(db, t) for t in targets]


def create_target(
    db: Session,
    *,
    user: User,
    project_id: str,
    display_name: str,
    base_url: str,
    environment: str,
    description: str,
    ownership_declaration: str,
    permission_reference: str,
) -> dict:
    project, _ = require_project_access(db, user, project_id, allowed_roles=OPERATOR_ROLES)
    try:
        norm = normalize_url(base_url)
    except UrlNormalizationError as exc:
        raise AppError(code="INVALID_TARGET_URL", message=str(exc), status_code=422) from exc

    target = Target(
        workspace_id=project.workspace_id,
        project_id=project.id,
        display_name=display_name.strip(),
        description=description.strip(),
        base_url=base_url.strip(),
        normalized_base_url=norm.inventory_url,
        scheme=norm.scheme,
        hostname=norm.hostname,
        port=norm.port,
        base_path=norm.path,
        environment=environment,
        authorization_status="pending_review",
        ownership_declaration=ownership_declaration.strip(),
        permission_reference=permission_reference.strip(),
    )
    db.add(target)
    db.flush()

    decl_hash = sha256_canonical_json(
        json.dumps(
            {
                "target_id": target.id,
                "normalized_base_url": target.normalized_base_url,
                "ownership_declaration": target.ownership_declaration,
                "permission_reference": target.permission_reference,
                "declaring_user_id": user.id,
            },
            sort_keys=True,
        )
    )
    db.add(
        AuthorizationRecord(
            target_id=target.id,
            declaring_user_id=user.id,
            permission_reference=target.permission_reference,
            ownership_declaration=target.ownership_declaration,
            declaration_hash=decl_hash,
            state="pending_review",
        )
    )
    append_audit(
        db,
        action="TARGET_REGISTERED",
        resource_type="target",
        resource_id=target.id,
        detail=f"Registered target '{target.display_name}' ({target.normalized_base_url}) as pending_review.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
    )
    db.commit()
    db.refresh(target)
    return serialize_target(db, target)


def get_target_detail(db: Session, *, user: User, target_id: str) -> dict:
    target, _, _ = get_target_or_404(db, user=user, target_id=target_id, allowed_roles=READ_ROLES)
    from app.services.scope_service import serialize_scope_version
    from app.services.assessment_service import serialize_run_summary

    auths = [
        serialize_auth_record(db, r)
        for r in db.scalars(
            select(AuthorizationRecord)
            .where(AuthorizationRecord.target_id == target.id)
            .order_by(AuthorizationRecord.created_at.desc())
        )
    ]
    scopes = [
        serialize_scope_version(db, s)
        for s in db.scalars(
            select(ScopeVersion)
            .where(ScopeVersion.target_id == target.id)
            .order_by(ScopeVersion.version_number.desc())
        )
    ]
    runs = [
        serialize_run_summary(db, r)
        for r in db.scalars(
            select(AssessmentRun)
            .where(AssessmentRun.target_id == target.id)
            .order_by(AssessmentRun.created_at.desc())
        )
    ]
    return {
        "target": serialize_target(db, target),
        "authorizations": auths,
        "scope_versions": scopes,
        "runs": runs,
    }


def update_target(
    db: Session,
    *,
    user: User,
    target_id: str,
    display_name: str | None = None,
    base_url: str | None = None,
    environment: str | None = None,
    description: str | None = None,
) -> dict:
    target, project, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=OPERATOR_ROLES
    )
    if display_name is not None:
        target.display_name = display_name.strip()
    if description is not None:
        target.description = description.strip()
    if environment is not None:
        target.environment = environment
    if base_url is not None:
        try:
            norm = normalize_url(base_url)
        except UrlNormalizationError as exc:
            raise AppError(code="INVALID_TARGET_URL", message=str(exc), status_code=422) from exc
        if norm.inventory_url != target.normalized_base_url:
            target.base_url = base_url.strip()
            target.normalized_base_url = norm.inventory_url
            target.scheme = norm.scheme
            target.hostname = norm.hostname
            target.port = norm.port
            target.base_path = norm.path
            target.authorization_status = "needs_revalidation"

    target.updated_at = utc_now()
    append_audit(
        db,
        action="TARGET_IDENTITY_UPDATED",
        resource_type="target",
        resource_id=target.id,
        detail=f"Updated target '{target.display_name}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
    )
    db.commit()
    db.refresh(target)
    return serialize_target(db, target)


def delete_target(db: Session, *, user: User, target_id: str) -> dict:
    target, project, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=APPROVER_ROLES
    )
    active_run = db.scalar(
        select(AssessmentRun).where(
            AssessmentRun.target_id == target.id,
            AssessmentRun.state.in_(["queued", "running", "cancellation_requested"]),
        )
    )
    if active_run is not None:
        raise AppError(
            code="TARGET_HAS_ACTIVE_RUN",
            message="Cannot delete target while an assessment run is active.",
            status_code=409,
        )
    target_name = target.display_name
    db.delete(target)
    append_audit(
        db,
        action="target.deleted",
        resource_type="target",
        resource_id=target_id,
        detail=f"Deleted target '{target_name}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
    )
    db.commit()
    return {"deleted": True, "id": target_id}


def submit_authorization_declaration(
    db: Session,
    *,
    user: User,
    target_id: str,
    ownership_declaration: str,
    permission_reference: str,
    notes: str | None = None,
    expires_at: datetime | None = None,
) -> dict:
    target, project, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=OPERATOR_ROLES
    )
    target.ownership_declaration = ownership_declaration.strip()
    target.permission_reference = permission_reference.strip()
    target.authorization_status = "pending_review"

    decl_hash = sha256_canonical_json(
        json.dumps(
            {
                "target_id": target.id,
                "normalized_base_url": target.normalized_base_url,
                "ownership_declaration": target.ownership_declaration,
                "permission_reference": target.permission_reference,
                "declaring_user_id": user.id,
            },
            sort_keys=True,
        )
    )
    rec = AuthorizationRecord(
        target_id=target.id,
        declaring_user_id=user.id,
        permission_reference=target.permission_reference,
        ownership_declaration=target.ownership_declaration,
        declaration_hash=decl_hash,
        state="pending_review",
        notes=notes,
        expires_at=expires_at,
    )
    db.add(rec)
    append_audit(
        db,
        action="target.authorization_submitted",
        resource_type="authorization_record",
        resource_id=rec.id,
        detail="Submitted target ownership/authorization declaration for review.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
    )
    db.commit()
    db.refresh(rec)
    return serialize_auth_record(db, rec)


def decide_target_authorization(
    db: Session,
    *,
    user: User,
    target_id: str,
    next_state: str,
    notes: str = "",
    expires_at: datetime | None = None,
) -> dict:
    target, project, _ = get_target_or_404(
        db, user=user, target_id=target_id, allowed_roles=APPROVER_ROLES
    )
    now = utc_now()
    target.authorization_status = next_state
    target.last_authorization_review_at = now

    latest_rec = db.scalar(
        select(AuthorizationRecord)
        .where(AuthorizationRecord.target_id == target.id)
        .order_by(AuthorizationRecord.created_at.desc())
        .limit(1)
    )
    decl_hash = sha256_canonical_json(
        json.dumps(
            {
                "target_id": target.id,
                "normalized_base_url": target.normalized_base_url,
                "ownership_declaration": target.ownership_declaration,
                "permission_reference": target.permission_reference,
                "decision": next_state,
                "reviewer": user.id,
            },
            sort_keys=True,
        )
    )
    rec = AuthorizationRecord(
        target_id=target.id,
        declaring_user_id=latest_rec.declaring_user_id if latest_rec else user.id,
        reviewed_by_user_id=user.id,
        permission_reference=target.permission_reference,
        ownership_declaration=target.ownership_declaration,
        declaration_hash=decl_hash,
        state=next_state,
        notes=notes or None,
        effective_at=now if next_state == "authorized" else None,
        expires_at=expires_at,
        revoked_at=now if next_state == "revoked" else None,
    )
    db.add(rec)
    append_audit(
        db,
        action="TARGET_AUTHORIZATION_UPDATED",
        resource_type="target",
        resource_id=target.id,
        detail=f"Authorization decision set to '{next_state}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
        target_id=target.id,
    )
    db.commit()
    db.refresh(target)
    return serialize_target(db, target)
