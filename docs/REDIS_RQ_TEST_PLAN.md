# Redis + RQ Test Plan (`REDIS_RQ_TEST_PLAN.md`)

## Test Categories (`backend/tests/jobs/test_redis_rq_suite.py`)
1. **Unit Tests:**
   - Redis config validation & URL password redaction (`redact_redis_url`).
   - Deterministic job ID generation & forbidden-field payload validation.
   - Idempotent enqueueing (duplicate `run_id` returns existing job without duplicate dispatch).
   - RQ-to-application lifecycle mapping & legal/illegal transition enforcement.
   - Versioned progress event builder & secret redaction.
2. **Integration & Security Tests:**
   - `JSONSerializer` enforcement (rejects non-JSON/untrusted pickle payloads).
   - Cooperative cancellation signal & Pub/Sub fallback polling.
   - Worker heartbeat (`5s` interval) & stale detection (`>30s`).
   - Redis outage during enqueue raises `QueueUnavailableError` without false `queued` response.
3. **Failure-Injection Tests:**
   - Zero active workers with `running` scan > 60s → transitions to `failed` (`Worker Unavailable`, NFR-OPS-007).
   - Stale worker / missing RQ job while run is `running` → transitions to `interrupted` (no blind replay, FR-RUN-006).
   - `SIGTERM` graceful shutdown handler sets stop flag, emits shutdown event, and cleans up heartbeat.
   - Queue dispatch latency measurement against provisional target (NFR-PERF-013 / NFR-PERF-029).
