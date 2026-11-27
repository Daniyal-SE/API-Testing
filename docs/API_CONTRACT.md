# API Contract — Semester 7 (`/api/v1`)

All endpoints are served under `/api/v1`. Responses serialize `camelCase` JSON fields aligned with `src/types/domain.ts` and `src/lib/mock-adapter.ts`.

---

## 1. Conventions

- **Auth & CSRF:** `POST /api/v1/auth/login` sets an `HttpOnly`, `SameSite=Lax` cookie (`abm_session`) and a readable CSRF cookie (`abm_csrf`). Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests require `X-CSRF-Token` matching `abm_csrf`. (`ALLOW_BEARER_HEADER=true` optionally supports Bearer tokens for non-browser clients.)
- **Correlation ID:** Echoed via `X-Correlation-ID` header and included in error envelopes.
- **Error Envelope:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted request payload failed validation.",
    "details": [],
    "correlation_id": "req-9c3a..."
  }
}
```
- **Pagination Envelope (`GET /url-inventory`, `GET /audit`):** `{ items, pagination: { page, pageSize, totalItems, totalPages } }` with `pageSize <= 100`.

---

## 2. Implemented Endpoints

### Health
- `GET /api/v1/health` — Public app, database, and Redis status (`semesterScope: "semester_7"`).
- `GET /api/v1/runner/health` — Authenticated `RunnerReadiness` payload.

### Authentication
- `GET /api/v1/auth/capabilities` — Returns `{ registrationMode, passwordRecoveryEnabled, aiAdvisorEnabled, semester8Enabled }`.
- `POST /api/v1/auth/login` — Body `{ email, password }` (email or username).
- `POST /api/v1/auth/logout` — Revokes active session and clears cookies.
- `GET /api/v1/auth/me` — Returns `{ user, sessionExpired, capabilities, workspaces, csrfToken }`.
- `POST /api/v1/auth/register` — Enabled only when `REGISTRATION_MODE=self_service`; returns `403` otherwise.

### Workspaces & Projects
- `GET /api/v1/workspaces` — Lists active workspaces for the user.
- `GET /api/v1/projects?workspaceId=...` — Lists accessible projects.
- `POST /api/v1/projects` — Creates project (`project_owner`, `security_tester`).
- `GET /api/v1/projects/{projectId}` — Returns `{ project, members, targets, runs, auditLogs }`.
- `PATCH /api/v1/projects/{projectId}` — Updates project metadata.
- `DELETE /api/v1/projects/{projectId}` — Blocked (`409`) if any run is active.

### Targets & Authorization
- `POST /api/v1/targets/preview-normalize` — Synchronous URL normalization preview.
- `GET /api/v1/targets?projectId=...` — Lists targets in accessible workspaces.
- `POST /api/v1/targets` — Registers target in `pending_review`.
- `GET /api/v1/targets/{targetId}` — Returns `{ target, authorizations, scopeVersions, runs }`.
- `PATCH /api/v1/targets/{targetId}` — Changing `baseUrl` or `environment` sets `authorizationStatus = "needs_revalidation"` and supersedes approved scopes.
- `DELETE /api/v1/targets/{targetId}` — Blocked (`409`) if active run exists.
- `GET /api/v1/targets/{targetId}/authorizations` — Lists chronological authorization records.
- `POST /api/v1/targets/{targetId}/authorizations` — Records new ownership/permission declaration.
- `POST /api/v1/targets/{targetId}/authorization-decision` — `project_owner` only (`authorized`, `revoked`, `needs_revalidation`).

### Scope Configuration & Versioning
- `POST /api/v1/scopes/preview` — Validates scope & budgets without persisting.
- `GET /api/v1/targets/{targetId}/scopes` — Lists scope versions newest-first.
- `POST /api/v1/targets/{targetId}/scopes` — Creates immutable version `vN` in `pending_approval`.
- `POST /api/v1/scopes/{scopeId}/decision` — `project_owner` only (`approved`, `rejected`).

### Assessments & Runs
- `POST /api/v1/assessments/preflight` — Evaluates blockers and `RunnerReadiness`.
- `GET /api/v1/assessments?projectId=...&state=...` — Lists assessment runs.
- `POST /api/v1/assessments` — Returns `202 Accepted` (`state: "queued"`). Rejects Semester 8 modules (`422`) and overlapping active runs (`409`).
- `GET /api/v1/assessments/{runId}` — Returns `{ run, discoveredUrls, findings: [], evidence: [] }`.
- `GET /api/v1/assessments/{runId}/events` — Lists sanitized `RunLogEvent` entries.
- `POST /api/v1/assessments/{runId}/cancel` — Returns `202 Accepted` (`state: "cancellation_requested"`).
- `DELETE /api/v1/assessments/{runId}` — Terminal runs only.
- `POST /api/v1/assessments/reconcile-stale` — Marks timed-out active runs as `interrupted`.

### URL Inventory & Audit
- `GET /api/v1/url-inventory` — Paginated, filterable (`runId`, `targetId`, `projectId`, `method`, `source`, `scopeStatus`, `testStatus`, `search`).
- `GET /api/v1/url-inventory/{urlId}` — Returns `{ url, sources, relatedFindings: [], zapAlerts: [] }`.
- `GET /api/v1/audit` — Paginated, filterable (`projectId`, `targetId`, `action`, `outcome`, `resourceType`, `search`).
