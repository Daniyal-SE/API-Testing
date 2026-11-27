# Semester 7 Database Verification Report (`DATABASE_VERIFICATION_REPORT_S7.md`)

## 1. Environment & Tooling Observed
- **OS:** Windows (`win32`)
- **Python:** `3.14.2` (`backend/.venv/Scripts/python.exe`)
- **SQLAlchemy:** `2.1.9` | **Alembic:** `1.20.1` | **PostgreSQL Driver:** `psycopg==3.3.9` (`psycopg-binary==3.3.9`)
- **Target Compose PostgreSQL Image:** `postgres:16.2-alpine` (`docker-compose.yml`)
- **Live PostgreSQL / Docker Daemon on Host:** **Not available** on this Windows machine (`psql`, `pg_isready`, `docker` not installed). Live PostgreSQL container execution must be run when Docker/PostgreSQL is available.

## 2. Commands Executed & Observed Results

### 2.1 Offline PostgreSQL DDL Generation (`PostgresqlImpl`)
```powershell
.\.venv\Scripts\alembic.exe upgrade head --sql
```
- **Result:** **Exit code 0 (`ALEMBIC_PG_SQL_OK`)**
- **Revisions generated:**
  - ` -> 0001_semester7_baseline`
  - `0001_semester7_baseline -> 0002_semester7_pg_integrity_and_indexes`

### 2.2 Full Automated Test Suite (`pytest`)
```powershell
.\.venv\Scripts\python.exe -m pytest -v --tb=short
```
- **Result:** **19 passed, 0 failed** in `17.83s`
- **Database-specific verification tests:**
  - `tests/integration/test_api_workflows.py::test_alembic_upgrade_and_downgrade_clean` — **PASSED** (clean `upgrade head` through `0002`, `downgrade base`, and re-`upgrade head`)
  - `tests/integration/test_database_integrity.py::test_postgresql_ddl_compilation_includes_jsonb_checks_and_partial_indexes` — **PASSED** (verifies all 14 tables compile for `postgresql.dialect()` with `JSONB`, `TIMESTAMP WITH TIME ZONE`, composite FKs, `CHECK` constraints, `uq_users_email_lower`, and `uq_assessment_runs_one_active_per_target`)
  - `tests/integration/test_database_integrity.py::test_composite_ownership_and_check_constraints_enforced` — **PASSED** (verifies `IntegrityError` on case-insensitive duplicate email, cross-workspace target/project composite FK violation, invalid port `70000` `CHECK` violation, and second active run partial unique index violation)
  - Remaining 16 unit, integration, security, and E2E tests — **PASSED**

## 3. Known Gaps
1. **Live PostgreSQL Execution Pending:** Integration tests ran against SQLite (`PRAGMA foreign_keys=ON`) + `fakeredis`, alongside PostgreSQL dialect DDL compilation and `alembic upgrade head --sql`. Running `pytest` against a live `postgres:16.2-alpine` instance via `docker compose up -d postgres` is required before final defense sign-off.
