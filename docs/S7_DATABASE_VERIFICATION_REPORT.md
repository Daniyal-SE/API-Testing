# Semester 7 Database Verification Report

- **Engine:** `postgres:16.2-alpine` (`PostgreSQL 16.2`)
- **Alembic Head:** `0003_widen_canonical_key (head)` (14 application tables + `alembic_version`)
- **Verified Constraints (`tests/integration/test_database_integrity.py`):**
  - Case-insensitive email/username functional unique indexes (`uq_users_email_lower`, `uq_users_username_lower`)
  - Cross-workspace composite FK isolation
  - Port range CHECK constraint (`1..65535`)
  - Partial unique index enforcing one active run per target (`uq_assessment_runs_one_active_per_target`)
- **Persistence Verified:** Container restart (`docker compose restart postgres`) retained all 15 public tables; browser `page.reload()` confirmed persisted projects, targets, scopes, runs, URL inventory, and audit logs.
- **Status:** **PASS**
