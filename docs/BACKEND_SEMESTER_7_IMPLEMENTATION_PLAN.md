# Backend Semester 7 Implementation Plan (40% Internal Defense)

**Product:** API Behavior Miner & Business-Logic Vulnerability Tester  
**Scope Boundary:** Semester 7 ONLY (Proposal Weeks 1–16; 40% Internal Defense Milestone)  
**Target Stack:** Python + FastAPI + Pydantic v2; PostgreSQL + SQLAlchemy 2.x + Alembic; Redis + Python RQ; HTTPX; Docker Compose (local academic demo)

---

## 1. Repository Audit Summary

Inspection of the workspace (`API-Testing-main`) shows:
- **Existing Frontend:** A React 19 + TypeScript + Vite 8 application exists in `src/` with `package.json`, `vite.config.ts`, `src/types/domain.ts`, `src/lib/api-client.ts`, `src/lib/mock-adapter.ts`, `src/lib/validators.ts`, `src/lib/permissions.ts`, and `docs/FRONTEND_*.md` / `docs/API_CONTRACT_GAPS.md`.
- **Existing Backend:** None prior to this implementation. No `backend/` directory, FastAPI routes, SQLAlchemy models, Alembic migrations, or `docker-compose.yml` existed.
- **Unavailable Source Files:** `Humanized-SRS(1).docx` (SRS Version 4.0) and `API_Behavior_Miner_Complete_Frontend_Specification.md` are not present in the repository or local workspace. Requirements are derived directly from the Master Backend Implementation Prompt and reconciled with the existing frontend contract in `src/types/domain.ts`, `src/lib/mock-adapter.ts`, `src/lib/validators.ts`, and `docs/API_CONTRACT_GAPS.md`.
- **Host Tooling Observed:** Python 3.14.2 (`pip`) is available; `docker` CLI and running PostgreSQL/Redis Windows services are not installed on the local host. Docker Compose and PostgreSQL/Redis integrations are authored cleanly and verified via Python integration/e2e tests using local test harnesses (SQLite/PostgreSQL-compatible SQLAlchemy models and `fakeredis` + RQ `SimpleWorker`), with Docker/PostgreSQL daemon runtime clearly marked where unexecuted on this host.

---

## 2. Semester 7 Boundary & Phase Plan

### Phase A — Repository Audit & Planning
- Produce the 8 foundational documents in `docs/`:
  - `BACKEND_SEMESTER_7_IMPLEMENTATION_PLAN.md`
  - `SEMESTER_7_REQUIREMENTS_TRACEABILITY.md`
  - `ARCHITECTURE.md`
  - `THREAT_MODEL.md`
  - `DATA_MODEL.md`
  - `API_CONTRACT.md`
  - `OPEN_DECISIONS_AND_ASSUMPTIONS.md`
  - `SEMESTER_8_DEFERRED_SCOPE.md`

### Phase B — Backend Foundation (SRS Weeks 1–2, 9–10)
- Create `backend/app/` modular layout (`core/`, `db/`, `models/`, `schemas/`, `services/`, `api/v1/`, `queue/`, `runner/`).
- Implement environment-based configuration (`pydantic-settings`), structured JSON logging with correlation IDs, global sanitized error envelope, and `/api/v1/health`.
- Implement SQLAlchemy 2.x models and Alembic initial migration (`0001_semester7_baseline.py`) for Semester 7 entities ONLY.
- Implement Argon2id password hashing, expiring revocable DB-backed sessions, HttpOnly/SameSite cookie + CSRF protection (plus configurable Bearer header), login rate limiting, and `registration_mode` capability flag.
- Implement Workspace, WorkspaceMember, Project, ProjectMember, Target, AuthorizationRecord, and append-only AuditLog persistence + server-side RBAC.

### Phase C — Scope & Safe Runner Boundary (SRS Weeks 13–14)
- Implement versioned `ScopeVersion` lifecycle (`draft`/`pending_approval` -> `approved`/`rejected`/`superseded`) with SHA-256 policy hash and normalized preview.
- Implement `url_normalization.py`, segment-aware `policy.py`, `destination_validation.py` (DNS A/AAAA + IPv4/IPv6 SSRF guard with narrow `local_lab` exception), `redirect_validation.py`, `budgets.py`, and `container.py` + `controller.py`.

### Phase D — Async Runs, RQ Worker & Same-Origin URL Discovery (SRS Weeks 15–16)
- Implement Assessment Preflight, immutable `run_plan_json` snapshots, single-active-run conflict (`409`), Redis/RQ job dispatch, cancellation propagation, stale job reconciliation, controlled HTTPX same-origin crawler (`crawler.py`), `url_inventory` + `discovery_sources` persistence, and paginated APIs.

### Phase E — Local Demo Fixture, Compose & Stabilization
- Build `backend/demo_fixture/`, `backend/scripts/seed_demo.py`, `backend/scripts/reset_demo.py`, Dockerfiles, `docker-compose.yml`, and full `pytest` unit/integration/security/E2E suites.
