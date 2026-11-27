"""Synthetic Semester 7 demo data seeding script (local-only, deterministic)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, sha256_canonical_json, utc_now
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.project import Project, ProjectMember
from app.models.scope import ScopeVersion
from app.models.target import AuthorizationRecord, Target
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.services.audit_service import append_audit
from app.services.scope_service import build_normalized_scope_preview
from app.schemas.scope import ScopeBudgetsSchema, ScopeCreateRequest


DEMO_PASSWORD = os.environ.get("DEMO_USER_PASSWORD", "FypDemoPass!2026")


def seed_database(db: Session) -> dict[str, str]:
    """Idempotently populate synthetic Semester 7 users, workspaces, projects, targets, and scopes."""
    existing_owner = db.scalar(select(User).where(User.email == "owner@fyp-lab.edu"))
    if existing_owner is not None:
        return {"status": "already_seeded"}

    pw_hash = hash_password(DEMO_PASSWORD)
    users_spec = [
        ("owner@fyp-lab.edu", "owner", "Amina Farooq", "project_owner", "Software Security Lab"),
        ("tester@fyp-lab.edu", "tester", "Saarim Zulfiqar", "security_tester", "FYP Security Team"),
        ("evaluator@fyp-lab.edu", "evaluator", "Dr. Kamran Siddiqui", "supervisor_evaluator", "Faculty Evaluation Panel"),
        ("admin@fyp-lab.edu", "admin", "Bilal Tariq", "system_admin", "Lab Infrastructure"),
        ("outsider@other-lab.edu", "outsider", "External Researcher", "project_owner", "Isolated Workspace"),
    ]
    users: dict[str, User] = {}
    for email, uname, dname, role, dept in users_spec:
        u = User(
            email=email,
            username=uname,
            display_name=dname,
            password_hash=pw_hash,
            global_role=role,
            account_status="active",
            department=dept,
        )
        db.add(u)
        users[email] = u
    db.flush()

    ws_main = Workspace(
        slug="fyp-security-lab",
        name="FYP Security Assessment Lab",
        description="Primary Semester 7 university capstone assessment workspace (local-only demo).",
        semester_label="Semester 7",
        owner_id=users["owner@fyp-lab.edu"].id,
    )
    ws_other = Workspace(
        slug="isolated-external-lab",
        name="Isolated Workspace B",
        description="Separate workspace used to verify tenant isolation.",
        semester_label="Semester 7",
        owner_id=users["outsider@other-lab.edu"].id,
    )
    db.add_all([ws_main, ws_other])
    db.flush()

    for email, role in [
        ("owner@fyp-lab.edu", "project_owner"),
        ("tester@fyp-lab.edu", "security_tester"),
        ("evaluator@fyp-lab.edu", "supervisor_evaluator"),
        ("admin@fyp-lab.edu", "system_admin"),
    ]:
        db.add(
            WorkspaceMember(
                workspace_id=ws_main.id,
                user_id=users[email].id,
                role=role,
                status="active",
                granted_by_id=users["owner@fyp-lab.edu"].id,
            )
        )
    db.add(
        WorkspaceMember(
            workspace_id=ws_other.id,
            user_id=users["outsider@other-lab.edu"].id,
            role="project_owner",
            status="active",
            granted_by_id=users["outsider@other-lab.edu"].id,
        )
    )

    proj = Project(
        workspace_id=ws_main.id,
        owner_id=users["owner@fyp-lab.edu"].id,
        name="Campus Commerce Lab (Sem 7)",
        description="Local lab ecommerce fixture for bounded same-origin URL discovery and scope enforcement.",
        environment_context="local_lab",
        status="active",
    )
    proj_other = Project(
        workspace_id=ws_other.id,
        owner_id=users["outsider@other-lab.edu"].id,
        name="Private Workspace B Project",
        description="Isolated project for workspace isolation verification.",
        environment_context="local_lab",
        status="active",
    )
    db.add_all([proj, proj_other])
    db.flush()

    for email, role in [
        ("owner@fyp-lab.edu", "project_owner"),
        ("tester@fyp-lab.edu", "security_tester"),
        ("evaluator@fyp-lab.edu", "supervisor_evaluator"),
        ("admin@fyp-lab.edu", "system_admin"),
    ]:
        db.add(
            ProjectMember(
                project_id=proj.id,
                user_id=users[email].id,
                role=role,
                status="active",
                added_by_id=users["owner@fyp-lab.edu"].id,
            )
        )

    fixture_host = os.environ.get("DEMO_FIXTURE_HOST", "fixture")
    fixture_port = int(os.environ.get("DEMO_FIXTURE_PORT", "8080"))
    fixture_url = f"http://{fixture_host}:{fixture_port}/api"

    tgt_lab = Target(
        workspace_id=ws_main.id,
        project_id=proj.id,
        display_name="Campus Shop Local Lab Fixture",
        description="Controlled local website fixture with pages, forms, duplicate links, and blocked redirect traps.",
        base_url=fixture_url,
        normalized_base_url=fixture_url,
        scheme="http",
        hostname=fixture_host,
        port=fixture_port,
        base_path="/api",
        environment="local_lab",
        authorization_status="authorized",
        ownership_declaration="Owned by FYP Security Lab Team; local disposable demo fixture.",
        permission_reference="FYP-LAB-AUTH-2026-01",
        last_authorization_review_at=utc_now(),
    )
    tgt_staging = Target(
        workspace_id=ws_main.id,
        project_id=proj.id,
        display_name="Order Settlement Staging (Pending)",
        description="Conservative staging profile awaiting owner authorization and scope approval.",
        base_url="https://staging-orders.fyp.internal/v1",
        normalized_base_url="https://staging-orders.fyp.internal/v1",
        scheme="https",
        hostname="staging-orders.fyp.internal",
        port=443,
        base_path="/v1",
        environment="staging",
        authorization_status="pending_review",
        ownership_declaration="Departmental staging sandbox managed by CS Systems.",
        permission_reference="PENDING-SIGN-OFF-09",
        last_authorization_review_at=utc_now(),
    )
    db.add_all([tgt_lab, tgt_staging])
    db.flush()

    db.add(
        AuthorizationRecord(
            target_id=tgt_lab.id,
            declaring_user_id=users["tester@fyp-lab.edu"].id,
            reviewed_by_user_id=users["owner@fyp-lab.edu"].id,
            permission_reference=tgt_lab.permission_reference,
            ownership_declaration=tgt_lab.ownership_declaration,
            declaration_hash=sha256_canonical_json(f"{tgt_lab.normalized_base_url}|{tgt_lab.permission_reference}"),
            state="authorized",
            scope_version_label="v1",
            notes="Approved synthetic local lab target for Semester 7 demonstration.",
            effective_at=utc_now(),
        )
    )
    db.add(
        AuthorizationRecord(
            target_id=tgt_staging.id,
            declaring_user_id=users["tester@fyp-lab.edu"].id,
            permission_reference=tgt_staging.permission_reference,
            ownership_declaration=tgt_staging.ownership_declaration,
            declaration_hash=sha256_canonical_json(f"{tgt_staging.normalized_base_url}|{tgt_staging.permission_reference}"),
            state="pending_review",
            notes="Awaiting Project Owner review.",
        )
    )

    scope_req = ScopeCreateRequest(
        allowed_hosts=[fixture_host],
        allowed_ports=[fixture_port],
        allowed_path_prefixes=["/api", "/auth"],
        excluded_paths=["/rest/admin/reset", "/api-admin"],
        follow_redirects_in_scope_only=True,
        allowed_methods=["GET", "HEAD", "OPTIONS"],
        state_changing_methods_enabled=False,
        block_private_and_link_local=True,
        local_lab_exception_active=True,
        budgets=ScopeBudgetsSchema(
            max_crawl_depth=3,
            max_requests=200,
            per_host_rate_rps=10.0,
            concurrency=2,
            max_wall_clock_seconds=120,
        ),
        change_summary="Approved Semester 7 Local Lab discovery scope.",
    )
    preview, policy_hash, canonical = build_normalized_scope_preview(scope_req)
    sv = ScopeVersion(
        target_id=tgt_lab.id,
        version_number=1,
        version_label="v1",
        approval_state="approved",
        allowed_hosts=canonical["allowed_hosts"],
        allowed_ports=canonical["allowed_ports"],
        allowed_path_prefixes=canonical["allowed_path_prefixes"],
        excluded_paths=canonical["excluded_paths"],
        allowed_methods=canonical["allowed_methods"],
        follow_redirects_in_scope_only=True,
        state_changing_methods_enabled=False,
        block_private_and_link_local=True,
        local_lab_exception_active=True,
        budgets=canonical["budgets"],
        normalized_preview=preview,
        policy_hash=policy_hash,
        change_summary=scope_req.change_summary,
        created_by_id=users["tester@fyp-lab.edu"].id,
        approved_by_id=users["owner@fyp-lab.edu"].id,
        approved_at=utc_now(),
    )
    db.add(sv)
    db.flush()
    tgt_lab.current_scope_version_id = sv.id

    append_audit(
        db,
        actor_user_id=users["owner@fyp-lab.edu"].id,
        actor_email="owner@fyp-lab.edu",
        actor_role="project_owner",
        action="DEMO_ENVIRONMENT_SEEDED",
        resource_type="workspace",
        resource_id=ws_main.id,
        workspace_id=ws_main.id,
        project_id=proj.id,
        target_id=tgt_lab.id,
        outcome="success",
        detail="Seeded synthetic Semester 7 demo workspace, project, targets, and approved Scope v1.",
    )
    db.commit()
    return {
        "status": "seeded",
        "workspace_id": ws_main.id,
        "project_id": proj.id,
        "authorized_target_id": tgt_lab.id,
        "pending_target_id": tgt_staging.id,
        "scope_id": sv.id,
    }


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        result = seed_database(db)
        print(result)


if __name__ == "__main__":
    main()
