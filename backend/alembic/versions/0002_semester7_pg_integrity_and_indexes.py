"""Add Semester 7 composite ownership constraints, CHECK constraints, and partial/functional indexes.

Revision ID: 0002_sem7_pg_integrity
Revises: 0001_semester7_baseline
Create Date: 2026-11-25 15:55:00+00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002_sem7_pg_integrity"
down_revision = "0001_semester7_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Users: check constraints & case-normalized functional unique indexes
    with op.batch_alter_table("users") as batch_op:
        batch_op.create_check_constraint("failed_login_nonneg", "failed_login_count >= 0")
        batch_op.create_check_constraint(
            "account_status_valid",
            "account_status IN ('active', 'suspended', 'deactivated')",
        )
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)
    op.create_index("uq_users_username_lower", "users", [sa.text("lower(username)")], unique=True)

    # 2. User sessions: active-session partial index
    op.create_index(
        "ix_user_sessions_active_user_exp",
        "user_sessions",
        ["user_id", "expires_at"],
        unique=False,
        postgresql_where=sa.text("revoked_at IS NULL"),
        sqlite_where=sa.text("revoked_at IS NULL"),
    )

    # 3. Workspace members: controlled role & status
    with op.batch_alter_table("workspace_members") as batch_op:
        batch_op.create_check_constraint(
            "ws_member_role_valid",
            "role IN ('project_owner', 'security_tester', 'supervisor_evaluator', 'system_admin', 'owner', 'admin', 'member', 'viewer')",
        )
        batch_op.create_check_constraint(
            "ws_member_status_valid",
            "status IN ('invited', 'active', 'suspended', 'revoked')",
        )

    # 4. Projects: composite ownership key & checks
    with op.batch_alter_table("projects") as batch_op:
        batch_op.create_unique_constraint("uq_projects_id_workspace", ["id", "workspace_id"])
        batch_op.create_check_constraint(
            "project_env_valid", "environment_context IN ('local_lab', 'staging')"
        )
        batch_op.create_check_constraint(
            "project_status_valid", "status IN ('active', 'archived', 'deleted')"
        )

    # 5. Project members: controlled role & status
    with op.batch_alter_table("project_members") as batch_op:
        batch_op.create_check_constraint(
            "proj_member_role_valid",
            "role IN ('project_owner', 'security_tester', 'supervisor_evaluator', 'system_admin', 'owner', 'admin', 'member', 'viewer')",
        )
        batch_op.create_check_constraint(
            "proj_member_status_valid",
            "status IN ('active', 'suspended', 'revoked')",
        )

    # 6. Targets: composite ownership key/FK & checks
    with op.batch_alter_table("targets") as batch_op:
        batch_op.create_unique_constraint(
            "uq_targets_id_project_workspace", ["id", "project_id", "workspace_id"]
        )
        batch_op.create_foreign_key(
            "fk_targets_project_workspace_projects",
            "projects",
            ["project_id", "workspace_id"],
            ["id", "workspace_id"],
            ondelete="CASCADE",
        )
        batch_op.create_check_constraint("target_port_range", "port >= 1 AND port <= 65535")
        batch_op.create_check_constraint(
            "target_env_valid", "environment IN ('local_lab', 'staging')"
        )
        batch_op.create_check_constraint(
            "target_auth_status_valid",
            "authorization_status IN ('pending_review', 'authorized', 'revoked', 'needs_revalidation')",
        )

    # 7. Authorization records: state check & lookup index
    with op.batch_alter_table("authorization_records") as batch_op:
        batch_op.create_check_constraint(
            "auth_rec_state_valid",
            "state IN ('pending_review', 'authorized', 'revoked', 'needs_revalidation')",
        )
    op.create_index(
        "ix_auth_records_target_state_exp",
        "authorization_records",
        ["target_id", "state", "expires_at"],
        unique=False,
    )

    # 8. Scope versions: composite key, positive version, controlled approval state
    with op.batch_alter_table("scope_versions") as batch_op:
        batch_op.create_unique_constraint("uq_scope_versions_id_target", ["id", "target_id"])
        batch_op.create_check_constraint("scope_version_positive", "version_number >= 1")
        batch_op.create_check_constraint(
            "scope_approval_state_valid",
            "approval_state IN ('pending_approval', 'approved', 'rejected', 'superseded', 'revoked')",
        )
    op.create_index(
        "ix_scope_versions_target_version",
        "scope_versions",
        ["target_id", "version_number"],
        unique=False,
    )

    # 9. Assessment runs: composite ownership FKs, counter checks, single-active-run partial unique index
    with op.batch_alter_table("assessment_runs") as batch_op:
        batch_op.create_foreign_key(
            "fk_runs_target_project_workspace",
            "targets",
            ["target_id", "project_id", "workspace_id"],
            ["id", "project_id", "workspace_id"],
            ondelete="CASCADE",
        )
        batch_op.create_foreign_key(
            "fk_runs_scope_target",
            "scope_versions",
            ["scope_version_id", "target_id"],
            ["id", "target_id"],
            ondelete="RESTRICT",
        )
        batch_op.create_check_constraint(
            "run_state_valid",
            "state IN ('queued', 'running', 'cancellation_requested', 'completed', 'partial', 'cancelled', 'failed', 'interrupted')",
        )
        batch_op.create_check_constraint("run_req_count_nonneg", "request_count >= 0")
        batch_op.create_check_constraint("run_req_budget_pos", "request_budget > 0")
        batch_op.create_check_constraint("run_disc_urls_nonneg", "discovered_urls_count >= 0")
        batch_op.create_check_constraint("run_in_scope_nonneg", "in_scope_urls_count >= 0")
        batch_op.create_check_constraint("run_excl_urls_nonneg", "excluded_urls_count >= 0")
        batch_op.create_check_constraint("run_dup_urls_nonneg", "duplicate_urls_count >= 0")
        batch_op.create_check_constraint("run_blocked_redir_nonneg", "blocked_redirects_count >= 0")

    op.create_index(
        "uq_assessment_runs_one_active_per_target",
        "assessment_runs",
        ["target_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('queued', 'running', 'cancellation_requested')"),
        sqlite_where=sa.text("state IN ('queued', 'running', 'cancellation_requested')"),
    )

    # 10. URL inventory & discovery sources
    with op.batch_alter_table("url_inventory") as batch_op:
        batch_op.create_check_constraint("url_inv_port_range", "port >= 1 AND port <= 65535")
        batch_op.create_check_constraint("url_inv_depth_nonneg", "depth >= 0")
        batch_op.create_check_constraint("url_inv_hit_count_pos", "hit_count >= 1")
        batch_op.create_check_constraint(
            "url_inv_scope_status_valid",
            "scope_status IN ('in_scope', 'out_of_scope', 'excluded', 'excluded_pattern', 'blocked_redirect', 'blocked_ssrf', 'invalid_url')",
        )
    op.create_index(
        "ix_discovery_sources_url_observed",
        "discovery_sources",
        ["url_inventory_id", "observed_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_discovery_sources_url_observed", table_name="discovery_sources")
    with op.batch_alter_table("url_inventory") as batch_op:
        batch_op.drop_constraint("url_inv_scope_status_valid", type_="check")
        batch_op.drop_constraint("url_inv_hit_count_pos", type_="check")
        batch_op.drop_constraint("url_inv_depth_nonneg", type_="check")
        batch_op.drop_constraint("url_inv_port_range", type_="check")

    op.drop_index("uq_assessment_runs_one_active_per_target", table_name="assessment_runs")
    with op.batch_alter_table("assessment_runs") as batch_op:
        batch_op.drop_constraint("run_blocked_redir_nonneg", type_="check")
        batch_op.drop_constraint("run_dup_urls_nonneg", type_="check")
        batch_op.drop_constraint("run_excl_urls_nonneg", type_="check")
        batch_op.drop_constraint("run_in_scope_nonneg", type_="check")
        batch_op.drop_constraint("run_disc_urls_nonneg", type_="check")
        batch_op.drop_constraint("run_req_budget_pos", type_="check")
        batch_op.drop_constraint("run_req_count_nonneg", type_="check")
        batch_op.drop_constraint("run_state_valid", type_="check")
        batch_op.drop_constraint("fk_runs_scope_target", type_="foreignkey")
        batch_op.drop_constraint("fk_runs_target_project_workspace", type_="foreignkey")

    op.drop_index("ix_scope_versions_target_version", table_name="scope_versions")
    with op.batch_alter_table("scope_versions") as batch_op:
        batch_op.drop_constraint("scope_approval_state_valid", type_="check")
        batch_op.drop_constraint("scope_version_positive", type_="check")
        batch_op.drop_constraint("uq_scope_versions_id_target", type_="unique")

    op.drop_index("ix_auth_records_target_state_exp", table_name="authorization_records")
    with op.batch_alter_table("authorization_records") as batch_op:
        batch_op.drop_constraint("auth_rec_state_valid", type_="check")

    with op.batch_alter_table("targets") as batch_op:
        batch_op.drop_constraint("target_auth_status_valid", type_="check")
        batch_op.drop_constraint("target_env_valid", type_="check")
        batch_op.drop_constraint("target_port_range", type_="check")
        batch_op.drop_constraint("fk_targets_project_workspace_projects", type_="foreignkey")
        batch_op.drop_constraint("uq_targets_id_project_workspace", type_="unique")

    with op.batch_alter_table("project_members") as batch_op:
        batch_op.drop_constraint("proj_member_status_valid", type_="check")
        batch_op.drop_constraint("proj_member_role_valid", type_="check")

    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_constraint("project_status_valid", type_="check")
        batch_op.drop_constraint("project_env_valid", type_="check")
        batch_op.drop_constraint("uq_projects_id_workspace", type_="unique")

    with op.batch_alter_table("workspace_members") as batch_op:
        batch_op.drop_constraint("ws_member_status_valid", type_="check")
        batch_op.drop_constraint("ws_member_role_valid", type_="check")

    op.drop_index("ix_user_sessions_active_user_exp", table_name="user_sessions")
    op.drop_index("uq_users_username_lower", table_name="users")
    op.drop_index("uq_users_email_lower", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("account_status_valid", type_="check")
        batch_op.drop_constraint("failed_login_nonneg", type_="check")
