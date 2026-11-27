from __future__ import annotations

from dataclasses import dataclass

from app.runner.destination_validation import DnsResolver, default_dns_resolver, validate_destination
from app.runner.policy import ScopePolicy, evaluate_scope
from app.runner.url_normalization import NormalizedUrl, UrlNormalizationError, normalize_url


@dataclass(frozen=True)
class RedirectDecision:
    allowed: bool
    normalized_target: NormalizedUrl | None
    scope_status: str
    reason: str


def validate_redirect_target(
    *,
    location_header: str,
    current_url: str,
    policy: ScopePolicy,
    registered_target_host: str,
    target_environment: str,
    dns_resolver: DnsResolver = default_dns_resolver,
) -> RedirectDecision:
    """Re-parse, normalize, scope-check, and DNS/IP-validate a 3xx redirect Location before dispatch."""
    if not location_header or not location_header.strip():
        return RedirectDecision(
            allowed=False,
            normalized_target=None,
            scope_status="blocked_redirect",
            reason="Redirect missing Location header.",
        )

    try:
        target = normalize_url(location_header, base_url=current_url)
    except UrlNormalizationError as exc:
        return RedirectDecision(
            allowed=False,
            normalized_target=None,
            scope_status="blocked_redirect",
            reason=f"Redirect URL failed normalization: {exc}",
        )

    if not policy.follow_redirects_in_scope_only:
        return RedirectDecision(
            allowed=False,
            normalized_target=target,
            scope_status="blocked_redirect",
            reason="Redirect following is disabled by scope policy.",
        )

    scope_dec = evaluate_scope(target, "GET", policy)
    if not scope_dec.allowed:
        return RedirectDecision(
            allowed=False,
            normalized_target=target,
            scope_status="blocked_redirect",
            reason=f"Blocked out-of-scope redirect: {scope_dec.reason}",
        )

    dest_check = validate_destination(
        hostname=target.hostname,
        policy=policy,
        registered_target_host=registered_target_host,
        target_environment=target_environment,
        dns_resolver=dns_resolver,
    )
    if not dest_check.allowed:
        return RedirectDecision(
            allowed=False,
            normalized_target=target,
            scope_status="blocked_redirect",
            reason=f"Blocked redirect destination IP: {dest_check.reason}",
        )

    return RedirectDecision(
        allowed=True,
        normalized_target=target,
        scope_status="in_scope",
        reason=f"Redirect destination passed scope and DNS/IP revalidation: {target.inventory_url}",
    )

