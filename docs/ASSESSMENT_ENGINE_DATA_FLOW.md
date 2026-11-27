# Assessment Engine Data Flow (`ASSESSMENT_ENGINE_DATA_FLOW.md`)

1. **Seed:** Normalized `base_url` enters queue at `depth=0` (`source_type="seed"`). Optional `robots.txt`/`sitemap.xml` seeds are gated by `evaluate_scope` before any fetch.
2. **Pre-Request Gate:** Every candidate passes `normalize_url` → `evaluate_scope` → `validate_destination` (DNS A/AAAA + SSRF check) → `BudgetTracker.check_before_request` → `is_cancelled()`.
3. **Fetch & Redirects:** `httpx.AsyncClient(follow_redirects=False)` issues `GET` only, streaming up to `max_response_bytes`. Redirect `Location` headers are manually resolved and re-validated via `validate_redirect_target` (max 5 hops).
4. **Extract & Deduplicate:** HTML (`text/html`) is parsed via `BeautifulSoup` for `<a>` links and `<form>` metadata (`action`, `method`, input names/types — never submitted). Canonical key `"{METHOD}:{canonical_key}"` deduplicates rows while appending `DiscoverySource` provenance.
5. **Persist:** `RunnerController._persist_crawl_result` saves `UrlInventory`, `DiscoverySource`, and `RunEvent` rows to PostgreSQL.
