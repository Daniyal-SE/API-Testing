from __future__ import annotations

import time

import pytest

from app.core.logging import redact_dict, sanitize_log_string
from app.models.assessment import AssessmentRun
from app.runner.budgets import BudgetTracker, CrawlBudgets
from app.runner.controller import transition_run_state
from app.runner.crawler import extract_links_and_forms
from app.runner.destination_validation import validate_destination
from app.runner.policy import ScopePolicy, evaluate_scope
from app.runner.redirect_validation import validate_redirect_target
from app.runner.url_normalization import UrlNormalizationError, normalize_url


def test_url_normalization_canonical_and_rejections() -> None:
    norm = normalize_url("HTTP://LocalHost:8080/api//v1/./orders/?b=2&a=secret_val#frag")
    assert norm.scheme == "http"
    assert norm.hostname == "localhost"
    assert norm.port == 8080
    assert norm.path == "/api/v1/orders"
    # Inventory URL must omit query parameter values to avoid secret leakage
    assert norm.inventory_url == "http://localhost:8080/api/v1/orders"
    assert norm.query_keys == ("a", "b")
    assert "a=secret_val&b=2" in norm.fetch_url

    for bad in [
        "ftp://localhost/file",
        "http://user:pass@localhost:8080/api",
        "http://localhost:8080/api/%2fadmin",
        "http://localhost:8080/api/..\\secret",
        "http://localhost:8080/api/bad\nline",
    ]:
        with pytest.raises(UrlNormalizationError):
            normalize_url(bad)


def test_scope_matcher_segment_aware_and_exclusions() -> None:
    policy = ScopePolicy.from_dict(
        {
            "allowed_hosts": ["localhost"],
            "allowed_ports": [8080],
            "allowed_path_prefixes": ["/api", "/auth"],
            "excluded_paths": ["/api/admin", "/rest/admin/reset"],
            "allowed_methods": ["GET", "HEAD"],
            "follow_redirects_in_scope_only": True,
            "block_private_and_link_local": True,
            "local_lab_exception_active": True,
        }
    )

    assert evaluate_scope(normalize_url("http://localhost:8080/api"), "GET", policy).allowed is True
    assert evaluate_scope(normalize_url("http://localhost:8080/api/orders/1"), "GET", policy).allowed is True

    # Prefix collision must NOT match /api
    collision = evaluate_scope(normalize_url("http://localhost:8080/api-admin/users"), "GET", policy)
    assert collision.allowed is False
    assert collision.scope_status == "out_of_scope"

    # Traversal into excluded path must be caught after normalization
    excl = evaluate_scope(normalize_url("http://localhost:8080/api/orders/../admin/reset"), "GET", policy)
    assert excl.allowed is False
    assert excl.scope_status == "excluded_pattern"

    # Method & port checks
    assert evaluate_scope(normalize_url("http://localhost:8080/api/orders"), "POST", policy).allowed is False
    assert evaluate_scope(normalize_url("http://localhost:9999/api/orders"), "GET", policy).allowed is False


def test_destination_validation_ipv4_ipv6_ssrf_and_local_lab() -> None:
    strict_policy = ScopePolicy.from_dict(
        {
            "allowed_hosts": ["staging.fyp.internal"],
            "allowed_ports": [443],
            "allowed_path_prefixes": ["/"],
            "block_private_and_link_local": True,
            "local_lab_exception_active": False,
        }
    )
    for bad_ip in [
        "127.0.0.1",
        "::1",
        "::ffff:127.0.0.1",
        "10.0.0.5",
        "172.16.10.2",
        "192.168.1.50",
        "169.254.169.254",
        "100.64.0.10",
        "fe80::1",
        "fc00::1",
    ]:
        res = validate_destination(
            hostname="staging.fyp.internal",
            policy=strict_policy,
            registered_target_host="staging.fyp.internal",
            target_environment="staging",
            dns_resolver=lambda _h, ip=bad_ip: [ip],
        )
        assert res.allowed is False, f"{bad_ip} should be blocked"

    # Public IP passes
    ok = validate_destination(
        hostname="staging.fyp.internal",
        policy=strict_policy,
        registered_target_host="staging.fyp.internal",
        target_environment="staging",
        dns_resolver=lambda _h: ["93.184.216.34"],
    )
    assert ok.allowed is True

    # Narrow Local Lab exception permits loopback ONLY for exact registered local_lab target
    lab_policy = ScopePolicy.from_dict(
        {
            "allowed_hosts": ["localhost"],
            "allowed_ports": [8080],
            "allowed_path_prefixes": ["/api"],
            "block_private_and_link_local": True,
            "local_lab_exception_active": True,
        }
    )
    lab_ok = validate_destination(
        hostname="localhost",
        policy=lab_policy,
        registered_target_host="localhost",
        target_environment="local_lab",
        dns_resolver=lambda _h: ["127.0.0.1"],
    )
    assert lab_ok.allowed is True

    # Even with local_lab exception active, metadata IP and mismatched host stay blocked
    meta_blocked = validate_destination(
        hostname="localhost",
        policy=lab_policy,
        registered_target_host="localhost",
        target_environment="local_lab",
        dns_resolver=lambda _h: ["169.254.169.254"],
    )
    assert meta_blocked.allowed is False

    host_mismatch = validate_destination(
        hostname="other-internal",
        policy=lab_policy,
        registered_target_host="localhost",
        target_environment="local_lab",
        dns_resolver=lambda _h: ["127.0.0.1"],
    )
    assert host_mismatch.allowed is False


