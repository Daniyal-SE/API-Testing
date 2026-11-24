# API Contract Gaps & Pending Backend Decisions

Because no backend OpenAPI specification, FastAPI routes, or Pydantic models exist in this repository yet, the frontend defines typed contract interfaces in `src/types/domain.ts` and documents every assumed contract or pending SRS decision below.

## 1. Authentication & Session Contract
| Area | Assumed Frontend Contract | Gap / Pending Backend Decision |
| :--- | :--- | :--- |
| Session Bootstrap | `GET /api/v1/auth/me` -> `{ user, workspace, capabilities }` | Confirm cookie name, CSRF header requirement, and `401` session-expired payload shape. |
| Sign In | `POST /api/v1/auth/login` -> `{ email, password }` | Confirm whether username login is allowed alongside email and MFA support. |
| Registration Mode | `capabilities.registrationMode`: `'invite_only' \| 'self_service' \| 'disabled'` | SRS requires choosing registration mode before implementation; currently configurable. |
| Password Recovery | `capabilities.passwordRecoveryEnabled`: `boolean` | Confirm SMTP/reset token endpoint availability (`/api/v1/auth/forgot-password`). |

## 2. RBAC & Permissions Matrix
| Area | Assumed Frontend Contract | Gap / Pending Backend Decision |
| :--- | :--- | :--- |
| Roles | `'project_owner' \| 'security_tester' \| 'supervisor_evaluator' \| 'system_admin'` | Confirm exact backend role strings and whether permissions are returned as an explicit string array (`permissions: string[]`) per project. |
| Authorization Enforcement | UI checks `canApproveTarget`, `canApproveScope`, `canLaunchRun`, `canTriageFinding` | Backend must return authoritative capability flags on each resource so UI never infers authorization solely from role labels. |

## 3. Targets, Authorization & Scope Versioning
| Area | Assumed Frontend Contract | Gap / Pending Backend Decision |
| :--- | :--- | :--- |
| Target States | `'registered' \| 'pending_review' \| 'authorized' \| 'expired' \| 'revoked' \| 'needs_revalidation'` | Confirm canonical enum strings from backend Pydantic models. |
| URL Normalization | `POST /api/v1/targets/preview-normalize` or inline response field `normalizedBaseUrl` | Confirm whether normalization happens synchronously during target creation or via a pre-validation endpoint. |
| Scope Budgets | `maxDepth`, `maxRequests`, `rateLimitRps`, `concurrency`, `maxDurationSeconds` | SRS numeric defaults are provisional; confirm backend upper-bound limits per environment (`local_lab` vs `staging`). |
| Scope Versioning | `POST /api/v1/targets/:id/scopes` creates immutable version `vN` requiring owner approval | Confirm whether minor exclusion edits trigger re-approval or only host/method/budget changes. |

## 4. Assessment Runs, Preflight & Safe Runner
| Area | Assumed Frontend Contract | Gap / Pending Backend Decision |
| :--- | :--- | :--- |
| Preflight Check | `POST /api/v1/assessments/preflight` -> `{ ready, blockers[], runnerReadiness }` | Confirm exact blocker codes (`MISSING_AUTH`, `UNAPPROVED_SCOPE`, `RUNNER_OFFLINE`, `DNS_POLICY_BLOCKED`, etc.). |
| Run Telemetry | `GET /api/v1/runs/:id` (polling) or `WS /api/v1/runs/:id/stream` | Confirm whether WebSockets or HTTP polling interval is used in Semester 7. |
| Run States | `'pending' \| 'queued' \| 'running' \| 'cancellation_requested' \| 'cancelled' \| 'completed' \| 'partial' \| 'failed' \| 'interrupted'` | Confirm exact state machine transitions and whether `needs_reconciliation` is a separate state. |
| Cancellation | `POST /api/v1/runs/:id/cancel` returns `202 Accepted` with `state: 'cancellation_requested'` | Confirm polling behavior until runner confirms terminal `cancelled` or `partial` state. |

## 5. Semester 8 Contracts (API, Graph, Invariants, Findings, Reports, Benchmarks)
- **OpenAPI Import**: Max file size limit (`maxUploadBytes`), async vs sync parser job ID, and exact `$ref` remote-fetch policy flags.
- **Behavior Graph**: Pagination/windowing format for 150+ nodes / 300+ edges and edge-approval mutation payload (`edgeId`, `decision`, `rationale`).
- **Test Identities**: Secret reference store identifier format (e.g., Vault/env ref ID) — UI strictly avoids raw secrets.
- **Business Invariants**: Operation sequence step schema, reset fixture webhook/endpoint reference, and oracle predicate AST/JSON schema.
- **Reports & Benchmarks**: Async export job polling endpoint (`queued -> generating -> ready | failed`), signed download URL lifetime, and statistical confidence interval fields on benchmark metrics.
