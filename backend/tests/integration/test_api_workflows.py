from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from rq import SimpleWorker
from sqlalchemy import inspect

from app.core.security import utc_now
from app.models.assessment import AssessmentRun
from app.models.user import UserSession
from app.queue.connection import get_rq_queue
from app.services.assessment_service import reconcile_stale_runs
from tests.conftest import login_client


def test_alembic_upgrade_and_downgrade_clean(tmp_path: Path) -> None:
    db_file = tmp_path / "alembic_verify.sqlite3"
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_file.as_posix()}")

    command.upgrade(cfg, "head")
    from sqlalchemy import create_engine

    eng = create_engine(f"sqlite:///{db_file.as_posix()}")
    tables = set(inspect(eng).get_table_names())
    expected = {
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
    assert expected.issubset(tables)
    # Ensure NO Semester 8 tables were created
    assert "findings" not in tables
    assert "openapi_contracts" not in tables
    assert "business_invariants" not in tables
    eng.dispose()

    command.downgrade(cfg, "base")
    eng2 = create_engine(f"sqlite:///{db_file.as_posix()}")
    assert set(inspect(eng2).get_table_names()) == {"alembic_version"}
    eng2.dispose()


def test_auth_session_csrf_and_logout_lifecycle(client) -> None:
    tc, TestingSession = client

    cap = tc.get("/api/v1/auth/capabilities")
    assert cap.status_code == 200
    assert cap.json()["registrationMode"] == "invite_only"
    assert cap.json()["semester8Enabled"] is False

    # Invite-only mode blocks self-registration
    reg = tc.post(
        "/api/v1/auth/register",
        json={"email": "new@fyp-lab.edu", "displayName": "New User", "password": "StrongPassword!123"},
    )
    assert reg.status_code == 403

    headers = login_client(tc, "owner@fyp-lab.edu")
    me = tc.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "owner@fyp-lab.edu"

    # Cookie-authenticated state mutation without CSRF header must fail with 403
    no_csrf = tc.post(
        "/api/v1/projects",
        json={
            "name": "No CSRF Project",
            "description": "Should fail due to missing X-CSRF-Token header.",
            "workspaceId": me.json()["workspaces"][0]["id"],
        },
    )
    assert no_csrf.status_code == 403

    # Logout invalidates session
    out = tc.post("/api/v1/auth/logout", headers=headers)
    assert out.status_code == 200
    assert tc.get("/api/v1/auth/me").status_code == 401

    # Expired session in DB is rejected
    login_client(tc, "tester@fyp-lab.edu")
    with TestingSession() as db:
        for s in db.query(UserSession).all():
            s.expires_at = utc_now() - timedelta(minutes=1)
        db.commit()
    expired_me = tc.get("/api/v1/auth/me")
    assert expired_me.status_code == 401
    assert expired_me.json()["error"]["code"] == "SESSION_EXPIRED"


def test_project_target_authz_scope_versioning_and_revalidation(client) -> None:
    tc, _ = client
    headers = login_client(tc, "owner@fyp-lab.edu")
    ws_id = tc.get("/api/v1/workspaces").json()[0]["id"]

    # Create project
    proj_resp = tc.post(
        "/api/v1/projects",
        headers=headers,
        json={
            "name": "Sem 7 Integration Project",
            "description": "Verify project, target, authorization, scope versioning, and audit logs.",
            "workspaceId": ws_id,
        },
    )
    assert proj_resp.status_code == 201
    project_id = proj_resp.json()["id"]

    # Register target -> starts in pending_review
    tgt_resp = tc.post(
        "/api/v1/targets",
        headers=headers,
        json={
            "projectId": project_id,
            "displayName": "Local Fixture Alpha",
            "baseUrl": "http://localhost:8080/api/",
            "environment": "local_lab",
            "description": "Local disposable lab target.",
            "ownershipDeclaration": "Owned by FYP Team for local academic defense.",
            "permissionReference": "FYP-INT-001",
        },
    )
    assert tgt_resp.status_code == 201
    target = tgt_resp.json()
    assert target["normalizedBaseUrl"] == "http://localhost:8080/api"
    assert target["authorizationStatus"] == "pending_review"

    # Approve authorization
    auth_resp = tc.post(
        f"/api/v1/targets/{target['id']}/authorization-decision",
        headers=headers,
        json={"state": "authorized", "notes": "Approved for integration testing"},
    )
    assert auth_resp.status_code == 200
    assert auth_resp.json()["authorizationStatus"] == "authorized"

    # Create scope v1 -> approve -> create v2 -> approve (v1 becomes superseded)
    scope_payload = {
        "allowedHosts": ["localhost"],
        "allowedPorts": [8080],
        "allowedPathPrefixes": ["/api"],
        "excludedPaths": ["/api/secret"],
        "followRedirectsInScopeOnly": True,
        "allowedMethods": ["GET", "HEAD"],
        "blockPrivateAndLinkLocal": True,
        "localLabExceptionActive": True,
        "budgets": {
            "maxCrawlDepth": 2,
            "maxRequests": 50,
            "perHostRateRps": 5,
            "concurrency": 1,
            "maxWallClockSeconds": 60,
        },
        "changeSummary": "Initial scope v1",
    }
    s1 = tc.post(f"/api/v1/targets/{target['id']}/scopes", headers=headers, json=scope_payload)
    assert s1.status_code == 201
    assert s1.json()["versionLabel"] == "v1"
    assert s1.json()["approvalState"] == "pending_approval"

    a1 = tc.post(f"/api/v1/scopes/{s1.json()['id']}/decision", headers=headers, json={"decision": "approved"})
    assert a1.status_code == 200
    assert a1.json()["approvalState"] == "approved"

    scope_payload["changeSummary"] = "Expanded prefix v2"
    s2 = tc.post(f"/api/v1/targets/{target['id']}/scopes", headers=headers, json=scope_payload)
    assert s2.json()["versionLabel"] == "v2"
    tc.post(f"/api/v1/scopes/{s2.json()['id']}/decision", headers=headers, json={"decision": "approved"})

    scopes = tc.get(f"/api/v1/targets/{target['id']}/scopes").json()
    by_label = {s["versionLabel"]: s["approvalState"] for s in scopes}
    assert by_label == {"v2": "approved", "v1": "superseded"}

    # Updating target URL invalidates authorization -> needs_revalidation
    upd = tc.patch(
        f"/api/v1/targets/{target['id']}",
        headers=headers,
        json={"baseUrl": "http://localhost:9090/api"},
    )
    assert upd.status_code == 200
    assert upd.json()["authorizationStatus"] == "needs_revalidation"

    # Audit log contains recorded governance events
    audits = tc.get(f"/api/v1/audit?projectId={project_id}&pageSize=50").json()
    actions = {a["action"] for a in audits["items"]}
    assert {"PROJECT_CREATED", "TARGET_REGISTERED", "TARGET_AUTHORIZATION_UPDATED", "SCOPE_APPROVED", "TARGET_IDENTITY_UPDATED"}.issubset(actions)


def test_rq_dispatch_immutable_snapshot_and_stale_reconciliation(client, fake_redis, test_settings, monkeypatch) -> None:
    tc, TestingSession = client
    headers = login_client(tc, "owner@fyp-lab.edu")

    # Fetch seeded authorized local lab target
    targets = tc.get("/api/v1/targets").json()
    lab_target = next(t for t in targets if t["authorizationStatus"] == "authorized")

    # Preflight passes for url_discovery
    pf = tc.post(
        "/api/v1/assessments/preflight",
        headers=headers,
        json={"targetId": lab_target["id"], "modules": ["url_discovery"]},
    )
    assert pf.status_code == 200
    assert pf.json()["canLaunch"] is True

    # Launch assessment -> queued into RQ
    launch = tc.post(
        "/api/v1/assessments",
        headers=headers,
        json={"targetId": lab_target["id"], "modules": ["url_discovery"]},
    )
    assert launch.status_code == 202
    run = launch.json()
    assert run["state"] == "queued"
    original_plan_hash = run["planHash"]

    # Mutate scope after queuing: run's immutable snapshot must remain unchanged
    tc.post(
        f"/api/v1/targets/{lab_target['id']}/scopes",
        headers=headers,
        json={
            "allowedHosts": ["localhost"],
            "allowedPorts": [8080],
            "allowedPathPrefixes": ["/changed"],
            "excludedPaths": [],
            "followRedirectsInScopeOnly": True,
            "allowedMethods": ["GET"],
            "blockPrivateAndLinkLocal": True,
            "localLabExceptionActive": True,
            "budgets": {
                "maxCrawlDepth": 1,
                "maxRequests": 10,
                "perHostRateRps": 1,
                "concurrency": 1,
                "maxWallClockSeconds": 30,
            },
            "changeSummary": "Post-launch draft",
        },
    )
    run_detail = tc.get(f"/api/v1/assessments/{run['id']}").json()["run"]
    assert run_detail["planHash"] == original_plan_hash

    # Verify job exists in RQ queue
    queue = get_rq_queue(fake_redis)
    assert len(queue.jobs) == 1

    # Simulate stale run reconciliation without blindly replaying
    with TestingSession() as db:
        db_run = db.get(AssessmentRun, run["id"])
        assert db_run is not None
        db_run.state = "running"
        db_run.heartbeat_at = utc_now() - timedelta(seconds=test_settings.stale_run_timeout_seconds + 60)
        db.commit()
        reconciled = reconcile_stale_runs(db, settings=test_settings)
        assert reconciled == 1

    after = tc.get(f"/api/v1/assessments/{run['id']}").json()["run"]
    assert after["state"] == "interrupted"

    # Worker bursting on an already-terminal run must not replay it
    monkeypatch.setattr("app.queue.tasks.SessionLocal", TestingSession)
    worker = SimpleWorker([queue], connection=fake_redis)
    worker.work(burst=True)
    after_burst = tc.get(f"/api/v1/assessments/{run['id']}").json()["run"]
    assert after_burst["state"] == "interrupted"
