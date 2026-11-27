from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, utc_now_dt


class UrlInventory(Base, UUIDPrimaryKeyMixin):
    """Deduplicated URL/route/form inventory discovered during bounded same-origin crawling."""

    __tablename__ = "url_inventory"
    __table_args__ = (
        UniqueConstraint("run_id", "canonical_key", name="uq_url_inventory_run_canonical"),
        CheckConstraint("port >= 1 AND port <= 65535", name="url_inv_port_range"),
        CheckConstraint("depth >= 0", name="url_inv_depth_nonneg"),
        CheckConstraint("hit_count >= 1", name="url_inv_hit_count_pos"),
        CheckConstraint(
            "scope_status IN ('in_scope', 'out_of_scope', 'excluded', 'excluded_pattern', 'blocked_redirect', 'blocked_ssrf', 'invalid_url')",
            name="url_inv_scope_status_valid",
        ),
        Index("ix_url_inventory_run_scope", "run_id", "scope_status"),
        Index("ix_url_inventory_project_target", "project_id", "target_id"),
    )

    workspace_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("targets.id", ondelete="CASCADE"), index=True, nullable=False
    )
    run_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    canonical_key: Mapped[str] = mapped_column(String(128), nullable=False)
    normalized_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    scheme: Mapped[str] = mapped_column(String(16), nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    method_hint: Mapped[str] = mapped_column(String(16), nullable=False, default="GET")
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False, default="page")
    primary_source: Mapped[str] = mapped_column(String(32), nullable=False, default="crawler")
    scope_status: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_reason: Mapped[str] = mapped_column(Text, nullable=False)
    test_status: Mapped[str] = mapped_column(String(32), nullable=False, default="discovered_only")
    parameter_names: Mapped[list[str]] = mapped_column(nullable=False, default=list)
    form_metadata: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    depth: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    sources: Mapped[list["DiscoverySource"]] = relationship(
        back_populates="url_item", cascade="all, delete-orphan", order_by="DiscoverySource.observed_at"
    )


class DiscoverySource(Base, UUIDPrimaryKeyMixin):
    """Provenance record capturing where and how a discovered or blocked URL was observed."""

    __tablename__ = "discovery_sources"
    __table_args__ = (
        Index("ix_discovery_sources_url_observed", "url_inventory_id", "observed_at"),
    )

    url_inventory_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("url_inventory.id", ondelete="CASCADE"), index=True, nullable=False
    )
    run_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    referring_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    element_context: Mapped[str | None] = mapped_column(String(256), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    url_item: Mapped[UrlInventory] = relationship(back_populates="sources")
