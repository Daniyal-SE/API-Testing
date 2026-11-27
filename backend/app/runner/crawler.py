from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx
from bs4 import BeautifulSoup

from app.core.logging import sanitize_log_string
from app.runner.budgets import BudgetTracker, CrawlBudgets
from app.runner.destination_validation import DnsResolver, default_dns_resolver, validate_destination
from app.runner.policy import ScopePolicy, evaluate_scope
from app.runner.redirect_validation import validate_redirect_target
from app.runner.url_normalization import NormalizedUrl, UrlNormalizationError, normalize_url

MAX_REDIRECT_HOPS = 5


@dataclass(frozen=True)
class CrawlCandidate:
    url: NormalizedUrl
    depth: int
    source_type: str
    referring_url: str | None
    element_context: str | None = None


@dataclass
class DiscoveredRecord:
    canonical_key: str
    normalized_url: str
    scheme: str
    host: str
    port: int
    path: str
    method_hint: str
    asset_type: str
    primary_source: str
    scope_status: str
    scope_reason: str
    test_status: str
    parameter_names: list[str]
    form_metadata: dict[str, Any] | None
    status_code: int | None
    content_type: str | None
    depth: int
    hit_count: int = 1
    sources: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class CrawlEvent:
    event_type: str
    level: str
    phase: str
    message: str
    detail: dict[str, Any] | None = None


@dataclass
class CrawlResult:
    terminal_state: str  # completed | partial | cancelled | failed
    stop_reason: str
    request_count: int
    discovered_urls_count: int
    in_scope_urls_count: int
    excluded_urls_count: int
    duplicate_urls_count: int
    blocked_redirects_count: int
    duration_seconds: int
    records: list[DiscoveredRecord]
    events: list[CrawlEvent]


def extract_links_and_forms(
    html_text: str,
    base_url: str,
) -> tuple[list[tuple[str, str, str]], list[dict[str, Any]]]:
    """Parse HTML for links and form metadata (read-only inventory; never submits forms)."""
    soup = BeautifulSoup(html_text, "html.parser")
    links: list[tuple[str, str, str]] = []

    for tag in soup.find_all("a", href=True):
        href = str(tag.get("href", "")).strip()
        if href and not href.startswith(("javascript:", "mailto:", "tel:", "#")):
            text = sanitize_log_string(tag.get_text(strip=True), 80)
            links.append((href, "link", f"a:{text}" if text else "a"))

    forms: list[dict[str, Any]] = []
    for form in soup.find_all("form"):
        action = str(form.get("action") or "").strip() or base_url
        method = str(form.get("method") or "GET").strip().upper()
        if method not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
            method = "GET"
        fields: list[dict[str, str]] = []
        for inp in form.find_all(["input", "select", "textarea"]):
            name = str(inp.get("name") or "").strip()
            if name:
                ftype = str(inp.get("type") or inp.name or "text").strip().lower()
                fields.append({"name": sanitize_log_string(name, 64), "type": sanitize_log_string(ftype, 32)})
        forms.append(
            {
                "action": action,
                "method": method,
                "field_names": [f["name"] for f in fields[:40]],
                "fields": fields[:40],
            }
        )
    return links, forms


