"""RBAC and tenant-isolation permission helpers."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.models.workspace import WorkspaceMember

APPROVER_ROLES = {"project_owner", "owner"}
OPERATOR_ROLES = {"project_owner", "security_tester", "owner", "member"}
READ_ROLES = OPERATOR_ROLES | {"supervisor_evaluator", "system_admin", "admin", "viewer"}


def can_approve_governance(role: str) -> bool:
    return role in APPROVER_ROLES


def can_launch_assessment(role: str) -> bool:
    return role in OPERATOR_ROLES


def require_workspace_member(
    db: Session,
    user: User,
    workspace_id: str,
    *,
    allowed_roles: set[str] | None = None,
) -> WorkspaceMember:
    member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
    )
    if member is None:
        raise AppError(
            code="FORBIDDEN",
            message="You do not have access to this workspace.",
            status_code=403,
        )
    if allowed_roles is not None and member.role not in allowed_roles:
        raise AppError(
            code="FORBIDDEN",
            message="Your workspace role does not permit this action.",
            status_code=403,
        )
    return member


def require_project_access(
    db: Session,
    user: User,
    project_id: str,
    *,
    allowed_roles: set[str] | None = None,
) -> tuple[Project, str]:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.status != "deleted")
    )
    if project is None:
        raise AppError(code="NOT_FOUND", message="Project not found.", status_code=404)

    ws_member = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == project.workspace_id,
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
    )
    if ws_member is None:
        raise AppError(
            code="NOT_FOUND",
            message="Project not found.",
            status_code=404,
        )

    proj_member = db.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
            ProjectMember.status == "active",
        )
    )
    effective_role = proj_member.role if proj_member else ws_member.role

    if allowed_roles is not None and effective_role not in allowed_roles:
        raise AppError(
            code="FORBIDDEN",
            message="Insufficient role permissions for this project operation.",
            status_code=403,
        )
    return project, effective_role
