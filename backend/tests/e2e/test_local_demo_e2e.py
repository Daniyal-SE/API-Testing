from __future__ import annotations

import httpx
from rq import SimpleWorker
from rq.serializers import JSONSerializer

from app.queue.connection import get_rq_queue
from app.runner.budgets import CrawlBudgets
from app.runner.container import LocalRestrictedRunnerExecutor
from app.runner.controller import RunnerController
from app.runner.crawler import SafeCrawler
from app.runner.policy import ScopePolicy
from demo_fixture.app import REQUEST_LOG, fixture_app, reset_fixture_log
from tests.conftest import login_client


def test_semester7_end_to_end_discovery_and_cancellation(client, fake_redis, monkeypatch) -> None:
    tc, TestingSession = client
    reset_fixture_log()

    owner_headers = login_client(tc, "owner@fyp-lab.edu")

    # 1. Create project
    ws_id = tc.get("/api/v1/workspaces").json()[0]["id"]
    proj = tc.post(
        "/api/v1/projects",
        headers=owner_headers,
        json={
            "name": "Semester 7 E2E Demo Project",
            "description": "End-to-end verification of safe local URL discovery and cancellation.",
            "workspaceId": ws_id,
        },
    ).json()

    # 2. Register local fixture target
    tester_headers = login_client(tc, "tester@fyp-lab.edu")
    tgt = tc.post(
        "/api/v1/targets",
        headers=tester_headers,
        json={
            "projectId": proj["id"],
            "displayName": "Campus Shop E2E Fixture",
            "baseUrl": "http://localhost:8080/api",
            "environment": "local_lab",
            "description": "Local website fixture for S7-AC-05 & S7-AC-06.",
            "ownershipDeclaration": "Owned by FYP Team; deterministic local fixture.",
            "permissionReference": "FYP-E2E-001",
        },
    ).json()

    # 3. Attempt unapproved launch -> blocked
    assert (
        tc.post(
            "/api/v1/assessments",
            headers=tester_headers,
            json={"targetId": tgt["id"], "modules": ["url_discovery"]},
        ).status_code
        == 422
    )

    # 4. Owner approves authorization and Scope v1
    owner_headers = login_client(tc, "owner@fyp-lab.edu")
    assert (
        tc.post(
            f"/api/v1/targets/{tgt['id']}/authorization-decision",
            headers=owner_headers,
            json={"state": "authorized", "notes": "Approved for E2E demo"},
        ).status_code
        == 200
    )
    tester_headers = login_client(tc, "tester@fyp-lab.edu")
    scope = tc.post(
        f"/api/v1/targets/{tgt['id']}/scopes",
        headers=tester_headers,
        json={
            "allowedHosts": ["localhost"],
            "allowedPorts": [8080],
            "allowedPathPrefixes": ["/api", "/auth"],
            "excludedPaths": ["/rest/admin/reset", "/api-admin"],
            "followRedirectsInScopeOnly": True,
            "allowedMethods": ["GET", "HEAD", "OPTIONS"],
            "blockPrivateAndLinkLocal": True,
            "localLabExceptionActive": True,
            "budgets": {
                "maxCrawlDepth": 3,
                "maxRequests": 50,
                "perHostRateRps": 20.0,
                "concurrency": 2,
                "maxWallClockSeconds": 60,
            },
            "changeSummary": "E2E bounded discovery scope",
        },
    ).json()
    owner_headers = login_client(tc, "owner@fyp-lab.edu")
    tc.post(
        f"/api/v1/scopes/{scope['id']}/decision",
        headers=owner_headers,
        json={"decision": "approved"},
    )

    # 5. Launch URL discovery assessment -> queued into RQ
    tester_headers = login_client(tc, "tester@fyp-lab.edu")
    launch = tc.post(
        "/api/v1/assessments",
        headers=tester_headers,
        json={"targetId": tgt["id"], "modules": ["url_discovery"]},
    )
    assert launch.status_code == 202
    run_id = launch.json()["id"]

    # Bind runner controller to ASGI transport serving fixture_app (zero external internet!)
    asgi_transport = httpx.ASGITransport(app=fixture_app)
    monkeypatch.setattr("app.queue.tasks.SessionLocal", TestingSession)
    monkeypatch.setattr(
        "app.queue.tasks.RunnerController",
        lambda settings=None: RunnerController(
            executor=LocalRestrictedRunnerExecutor(transport=asgi_transport),
            settings=settings,
        ),
    )

    queue = get_rq_queue(fake_redis)
    worker = SimpleWorker([queue], connection=fake_redis, serializer=JSONSerializer)
    worker.work(burst=True)

    # 6. Verify completed run telemetry, counters, and inventory
    detail = tc.get(f"/api/v1/assessments/{run_id}").json()
    run_out = detail["run"]
    assert run_out["state"] == "completed"
    assert run_out["progressPercent"] == 100
    assert run_out["inScopeUrlsCount"] >= 4
    assert run_out["blockedRedirectsCount"] >= 2
    assert run_out["duplicateUrlsCount"] >= 1

    inv = tc.get(f"/api/v1/url-inventory?runId={run_id}&pageSize=50").json()
    assert inv["pagination"]["totalItems"] >= 6
    urls_by_path = {(u["path"], u["method"]): u for u in inv["items"]}

    # Expected in-scope endpoints & form discovered without submitting POST form
    assert ("/api", "GET") in urls_by_path
    assert ("/api/catalog", "GET") in urls_by_path
    assert ("/api/orders", "GET") in urls_by_path
    assert ("/auth/login", "GET") in urls_by_path
    assert ("/auth/login", "POST") in urls_by_path
    assert urls_by_path[("/auth/login", "POST")]["assetType"] == "form"
    assert urls_by_path[("/auth/login", "POST")]["formFields"] == ["email", "password", "csrf_token"]
    assert urls_by_path[("/api/catalog", "GET")]["hitCount"] >= 2  # Deduplicated!

    # Check provenance on /api/orders
    orders_id = urls_by_path[("/api/orders", "GET")]["id"]
    orders_detail = tc.get(f"/api/v1/url-inventory/{orders_id}").json()
    assert len(orders_detail["sources"]) >= 1
    assert any(s["referringUrl"] for s in orders_detail["sources"])

    # CRITICAL S7-AC-05 PROOF: excluded routes, prefix collisions, form POSTs, and external/metadata redirects were NEVER fetched
    assert "/rest/admin/reset" not in REQUEST_LOG
    assert "/api-admin/secret" not in REQUEST_LOG
    assert "POST /auth/login" not in REQUEST_LOG

    # 7. Demonstrate cancellation confirmation before terminal state
    launch2 = tc.post(
        "/api/v1/assessments",
        headers=tester_headers,
        json={"targetId": tgt["id"], "modules": ["url_discovery"]},
    )
    assert launch2.status_code == 202
    run2_id = launch2.json()["id"]

    cancel_resp = tc.post(f"/api/v1/assessments/{run2_id}/cancel", headers=tester_headers)
    assert cancel_resp.status_code == 202
    assert cancel_resp.json()["state"] == "cancellation_requested"

    worker.work(burst=True)
    run2_after = tc.get(f"/api/v1/assessments/{run2_id}").json()["run"]
    assert run2_after["state"] == "cancelled"
    assert run2_after["requestCount"] == 0


