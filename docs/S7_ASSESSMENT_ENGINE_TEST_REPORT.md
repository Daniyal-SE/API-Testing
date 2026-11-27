# Semester 7 Assessment Engine Test Report

- **Engine:** HTTPX-based same-origin controlled crawler (`SafeCrawler`, `ScopePolicy`, `CrawlBudgets`, `seed_parsers.py`)
- **Live Fixture Verification (`s7-master-verification.spec.ts` + `demo_fixture`):**
  - Enqueued via FastAPI -> Redis (`abm_assessments`) -> RQ `SimpleWorker` -> crawled `http://localhost:8080/api` -> persisted `/api/catalog`, `/api/orders`, and provenance into PostgreSQL `url_inventory` & `discovery_sources`.
- **Unit & E2E Tests (`pytest`):**
  - `tests/unit/test_scope_and_runner_units.py`: 6/6 passed (URL normalization, segment-aware scope matching, IPv4/IPv6 SSRF blocking, redirect revalidation, budget tracker, HTML form metadata extraction without submission)
  - `tests/unit/test_seed_parsers_and_s8_boundary.py`: 3/3 passed (`robots.txt`, `sitemap.xml`, Semester 8 `NotImplementedError` boundary)
  - `tests/e2e/test_local_demo_e2e.py`: 2/2 passed (end-to-end discovery, mid-crawl cancellation, budget stop)
- **Status:** **PASS**
