from __future__ import annotations

from tests.conftest import login_client


def test_unauthenticated_access_denied(client) -> None:
    tc, _ = client
    for method, path in [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/workspaces"),
        ("GET", "/api/v1/projects"),
        ("GET", "/api/v1/targets"),
        ("GET", "/api/v1/assessments"),
        ("GET", "/api/v1/url-inventory"),
        ("GET", "/api/v1/audit"),
    ]:
        res = tc.request(method, path)
        assert res.status_code == 401, f"{method} {path} returned {res.status_code}"


def test_cross_workspace_idor_isolation(client) -> None:
    tc, _ = client

    # Owner reads Workspace A project & target
    login_client(tc, "owner@fyp-lab.edu")
    owner_projects = tc.get("/api/v1/projects").json()
    owner_targets = tc.get("/api/v1/targets").json()
    target_a_id = owner_targets[0]["id"]
    proj_a_id = owner_projects[0]["id"]

    # Switch session to isolated Workspace B user (outsider@other-lab.edu)
    outsider_headers = login_client(tc, "outsider@other-lab.edu")
    assert all(p["id"] != proj_a_id for p in tc.get("/api/v1/projects").json())
    assert tc.get(f"/api/v1/projects/{proj_a_id}").status_code == 404
    assert tc.get(f"/api/v1/targets/{target_a_id}").status_code == 404
    assert tc.get(f"/api/v1/targets/{target_a_id}/scopes").status_code == 404
    assert (
        tc.post(
            f"/api/v1/targets/{target_a_id}/authorization-decision",
            headers=outsider_headers,
            json={"state": "authorized", "notes": "IDOR attempt"},
        ).status_code
        == 404
    )


def test_rbac_least_privilege_boundaries(client) -> None:
    tc, _ = client
    login_client(tc, "owner@fyp-lab.edu")
    targets = tc.get("/api/v1/targets").json()
    pending_tgt = next(t for t in targets if t["authorizationStatus"] == "pending_review")
    lab_tgt = next(t for t in targets if t["authorizationStatus"] == "authorized")

    # Security Tester cannot approve target authorization or scope
    tester_headers = login_client(tc, "tester@fyp-lab.edu")
    assert (
        tc.post(
            f"/api/v1/targets/{pending_tgt['id']}/authorization-decision",
            headers=tester_headers,
            json={"state": "authorized", "notes": "Self-approval attempt"},
        ).status_code
        == 403
    )
    draft_scope = tc.post(
        f"/api/v1/targets/{lab_tgt['id']}/scopes",
        headers=tester_headers,
        json={
            "allowedHosts": ["localhost"],
            "allowedPorts": [8080],
            "allowedPathPrefixes": ["/api"],
            "excludedPaths": [],
            "followRedirectsInScopeOnly": True,
            "allowedMethods": ["GET"],
            "blockPrivateAndLinkLocal": True,
            "localLabExceptionActive": True,
            "budgets": {
                "maxCrawlDepth": 2,
                "maxRequests": 25,
                "perHostRateRps": 2,
                "concurrency": 1,
                "maxWallClockSeconds": 30,
            },
            "changeSummary": "Tester draft",
        },
    )
    assert draft_scope.status_code == 201
    assert (
        tc.post(
            f"/api/v1/scopes/{draft_scope.json()['id']}/decision",
            headers=tester_headers,
            json={"decision": "approved"},
        ).status_code
        == 403
    )

    # Evaluator is strictly read-only
    eval_headers = login_client(tc, "evaluator@fyp-lab.edu")
    ws_id = tc.get("/api/v1/workspaces").json()[0]["id"]
    assert (
        tc.post(
            "/api/v1/projects",
            headers=eval_headers,
            json={"name": "Illegal", "description": "Evaluator should be blocked", "workspaceId": ws_id},
        ).status_code
        == 403
    )
    assert (
        tc.post(
            "/api/v1/assessments",
            headers=eval_headers,
            json={"targetId": lab_tgt["id"], "modules": ["url_discovery"]},
        ).status_code
        == 403
    )

    # System Admin cannot authorize targets, approve scope, or launch runs
    admin_headers = login_client(tc, "admin@fyp-lab.edu")
    assert tc.get("/api/v1/runner/health").status_code == 200
    assert (
        tc.post(
            f"/api/v1/targets/{pending_tgt['id']}/authorization-decision",
            headers=admin_headers,
            json={"state": "authorized", "notes": "Admin bypass attempt"},
        ).status_code
        == 403
    )
    assert (
        tc.post(
            f"/api/v1/scopes/{draft_scope.json()['id']}/decision",
            headers=admin_headers,
            json={"decision": "approved"},
        ).status_code
        == 403
    )


def test_authorization_scope_semester8_and_conflict_gates(client) -> None:
    tc, _ = client
    headers = login_client(tc, "owner@fyp-lab.edu")
    targets = tc.get("/api/v1/targets").json()
    pending_tgt = next(t for t in targets if t["authorizationStatus"] == "pending_review")
    lab_tgt = next(t for t in targets if t["authorizationStatus"] == "authorized")

    # Pending authorization blocks launch
    blocked = tc.post(
        "/api/v1/assessments",
        headers=headers,
        json={"targetId": pending_tgt["id"], "modules": ["url_discovery"]},
    )
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "MISSING_TARGET_AUTHORIZATION"

    # Semester 8 module rejected in Semester 7
    sem8 = tc.post(
        "/api/v1/assessments",
        headers=headers,
        json={"targetId": lab_tgt["id"], "modules": ["url_discovery", "zap_passive"]},
    )
    assert sem8.status_code == 422
    assert sem8.json()["error"]["code"] == "SEMESTER_8_MODULE_DEFERRED"

    # Launch valid run, then second concurrent run on same target returns 409 Conflict
    first = tc.post(
        "/api/v1/assessments",
        headers=headers,
        json={"targetId": lab_tgt["id"], "modules": ["url_discovery"]},
    )
    assert first.status_code == 202
    second = tc.post(
        "/api/v1/assessments",
        headers=headers,
        json={"targetId": lab_tgt["id"], "modules": ["url_discovery"]},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ACTIVE_RUN_CONFLICT"


def test_login_rate_limiting_and_no_secret_leakage(client) -> None:
    tc, _ = client
    for _ in range(5):
        r = tc.post("/api/v1/auth/login", json={"email": "owner@fyp-lab.edu", "password": "WrongPassword123"})
        assert r.status_code == 401
        assert "owner@fyp-lab.edu" not in r.json()["error"]["message"]

    limited = tc.post("/api/v1/auth/login", json={"email": "owner@fyp-lab.edu", "password": "WrongPassword123"})
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "RATE_LIMITED"

    # Audit logs never contain plaintext passwords or raw session cookies
    login_client(tc, "tester@fyp-lab.edu")
    audits_text = tc.get("/api/v1/audit?pageSize=50").text
    assert "WrongPassword123" not in audits_text
    assert "FypDemoPass!2026" not in audits_text
