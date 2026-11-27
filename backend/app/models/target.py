from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now_dt


class Target(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Registered Local Lab or Staging target; registration is separate from execution authorization."""

    __tablename__ = "targets"
    __table_args__ = (
        UniqueConstraint("id", "project_id", "workspace_id", name="uq_targets_id_project_workspace"),
        ForeignKeyConstraint(
            ["project_id", "workspace_id"],
            ["projects.id", "projects.workspace_id"],
            name="fk_targets_project_workspace_projects",
            ondelete="CASCADE",
        ),
        CheckConstraint("port >= 1 AND port <= 65535", name="target_port_range"),
        CheckConstraint("environment IN ('local_lab', 'staging')", name="target_env_valid"),
        CheckConstraint(
            "authorization_status IN ('pending_review', 'authorized', 'revoked', 'needs_revalidation')",
            name="target_auth_status_valid",
        ),
        Index("ix_targets_project_auth_status", "project_id", "authorization_status"),
    )

    workspace_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    scheme: Mapped[str] = mapped_column(String(16), nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    base_path: Mapped[str] = mapped_column(String(255), nullable=False, default="/")
    environment: Mapped[str] = mapped_column(String(32), nullable=False)
    authorization_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_review")
    ownership_declaration: Mapped[str] = mapped_column(Text, nullable=False)
    permission_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    current_scope_version_id: Mapped[str | None] = mapped_column(Uuid(as_uuid=False), nullable=True)
    last_authorization_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    authorizations: Mapped[list["AuthorizationRecord"]] = relationship(
        back_populates="target", cascade="all, delete-orphan", order_by="desc(AuthorizationRecord.created_at)"
    )


class AuthorizationRecord(Base, UUIDPrimaryKeyMixin):
    """Structured, auditable authorization & ownership declaration record tied to target identity."""

    __tablename__ = "authorization_records"
    __table_args__ = (
        CheckConstraint(
            "state IN ('pending_review', 'authorized', 'revoked', 'needs_revalidation')",
            name="auth_rec_state_valid",
        ),
        Index("ix_auth_records_target_state_exp", "target_id", "state", "expires_at"),
    )

    target_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("targets.id", ondelete="CASCADE"), index=True, nullable=False
    )
    declaring_user_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewed_by_user_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    permission_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    ownership_declaration: Mapped[str] = mapped_column(Text, nullable=False)
    declaration_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_version_label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    effective_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    target: Mapped[Target] = relationship(back_populates="authorizations")

