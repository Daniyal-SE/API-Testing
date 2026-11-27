# PostgreSQL Configuration Report

- **Image & Version:** `postgres:16.2-alpine` (`PostgreSQL 16.2 on x86_64-pc-linux-musl`)
- **Databases:** `abm_sem7` (development) and `abm_sem7_test` (pytest integration isolation)
- **Alembic Migrations:**
  - `0001_semester7_baseline` — 14 Semester 7 tables
  - `0002_sem7_pg_integrity` — Composite ownership FKs, CHECK constraints, partial/functional indexes (revision ID shortened to fit PostgreSQL `alembic_version.version_num` `VARCHAR(32)` limit)
  - `0003_widen_canonical_key` — Widened `url_inventory.canonical_key` from `VARCHAR(64)` to `VARCHAR(128)` for `METHOD:<sha256>` keys
  - `alembic current`: `0003_widen_canonical_key (head)`
- **Persistence Verification:** Restarted `postgres` container via `docker compose restart postgres`; verified `pg_isready` accepts connections and `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` returned `15` (14 app tables + `alembic_version`).
