from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKeyMixin, utc_now_dt


class AssessmentRun(Base, UUIDPrimaryKeyMixin):
    """Asynchronous Semester 7 URL discovery run bound to an immutable scope/target snapshot."""

    __tablename__ = "assessment_runs"
    __table_args__ = (
        ForeignKeyConstraint(
            ["target_id", "project_id", "workspace_id"],
            ["targets.id", "targets.project_id", "targets.workspace_id"],
            name="fk_runs_target_project_workspace",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["scope_version_id", "target_id"],
            ["scope_versions.id", "scope_versions.target_id"],
            name="fk_runs_scope_target",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "state IN ('queued', 'running', 'cancellation_requested', 'completed', 'partial', 'cancelled', 'failed', 'interrupted')",
            name="run_state_valid",
        ),
        CheckConstraint("request_count >= 0", name="run_req_count_nonneg"),
        CheckConstraint("request_budget > 0", name="run_req_budget_pos"),
        CheckConstraint("discovered_urls_count >= 0", name="run_disc_urls_nonneg"),
        CheckConstraint("in_scope_urls_count >= 0", name="run_in_scope_nonneg"),
        CheckConstraint("excluded_urls_count >= 0", name="run_excl_urls_nonneg"),
        CheckConstraint("duplicate_urls_count >= 0", name="run_dup_urls_nonneg"),
        CheckConstraint("blocked_redirects_count >= 0", name="run_blocked_redir_nonneg"),
        Index("ix_runs_target_state", "target_id", "state"),
        Index("ix_runs_workspace_project_created", "workspace_id", "project_id", "created_at"),
        Index(
            "uq_assessment_runs_one_active_per_target",
            "target_id",
            unique=True,
            postgresql_where=text("state IN ('queued', 'running', 'cancellation_requested')"),
            sqlite_where=text("state IN ('queued', 'running', 'cancellation_requested')"),
        ),
    )

    run_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    workspace_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("targets.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scope_version_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("scope_versions.id", ondelete="RESTRICT"), nullable=False
    )
    initiated_by_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    rq_job_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    modules: Mapped[list[str]] = mapped_column(nullable=False)
    run_plan_json: Mapped[dict[str, Any]] = mapped_column(nullable=False)
    plan_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    state: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    current_phase: Mapped[str] = mapped_column(String(160), nullable=False, default="Queued for Worker")
    phases_json: Mapped[list[dict[str, Any]]] = mapped_column(nullable=False, default=list)
    progress_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)

    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    request_budget: Mapped[int] = mapped_column(Integer, nullable=False)
    discovered_urls_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    in_scope_urls_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    excluded_urls_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_urls_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    blocked_redirects_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    retained_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    events: Mapped[list["RunEvent"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="RunEvent.created_at"
    )


class RunEvent(Base, UUIDPrimaryKeyMixin):
    """Sanitized operational progress and policy-denial event emitted during an assessment run."""

    __tablename__ = "run_events"
    __table_args__ = (Index("ix_run_events_run_created", "run_id", "created_at"),)

    run_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("assessment_runs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    level: Mapped[str] = mapped_column(String(16), nullable=False, default="info")
    phase: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    detail_json: Mapped[dict[str, Any] | None] = mapped_column(nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    run: Mapped[AssessmentRun] = relationship(back_populates="events")

