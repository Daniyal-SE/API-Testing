from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import CamelModel


class DiscoverySourceOut(CamelModel):
    id: str
    source_type: str
    referring_url: str | None = None
    element_context: str | None = None
    observed_at: datetime


class DiscoveredUrlItemOut(CamelModel):
    id: str
    project_id: str
    target_id: str
    run_id: str
    run_code: str | None = None
    normalized_url: str
    path: str
    method: str = "GET"
    asset_type: str
    source: str
    host: str
    port: int
    scope_status: str
    scope_reason: str
    test_status: str
    parameters: list[str] = Field(default_factory=list)
    form_fields: list[str] | None = None
    form_metadata: dict[str, Any] | None = None
    status_code: int | None = None
    content_type: str | None = None
    depth: int = 0
    hit_count: int = 1
    first_seen_at: datetime
    last_seen_at: datetime
    related_finding_ids: list[str] = Field(default_factory=list)


class UrlInventoryDetailOut(CamelModel):
    url: DiscoveredUrlItemOut
    sources: list[DiscoverySourceOut]
    related_findings: list[dict[str, Any]] = Field(default_factory=list)
    zap_alerts: list[dict[str, Any]] = Field(default_factory=list)

