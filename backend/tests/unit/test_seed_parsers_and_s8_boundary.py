"""Unit tests for bounded robots.txt / sitemap.xml seed parsers and S8 extension boundary."""
from __future__ import annotations

import pytest

from app.assessment import SEMESTER_8_CAPABILITIES, invoke_semester8_module
from app.runner.policy import ScopePolicy, evaluate_scope
from app.runner.seed_parsers import parse_robots_txt, parse_sitemap_xml
from app.runner.url_normalization import normalize_url


def test_robots_txt_bounded_parsing() -> None:
    raw = """
    User-agent: *
    Disallow: /rest/admin/reset # admin
    Allow: /api/catalog
    Sitemap: http://localhost:8080/sitemap.xml
    """
    directives = parse_robots_txt(raw)
    assert directives.disallow_paths == ["/rest/admin/reset"]
    assert directives.allow_paths == ["/api/catalog"]
    assert directives.sitemaps == ["http://localhost:8080/sitemap.xml"]


def test_sitemap_xml_parsing_and_scope_gate_blocks_external_urls() -> None:
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>http://localhost:8080/api/catalog</loc></url>
      <url><loc>https://evil-external.invalid/steal</loc></url>
      <url><loc>http://localhost:8080/rest/admin/reset</loc></url>
    </urlset>
    """
    pages, nested = parse_sitemap_xml(xml)
    assert len(pages) == 3
    assert nested == []

    policy = ScopePolicy.from_dict(
        {
            "allowed_hosts": ["localhost"],
            "allowed_ports": [8080],
            "allowed_path_prefixes": ["/api"],
            "excluded_paths": ["/rest/admin/reset"],
        },
        allowed_schemes=("http",),
    )
    in_scope = [
        url for url in pages
        if evaluate_scope(normalize_url(url), "GET", policy).allowed
    ]
    assert in_scope == ["http://localhost:8080/api/catalog"]

    # Malformed XML fails safely without crashing
    assert parse_sitemap_xml("<urlset><broken>") == ([], [])


def test_semester8_extension_boundary_raises_not_implemented() -> None:
    for mod in SEMESTER_8_CAPABILITIES:
        with pytest.raises(NotImplementedError):
            invoke_semester8_module(mod)