class SafeCrawler:
    """Controlled same-origin HTTPX crawler enforcing scope, DNS/IP, redirect, and budget rules."""

    def __init__(
        self,
        *,
        seed_url: str,
        registered_target_host: str,
        target_environment: str,
        policy: ScopePolicy,
        budgets: CrawlBudgets,
        is_cancelled: Callable[[], bool] | None = None,
        on_progress: Callable[[dict[str, int]], None] | None = None,
        dns_resolver: DnsResolver = default_dns_resolver,
        transport: httpx.AsyncBaseTransport | None = None,
        connect_timeout: float = 5.0,
        read_timeout: float = 10.0,
    ) -> None:
        self.seed_url = seed_url
        self.registered_target_host = registered_target_host
        self.target_environment = target_environment
        self.policy = policy
        self.budgets = budgets
        self.is_cancelled = is_cancelled or (lambda: False)
        self.on_progress = on_progress
        self.dns_resolver = dns_resolver
        self.transport = transport
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout

    async def run(self) -> CrawlResult:
        tracker = BudgetTracker(budgets=self.budgets)
        events: list[CrawlEvent] = []
        records_by_key: dict[str, DiscoveredRecord] = {}
        queued_fetch_urls: set[str] = set()
        queue: deque[CrawlCandidate] = deque()
        duplicate_count = 0
        blocked_redirects = 0
        excluded_count = 0

        def record_url(
            *,
            norm: NormalizedUrl,
            method: str,
            asset_type: str,
            source_type: str,
            scope_status: str,
            scope_reason: str,
            test_status: str,
            referring_url: str | None,
            element_context: str | None,
            status_code: int | None,
            content_type: str | None,
            depth: int,
            form_metadata: dict[str, Any] | None = None,
        ) -> bool:
            nonlocal duplicate_count
            key = f"{method.upper()}:{norm.canonical_key}"
            now_iso = datetime.now(timezone.utc).isoformat()
            src_entry = {
                "source_type": source_type,
                "referring_url": referring_url,
                "element_context": sanitize_log_string(element_context or "", 200) or None,
                "observed_at": now_iso,
            }
            if key in records_by_key:
                existing = records_by_key[key]
                existing.hit_count += 1
                duplicate_count += 1
                if len(existing.sources) < 20:
                    existing.sources.append(src_entry)
                if form_metadata and not existing.form_metadata:
                    existing.form_metadata = form_metadata
                return False

            records_by_key[key] = DiscoveredRecord(
                canonical_key=key,
                normalized_url=norm.inventory_url,
                scheme=norm.scheme,
                host=norm.hostname,
                port=norm.port,
                path=norm.path,
                method_hint=method.upper(),
                asset_type=asset_type,
                primary_source=source_type,
                scope_status=scope_status,
                scope_reason=sanitize_log_string(scope_reason, 500),
                test_status=test_status,
                parameter_names=list(norm.query_keys),
                form_metadata=form_metadata,
                status_code=status_code,
                content_type=content_type,
                depth=depth,
                sources=[src_entry],
            )
            return True

        try:
            seed_norm = normalize_url(self.seed_url)
        except UrlNormalizationError as exc:
            events.append(
                CrawlEvent(
                    event_type="SEED_INVALID",
                    level="error",
                    phase="URL Discovery",
                    message=f"Seed URL rejected by normalizer: {exc}",
                )
            )
            return CrawlResult(
                terminal_state="failed",
                stop_reason="INVALID_SEED_URL",
                request_count=0,
                discovered_urls_count=0,
                in_scope_urls_count=0,
                excluded_urls_count=0,
                duplicate_urls_count=0,
                blocked_redirects_count=0,
                duration_seconds=int(tracker.elapsed_seconds()),
                records=[],
                events=events,
            )

        queue.append(CrawlCandidate(url=seed_norm, depth=0, source_type="seed", referring_url=None))
        queued_fetch_urls.add(seed_norm.fetch_url)

        timeout = httpx.Timeout(
            connect=self.connect_timeout,
            read=self.read_timeout,
            write=5.0,
            pool=5.0,
        )
        client_kwargs: dict[str, Any] = {
            "follow_redirects": False,
            "timeout": timeout,
            "headers": {"User-Agent": "ABM-Semester7-SafeCrawler/0.7 (+local-authorized)"},
        }
        if self.transport is not None:
            client_kwargs["transport"] = self.transport

        stop_reason = "QUEUE_EXHAUSTED"
        terminal_state = "completed"

        async with httpx.AsyncClient(**client_kwargs) as client:
            while queue:
                if self.is_cancelled():
                    stop_reason = "CANCELLED_BY_OPERATOR"
                    terminal_state = "partial" if records_by_key else "cancelled"
                    events.append(
                        CrawlEvent(
                            event_type="CRAWL_CANCELLED",
                            level="warning",
                            phase="Control",
                            message="Crawler observed cancellation signal; halting new requests.",
                        )
                    )
                    break

                candidate = queue.popleft()

                if candidate.depth > self.budgets.max_crawl_depth:
                    continue

                scope_dec = evaluate_scope(candidate.url, "GET", self.policy)
                if not scope_dec.allowed:
                    excluded_count += 1
                    record_url(
                        norm=candidate.url,
                        method="GET",
                        asset_type="route",
                        source_type=candidate.source_type,
                        scope_status=scope_dec.scope_status,
                        scope_reason=scope_dec.reason,
                        test_status="blocked",
                        referring_url=candidate.referring_url,
                        element_context=candidate.element_context,
                        status_code=None,
                        content_type=None,
                        depth=candidate.depth,
                    )
                    events.append(
                        CrawlEvent(
                            event_type="SCOPE_DENIED",
                            level="warning",
                            phase="URL Discovery",
                            message=f"Blocked out-of-scope URL {candidate.url.inventory_url}: {scope_dec.reason}",
                            detail={"url": candidate.url.inventory_url, "status": scope_dec.scope_status},
                        )
                    )
                    continue

                dest_check = validate_destination(
                    hostname=candidate.url.hostname,
                    policy=self.policy,
                    registered_target_host=self.registered_target_host,
                    target_environment=self.target_environment,
                    dns_resolver=self.dns_resolver,
                )
                if not dest_check.allowed:
                    excluded_count += 1
                    record_url(
                        norm=candidate.url,
                        method="GET",
                        asset_type="route",
                        source_type=candidate.source_type,
                        scope_status="out_of_scope",
                        scope_reason=dest_check.reason,
                        test_status="blocked",
                        referring_url=candidate.referring_url,
                        element_context=candidate.element_context,
                        status_code=None,
                        content_type=None,
                        depth=candidate.depth,
                    )
                    events.append(
                        CrawlEvent(
                            event_type="DESTINATION_BLOCKED",
                            level="warning",
                            phase="URL Discovery",
                            message=f"Blocked destination {candidate.url.inventory_url}: {dest_check.reason}",
                        )
                    )
                    continue

                ok_budget, budget_reason = tracker.check_before_request(candidate.depth)
                if not ok_budget:
                    stop_reason = budget_reason or "BUDGET_EXHAUSTED"
                    terminal_state = "partial"
                    events.append(
                        CrawlEvent(
                            event_type="BUDGET_STOPPED",
                            level="warning",
                            phase="URL Discovery",
                            message=f"Crawl halted due to budget limit ({stop_reason}).",
                        )
                    )
                    break

                delay = tracker.pace_delay_seconds()
                if delay > 0:
                    await asyncio.sleep(delay)

                if self.is_cancelled():
                    stop_reason = "CANCELLED_BY_OPERATOR"
                    terminal_state = "partial" if records_by_key else "cancelled"
                    break

                tracker.record_request_dispatched()
                try:
                    resp = await client.get(candidate.url.fetch_url)
                except httpx.HTTPError as exc:
                    events.append(
                        CrawlEvent(
                            event_type="REQUEST_ERROR",
                            level="warning",
                            phase="URL Discovery",
                            message=f"HTTP error fetching {candidate.url.inventory_url}: {type(exc).__name__}",
                        )
                    )
                    continue

                content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower() or None
                body_bytes = resp.content[: self.budgets.max_response_bytes]

                record_url(
                    norm=candidate.url,
                    method="GET",
                    asset_type="api_endpoint" if content_type == "application/json" else "page",
                    source_type=candidate.source_type,
                    scope_status="in_scope",
                    scope_reason=scope_dec.reason,
                    test_status="discovered_only",
                    referring_url=candidate.referring_url,
                    element_context=candidate.element_context,
                    status_code=resp.status_code,
                    content_type=content_type,
                    depth=candidate.depth,
                )

                if 300 <= resp.status_code < 400 and "location" in resp.headers:
                    location = resp.headers["location"]
                    r_dec = validate_redirect_target(
                        location_header=location,
                        current_url=candidate.url.fetch_url,
                        policy=self.policy,
                        registered_target_host=self.registered_target_host,
                        target_environment=self.target_environment,
                        dns_resolver=self.dns_resolver,
                    )
                    if not r_dec.allowed:
                        blocked_redirects += 1
                        if r_dec.normalized_target is not None:
                            record_url(
                                norm=r_dec.normalized_target,
                                method="GET",
                                asset_type="route",
                                source_type="redirect_blocked",
                                scope_status="blocked_redirect",
                                scope_reason=r_dec.reason,
                                test_status="blocked",
                                referring_url=candidate.url.inventory_url,
                                element_context=f"HTTP {resp.status_code} Location",
                                status_code=None,
                                content_type=None,
                                depth=candidate.depth + 1,
                            )
                        events.append(
                            CrawlEvent(
                                event_type="REDIRECT_BLOCKED",
                                level="warning",
                                phase="URL Discovery",
                                message=sanitize_log_string(r_dec.reason, 300),
                            )
                        )
                    elif r_dec.normalized_target is not None and candidate.depth + 1 <= self.budgets.max_crawl_depth:
                        if r_dec.normalized_target.fetch_url not in queued_fetch_urls:
                            queued_fetch_urls.add(r_dec.normalized_target.fetch_url)
                            queue.append(
                                CrawlCandidate(
                                    url=r_dec.normalized_target,
                                    depth=candidate.depth + 1,
                                    source_type="link",
                                    referring_url=candidate.url.inventory_url,
                                    element_context=f"HTTP {resp.status_code} redirect",
                                )
                            )

                if content_type and "html" in content_type and resp.status_code == 200:
                    html_text = body_bytes.decode("utf-8", errors="replace")
                    links, forms = extract_links_and_forms(html_text, candidate.url.fetch_url)

                    for href, src_type, ctx in links:
                        try:
                            link_norm = normalize_url(href, base_url=candidate.url.fetch_url)
                        except UrlNormalizationError:
                            continue

                        link_scope = evaluate_scope(link_norm, "GET", self.policy)
                        if not link_scope.allowed:
                            excluded_count += 1
                            record_url(
                                norm=link_norm,
                                method="GET",
                                asset_type="route",
                                source_type=src_type,
                                scope_status=link_scope.scope_status,
                                scope_reason=link_scope.reason,
                                test_status="blocked",
                                referring_url=candidate.url.inventory_url,
                                element_context=ctx,
                                status_code=None,
                                content_type=None,
                                depth=candidate.depth + 1,
                            )
                            continue

                        if candidate.depth + 1 <= self.budgets.max_crawl_depth:
                            if link_norm.fetch_url in queued_fetch_urls:
                                record_url(
                                    norm=link_norm,
                                    method="GET",
                                    asset_type="page",
                                    source_type=src_type,
                                    scope_status="in_scope",
                                    scope_reason=link_scope.reason,
                                    test_status="discovered_only",
                                    referring_url=candidate.url.inventory_url,
                                    element_context=ctx,
                                    status_code=None,
                                    content_type=None,
                                    depth=candidate.depth + 1,
                                )
                            else:
                                queued_fetch_urls.add(link_norm.fetch_url)
                                queue.append(
                                    CrawlCandidate(
                                        url=link_norm,
                                        depth=candidate.depth + 1,
                                        source_type=src_type,
                                        referring_url=candidate.url.inventory_url,
                                        element_context=ctx,
                                    )
                                )

                    for form in forms:
                        try:
                            action_norm = normalize_url(form["action"], base_url=candidate.url.fetch_url)
                        except UrlNormalizationError:
                            continue
                        form_method = form["method"]
                        form_scope = evaluate_scope(action_norm, form_method, self.policy)
                        record_url(
                            norm=action_norm,
                            method=form_method,
                            asset_type="form",
                            source_type="form",
                            scope_status=form_scope.scope_status,
                            scope_reason=(
                                form_scope.reason
                                if form_scope.allowed
                                else f"Form action recorded (not submitted): {form_scope.reason}"
                            ),
                            test_status="discovered_only" if form_scope.allowed else "blocked",
                            referring_url=candidate.url.inventory_url,
                            element_context=f"form[{form_method}]",
                            status_code=None,
                            content_type=None,
                            depth=candidate.depth + 1,
                            form_metadata={"method": form_method, "fields": form["fields"], "field_names": form["field_names"]},
                        )

                if self.on_progress:
                    self.on_progress(
                        {
                            "request_count": tracker.requests_sent,
                            "discovered_urls_count": len(records_by_key),
                            "in_scope_urls_count": sum(1 for r in records_by_key.values() if r.scope_status == "in_scope"),
                            "excluded_urls_count": excluded_count,
                            "duplicate_urls_count": duplicate_count,
                            "blocked_redirects_count": blocked_redirects,
                        }
                    )

        records = list(records_by_key.values())
        in_scope_count = sum(1 for r in records if r.scope_status == "in_scope")
        return CrawlResult(
            terminal_state=terminal_state,
            stop_reason=stop_reason,
            request_count=tracker.requests_sent,
            discovered_urls_count=len(records),
            in_scope_urls_count=in_scope_count,
            excluded_urls_count=excluded_count,
            duplicate_urls_count=duplicate_count,
            blocked_redirects_count=blocked_redirects,
            duration_seconds=max(0, int(round(tracker.elapsed_seconds()))),
            records=records,
            events=events,
        )
