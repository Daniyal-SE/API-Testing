"""Semester 7 baseline schema (40% Internal Defense entities only).

Revision ID: 0001_semester7_baseline
Revises:
Create Date: 2026-11-25 14:15:00+00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_semester7_baseline"
down_revision = None
branch_labels = None
depends_on = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("global_role", sa.String(length=40), nullable=False),
        sa.Column("account_status", sa.String(length=32), nullable=False),
        sa.Column("department", sa.String(length=120), nullable=True),
        sa.Column("failed_login_count", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent_summary", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_sessions_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_sessions")),
    )
    op.create_index(op.f("ix_user_sessions_token_hash"), "user_sessions", ["token_hash"], unique=True)
    op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("semester_label", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_workspaces_owner_id_users"), ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspaces")),
    )
    op.create_index(op.f("ix_workspaces_slug"), "workspaces", ["slug"], unique=True)

    op.create_table(
        "workspace_members",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("granted_by_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["granted_by_id"], ["users.id"], name=op.f("fk_workspace_members_granted_by_id_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_workspace_members_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name=op.f("fk_workspace_members_workspace_id_workspaces"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspace_members")),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member_user"),
    )
    op.create_index(op.f("ix_workspace_members_user_id"), "workspace_members", ["user_id"], unique=False)
    op.create_index(op.f("ix_workspace_members_workspace_id"), "workspace_members", ["workspace_id"], unique=False)

    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("owner_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("environment_context", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_projects_owner_id_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name=op.f("fk_projects_workspace_id_workspaces"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(op.f("ix_projects_workspace_id"), "projects", ["workspace_id"], unique=False)
    op.create_index("ix_projects_workspace_status_updated", "projects", ["workspace_id", "status", "updated_at"], unique=False)

    op.create_table(
        "project_members",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("user_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("added_by_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["added_by_id"], ["users.id"], name=op.f("fk_project_members_added_by_id_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_project_members_project_id_projects"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_project_members_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_project_members")),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_member_user"),
    )
    op.create_index(op.f("ix_project_members_project_id"), "project_members", ["project_id"], unique=False)
    op.create_index(op.f("ix_project_members_user_id"), "project_members", ["user_id"], unique=False)

    op.create_table(
        "targets",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("base_url", sa.String(length=512), nullable=False),
        sa.Column("normalized_base_url", sa.String(length=512), nullable=False),
        sa.Column("scheme", sa.String(length=16), nullable=False),
        sa.Column("hostname", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("base_path", sa.String(length=255), nullable=False),
        sa.Column("environment", sa.String(length=32), nullable=False),
        sa.Column("authorization_status", sa.String(length=32), nullable=False),
        sa.Column("ownership_declaration", sa.Text(), nullable=False),
        sa.Column("permission_reference", sa.String(length=128), nullable=False),
        sa.Column("current_scope_version_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("last_authorization_review_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_targets_project_id_projects"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name=op.f("fk_targets_workspace_id_workspaces"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_targets")),
    )
    op.create_index(op.f("ix_targets_project_id"), "targets", ["project_id"], unique=False)
    op.create_index(op.f("ix_targets_workspace_id"), "targets", ["workspace_id"], unique=False)
    op.create_index("ix_targets_project_auth_status", "targets", ["project_id", "authorization_status"], unique=False)

    op.create_table(
        "authorization_records",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("target_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("declaring_user_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("reviewed_by_user_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("permission_reference", sa.String(length=128), nullable=False),
        sa.Column("ownership_declaration", sa.Text(), nullable=False),
        sa.Column("declaration_hash", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("scope_version_label", sa.String(length=32), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["declaring_user_id"], ["users.id"], name=op.f("fk_authorization_records_declaring_user_id_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by_user_id"], ["users.id"], name=op.f("fk_authorization_records_reviewed_by_user_id_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_id"], ["targets.id"], name=op.f("fk_authorization_records_target_id_targets"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_authorization_records")),
    )
    op.create_index(op.f("ix_authorization_records_target_id"), "authorization_records", ["target_id"], unique=False)

    op.create_table(
        "scope_versions",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("target_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("version_label", sa.String(length=32), nullable=False),
        sa.Column("approval_state", sa.String(length=32), nullable=False),
        sa.Column("allowed_hosts", JSON_TYPE, nullable=False),
        sa.Column("allowed_ports", JSON_TYPE, nullable=False),
        sa.Column("allowed_path_prefixes", JSON_TYPE, nullable=False),
        sa.Column("excluded_paths", JSON_TYPE, nullable=False),
        sa.Column("allowed_methods", JSON_TYPE, nullable=False),
        sa.Column("follow_redirects_in_scope_only", sa.Boolean(), nullable=False),
        sa.Column("state_changing_methods_enabled", sa.Boolean(), nullable=False),
        sa.Column("block_private_and_link_local", sa.Boolean(), nullable=False),
        sa.Column("local_lab_exception_active", sa.Boolean(), nullable=False),
        sa.Column("budgets", JSON_TYPE, nullable=False),
        sa.Column("normalized_preview", sa.Text(), nullable=False),
        sa.Column("policy_hash", sa.String(length=64), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=False),
        sa.Column("created_by_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("approved_by_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], name=op.f("fk_scope_versions_approved_by_id_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], name=op.f("fk_scope_versions_created_by_id_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["target_id"], ["targets.id"], name=op.f("fk_scope_versions_target_id_targets"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scope_versions")),
        sa.UniqueConstraint("target_id", "version_number", name="uq_scope_target_version"),
    )
    op.create_index(op.f("ix_scope_versions_target_id"), "scope_versions", ["target_id"], unique=False)

    op.create_table(
        "assessment_runs",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("run_code", sa.String(length=32), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("target_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("scope_version_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("initiated_by_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("rq_job_id", sa.String(length=128), nullable=True),
        sa.Column("modules", JSON_TYPE, nullable=False),
        sa.Column("run_plan_json", JSON_TYPE, nullable=False),
        sa.Column("plan_hash", sa.String(length=64), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("current_phase", sa.String(length=160), nullable=False),
        sa.Column("phases_json", JSON_TYPE, nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=True),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("request_budget", sa.Integer(), nullable=False),
        sa.Column("discovered_urls_count", sa.Integer(), nullable=False),
        sa.Column("in_scope_urls_count", sa.Integer(), nullable=False),
        sa.Column("excluded_urls_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_urls_count", sa.Integer(), nullable=False),
        sa.Column("blocked_redirects_count", sa.Integer(), nullable=False),
        sa.Column("retained_summary", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["initiated_by_id"], ["users.id"], name=op.f("fk_assessment_runs_initiated_by_id_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_assessment_runs_project_id_projects"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scope_version_id"], ["scope_versions.id"], name=op.f("fk_assessment_runs_scope_version_id_scope_versions"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["target_id"], ["targets.id"], name=op.f("fk_assessment_runs_target_id_targets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name=op.f("fk_assessment_runs_workspace_id_workspaces"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assessment_runs")),
    )
    op.create_index(op.f("ix_assessment_runs_project_id"), "assessment_runs", ["project_id"], unique=False)
    op.create_index(op.f("ix_assessment_runs_run_code"), "assessment_runs", ["run_code"], unique=True)
    op.create_index(op.f("ix_assessment_runs_target_id"), "assessment_runs", ["target_id"], unique=False)
    op.create_index(op.f("ix_assessment_runs_workspace_id"), "assessment_runs", ["workspace_id"], unique=False)
    op.create_index("ix_runs_target_state", "assessment_runs", ["target_id", "state"], unique=False)
    op.create_index("ix_runs_workspace_project_created", "assessment_runs", ["workspace_id", "project_id", "created_at"], unique=False)

    op.create_table(
        "run_events",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("run_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("level", sa.String(length=16), nullable=False),
        sa.Column("phase", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("detail_json", JSON_TYPE, nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["assessment_runs.id"], name=op.f("fk_run_events_run_id_assessment_runs"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_run_events")),
    )
    op.create_index(op.f("ix_run_events_run_id"), "run_events", ["run_id"], unique=False)
    op.create_index("ix_run_events_run_created", "run_events", ["run_id", "created_at"], unique=False)

    op.create_table(
        "url_inventory",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("target_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("run_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("canonical_key", sa.String(length=64), nullable=False),
        sa.Column("normalized_url", sa.String(length=1024), nullable=False),
        sa.Column("scheme", sa.String(length=16), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("method_hint", sa.String(length=16), nullable=False),
        sa.Column("asset_type", sa.String(length=32), nullable=False),
        sa.Column("primary_source", sa.String(length=32), nullable=False),
        sa.Column("scope_status", sa.String(length=32), nullable=False),
        sa.Column("scope_reason", sa.Text(), nullable=False),
        sa.Column("test_status", sa.String(length=32), nullable=False),
        sa.Column("parameter_names", JSON_TYPE, nullable=False),
        sa.Column("form_metadata", JSON_TYPE, nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("hit_count", sa.Integer(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_url_inventory_project_id_projects"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["assessment_runs.id"], name=op.f("fk_url_inventory_run_id_assessment_runs"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["targets.id"], name=op.f("fk_url_inventory_target_id_targets"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name=op.f("fk_url_inventory_workspace_id_workspaces"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_url_inventory")),
        sa.UniqueConstraint("run_id", "canonical_key", name="uq_url_inventory_run_canonical"),
    )
    op.create_index(op.f("ix_url_inventory_project_id"), "url_inventory", ["project_id"], unique=False)
    op.create_index(op.f("ix_url_inventory_run_id"), "url_inventory", ["run_id"], unique=False)
    op.create_index(op.f("ix_url_inventory_target_id"), "url_inventory", ["target_id"], unique=False)
    op.create_index(op.f("ix_url_inventory_workspace_id"), "url_inventory", ["workspace_id"], unique=False)
    op.create_index("ix_url_inventory_project_target", "url_inventory", ["project_id", "target_id"], unique=False)
    op.create_index("ix_url_inventory_run_scope", "url_inventory", ["run_id", "scope_status"], unique=False)

    op.create_table(
        "discovery_sources",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("url_inventory_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("run_id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("referring_url", sa.String(length=1024), nullable=True),
        sa.Column("element_context", sa.String(length=256), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["assessment_runs.id"], name=op.f("fk_discovery_sources_run_id_assessment_runs"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["url_inventory_id"], ["url_inventory.id"], name=op.f("fk_discovery_sources_url_inventory_id_url_inventory"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_discovery_sources")),
    )
    op.create_index(op.f("ix_discovery_sources_run_id"), "discovery_sources", ["run_id"], unique=False)
    op.create_index(op.f("ix_discovery_sources_url_inventory_id"), "discovery_sources", ["url_inventory_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(as_uuid=False), nullable=False),
        sa.Column("workspace_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("project_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("target_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("actor_user_id", sa.Uuid(as_uuid=False), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("actor_role", sa.String(length=40), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("correlation_run_id", sa.String(length=64), nullable=True),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("metadata_json", JSON_TYPE, nullable=False),
        sa.Column("integrity_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], name=op.f("fk_audit_logs_actor_user_id_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_audit_logs_project_id_projects"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["target_id"], ["targets.id"], name=op.f("fk_audit_logs_target_id_targets"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], name=op.f("fk_audit_logs_workspace_id_workspaces"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index("ix_audit_action_outcome", "audit_logs", ["action", "outcome"], unique=False)
    op.create_index("ix_audit_project_created", "audit_logs", ["project_id", "created_at"], unique=False)
    op.create_index("ix_audit_workspace_created", "audit_logs", ["workspace_id", "created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_project_id"), "audit_logs", ["project_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_target_id"), "audit_logs", ["target_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_workspace_id"), "audit_logs", ["workspace_id"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("discovery_sources")
    op.drop_table("url_inventory")
    op.drop_table("run_events")
    op.drop_table("assessment_runs")
    op.drop_table("scope_versions")
    op.drop_table("authorization_records")
    op.drop_table("targets")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
    op.drop_table("user_sessions")
    op.drop_table("users")

