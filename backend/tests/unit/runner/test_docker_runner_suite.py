"""Unit, security, output-capture, and orphan-reconciliation tests for Docker Runner."""
from __future__ import annotations

import io
import json
import subprocess

import pytest

from app.runner.container import DockerRunnerExecutor
from app.runner.output_capture import BoundedOutputCapture, sanitize_runner_output
from app.runner.plan_validator import PlanValidationError, validate_execution_plan
from app.runner.reconciliation import reconcile_orphaned_containers
from app.runner.security_profile import ContainerSecurityProfile, build_hardened_docker_command


def _sample_plan(local_lab: bool = False) -> dict:
    return {
        "plan_schema_version": 1,
        "run_id": "run-docker-1",
        "correlation_id": "req-docker-1",
        "target": {
            "id": "t-1",
            "normalized_base_url": "http://localhost:8080/api",
            "scheme": "http",
            "hostname": "localhost",
            "port": 8080,
            "environment": "local_lab",
        },
        "scope": {
            "id": "s-1",
            "version_label": "v1",
            "policy_hash": "a" * 64,
            "allowed_hosts": ["localhost"],
            "allowed_ports": [8080],
            "allowed_path_prefixes": ["/api"],
            "excluded_paths": [],
            "allowed_methods": ["GET"],
            "follow_redirects_in_scope_only": True,
            "block_private_and_link_local": True,
            "local_lab_exception_active": local_lab,
            "budgets": {
                "max_crawl_depth": 3,
                "max_requests": 50,
                "per_host_rate_rps": 2.0,
                "concurrency": 2,
                "max_wall_clock_seconds": 60,
            },
        },
        "modules": ["url_discovery"],
        "runner_image": "abm-safe-runner:sem7",
    }


def test_container_security_profile_and_default_deny_network() -> None:
    executor = DockerRunnerExecutor()
    cmd_none = executor.build_docker_command(60, run_id="run-1", correlation_id="cid-1", local_lab_exception_active=False)
    joined = " ".join(cmd_none)
    assert "--read-only" in cmd_none
    assert "--cap-drop=ALL" in cmd_none
    assert "--security-opt=no-new-privileges:true" in cmd_none
    assert "--user=10001:10001" in cmd_none
    assert "--network=none" in cmd_none
    assert "--pids-limit=64" in cmd_none
    assert "--ulimit=nofile=256:256" in cmd_none
    assert "--label=abm.managed=true" in cmd_none
    assert "--privileged" not in joined
    assert "docker.sock" not in joined

    cmd_lab = executor.build_docker_command(60, run_id="run-1", correlation_id="cid-1", local_lab_exception_active=True)
    assert "--network=abm_internal" in cmd_lab


def test_execution_plan_validation_rejects_unsafe_inputs() -> None:
    plan = validate_execution_plan(_sample_plan())
    assert plan.plan_schema_version == 1

    bad_ver = _sample_plan()
    bad_ver["plan_schema_version"] = 99
    with pytest.raises(PlanValidationError):
        validate_execution_plan(bad_ver)

    bad_img = _sample_plan()
    bad_img["runner_image"] = "evil/untrusted:latest"
    with pytest.raises(PlanValidationError):
        validate_execution_plan(bad_img)

    bad_mod = _sample_plan()
    bad_mod["modules"] = ["zap_scan"]
    with pytest.raises(PlanValidationError):
        validate_execution_plan(bad_mod)

    bad_budget = _sample_plan()
    bad_budget["scope"]["budgets"]["max_requests"] = 999_999
    with pytest.raises(PlanValidationError):
        validate_execution_plan(bad_budget)


def test_bounded_output_capture_and_ansi_secret_sanitization() -> None:
    cleaned, truncated = sanitize_runner_output("\x1b[31mERROR\x1b[0m Cookie: abm_session=secret123;", max_bytes=128)
    assert "\x1b[" not in cleaned
    assert "abm_session=[REDACTED]" in cleaned
    assert truncated is False

    cap = BoundedOutputCapture(max_bytes=10)
    out = cap.read_stream(io.StringIO("0123456789ABCDEF"))
    assert cap.truncated is True
    assert out == "0123456789"


def test_orphan_container_reconciliation_only_touches_abm_managed(db_session_factory) -> None:
    _, TestingSession = db_session_factory
    removed_ids: list[str] = []

    def _fake_run(cmd: list[str], **_kwargs) -> subprocess.CompletedProcess[str]:
        if cmd[:2] == ["docker", "ps"]:
            line1 = json.dumps({"ID": "cid-orphan", "Labels": "abm.managed=true,abm.run_id=missing-run"})
            return subprocess.CompletedProcess(cmd, 0, stdout=line1 + "\n", stderr="")
        if cmd[:3] == ["docker", "rm", "-f"]:
            removed_ids.append(cmd[3])
            return subprocess.CompletedProcess(cmd, 0, stdout=cmd[3], stderr="")
        return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="err")

    with TestingSession() as db:
        res = reconcile_orphaned_containers(db, run_cmd=_fake_run)
        assert res == ["cid-orphan"]
        assert removed_ids == ["cid-orphan"]
