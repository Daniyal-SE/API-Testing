# Redis + RQ Backend Integration Contract (`REDIS_RQ_BACKEND_CONTRACT.md`)

## 1. Enqueue Contract (FastAPI → Redis/RQ)
- **Function:** `app.jobs.enqueue.enqueue_assessment_run(run_id, *, correlation_id, wall_clock_seconds, redis_conn=None)`
- **Arguments passed to RQ:** `("run_id", "correlation_id", task_version=1)` — strictly JSON-serializable, zero secrets or ORM objects.
- **Job ID:** `abm-run-{run_id}` (idempotent).
- **Timeout:** `wall_clock_seconds + 60` seconds grace.

## 2. Canonical Run Lifecycle Mapping
| RQ Status | Application State (`assessment_runs.state`) |
|---|---|
| `queued` | `queued` |
| `started` | `running` |
| `finished` | `completed` / `partial` / `cancelled` (authoritative from `RunnerController`) |
| `failed` | `failed` or `interrupted` (never auto-retried) |
| `stopped` / `canceled` | `cancelled` (only after runner cleanup confirmation) |

## 3. Runner Controller Handoff
- Worker loads `AssessmentRun` from PostgreSQL, verifies target `authorization_status == "authorized"` and `ScopeVersion.approval_state == "approved"`, then delegates exclusively to `RunnerController.execute_run(db, run_id)`.