def test_redirect_revalidation() -> None:
    policy = ScopePolicy.from_dict(
        {
            "allowed_hosts": ["localhost"],
            "allowed_ports": [8080],
            "allowed_path_prefixes": ["/api"],
            "follow_redirects_in_scope_only": True,
            "block_private_and_link_local": True,
            "local_lab_exception_active": True,
        }
    )
    in_scope = validate_redirect_target(
        location_header="/api/orders",
        current_url="http://localhost:8080/api",
        policy=policy,
        registered_target_host="localhost",
        target_environment="local_lab",
        dns_resolver=lambda _h: ["127.0.0.1"],
    )
    assert in_scope.allowed is True

    ext = validate_redirect_target(
        location_header="https://evil.example.com/steal",
        current_url="http://localhost:8080/api",
        policy=policy,
        registered_target_host="localhost",
        target_environment="local_lab",
        dns_resolver=lambda _h: ["93.184.216.34"],
    )
    assert ext.allowed is False
    assert ext.scope_status == "blocked_redirect"


def test_budget_tracker_and_state_machine() -> None:
    tracker = BudgetTracker(
        budgets=CrawlBudgets(
            max_crawl_depth=2,
            max_requests=2,
            per_host_rate_rps=20.0,
            concurrency=1,
            max_wall_clock_seconds=60,
        )
    )
    assert tracker.check_before_request(0) == (True, None)
    tracker.record_request_dispatched()
    assert tracker.check_before_request(1) == (True, None)
    tracker.record_request_dispatched()
    assert tracker.check_before_request(1) == (False, "BUDGET_REQUESTS_EXHAUSTED")
    assert tracker.check_before_request(3) == (False, "BUDGET_DEPTH_EXCEEDED")

    # Duration exhaustion
    expired_tracker = BudgetTracker(
        budgets=CrawlBudgets(1, 100, 10.0, 1, max_wall_clock_seconds=0),
        start_monotonic=time.monotonic() - 2,
    )
    assert expired_tracker.check_before_request(0) == (False, "BUDGET_DURATION_EXCEEDED")

    # State machine transitions
    run = AssessmentRun(
        run_code="RUN-999",
        workspace_id="w",
        project_id="p",
        target_id="t",
        scope_version_id="s",
        initiated_by_id="u",
        modules=["url_discovery"],
        run_plan_json={},
        plan_hash="h",
        state="queued",
        current_phase="Queued",
        request_budget=10,
    )
    transition_run_state(run, "running")
    transition_run_state(run, "completed")
    with pytest.raises(ValueError):
        transition_run_state(run, "running")


def test_audit_redaction_and_html_form_parser() -> None:
    redacted = redact_dict({"password": "p1", "cookie": "c1", "token": "t1", "note": "ok"})
    assert redacted["password"] == "[REDACTED]"
    assert redacted["cookie"] == "[REDACTED]"
    assert redacted["token"] == "[REDACTED]"
    assert redacted["note"] == "ok"
    assert "abm_session=[REDACTED]" in sanitize_log_string("Cookie: abm_session=secret123;")

    links, forms = extract_links_and_forms(
        '<a href="/api/items">Items</a><form action="/auth/login" method="POST"><input name="email" type="email"/><input name="password" type="password"/></form>',
        "http://localhost:8080/api",
    )
    assert links[0][0] == "/api/items"
    assert forms[0]["method"] == "POST"
    assert forms[0]["field_names"] == ["email", "password"]
