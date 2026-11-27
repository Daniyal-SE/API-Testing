# Assessment Engine API Contract (`ASSESSMENT_ENGINE_API_CONTRACT.md`)

Reuses existing FastAPI endpoints without duplicating routes:
- `POST /api/v1/assessments/preflight` — Validates target authorization, approved scope, active-run conflict, and Semester 7 module gate (`url_discovery` only).
- `POST /api/v1/assessments` (`202`) — Enqueues immutable `run_plan_json` to RQ.
- `GET /api/v1/assessments/{run_id}` & `/events` — Returns truthful run state, counters, and sanitized `RunEvent` stream.
- `POST /api/v1/assessments/{run_id}/cancel` (`202`) — Sets cooperative cancellation signal.
- `GET /api/v1/url-inventory` & `/{url_id}` — Paginated URL inventory (`page`, `pageSize`) with `sources` provenance, `formFields`, `scopeStatus`, `depth`, and `hitCount`.
