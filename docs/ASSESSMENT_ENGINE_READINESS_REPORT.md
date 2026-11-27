# Assessment Engine Readiness Report (Semester 7)

- **Engine:** HTTPX-based same-origin URL discovery & controlled crawler (`backend/app/runner/crawler.py`, `policy.py`, `budgets.py`, `seed_parsers.py`).
- **Verified Controls:**
  - Same-origin & path-prefix scope matching (`ScopePolicy`)
  - Canonical URL normalization & `METHOD:<sha256>` deduplication with `DiscoverySource` provenance
  - Safe HTML form metadata extraction (no form submission)
  - SSRF protection (IPv4/IPv6 private/link-local blocking with explicit `local_lab` exception)
  - Redirect revalidation & out-of-scope blocking
  - Request, depth, rate, concurrency, response-size, and wall-clock budgets
  - End-to-end persistence into PostgreSQL `url_inventory` & `discovery_sources` verified via `tests/e2e/test_local_demo_e2e.py`.
