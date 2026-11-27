# Semester 7 Playwright Test Report

**Execution Date:** 2026-11-27 | **Playwright:** `1.65.1` (Chromium)

| Suite | Command | Result | Evidence |
|---|---|---|---|
| Master Live Browser Verification | `npx playwright test tests/e2e/s7-master-verification.spec.ts --workers=1 --reporter=list --output=artifacts/semester-7-testing/traces` | **3 passed (1.0m)** | `artifacts/semester-7-testing/screenshots/01-login-page.png` .. `15-logout.png`, `artifacts/semester-7-testing/traces/` (videos + `trace.zip`) |
| Complete UI + Full-Stack Suite | `npx playwright test --workers=2 --reporter=list` | **9 passed (37.2s)** | `tests/example.spec.ts` (1), `tests/fyp-complete-e2e.spec.ts` (7), `tests/fullstack-live-e2e.spec.ts` (1) |
