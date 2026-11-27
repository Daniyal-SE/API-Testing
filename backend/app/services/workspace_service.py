"""Workspace listing service."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


def list_user_workspaces(db: Session, user: User) -> list[dict]:
    """Return all active workspaces accessible to the authenticated user."""
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

    workspaces = list(
        db.scalars(
            select(Workspace)
            .where(Workspace.id.in_(ws_ids), Workspace.is_active.is_(True))
            .order_by(Workspace.created_at.asc())
        )
    )
    result: list[dict] = []
    for ws in workspaces:
        member_count = int(
            db.scalar(
                select(func.count())
                .select_from(WorkspaceMember)
                .where(
                    WorkspaceMember.workspace_id == ws.id,
                    WorkspaceMember.status == "active",
                )
            )
            or 0
        )
        result.append(
            {
                "id": ws.id,
                "name": ws.name,
                "slug": ws.slug,
                "description": ws.description,
                "semester_label": ws.semester_label,
                "member_count": member_count,
            }
        )
    return result
