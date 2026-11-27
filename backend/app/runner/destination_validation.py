from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable
from dataclasses import dataclass

from app.runner.policy import ScopePolicy

_CGNAT_NETWORK = ipaddress.IPv4Network("100.64.0.0/10")
_METADATA_IPS = frozenset({"169.254.169.254", "fd00:ec2::254"})

IPAddr = ipaddress.IPv4Address | ipaddress.IPv6Address
DnsResolver = Callable[[str], list[str]]


@dataclass(frozen=True)
class DestinationCheckResult:
    allowed: bool
    resolved_ips: tuple[str, ...]
    reason: str


def default_dns_resolver(hostname: str) -> list[str]:
    """Resolve A and AAAA records for hostname using system socket resolver."""
    infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    ips: list[str] = []
    for info in infos:
        sockaddr = info[4]
        if sockaddr:
            ip_str = str(sockaddr[0]).split("%", 1)[0]
            if ip_str not in ips:
                ips.append(ip_str)
    return ips


def _unpack_ip(raw_ip: str) -> IPAddr:
    addr = ipaddress.ip_address(raw_ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped
    return addr


def classify_disallowed_ip(addr: IPAddr) -> str | None:
    """Return a non-null reason if IP is non-global (metadata, loopback, private, link-local, etc.)."""
    if str(addr) in _METADATA_IPS:
        return "cloud_metadata_ip"
    if addr.is_link_local:
        return "link_local_ip"
    if addr.is_multicast:
        return "multicast_ip"
    if addr.is_unspecified:
        return "unspecified_ip"
    if addr.is_loopback:
        return "loopback_ip"
    if addr.is_private:
        return "private_ip"
    if addr.is_reserved:
        return "reserved_ip"
    if isinstance(addr, ipaddress.IPv4Address) and addr in _CGNAT_NETWORK:
        return "cgnat_ip"
    return None


def validate_destination(
    *,
    hostname: str,
    policy: ScopePolicy,
    registered_target_host: str,
    target_environment: str,
    dns_resolver: DnsResolver = default_dns_resolver,
) -> DestinationCheckResult:
    """Resolve DNS A/AAAA records and enforce SSRF/private-network policy with narrow Local Lab exception."""
    clean_host = hostname.strip().lower().rstrip(".")
    registered_clean = registered_target_host.strip().lower().rstrip(".")

    try:
        ip_literal = _unpack_ip(clean_host)
        resolved = [str(ip_literal)]
    except ValueError:
        try:
            resolved = dns_resolver(clean_host)
        except OSError as exc:
            return DestinationCheckResult(
                allowed=False,
                resolved_ips=(),
                reason=f"DNS resolution failed for '{clean_host}': {exc}",
            )

    if not resolved:
        return DestinationCheckResult(
            allowed=False,
            resolved_ips=(),
            reason=f"DNS resolution returned no A/AAAA records for '{clean_host}'.",
        )

    is_exact_local_lab = (
        target_environment == "local_lab"
        and policy.local_lab_exception_active
        and clean_host == registered_clean
    )

    for raw_ip in resolved:
        try:
            addr = _unpack_ip(raw_ip)
        except ValueError:
            return DestinationCheckResult(
                allowed=False,
                resolved_ips=tuple(resolved),
                reason=f"Unparseable resolved IP '{raw_ip}'.",
            )

        classification = classify_disallowed_ip(addr)
        if classification is None:
            continue

        if classification in ("cloud_metadata_ip", "link_local_ip", "multicast_ip", "unspecified_ip", "reserved_ip"):
            return DestinationCheckResult(
                allowed=False,
                resolved_ips=tuple(resolved),
                reason=f"Destination IP {addr} blocked ({classification}).",
            )

        if not is_exact_local_lab:
            return DestinationCheckResult(
                allowed=False,
                resolved_ips=tuple(resolved),
                reason=(
                    f"Destination IP {addr} blocked ({classification}); "
                    "Local Lab exception is inactive or host does not match registered local_lab target."
                ),
            )

    return DestinationCheckResult(
        allowed=True,
        resolved_ips=tuple(resolved),
        reason="Destination IP(s) passed network safety policy.",
    )