async def test_mid_crawl_cancellation_and_budget_stop_preserve_partial_results() -> None:
    reset_fixture_log()
    policy = ScopePolicy.from_dict(
        {
            "allowed_hosts": ["localhost"],
            "allowed_ports": [8080],
            "allowed_path_prefixes": ["/api", "/auth"],
            "excluded_paths": ["/rest/admin/reset", "/api-admin"],
            "follow_redirects_in_scope_only": True,
            "allowed_methods": ["GET", "HEAD", "OPTIONS"],
            "block_private_and_link_local": True,
            "local_lab_exception_active": True,
        },
        allowed_schemes=("http",),
    )

    # Budget exhaustion stops at 2 requests and preserves partial records
    crawler_budget = SafeCrawler(
        seed_url="http://localhost:8080/api",
        registered_target_host="localhost",
        target_environment="local_lab",
        policy=policy,
        budgets=CrawlBudgets(
            max_crawl_depth=3,
            max_requests=2,
            per_host_rate_rps=20.0,
            concurrency=1,
            max_wall_clock_seconds=30,
        ),
        transport=httpx.ASGITransport(app=fixture_app),
    )
    res_budget = await crawler_budget.run()
    assert res_budget.terminal_state == "partial"
    assert res_budget.stop_reason == "BUDGET_REQUESTS_EXHAUSTED"
    assert res_budget.request_count == 2
    assert res_budget.in_scope_urls_count >= 2

    # Mid-crawl cancellation stops after 1 request and preserves partial inventory
    calls = {"n": 0}

    def cancel_after_one() -> bool:
        calls["n"] += 1
        return calls["n"] > 2

    crawler_cancel = SafeCrawler(
        seed_url="http://localhost:8080/api",
        registered_target_host="localhost",
        target_environment="local_lab",
        policy=policy,
        budgets=CrawlBudgets(
            max_crawl_depth=3,
            max_requests=20,
            per_host_rate_rps=20.0,
            concurrency=1,
            max_wall_clock_seconds=30,
        ),
        is_cancelled=cancel_after_one,
        transport=httpx.ASGITransport(app=fixture_app),
    )
    res_cancel = await crawler_cancel.run()
    assert res_cancel.terminal_state == "partial"
    assert res_cancel.stop_reason == "CANCELLED_BY_OPERATOR"
    assert res_cancel.request_count == 1
    assert res_cancel.discovered_urls_count >= 1
