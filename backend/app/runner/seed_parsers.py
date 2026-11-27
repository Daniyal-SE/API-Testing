"""Bounded, scope-safe parsers for robots.txt and sitemap.xml (DFR-URL-04)."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass

MAX_ROBOTS_BYTES = 131_072
MAX_SITEMAP_BYTES = 1_048_576
MAX_SEED_ENTRIES = 500


@dataclass(frozen=True)
class RobotsDirectives:
    allow_paths: list[str]
    disallow_paths: list[str]
    sitemaps: list[str]


def parse_robots_txt(raw_text: str, *, max_entries: int = MAX_SEED_ENTRIES) -> RobotsDirectives:
    """Extract Allow, Disallow, and Sitemap directives with strict size/entry bounds."""
    bounded = raw_text[:MAX_ROBOTS_BYTES]
    allows: list[str] = []
    disallows: list[str] = []
    sitemaps: list[str] = []

    for line in bounded.splitlines():
        clean = line.split("#", 1)[0].strip()
        if not clean or ":" not in clean:
            continue
        key, val = clean.split(":", 1)
        k = key.strip().lower()
        v = val.strip()
        if not v:
            continue
        if k == "allow" and len(allows) < max_entries:
            allows.append(v)
        elif k == "disallow" and len(disallows) < max_entries:
            disallows.append(v)
        elif k == "sitemap" and len(sitemaps) < 50:
            sitemaps.append(v)

    return RobotsDirectives(allow_paths=allows, disallow_paths=disallows, sitemaps=sitemaps)


def parse_sitemap_xml(
    raw_xml: str,
    *,
    max_entries: int = MAX_SEED_ENTRIES,
) -> tuple[list[str], list[str]]:
    """
    Parse bounded XML sitemap into (page_urls, nested_sitemap_urls).
    Returns empty lists on malformed XML without raising unhandled exceptions.
    Never expands scope; callers must pass every URL through normalize_url + evaluate_scope.
    """
    if len(raw_xml.encode("utf-8", errors="replace")) > MAX_SITEMAP_BYTES:
        return [], []
    try:
        root = ET.fromstring(raw_xml)
    except ET.ParseError:
        return [], []

    page_urls: list[str] = []
    nested_sitemaps: list[str] = []
    seen: set[str] = set()

    for elem in root.iter():
        tag = elem.tag.split("}", 1)[-1].lower()
        if tag == "loc" and elem.text:
            loc = elem.text.strip()
            if not loc or loc in seen:
                continue
            seen.add(loc)
            # Check parent tag heuristic via root tag
            root_tag = root.tag.split("}", 1)[-1].lower()
            if root_tag == "sitemapindex":
                if len(nested_sitemaps) < 50:
                    nested_sitemaps.append(loc)
            else:
                if len(page_urls) < max_entries:
                    page_urls.append(loc)

    return page_urls, nested_sitemaps
