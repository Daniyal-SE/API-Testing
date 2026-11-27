from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import time
from collections.abc import Callable
from dataclasses import asdict
from typing import Any, Protocol

import httpx

from app.runner.budgets import CrawlBudgets
from app.runner.crawler import CrawlEvent, CrawlResult, DiscoveredRecord, SafeCrawler
from app.runner.output_capture import BoundedOutputCapture
from app.runner.plan_validator import validate_execution_plan
from app.runner.policy import ScopePolicy
from app.runner.security_profile import ContainerSecurityProfile, build_hardened_docker_command


class RunnerExecutor(Protocol):
    """Boundary separating the Trusted Runner Controller from untrusted task execution."""

    mode_name: str

    def execute_discovery(
        self,
        *,
        run_plan: dict[str, Any],
        is_cancelled: Callable[[], bool],
        on_progress: Callable[[dict[str, int]], None] | None = None,
    ) -> CrawlResult:
        ...


class LocalRestrictedRunnerExecutor:
    """
    Restricted local runner adapter used in academic development/CI environments
    where Docker daemon is unavailable. Enforces identical URL normalization,
    scope matching, DNS/IP SSRF blocking, manual redirect checks, and budgets,
    with zero access to DB sessions, Redis, or control-plane secrets.
    """

    mode_name = "local_restricted"

    def __init__(
        self,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        max_response_bytes: int = 2_097_152,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
    ) -> None:
        self.transport = transport
        self.max_response_bytes = max_response_bytes
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout

    def execute_discovery(
        self,
        *,
        run_plan: dict[str, Any],
        is_cancelled: Callable[[], bool],
        on_progress: Callable[[dict[str, int]], None] | None = None,
    ) -> CrawlResult:
        policy = ScopePolicy.from_dict(
            run_plan["scope"],
            allowed_schemes=(run_plan["target"]["scheme"],),
        )
        b_dict = run_plan["scope"]["budgets"]
        budgets = CrawlBudgets(
            max_crawl_depth=int(b_dict["max_crawl_depth"]),
            max_requests=int(b_dict["max_requests"]),
            per_host_rate_rps=float(b_dict["per_host_rate_rps"]),
            concurrency=int(b_dict["concurrency"]),
            max_wall_clock_seconds=int(b_dict["max_wall_clock_seconds"]),
            max_response_bytes=self.max_response_bytes,
        )
        crawler = SafeCrawler(
            seed_url=run_plan["target"]["normalized_base_url"],
            registered_target_host=run_plan["target"]["hostname"],
            target_environment=run_plan["target"]["environment"],
            policy=policy,
            budgets=budgets,
            is_cancelled=is_cancelled,
            on_progress=on_progress,
            transport=self.transport,
            connect_timeout=self.connect_timeout,
            read_timeout=self.read_timeout,
        )
        return asyncio.run(crawler.run())


