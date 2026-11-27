# Redis + RQ Implementation Plan (Semester 7 — 40%)

## 1. Existing Repository Audit
- `backend/app/queue/connection.py`: Basic Redis client, `get_rq_queue`, cancel key helpers, `set_redis_client_override` for `fakeredis`.
- `backend/app/queue/tasks.py`: `run_assessment_job(run_id)` invoking `RunnerController.execute_run`.
- `backend/app/queue/worker.py`: Minimal `Worker([settings.rq_queue_name]).work(with_scheduler=False)`.
- `docker-compose.yml`: `redis:7-alpine` (floating minor tag) and `worker` service.

## 2. Gaps Addressed in Semester 7
1. Centralized `app/core/redis_config.py` with URL credential redaction, key namespacing, and explicit timeouts.
2. Safe `JSONSerializer` on RQ queues (`app/jobs/queues.py`) to prohibit arbitrary pickle deserialization.
3. Idempotent enqueueing (`app/jobs/enqueue.py`) & payload validation (`app/jobs/job_ids.py`).
4. Explicit RQ-to-Application lifecycle mapping (`app/jobs/lifecycle_adapter.py`).
5. Worker heartbeat (`5s` interval, `30s` stale threshold) and NFR-OPS-007 zero-worker detection (`60s` → `failed / Worker Unavailable`).
6. Cooperative cancellation + Pub/Sub wake-up + `SIGTERM` graceful shutdown (`30s` drain grace).
7. Reconciler/watchdog (`app/jobs/reconciliation.py`) that marks interrupted runs without blind replay.
8. Operational health diagnostics (`app/jobs/health.py`) and comprehensive unit/integration/security/failure-injection tests.
