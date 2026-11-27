# Database Migration and Recovery Guide (`DATABASE_MIGRATION_AND_RECOVERY.md`)

## 1. First-Run PostgreSQL & Alembic Workflow (Docker Compose)
1. **Start PostgreSQL & wait for healthy status:**
   ```bash
   docker compose up -d postgres
   docker compose exec postgres pg_isready -U abm_user -d abm_sem7
   ```
2. **Apply Alembic migrations (separate from health check):**
   ```bash
   cd backend
   alembic upgrade head
   alembic current   # must match: 0002_semester7_pg_integrity_and_indexes (head)
   ```
3. **Seed synthetic Semester 7 demo data (local-only, idempotent):**
   ```bash
   python scripts/seed_demo.py
   ```
4. **Reset local demo database (destructive — local dev/demo ONLY):**
   ```bash
   python scripts/reset_demo.py
   ```

## 2. Offline PostgreSQL DDL Verification (No Live Server Required)
```bash
cd backend
alembic upgrade head --sql > alembic_pg_preview.sql
```

## 3. Backup & Restore (Defense Environment)
- **Backup:**
  ```bash
  docker compose exec -T postgres pg_dump -U abm_user -d abm_sem7 -Fc > abm_sem7_backup.dump
  ```
- **Restore:**
  ```bash
  docker compose exec -T postgres pg_restore -U abm_user -d abm_sem7 --clean --if-exists < abm_sem7_backup.dump
  ```
