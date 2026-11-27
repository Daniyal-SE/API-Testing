from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now_dt


class Project(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Workspace-scoped assessment project."""

    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("id", "workspace_id", name="uq_projects_id_workspace"),
        CheckConstraint("environment_context IN ('local_lab', 'staging')", name="project_env_valid"),
        CheckConstraint("status IN ('active', 'archived', 'deleted')", name="project_status_valid"),
        Index("ix_projects_workspace_status_updated", "workspace_id", "status", "updated_at"),
    )

    workspace_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    owner_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    environment_context: Mapped[str] = mapped_column(String(40), nullable=False, default="local_lab")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    members: Mapped[list["ProjectMember"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectMember(Base, UUIDPrimaryKeyMixin):
    """Project-level role assignment enforcing least privilege."""

    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_member_user"),
        CheckConstraint(
            "role IN ('project_owner', 'security_tester', 'supervisor_evaluator', 'system_admin', 'owner', 'admin', 'member', 'viewer')",
            name="proj_member_role_valid",
        ),
        CheckConstraint("status IN ('active', 'suspended', 'revoked')", name="proj_member_status_valid"),
    )

    project_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    added_by_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    project: Mapped[Project] = relationship(back_populates="members")
