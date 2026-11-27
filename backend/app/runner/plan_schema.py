"""Typed, versioned ExecutionPlanV1 contract shared between control plane and restricted runner."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TargetPlanV1(BaseModel):
    id: str = ""
    normalized_base_url: str
    scheme: Literal["http", "https"]
    hostname: str
    port: int = Field(..., ge=1, le=65535)
    environment: Literal["local_lab", "staging"] = "local_lab"


class BudgetsPlanV1(BaseModel):
    max_crawl_depth: int = Field(default=3, ge=1, le=20)
    max_requests: int = Field(default=400, ge=1, le=50000)
    per_host_rate_rps: float = Field(default=2.0, ge=0.1, le=100.0)
    concurrency: int = Field(default=2, ge=1, le=50)
    max_wall_clock_seconds: int = Field(default=240, ge=5, le=7200)


class ScopePlanV1(BaseModel):
    id: str = ""
    version_label: str = "v1"
    policy_hash: str = ""
    allowed_hosts: list[str] = Field(..., min_length=1)
    allowed_ports: list[int] = Field(..., min_length=1)
    allowed_path_prefixes: list[str] = Field(default_factory=lambda: ["/"])
    excluded_paths: list[str] = Field(default_factory=list)
    allowed_methods: list[str] = Field(default_factory=lambda: ["GET", "HEAD", "OPTIONS"])
    follow_redirects_in_scope_only: bool = True
    block_private_and_link_local: bool = True
    local_lab_exception_active: bool = False
    budgets: BudgetsPlanV1


class ExecutionPlanV1(BaseModel):
    plan_schema_version: Literal[1] = 1
    run_id: str = "local"
    correlation_id: str = "req-runner"
    target: TargetPlanV1
    scope: ScopePlanV1
    modules: list[str] = Field(default_factory=lambda: ["url_discovery"])
    runner_image: str = "abm-safe-runner:sem7"
