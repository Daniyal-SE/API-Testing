# Database Decisions and Assumptions (`DATABASE_DECISIONS_AND_ASSUMPTIONS.md`)

## 1. Recorded Decisions & Competing Interpretations
1. **SRS Version 4.0 File Absence:** `Humanized-SRS(1).docx` is not present in the repository. Requirements are traced from the Master Database Prompt, the Master Backend Prompt, and the existing FastAPI/Pydantic/ORM codebase.
2. **PostgreSQL Daemon Unavailable on Windows Host:** Neither `psql`, `pg_isready`, nor `docker` is installed on the local Windows host. Therefore:
   - Production/Docker Compose configuration targets **`postgres:16.2-alpine`** with `psycopg==3.3.9` and `JSONB`.
   - Local test execution uses **SQLite + `fakeredis`** for runtime tests, supplemented by **offline PostgreSQL DDL compilation (`alembic upgrade head --sql` / `CreateTable(..., postgresql.dialect())`)** to verify PostgreSQL syntax, `JSONB`, `UUID`, `TIMESTAMPTZ`, `CHECK` constraints, and partial/functional indexes. Real PostgreSQL execution must be run once Docker/PostgreSQL is started.
3. **`users.global_role` vs Membership Roles:** Existing `users` table retains `global_role` as a default UI/profile label, while authoritative workspace and project permissions are stored in `workspace_members.role` and `project_members.role`.
4. **`user_sessions` Persistence:** Retained because the existing backend uses stateful opaque HttpOnly session cookies + CSRF token hashes with explicit logout revocation (`POST /api/v1/auth/logout`).
5. **`notifications` Table Deferred:** The current Semester 7 frontend/API contract has no `/notifications` endpoint or persisted notification requirement; omitted to avoid unused tables.
6. **Tenant Isolation Strategy (App-Layer Policy vs RLS):** Enforced via `app/services/permissions.py` + composite ownership FKs (`(project_id, workspace_id)` and `(target_id, project_id, workspace_id)`). PostgreSQL RLS is not enabled to avoid pooled-connection session variable leakage.
7. **Single Active Run per Target:** Enforced both in `preflight_service.py` and in the database via partial unique index `uq_assessment_runs_one_active_per_target` on `assessment_runs(target_id)` where `state IN ('queued', 'running', 'cancellation_requested')`.
