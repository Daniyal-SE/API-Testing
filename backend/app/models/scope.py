from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin, utc_now_dt


class ScopeVersion(Base, UUIDPrimaryKeyMixin):
    """Immutable versioned scope policy snapshot for a target."""

    __tablename__ = "scope_versions"
    __table_args__ = (
        UniqueConstraint("target_id", "version_number", name="uq_scope_target_version"),
        UniqueConstraint("id", "target_id", name="uq_scope_versions_id_target"),
        CheckConstraint("version_number >= 1", name="scope_version_positive"),
        CheckConstraint(
            "approval_state IN ('pending_approval', 'approved', 'rejected', 'superseded', 'revoked')",
            name="scope_approval_state_valid",
        ),
        Index("ix_scope_versions_target_version", "target_id", "version_number"),
    )

    target_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("targets.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    version_label: Mapped[str] = mapped_column(String(32), nullable=False)
    approval_state: Mapped[str] = mapped_column(String(32), nullable=False, default="pending_approval")

    allowed_hosts: Mapped[list[str]] = mapped_column(nullable=False)
    allowed_ports: Mapped[list[int]] = mapped_column(nullable=False)
    allowed_path_prefixes: Mapped[list[str]] = mapped_column(nullable=False)
    excluded_paths: Mapped[list[str]] = mapped_column(nullable=False, default=list)
    allowed_methods: Mapped[list[str]] = mapped_column(nullable=False)

    follow_redirects_in_scope_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    state_changing_methods_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    block_private_and_link_local: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    local_lab_exception_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    budgets: Mapped[dict[str, Any]] = mapped_column(nullable=False)
    normalized_preview: Mapped[str] = mapped_column(Text, nullable=False)
    policy_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    change_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_by_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    approved_by_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

