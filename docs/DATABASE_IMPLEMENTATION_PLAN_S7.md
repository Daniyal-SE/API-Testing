# Semester 7 Database Implementation Plan (40% Internal Defense)

## 1. Repository & Database Audit Summary
An inspection of the repository at `backend/` and root `docker-compose.yml` was performed prior to schema enhancements:

| Component | Location | Audit Classification | Notes |
|---|---|---|---|
| SQLAlchemy Base & Types | `backend/app/db/base.py` | Present and working | `DeclarativeBase`, `NAMING_CONVENTION`, `JSONType` (`JSON` with `JSONB` PostgreSQL variant), `UUIDPrimaryKeyMixin`, `TimestampMixin` |
| Engine & Session | `backend/app/db/session.py` | Present and working | Sync SQLAlchemy 2.1.9 engine with `pool_pre_ping=True` and SQLite FK `PRAGMA` for unit/CI fallback |
| Core ORM Models (14 tables) | `backend/app/models/*.py` | Present but incomplete | All 14 Semester 7 tables exist; missing composite tenant-ownership FKs, `CHECK` constraints, partial unique index for active runs, and case-normalized functional unique indexes |
| Alembic Configuration | `backend/alembic.ini`, `backend/alembic/env.py` | Present and working | Imports `app.models`, `compare_type=True` |
| Baseline Migration | `backend/alembic/versions/0001_semester7_baseline.py` | Present and working | Creates all 14 tables cleanly; upgrade/downgrade verified |
| Docker Compose Postgres | `docker-compose.yml` | Present but needs hardening | Uses `postgres:16-alpine` (pin to `postgres:16.2-alpine`), exposes `5432:5432` without `127.0.0.1` bind or private network |
| Environment Template | `backend/.env.example` | Present and working | Uses safe placeholders; `.gitignore` protects `.env*`, `*.pem`, `*.key` |
| DB Verification Tests | `backend/tests/` | Present but incomplete | Existing tests run on SQLite + `fakeredis`; no dedicated database constraint/composite-FK/PostgreSQL DDL verification suite |

## 2. Semester 7 Scope Boundary
- **Included (40%):** Identity (`users`, `user_sessions`), tenancy (`workspaces`, `workspace_members`, `projects`, `project_members`), target governance (`targets`, `authorization_records`, `scope_versions`), async assessment lifecycle (`assessment_runs`, `run_events`), append-only audit (`audit_logs`), and same-origin URL discovery (`url_inventory`, `discovery_sources`).
- **Excluded (Semester 8 — 60%):** OpenAPI contracts/operations, Schemathesis cases, NetworkX behavior graphs, multi-identity test profiles, BOLA/business-invariant rules, ZAP alert normalization, generalized findings/evidence packages, HTML/JSON reports, benchmark ground truth, and AI advisor tables.

## 3. Phased Execution Plan
1. **Phase 1 — Audit & Design Docs:** Produce all 8 `docs/DATABASE_*` documents.
2. **Phase 2 — Model & Constraint Hardening:** Add composite ownership keys/FKs, `CHECK` constraints, case-normalized functional unique indexes, and active-run partial unique index in `app/models/*.py`.
3. **Phase 3 — Incremental Migration (`0002`):** Create `0002_semester7_pg_integrity_and_indexes.py` revising `0001_semester7_baseline` without altering `0001` history.
4. **Phase 4 — Compose & Bootstrap Hardening:** Pin `postgres:16.2-alpine`, bind `127.0.0.1:5432:5432`, add `abm_internal` network.
5. **Phase 5 — Verification:** Generate offline PostgreSQL DDL via `alembic upgrade head --sql`, run dedicated DB integrity tests + full pytest suite, and record exact results in `DATABASE_VERIFICATION_REPORT_S7.md`.
