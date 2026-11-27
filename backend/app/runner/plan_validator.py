"""Fail-closed validation of ExecutionPlanV1 before launching an ephemeral container."""
from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.runner.plan_schema import ExecutionPlanV1

ALLOWED_RUNNER_IMAGES = {"abm-safe-runner:sem7"}
ALLOWED_S7_MODULES = {"url_discovery"}


class PlanValidationError(ValueError):
    """Raised when an execution plan fails schema, policy, image, or ceiling validation."""


def validate_execution_plan(
    raw_plan: dict[str, Any],
    *,
    settings: Settings | None = None,
    allowed_images: set[str] | None = None,
) -> ExecutionPlanV1:
    cfg = settings or get_settings()
    allowlist = allowed_images or (ALLOWED_RUNNER_IMAGES | {cfg.runner_docker_image})

    normalized_input = dict(raw_plan)
    if "plan_schema_version" not in normalized_input:
        normalized_input["plan_schema_version"] = 1
    if "runner_image" not in normalized_input:
        normalized_input["runner_image"] = cfg.runner_docker_image

    try:
        plan = ExecutionPlanV1(**normalized_input)
    except ValidationError as exc:
        raise PlanValidationError(f"Invalid execution plan schema: {exc}") from exc

    if plan.runner_image not in allowlist:
        raise PlanValidationError(f"Runner image '{plan.runner_image}' is not in the allowlist.")

    unsupported = [m for m in plan.modules if m not in ALLOWED_S7_MODULES]
    if unsupported:
        raise PlanValidationError(f"Unsupported/Semester-8 modules requested: {unsupported}")

    b = plan.scope.budgets
    if b.max_crawl_depth > cfg.platform_max_crawl_depth:
        raise PlanValidationError("max_crawl_depth exceeds platform ceiling.")
    if b.max_requests > cfg.platform_max_requests:
        raise PlanValidationError("max_requests exceeds platform ceiling.")
    if b.per_host_rate_rps > cfg.platform_max_rate_rps:
        raise PlanValidationError("per_host_rate_rps exceeds platform ceiling.")
    if b.concurrency > cfg.platform_max_concurrency:
        raise PlanValidationError("concurrency exceeds platform ceiling.")
    if b.max_wall_clock_seconds > cfg.platform_max_wall_clock_seconds:
        raise PlanValidationError("max_wall_clock_seconds exceeds platform ceiling.")

    return plan
