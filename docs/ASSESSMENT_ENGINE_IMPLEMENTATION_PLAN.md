# Assessment Engine Implementation Plan (Semester 7 — 40%)

## 1. Repository Audit
- `backend/app/runner/crawler.py`: Existing `SafeCrawler` using `httpx.AsyncClient(follow_redirects=False)`, `BudgetTracker`, `validate_destination`, `evaluate_scope`, `validate_redirect_target`, `normalize_url`, and `extract_links_and_forms`.
- `backend/demo_fixture/app.py`: Local deterministic target fixture with in-scope pages, duplicate links, GET/POST forms, excluded `/rest/admin/reset`, prefix-collision `/api-admin/secret`, and in-scope/external/metadata redirects.
- **Identified Gaps:**
  1. Missing bounded `robots.txt` and `sitemap.xml` seed parsers (DFR-URL-04).
  2. Missing explicit Semester 8 `not_implemented` extension boundary module (`app/assessment/`).
  3. Missing `docs/ASSESSMENT_ENGINE_*` documentation suite.

## 2. Implementation Tasks
1. Create the 9 `docs/ASSESSMENT_ENGINE_*` documents.
2. Implement `backend/app/runner/seed_parsers.py` (`parse_robots_txt`, `parse_sitemap_xml` with strict size/entry/loop bounds).
3. Implement `backend/app/assessment/__init__.py` documenting Semester 8 extension points (`NotImplementedError`).
4. Add unit/MockTransport tests in `backend/tests/unit/test_seed_parsers_and_s8_boundary.py` and run the full `pytest` suite.
