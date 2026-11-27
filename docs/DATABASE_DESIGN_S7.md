# Semester 7 Database Design (`DATABASE_DESIGN_S7.md`)

## 1. Why PostgreSQL
PostgreSQL 16 (`postgres:16.2-alpine`) is the authoritative relational store for the Semester 7 control plane because it natively enforces:
- Strong `UUID`, `TIMESTAMPTZ`, and `JSONB` types for immutable scope snapshots, run plans, and sanitized metadata.
- Composite unique/foreign keys preventing cross-workspace ownership mismatches.
- Partial unique indexes (`WHERE state IN ('queued', 'running', 'cancellation_requested')`) for race-free single-active-run concurrency per target.
- Expression/functional unique indexes (`lower(email)`, `lower(username)`) for case-insensitive identity uniqueness.

## 2. Semester 7 Scope & Explicit Semester 8 Exclusions
- **Implemented (14 tables):** `users`, `user_sessions`, `workspaces`, `workspace_members`, `projects`, `project_members`, `targets`, `authorization_records`, `scope_versions`, `assessment_runs`, `run_events`, `url_inventory`, `discovery_sources`, `audit_logs`.
- **Deferred to Semester 8 (not created):** `openapi_contracts`, `api_operations`, `behavior_graph_nodes`, `behavior_graph_edges`, `test_identities`, `invariant_rules`, `findings`, `evidence_packages`, `zap_alerts`, `reports`, `benchmark_cases`, `ai_suggestions`, `notifications` (not required by Semester 7 acceptance demo).

## 3. Tenant & Ownership Model
- `workspaces` is the top-level tenant boundary (`owner_id` -> `users.id`).
- `projects` belongs to one `workspace_id`, with composite key `(id, workspace_id)`.
- `targets` references `(project_id, workspace_id)` via a composite FK to `projects(id, workspace_id)`, guaranteeing a target cannot belong to a project in another workspace.
- `assessment_runs` references `(target_id, project_id, workspace_id)` via composite FK to `targets`, and `(scope_version_id, target_id)` via composite FK to `scope_versions`, guaranteeing every run uses a scope version belonging to that exact target and ownership path.

## 4. Authorization & Scope Versioning Strategy
- **Target registration != authorization:** `targets` starts in `pending_review`. Every declaration, approval, expiry, or revocation appends a row to `authorization_records` with a SHA-256 `declaration_hash`.
- **Immutable scope versions:** `scope_versions` enforces `UNIQUE(target_id, version_number)`. Editing scope creates a new version (`v2`, `v3`) and supersedes the prior approved version; historical runs remain bound to their original `scope_version_id`.

## 5. Assessment Run Lifecycle & Concurrency
- `assessment_runs` is the durable source of truth (Redis/RQ is the dispatch queue only).
- **Single active run per target:** Enforced by partial unique index `uq_assessment_runs_one_active_per_target` on `(target_id)` where `state IN ('queued', 'running', 'cancellation_requested')`, plus backend preflight checks.
- **No long-lived DB transactions:** `RunnerController` commits state transitions (`queued` -> `running` -> `completed`/`partial`/`cancelled`/`failed`) in short transactions and never holds a DB transaction open during HTTPX crawling.

## 6. URL Inventory Deduplication & Provenance
- `url_inventory` enforces `UNIQUE(run_id, canonical_key)` where `canonical_key = "{METHOD}:{normalized_canonical_key}"` (preserving distinct query-parameter key sets while stripping sensitive values).
- `discovery_sources` stores 1-to-many provenance rows (`source_type`, `referring_url`, `element_context`, `observed_at`) so deduplicated URLs retain every referring page/form.

## 7. Indexing Strategy (Query-Path Driven)
- `user_sessions(user_id, expires_at) WHERE revoked_at IS NULL` — active session lookup.
- `projects(workspace_id, status, updated_at)` — workspace dashboard listing.
- `targets(project_id, authorization_status)` — preflight & project target list.
- `scope_versions(target_id, version_number)` — latest/versioned scope lookup.
- `assessment_runs(target_id, state)` & `assessment_runs(workspace_id, project_id, created_at)` — active run check & run history.
- `run_events(run_id, created_at)` — ordered run monitor stream.
- `url_inventory(run_id, scope_status)` & `url_inventory(project_id, target_id)` — paginated inventory filtering.
- `discovery_sources(url_inventory_id, observed_at)` — URL detail provenance drawer.
- `audit_logs(workspace_id, created_at)` & `audit_logs(action, outcome)` — governance audit viewer.

## 8. Security, Privacy & Audit Controls
- **No plaintext secrets:** Only Argon2id `password_hash`, SHA-256 `token_hash`, and SHA-256 `csrf_token_hash` are stored.
- **Redaction:** `audit_service.append_audit` and `logging.redact_dict` scrub cookies, bearer tokens, and secret keys before `JSONB` persistence.
- **Append-only audit:** No `UPDATE` or `DELETE` API routes exist for `audit_logs`; every row carries a canonical `integrity_hash`.
- **Tenant isolation:** Enforced at query layer in `app/services/permissions.py` (cross-workspace access returns `404`) rather than PostgreSQL RLS, avoiding connection-pool context leakage.