class DockerRunnerExecutor:
    """
    Short-lived unprivileged Docker container executor (`--read-only`, `--cap-drop=ALL`,
    non-root user, memory/CPU/PID limits, no Docker socket or DB credentials mounted).
    """

    mode_name = "docker"

    def __init__(
        self,
        image: str = "abm-safe-runner:sem7",
        max_response_bytes: int = 2_097_152,
        max_output_bytes: int = 4_194_304,
    ) -> None:
        self.image = image
        self.max_response_bytes = max_response_bytes
        self.max_output_bytes = max_output_bytes

    def build_docker_command(
        self,
        wall_clock_seconds: int,
        *,
        run_id: str = "local",
        correlation_id: str = "req-runner",
        local_lab_exception_active: bool = False,
    ) -> list[str]:
        profile = ContainerSecurityProfile(
            image=self.image,
            network_mode="abm_internal" if local_lab_exception_active else "none",
            max_response_bytes=self.max_response_bytes,
        )
        return build_hardened_docker_command(
            profile,
            run_id=run_id,
            correlation_id=correlation_id,
        )

    def execute_discovery(
        self,
        *,
        run_plan: dict[str, Any],
        is_cancelled: Callable[[], bool],
        on_progress: Callable[[dict[str, int]], None] | None = None,
    ) -> CrawlResult:
        plan = validate_execution_plan(run_plan)
        wall_clock = plan.scope.budgets.max_wall_clock_seconds
        cmd = self.build_docker_command(
            wall_clock,
            run_id=plan.run_id,
            correlation_id=plan.correlation_id,
            local_lab_exception_active=plan.scope.local_lab_exception_active,
        )
        payload = json.dumps({"run_plan": plan.model_dump()})
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        assert proc.stdin is not None
        proc.stdin.write(payload)
        proc.stdin.close()

        deadline = time.monotonic() + wall_clock + 5
        while proc.poll() is None:
            if is_cancelled():
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                return CrawlResult(
                    terminal_state="cancelled",
                    stop_reason="CANCELLED_BY_OPERATOR",
                    request_count=0,
                    discovered_urls_count=0,
                    in_scope_urls_count=0,
                    excluded_urls_count=0,
                    duplicate_urls_count=0,
                    blocked_redirects_count=0,
                    duration_seconds=0,
                    records=[],
                    events=[
                        CrawlEvent(
                            event_type="CONTAINER_TERMINATED",
                            level="warning",
                            phase="Control",
                            message="Terminated restricted Docker runner container upon operator cancellation.",
                        )
                    ],
                )
            if time.monotonic() >= deadline:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
                return CrawlResult(
                    terminal_state="partial",
                    stop_reason="BUDGET_DURATION_EXCEEDED",
                    request_count=0,
                    discovered_urls_count=0,
                    in_scope_urls_count=0,
                    excluded_urls_count=0,
                    duplicate_urls_count=0,
                    blocked_redirects_count=0,
                    duration_seconds=wall_clock,
                    records=[],
                    events=[
                        CrawlEvent(
                            event_type="CONTAINER_TIMEOUT",
                            level="warning",
                            phase="Control",
                            message="Terminated restricted Docker runner container after wall-clock deadline.",
                        )
                    ],
                )
            try:
                proc.wait(timeout=0.5)
            except subprocess.TimeoutExpired:
                continue

        capture = BoundedOutputCapture(max_bytes=self.max_output_bytes)
        stdout_data = capture.read_stream(proc.stdout)
        if capture.truncated or proc.returncode != 0 or not stdout_data.strip():
            return CrawlResult(
                terminal_state="failed",
                stop_reason=f"CONTAINER_EXIT_{proc.returncode}",
                request_count=0,
                discovered_urls_count=0,
                in_scope_urls_count=0,
                excluded_urls_count=0,
                duplicate_urls_count=0,
                blocked_redirects_count=0,
                duration_seconds=0,
                records=[],
                events=[
                    CrawlEvent(
                        event_type="RUNNER_FAILED",
                        level="error",
                        phase="URL Discovery",
                        message=f"Restricted runner container exited with code {proc.returncode}.",
                    )
                ],
            )

        data = json.loads(stdout_data)
        return CrawlResult(
            terminal_state=data["terminal_state"],
            stop_reason=data["stop_reason"],
            request_count=data["request_count"],
            discovered_urls_count=data["discovered_urls_count"],
            in_scope_urls_count=data["in_scope_urls_count"],
            excluded_urls_count=data["excluded_urls_count"],
            duplicate_urls_count=data["duplicate_urls_count"],
            blocked_redirects_count=data["blocked_redirects_count"],
            duration_seconds=data["duration_seconds"],
            records=[DiscoveredRecord(**r) for r in data["records"]],
            events=[CrawlEvent(**e) for e in data["events"]],
        )


def _container_entrypoint() -> None:
    """Entrypoint invoked inside Dockerfile.runner reading RunPlan JSON from stdin."""
    raw = sys.stdin.read()
    envelope = json.loads(raw)
    executor = LocalRestrictedRunnerExecutor()
    result = executor.execute_discovery(
        run_plan=envelope["run_plan"],
        is_cancelled=lambda: False,
    )
    print(json.dumps(asdict(result)))


if __name__ == "__main__":
    _container_entrypoint()
