from __future__ import annotations

import hashlib
import posixpath
import re
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f]")
_ENCODED_SEPARATOR_RE = re.compile(r"%(?:2f|5c|00)", re.IGNORECASE)
_MULTI_SLASH_RE = re.compile(r"/{2,}")


@dataclass(frozen=True)
class NormalizedUrl:
    """Canonical representation of a validated http/https URL."""

    scheme: str
    hostname: str
    port: int
    path: str
    query_keys: tuple[str, ...]
    fetch_url: str
    inventory_url: str
    canonical_key: str


class UrlNormalizationError(ValueError):
    """Raised when a URL fails strict safety or syntax normalization."""


def _is_ipv6_literal(host: str) -> bool:
    return ":" in host


def _format_netloc(hostname: str, port: int, scheme: str) -> str:
    host_part = f"[{hostname}]" if _is_ipv6_literal(hostname) else hostname
    default_port = 443 if scheme == "https" else 80
    if port == default_port:
        return host_part
    return f"{host_part}:{port}"


def _canonicalize_path(raw_path: str) -> str:
    if "\\" in raw_path:
        raise UrlNormalizationError("Backslashes are not permitted in URL paths.")
    if _ENCODED_SEPARATOR_RE.search(raw_path):
        raise UrlNormalizationError("Encoded path separators (%2f/%5c/%00) are rejected.")

    collapsed = _MULTI_SLASH_RE.sub("/", raw_path or "/")
    if not collapsed.startswith("/"):
        collapsed = "/" + collapsed

    resolved = posixpath.normpath(collapsed)
    if not resolved.startswith("/"):
        resolved = "/" + resolved
    resolved = _MULTI_SLASH_RE.sub("/", resolved)
    if resolved != "/" and resolved.endswith("/"):
        resolved = resolved.rstrip("/")
    return resolved


def normalize_url(raw_url: str, *, base_url: str | None = None) -> NormalizedUrl:
    """Parse and strictly normalize an HTTP(S) URL, rejecting smuggling or credential tricks."""
    if not raw_url or not isinstance(raw_url, str):
        raise UrlNormalizationError("URL cannot be empty.")

    candidate = raw_url.strip()
    if _CONTROL_CHAR_RE.search(candidate) or any(ch.isspace() for ch in candidate):
        raise UrlNormalizationError("URL contains invalid whitespace or control characters.")

    if base_url:
        candidate = urljoin(base_url, candidate)

    try:
        parsed = urlsplit(candidate)
    except ValueError as exc:
        raise UrlNormalizationError("Malformed URL syntax.") from exc

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise UrlNormalizationError("Only http and https schemes are supported.")

    if parsed.username is not None or parsed.password is not None or "@" in parsed.netloc:
        raise UrlNormalizationError("Embedded credentials in URL authority are prohibited.")

    raw_host = parsed.hostname
    if not raw_host:
        raise UrlNormalizationError("URL must include a valid hostname.")

    hostname = raw_host.lower().rstrip(".")
    if not hostname or any(c in hostname for c in ("/", "\\", "?", "#")):
        raise UrlNormalizationError("Malformed hostname in URL.")

    try:
        explicit_port = parsed.port
    except ValueError as exc:
        raise UrlNormalizationError("Invalid port in URL authority.") from exc

    default_port = 443 if scheme == "https" else 80
    port = explicit_port if explicit_port is not None else default_port
    if port < 1 or port > 65535:
        raise UrlNormalizationError("Port must be between 1 and 65535.")

    path = _canonicalize_path(parsed.path or "/")

    query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
    sorted_pairs = sorted(query_pairs, key=lambda kv: (kv[0], kv[1]))
    query_keys = tuple(sorted({k for k, _ in sorted_pairs if k}))
    sorted_query_str = urlencode(sorted_pairs)

    netloc = _format_netloc(hostname, port, scheme)
    fetch_url = urlunsplit((scheme, netloc, "" if path == "/" and not sorted_query_str else path, sorted_query_str, ""))
    if not fetch_url.endswith("/") and path == "/" and not sorted_query_str:
        fetch_url = f"{scheme}://{netloc}"

    inventory_path = "" if path == "/" else path
    inventory_url = f"{scheme}://{netloc}{inventory_path}"
    canonical_key = hashlib.sha256(f"{inventory_url}|keys={','.join(query_keys)}".encode("utf-8")).hexdigest()

    return NormalizedUrl(
        scheme=scheme,
        hostname=hostname,
        port=port,
        path=path,
        query_keys=query_keys,
        fetch_url=fetch_url,
        inventory_url=inventory_url,
        canonical_key=canonical_key,
    )


def normalize_prefix(prefix: str) -> str:
    """Normalize a scope path prefix cleanly."""
    cleaned = prefix.strip()
    if not cleaned:
        return "/"
    return _canonicalize_path(cleaned)
