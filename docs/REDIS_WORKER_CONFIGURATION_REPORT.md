# Redis & Worker Configuration Report

- **Image & Version:** `redis:7.2.4-alpine` (`redis-server --appendonly yes`, bound `127.0.0.1:6379`)
- **Connectivity:** `docker compose exec -T redis redis-cli ping` returned `PONG`.
- **Queue & Serializer:** Python RQ `3.0.0` + `redis-py` `8.2.0` configured with `JSONSerializer` (no pickle deserialization).
- **Verified Behaviors (against live Redis `db 15`):**
  - Idempotent job enqueue (`abm-run-<run_id>`)
  - Worker heartbeat publishing & stale-worker detection
  - Cooperative cancellation signaling & Pub/Sub progress events
  - `SimpleWorker(..., serializer=JSONSerializer)` burst execution completing real URL discovery runs
  - `reconcile_active_runs` & `SIGTERM` graceful shutdown handler
