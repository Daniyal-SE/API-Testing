# Open Decisions & Assumptions — Semester 7

## 1. Unavailable Source Artefacts
- **`Humanized-SRS(1).docx` (SRS Version 4.0)** and **`API_Behavior_Miner_Complete_Frontend_Specification.md`** were not present in the workspace (`API-Testing-main`) or local Downloads folder.
- **Resolution:** All requirements are grounded in the Master Backend Implementation Prompt and the existing frontend specification/contracts in `src/types/domain.ts`, `src/lib/mock-adapter.ts`, `src/lib/validators.ts`, `src/lib/permissions.ts`, `docs/FRONTEND_DECISIONS.md`, and `docs/API_CONTRACT_GAPS.md`. No uninspected file contents are assumed or invented.

---

## 2. Explicit Engineering Decisions

| # | Decision Area | Chosen Semester 7 Behavior | Rationale & Configurability |
| :--- | :--- | :--- | :--- |
| **OD-01** | **Registration Mode** | Configurable `REGISTRATION_MODE` env var (`invite_only` default; supports `disabled`, `invite_only`, `self_service`). | Matches `src/types/domain.ts` and `mock-adapter.ts` default (`invite_only`). |
| **OD-02** | **Password Policy** | Configurable `MIN_PASSWORD_LENGTH` (default `10`). | Avoids hardcoded weak minimum while remaining configurable via `.env`. |
| **OD-03** | **Session Transport & CSRF** | Primary: `HttpOnly`, `SameSite=Lax` cookie (`abm_session`) + `abm_csrf` double-submit header (`X-CSRF-Token`). Optional Bearer header (`ALLOW_BEARER_HEADER=true` in dev/test). | Satisfies browser CSRF protection and enables clean API/CLI testing. |
| **OD-04** | **RBAC & Isolation** | Server-side enforcement per workspace/project membership + role. Cross-workspace guessed IDs return `404`; insufficient role inside workspace returns `403`. | Matches SRS least-privilege matrix and prevents cross-tenant ID enumeration. |
| **OD-05** | **Target Authorization Expiry** | `authorization_records` supports optional `expires_at`. Changing `base_url` or `environment` sets `authorization_status = needs_revalidation` and supersedes approved scopes. | Prevents stale authorization from carrying over to a mutated target identity. |
| **OD-06** | **Single Active Run Policy** | At most one active run (`pending`, `queued`, `running`, `cancellation_requested`) per `target_id`. Concurrent launch returns `409 Conflict`. | Prevents overlapping crawls against local targets. |
| **OD-07** | **Budget Upper Bounds** | Platform ceilings: `maxCrawlDepth` (1–8), `maxRequests` (1–5000), `perHostRateRps` (0.5–20), `concurrency` (1–10), `maxWallClockSeconds` (10–3600). Configurable via env vars. | Aligns with `src/lib/validators.ts` while allowing deterministic bounded tests. |
| **OD-08** | **Run Telemetry Transport** | HTTP polling (`GET /api/v1/assessments/{id}` & `/events`). | Matches `AssessmentRunMonitorPage` polling (`1200ms`). |
| **OD-09** | **Progress Percentage Honesty** | `progressPercent` is `null` (Indeterminate) during active crawl; `100` on `completed`. | Obeys Section 8.6 prohibition against fabricated progress percentages. |
| **OD-10** | **Runner Isolation Mode on Windows Host** | `docker` CLI and PostgreSQL/Redis daemons are not installed on the current Windows host. Implemented both `DockerRunnerExecutor` (`Dockerfile.runner`) and `LocalRestrictedRunnerExecutor` behind `RunnerExecutor`, selectable via `RUNNER_MODE`. | Enables deterministic testing on this host without falsely claiming live Docker container execution. |
| **OD-11** | **Frontend Unmodified** | Frontend files (`src/`) were NOT modified. | Obeys Section 19 constraint. |
