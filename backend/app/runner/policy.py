from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.runner.url_normalization import NormalizedUrl, normalize_prefix

SAFE_DISCOVERY_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})


@dataclass(frozen=True)
class ScopeDecision:
    allowed: bool
    scope_status: str  # in_scope | out_of_scope | excluded_pattern
    reason: str


@dataclass(frozen=True)
class ScopePolicy:
    """Immutable scope policy enforced by both control-plane validation and runner."""

    allowed_schemes: frozenset[str]
    allowed_hosts: frozenset[str]
    allowed_ports: frozenset[int]
    allowed_path_prefixes: tuple[str, ...]
    excluded_paths: tuple[str, ...]
    allowed_methods: frozenset[str]
    follow_redirects_in_scope_only: bool
    block_private_and_link_local: bool
    local_lab_exception_active: bool

    @classmethod
    def from_dict(cls, data: dict[str, Any], *, allowed_schemes: tuple[str, ...] = ("http", "https")) -> "ScopePolicy":
        hosts = frozenset(h.strip().lower().rstrip(".") for h in data.get("allowed_hosts", []) if h.strip())
        ports = frozenset(int(p) for p in data.get("allowed_ports", []))
        prefixes = tuple(normalize_prefix(p) for p in data.get("allowed_path_prefixes", ["/"]) if p.strip()) or ("/",)
        exclusions = tuple(normalize_prefix(p) for p in data.get("excluded_paths", []) if p.strip())
        methods = frozenset(m.strip().upper() for m in data.get("allowed_methods", ["GET", "HEAD", "OPTIONS"]))
        return cls(
            allowed_schemes=frozenset(s.lower() for s in allowed_schemes),
            allowed_hosts=hosts,
            allowed_ports=ports,
            allowed_path_prefixes=prefixes,
            excluded_paths=exclusions,
            allowed_methods=methods,
            follow_redirects_in_scope_only=bool(data.get("follow_redirects_in_scope_only", True)),
            block_private_and_link_local=bool(data.get("block_private_and_link_local", True)),
            local_lab_exception_active=bool(data.get("local_lab_exception_active", False)),
        )


def path_matches_segment_prefix(path: str, prefix: str) -> bool:
    """Match URL paths on segment boundaries so /api never matches /api-admin."""
    if prefix == "/":
        return True
    clean_prefix = prefix.rstrip("/")
    return path == clean_prefix or path.startswith(clean_prefix + "/")


def evaluate_scope(url: NormalizedUrl, method: str, policy: ScopePolicy) -> ScopeDecision:
    """Evaluate a normalized URL and HTTP method against an immutable ScopePolicy."""
    method_upper = method.strip().upper()
    if method_upper not in policy.allowed_methods:
        return ScopeDecision(
            allowed=False,
            scope_status="out_of_scope",
            reason=f"HTTP method {method_upper} is not in approved scope allowedMethods.",
        )

    if url.scheme not in policy.allowed_schemes:
        return ScopeDecision(
            allowed=False,
            scope_status="out_of_scope",
            reason=f"Scheme '{url.scheme}' is outside approved target scheme.",
        )

    if url.hostname not in policy.allowed_hosts:
        return ScopeDecision(
            allowed=False,
            scope_status="out_of_scope",
            reason=f"Host '{url.hostname}' is outside approved target host allowlist.",
        )

    if policy.allowed_ports and url.port not in policy.allowed_ports:
        return ScopeDecision(
            allowed=False,
            scope_status="out_of_scope",
            reason=f"Port {url.port} is outside approved target port allowlist.",
        )

    for excl in policy.excluded_paths:
        if path_matches_segment_prefix(url.path, excl):
            return ScopeDecision(
                allowed=False,
                scope_status="excluded_pattern",
                reason=f"Matched excluded path rule '{excl}'.",
            )

    matched_prefix = next(
        (pref for pref in policy.allowed_path_prefixes if path_matches_segment_prefix(url.path, pref)),
        None,
    )
    if matched_prefix is None:
        return ScopeDecision(
            allowed=False,
            scope_status="out_of_scope",
            reason=f"Path '{url.path}' does not match any approved path prefix.",
        )

    return ScopeDecision(
        allowed=True,
        scope_status="in_scope",
        reason=f"Matches host {url.hostname}:{url.port} and prefix '{matched_prefix}'.",
    )

