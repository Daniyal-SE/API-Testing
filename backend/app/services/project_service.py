"""Project CRUD and detail service."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import utc_now
from app.models.assessment import AssessmentRun
from app.models.audit import AuditLog
from app.models.project import Project, ProjectMember
from app.models.target import Target
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.services.audit_service import append_audit, serialize_audit_entry
from app.services.permissions import (
    APPROVER_ROLES,
    OPERATOR_ROLES,
    READ_ROLES,
    can_approve_governance,
    can_launch_assessment,
    require_project_access,
    require_workspace_member,
)


def _serialize_project(db: Session, project: Project, current_role: str) -> dict:
    owner = db.scalar(select(User).where(User.id == project.owner_id))
    target_count = int(
        db.scalar(select(func.count()).select_from(Target).where(Target.project_id == project.id)) or 0
    )
    latest_run = db.scalar(
        select(AssessmentRun)
        .where(AssessmentRun.project_id == project.id)
        .order_by(AssessmentRun.created_at.desc())
        .limit(1)
    )
    return {
        "id": project.id,
        "workspace_id": project.workspace_id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "owner_name": owner.display_name if owner else "Unknown",
        "current_user_role": current_role,
        "target_count": target_count,
        "latest_run_id": latest_run.id if latest_run else None,
        "latest_run_state": latest_run.state if latest_run else None,
        "updated_at": project.updated_at,
        "created_at": project.created_at,
    }


def list_projects(db: Session, *, user: User, workspace_id: str | None = None) -> list[dict]:
    ws_members = list(
        db.scalars(
            select(WorkspaceMember).where(
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.status == "active",
            )
        )
    )
    role_by_ws = {m.workspace_id: m.role for m in ws_members}
    if not role_by_ws:
        return []

    if workspace_id:
        require_workspace_member(db, user, workspace_id, allowed_roles=READ_ROLES)
        ws_ids = [workspace_id]
    else:
        ws_ids = list(role_by_ws.keys())

    projects = list(
        db.scalars(
            select(Project)
            .where(Project.workspace_id.in_(ws_ids), Project.status != "deleted")
            .order_by(Project.updated_at.desc())
        )
    )
    items: list[dict] = []
    for proj in projects:
        pm = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == proj.id,
                ProjectMember.user_id == user.id,
                ProjectMember.status == "active",
            )
        )
        role = pm.role if pm else role_by_ws.get(proj.workspace_id, "viewer")
        items.append(_serialize_project(db, proj, role))
    return items


def create_project(
    db: Session,
    *,
    user: User,
    workspace_id: str,
    name: str,
    description: str,
    environment_context: str = "local_lab",
) -> dict:
    member = require_workspace_member(db, user, workspace_id, allowed_roles=OPERATOR_ROLES)
    project = Project(
        workspace_id=workspace_id,
        owner_id=user.id,
        name=name.strip(),
        description=description.strip(),
        environment_context=environment_context,
        status="active",
    )
    db.add(project)
    db.flush()

    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=user.id,
            role="project_owner" if member.role in APPROVER_ROLES else member.role,
            status="active",
            added_by_id=user.id,
        )
    )
    append_audit(
        db,
        action="PROJECT_CREATED",
        resource_type="project",
        resource_id=project.id,
        detail=f"Created project '{project.name}'.",
        actor_user=user,
        workspace_id=workspace_id,
        project_id=project.id,
    )
    db.commit()
    db.refresh(project)
    return _serialize_project(db, project, member.role)


def get_project_detail(db: Session, *, user: User, project_id: str) -> dict:
    project, role = require_project_access(db, user, project_id, allowed_roles=READ_ROLES)
    members_rows = list(
        db.scalars(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.status == "active",
            )
        )
    )
    members_out: list[dict] = []
    for pm in members_rows:
        u = db.scalar(select(User).where(User.id == pm.user_id))
        if u:
            members_out.append(
                {
                    "user_id": u.id,
                    "display_name": u.display_name,
                    "email": u.email,
                    "role": pm.role,
                    "added_at": pm.added_at,
                    "can_approve_target": can_approve_governance(pm.role),
                    "can_approve_scope": can_approve_governance(pm.role),
                    "can_launch_assessment": can_launch_assessment(pm.role),
                }
            )

    from app.services.target_service import serialize_target
    from app.services.assessment_service import serialize_run_summary

    targets = [
        serialize_target(db, t)
        for t in db.scalars(
            select(Target).where(Target.project_id == project.id).order_by(Target.created_at.desc())
        )
    ]
    runs = [
        serialize_run_summary(db, r)
        for r in db.scalars(
            select(AssessmentRun)
            .where(AssessmentRun.project_id == project.id)
            .order_by(AssessmentRun.created_at.desc())
        )
    ]
    audits = [
        serialize_audit_entry(db, a)
        for a in db.scalars(
            select(AuditLog)
            .where(AuditLog.project_id == project.id)
            .order_by(AuditLog.created_at.desc())
            .limit(50)
        )
    ]

    return {
        "project": _serialize_project(db, project, role),
        "members": members_out,
        "targets": targets,
        "runs": runs,
        "audit_logs": audits,
    }


def update_project(
    db: Session,
    *,
    user: User,
    project_id: str,
    name: str | None = None,
    description: str | None = None,
) -> dict:
    project, role = require_project_access(db, user, project_id, allowed_roles=APPROVER_ROLES)
    if name is not None:
        project.name = name.strip()
    if description is not None:
        project.description = description.strip()
    project.updated_at = utc_now()
    append_audit(
        db,
        action="project.updated",
        resource_type="project",
        resource_id=project.id,
        detail=f"Updated project '{project.name}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
    )
    db.commit()
    db.refresh(project)
    return _serialize_project(db, project, role)


def delete_project(db: Session, *, user: User, project_id: str) -> dict:
    project, _ = require_project_access(db, user, project_id, allowed_roles=APPROVER_ROLES)
    project.status = "deleted"
    project.deleted_at = utc_now()
    append_audit(
        db,
        action="project.deleted",
        resource_type="project",
        resource_id=project.id,
        detail=f"Archived project '{project.name}'.",
        actor_user=user,
        workspace_id=project.workspace_id,
        project_id=project.id,
    )
    db.commit()
    return {"deleted": True, "id": project.id}
