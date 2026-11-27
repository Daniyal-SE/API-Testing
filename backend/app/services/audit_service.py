"""Append-only security and governance audit log service."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.correlation import get_correlation_id
from app.core.logging import redact_dict, sanitize_log_string
from app.core.security import sha256_canonical_json, utc_now
from app.models.audit import AuditLog
from app.models.project import Project
from app.models.target import Target
from app.models.user import User
from app.models.workspace import WorkspaceMember


def append_audit(
    db: Session,
    *,
    action: str,
    resource_type: str,
    resource_id: str,
    detail: str,
    actor_user: User | None = None,
    actor_user_id: str | None = None,
    actor_email: str | None = None,
    actor_role: str | None = None,
    workspace_id: str | None = None,
    project_id: str | None = None,
    target_id: str | None = None,
    outcome: str = "success",
    correlation_run_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    """Append an immutable audit log entry with integrity hash."""
    resolved_email = actor_email or (actor_user.email if actor_user else "system@abm.local")
    resolved_role = actor_role or (actor_user.global_role if actor_user else "system")
    cid = get_correlation_id()
    safe_detail = sanitize_log_string(detail, max_len=1000)
    safe_meta = redact_dict(metadata or {})
    now = utc_now()

    canonical = json.dumps(
        {
            "action": action,
            "actor_email": resolved_email,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "outcome": outcome,
            "detail": safe_detail,
            "metadata": safe_meta,
            "correlation_id": cid,
            "timestamp": now.isoformat(),
        },
        sort_keys=True,
        default=str,
    )
    integrity_hash = sha256_canonical_json(canonical)

    entry = AuditLog(
        workspace_id=workspace_id,
        project_id=project_id,
        target_id=target_id,
        actor_user_id=actor_user_id or (actor_user.id if actor_user else None),
        actor_email=resolved_email,
        actor_role=resolved_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        correlation_id=cid,
        correlation_run_id=correlation_run_id,
        detail=safe_detail,
        metadata_json=safe_meta,
        integrity_hash=integrity_hash,
        created_at=now,
    )
    db.add(entry)
    db.flush()
    return entry


def serialize_audit_entry(
    db: Session,
    entry: AuditLog,
    *,
    project_names: dict[str, str] | None = None,
    target_names: dict[str, str] | None = None,
) -> dict[str, Any]:
    proj_name = None
    if entry.project_id:
        if project_names is not None and entry.project_id in project_names:
            proj_name = project_names[entry.project_id]
        else:
            proj_name = db.scalar(select(Project.name).where(Project.id == entry.project_id))

    tgt_name = None
    if entry.target_id:
        if target_names is not None and entry.target_id in target_names:
            tgt_name = target_names[entry.target_id]
        else:
            tgt_name = db.scalar(select(Target.display_name).where(Target.id == entry.target_id))

    return {
        "id": entry.id,
        "timestamp": entry.created_at,
        "actor_email": entry.actor_email,
        "actor_role": entry.actor_role,
        "action": entry.action,
        "resource_type": entry.resource_type,
        "resource_id": entry.resource_id,
        "project_id": entry.project_id,
        "project_name": proj_name,
        "target_id": entry.target_id,
        "target_name": tgt_name,
        "outcome": entry.outcome,
        "correlation_id": entry.correlation_id,
        "correlation_run_id": entry.correlation_run_id,
        "detail": entry.detail,
        "metadata": entry.metadata_json or {},
        "integrity_hash": entry.integrity_hash,
    }


def list_audit_logs(
    db: Session,
    *,
    user_id: str,
    page: int = 1,
    page_size: int = 25,
    project_id: str | None = None,
    target_id: str | None = None,
    action: str | None = None,
    outcome: str | None = None,
    resource_type: str | None = None,
    search: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Return workspace-isolated paginated audit logs."""
    ws_ids = list(
        db.scalars(
            select(WorkspaceMember.workspace_id).where(
                WorkspaceMember.user_id == user_id,
                WorkspaceMember.status == "active",
            )
        )
    )
    if not ws_ids:
        return [], 0

    stmt = select(AuditLog).where(AuditLog.workspace_id.in_(ws_ids))
    count_stmt = select(func.count()).select_from(AuditLog).where(AuditLog.workspace_id.in_(ws_ids))

    filters = []
    if project_id:
        filters.append(AuditLog.project_id == project_id)
    if target_id:
        filters.append(AuditLog.target_id == target_id)
    if action:
        filters.append(AuditLog.action == action)
    if outcome:
        filters.append(AuditLog.outcome == outcome)
    if resource_type:
        filters.append(AuditLog.resource_type == resource_type)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                AuditLog.detail.ilike(pattern),
                AuditLog.actor_email.ilike(pattern),
                AuditLog.action.ilike(pattern),
                AuditLog.resource_id.ilike(pattern),
            )
        )

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = int(db.scalar(count_stmt) or 0)
    offset = (page - 1) * page_size
    rows = list(db.scalars(stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)))
    return [serialize_audit_entry(db, row) for row in rows], total
