"""Database integrity, composite ownership, CHECK constraint, and PostgreSQL DDL verification tests."""
from __future__ import annotations

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError
from sqlalchemy.schema import CreateIndex, CreateTable

from app.db.base import Base
from app.models.assessment import AssessmentRun
from app.models.project import Project
from app.models.scope import ScopeVersion
from app.models.target import Target
from app.models.user import User
from app.models.workspace import Workspace
from scripts.seed_demo import seed_database


def test_postgresql_ddl_compilation_includes_jsonb_checks_and_partial_indexes() -> None:
    """Verify all 14 Semester 7 tables compile cleanly for PostgreSQL 16+ dialect."""
    pg_dialect = postgresql.dialect()
    table_names = set(Base.metadata.tables.keys())
    assert table_names == {
        "users",
        "user_sessions",
        "workspaces",
        "workspace_members",
        "projects",
        "project_members",
        "targets",
        "authorization_records",
        "scope_versions",
        "assessment_runs",
        "run_events",
        "url_inventory",
        "discovery_sources",
        "audit_logs",
    }

    ddl_sql = "\n".join(
        str(CreateTable(tbl).compile(dialect=pg_dialect))
        for tbl in Base.metadata.sorted_tables
    )
    index_sql = "\n".join(
        str(CreateIndex(idx).compile(dialect=pg_dialect))
        for tbl in Base.metadata.sorted_tables
        for idx in tbl.indexes
    )

    assert "JSONB" in ddl_sql
    assert "TIMESTAMP WITH TIME ZONE" in ddl_sql
    assert "fk_targets_project_workspace_projects" in ddl_sql
    assert "fk_runs_target_project_workspace" in ddl_sql
    assert "fk_runs_scope_target" in ddl_sql
    assert "uq_assessment_runs_one_active_per_target" in index_sql
    assert "uq_users_email_lower" in index_sql


def test_composite_ownership_and_check_constraints_enforced(db_session_factory) -> None:
    _, TestingSession = db_session_factory
    with TestingSession() as db:
        seed_database(db)

        ws_list = db.query(Workspace).all()
        ws_a, ws_b = ws_list[0], ws_list[1]
        proj_a = db.query(Project).filter_by(workspace_id=ws_a.id).first()
        owner = db.query(User).filter_by(email="owner@fyp-lab.edu").first()
        tgt_a = db.query(Target).filter_by(project_id=proj_a.id).first()
        scope_a = db.query(ScopeVersion).filter_by(target_id=tgt_a.id).first()
        assert proj_a and owner and tgt_a and scope_a

        # 1. Case-insensitive email uniqueness
        with pytest.raises(IntegrityError):
            db.add(
                User(
                    email="OWNER@FYP-LAB.EDU",
                    username="owner_dup",
                    display_name="Dup",
                    password_hash="hash",
                )
            )
            db.flush()
        db.rollback()

        # 2. Cross-workspace target/project mismatch blocked by composite FK
        with pytest.raises(IntegrityError):
            db.add(
                Target(
                    workspace_id=ws_b.id,
                    project_id=proj_a.id,
                    display_name="Cross-Tenant Target",
                    description="Should fail composite FK",
                    base_url="http://localhost:9000",
                    normalized_base_url="http://localhost:9000/",
                    scheme="http",
                    hostname="localhost",
                    port=9000,
                    base_path="/",
                    environment="local_lab",
                    authorization_status="pending_review",
                    ownership_declaration="Invalid cross-tenant",
                    permission_reference="REF-BAD",
                )
            )
            db.flush()
        db.rollback()

        # 3. Port CHECK constraint rejects port 0 or > 65535
        with pytest.raises(IntegrityError):
            db.add(
                Target(
                    workspace_id=ws_a.id,
                    project_id=proj_a.id,
                    display_name="Bad Port Target",
                    description="Invalid port",
                    base_url="http://localhost:70000",
                    normalized_base_url="http://localhost:70000/",
                    scheme="http",
                    hostname="localhost",
                    port=70000,
                    base_path="/",
                    environment="local_lab",
                    authorization_status="pending_review",
                    ownership_declaration="Invalid port",
                    permission_reference="REF-PORT",
                )
            )
            db.flush()
        db.rollback()

        # 4. Partial unique index allows only one active run per target
        db.add(
            AssessmentRun(
                run_code="RUN-DB-1",
                workspace_id=ws_a.id,
                project_id=proj_a.id,
                target_id=tgt_a.id,
                scope_version_id=scope_a.id,
                initiated_by_id=owner.id,
                modules=["url_discovery"],
                run_plan_json={},
                plan_hash="a" * 64,
                state="queued",
                current_phase="Queued",
                request_budget=50,
            )
        )
        db.flush()

        with pytest.raises(IntegrityError):
            db.add(
                AssessmentRun(
                    run_code="RUN-DB-2",
                    workspace_id=ws_a.id,
                    project_id=proj_a.id,
                    target_id=tgt_a.id,
                    scope_version_id=scope_a.id,
                    initiated_by_id=owner.id,
                    modules=["url_discovery"],
                    run_plan_json={},
                    plan_hash="b" * 64,
                    state="running",
                    current_phase="Running",
                    request_budget=50,
                )
            )
            db.flush()
        db.rollback()
