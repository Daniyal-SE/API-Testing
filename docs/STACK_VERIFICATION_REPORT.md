# Stack Verification Report

**Verification Date:** 2026-11-27

## Executed Verification Summary

| Component | Command Executed | Actual Result |
|---|---|---|
| Python & `.venv` | `python --version` / `.venv\Scripts\python.exe -m pip --version` | `Python 3.14.2`, `pip 26.3` |
| Git | `git --version` | `git version 2.46.0.windows.1` |
| Docker Engine & Compose | `docker --version`, `docker compose version`, `docker info` | `Docker 29.9.3`, `Compose v5.7.1` |
| PostgreSQL | `docker compose exec -T postgres pg_isready`, `psql ... SELECT version()`, `docker compose restart postgres` | `PostgreSQL 16.2`, `15` tables persisted across restart |
| Redis | `docker compose exec -T redis redis-cli ping` | `PONG` |
| Alembic | `alembic upgrade head`, `alembic current` | `0003_widen_canonical_key (head)` |
| Docker Runner | `docker build -f backend/Dockerfile.runner -t abm-safe-runner:sem7 backend` + `docker run --rm --read-only --cap-drop=ALL --network none --user 10001:10001 ...` | `uid: 10001 httpx: 0.28.1 bs4: 4.15.0`, container removed |
| Backend Pytest Suite | `.\.venv\Scripts\python.exe -m pytest -v --tb=short` (against real PostgreSQL `abm_sem7_test` + Redis `db 15`) | **32 passed in 23.32s** |
| Frontend Playwright E2E | `npx playwright test --reporter=list` | **8 passed in 45.2s** |
