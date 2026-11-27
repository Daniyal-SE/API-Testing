# Semester 7 End-to-End Test Plan

- **Product:** API Behavior Miner & Business-Logic Vulnerability Tester
- **Scope:** Semester 7 — Internal Defense (40%) ONLY
- **Browsers & Runners:** Playwright `1.65.1` (Chromium), pytest `9.2.0`
- **Live Stack Under Test:** React/Vite (`localhost:3001` live / `localhost:3000` demo), FastAPI (`localhost:8000`), PostgreSQL `16.2` (`abm_sem7` / `abm_sem7_test`), Redis `7.2.4` + Python RQ `3.0.0` (`SimpleWorker`), Docker Runner (`abm-safe-runner:sem7`), HTTPX Assessment Engine (`0.28.1`), Local Fixture (`demo_fixture` on `127.0.0.1:8080`).

## Test Suites Executed
1. `tests/e2e/s7-master-verification.spec.ts` — Real browser E2E with videos, traces, and 15 checkpoint screenshots against live backend + PostgreSQL + Redis/RQ + Worker + HTTPX Engine.
2. `tests/fullstack-live-e2e.spec.ts` — Full-stack live integration E2E.
3. `tests/example.spec.ts` & `tests/fyp-complete-e2e.spec.ts` — Complete UI & RBAC suite.
4. `backend/tests/` (`pytest -v --tb=short`) — 32 unit, integration, DB, Redis/RQ, Docker Runner, security, and E2E tests against real PostgreSQL + Redis.
