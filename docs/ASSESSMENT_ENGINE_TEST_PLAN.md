# Assessment Engine Test Plan (`ASSESSMENT_ENGINE_TEST_PLAN.md`)

- **Unit Tests:** `test_scope_and_runner_units.py` (URL normalization, segment-aware scope, SSRF, redirects, budgets, state machine, HTML/form extraction) + `test_seed_parsers_and_s8_boundary.py` (`robots.txt`, `sitemap.xml` limits/out-of-scope filtering, S8 `NotImplementedError` boundary).
- **E2E & Fixture Tests:** `test_local_demo_e2e.py` (`fixture_app` `REQUEST_LOG` proving `/rest/admin/reset`, `/api-admin/secret`, `POST /auth/login`, and external/metadata redirects receive **zero** requests; deduplication, provenance, budget stop, and cancellation).
