from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utc_now_dt


class AuditLog(Base, UUIDPrimaryKeyMixin):
    """Append-only security and governance audit log (no update or delete routes)."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_workspace_created", "workspace_id", "created_at"),
        Index("ix_audit_project_created", "project_id", "created_at"),
        Index("ix_audit_action_outcome", "action", "outcome"),
    )

    workspace_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="SET NULL"), index=True, nullable=True
    )
    project_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="SET NULL"), index=True, nullable=True
    )
    target_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("targets.id", ondelete="SET NULL"), index=True, nullable=True
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(40), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(128), nullable=False)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False, default="success")
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    correlation_run_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(nullable=False, default=dict)
    integrity_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

