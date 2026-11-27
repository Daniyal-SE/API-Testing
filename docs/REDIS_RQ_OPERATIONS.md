# Redis + RQ Operations Guide (`REDIS_RQ_OPERATIONS.md`)

## 1. Starting & Stopping Services (Docker Compose)
```bash
# Start Redis and PostgreSQL
docker compose up -d postgres redis

# Start standalone RQ worker (separate from FastAPI)
docker compose up -d worker

# Scale workers within concurrency policy
docker compose up -d --scale worker=2

# Graceful stop (sends SIGTERM, 30s drain grace)
docker compose stop worker
```

## 2. Local Development (No Docker)
```bash
cd backend
.\.venv\Scripts\python.exe -m app.queue.worker
```

## 3. Diagnostics & Health
- `GET /api/v1/health` — Public Redis ping + DB health.
- `GET /api/v1/runner/health` — Authenticated runner controller + queue readiness.
- `app/jobs/health.py::get_queue_diagnostics()` — Queue depth, active/stale worker counts, RQ registry summaries (no secrets exposed).

## 4. Safe Recovery & Reconciliation
- Never use `FLUSHALL` / `FLUSHDB` in shared environments.
- Run `reconcile_active_runs(db)` to detect orphaned `queued`/`running` runs when active workers drop to zero (`Worker Unavailable`) or heartbeats go stale (`>30s` → `interrupted`).
