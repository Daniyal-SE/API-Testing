# Semester 7 Data Dictionary (`DATABASE_DATA_DICTIONARY_S7.md`)

All timestamps are `TIMESTAMPTZ` stored in UTC (rendered in `Asia/Karachi` at the UI layer). Primary keys are application-generated UUIDv4 (`UUID`). `JSONType` maps to `JSONB` on PostgreSQL.

## 1. `users`
Purpose: Authenticated platform identities.
| Column | PG Type | Null | Default | Constraints / Rules | Sensitivity | SRS Ref |
|---|---|---|---|---|---|---|
| `id` | `UUID` | NO | UUIDv4 | PK (`pk_users`) | Internal ID | 7.1 |
| `email` | `VARCHAR(255)` | NO | — | Unique (`ix_users_email`), functional `lower(email)` unique | PII | 7.1 |
| `username` | `VARCHAR(100)` | NO | — | Unique (`ix_users_username`), functional `lower(username)` unique | Internal | 7.1 |
| `display_name` | `VARCHAR(120)` | NO | — | Bounded display name | PII | 7.1 |
| `password_hash` | `VARCHAR(512)` | NO | — | Argon2id hash only; never returned in API | Secret Hash | 5.3, 7.1 |
| `global_role` | `VARCHAR(40)` | NO | `'security_tester'` | Default platform role label | Internal | 7.1 |
| `account_status` | `VARCHAR(32)` | NO | `'active'` | `CHECK IN ('active','suspended','deactivated')` | Internal | 7.1 |
| `department` | `VARCHAR(120)` | YES | `NULL` | Academic department label | Internal | 7.1 |
| `failed_login_count` | `INTEGER` | NO | `0` | `CHECK >= 0` | Security | 7.1 |
| `locked_until` | `TIMESTAMPTZ` | YES | `NULL` | Account lockout expiry | Security | 7.1 |
| `last_login_at` | `TIMESTAMPTZ` | YES | `NULL` | Last successful login | Audit | 7.1 |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | NO | `utc_now` | Audit timestamps | Metadata | 7.1 |

## 2. `user_sessions`
Purpose: Revocable opaque session & CSRF token digest store.
| Column | PG Type | Null | Default | Constraints / Rules | Sensitivity | SRS Ref |
|---|---|---|---|---|---|---|
| `id` | `UUID` | NO | UUIDv4 | PK | Internal ID | 7.2 |
| `user_id` | `UUID` | NO | — | FK -> `users.id` (`ON DELETE CASCADE`) | Internal | 7.2 |
| `token_hash` | `VARCHAR(128)` | NO | — | SHA-256 of opaque cookie; Unique | Secret Hash | 7.2 |
| `csrf_token_hash` | `VARCHAR(128)` | NO | — | SHA-256 of CSRF token | Secret Hash | 7.2 |
| `expires_at` | `TIMESTAMPTZ` | NO | — | Session expiration | Security | 7.2 |
| `revoked_at` | `TIMESTAMPTZ` | YES | `NULL` | Logout/revocation timestamp | Security | 7.2 |
| `ip_address` | `VARCHAR(64)` | YES | `NULL` | Client IP | PII/Security | 7.2 |
| `user_agent_summary` | `VARCHAR(200)` | YES | `NULL` | Bounded UA string | Metadata | 7.2 |
| `created_at`, `last_seen_at` | `TIMESTAMPTZ` | NO | `utc_now` | Session activity timestamps | Metadata | 7.2 |

## 3. `workspaces` & 4. `workspace_members`
- **`workspaces`**: `id (PK)`, `slug (UNIQUE)`, `name`, `description`, `semester_label` (default `'Semester 7'`), `owner_id (FK users.id RESTRICT)`, `is_active (BOOLEAN)`, `created_at`, `updated_at`.
- **`workspace_members`**: `id (PK)`, `workspace_id (FK CASCADE)`, `user_id (FK CASCADE)`, `role (CHECK controlled)`, `status (CHECK IN ('invited','active','suspended','revoked'))`, `granted_by_id (FK users.id SET NULL)`, `granted_at`, `UNIQUE(workspace_id, user_id)`.

## 5. `projects` & 6. `project_members`
- **`projects`**: `id (PK)`, `workspace_id (FK CASCADE)`, `owner_id (FK users.id RESTRICT)`, `name`, `description`, `environment_context (CHECK IN ('local_lab','staging'))`, `status (CHECK IN ('active','archived','deleted'))`, `deleted_at`, `created_at`, `updated_at`, `UNIQUE(id, workspace_id)`.
- **`project_members`**: `id (PK)`, `project_id (FK CASCADE)`, `user_id (FK CASCADE)`, `role (CHECK controlled)`, `status (CHECK IN ('active','suspended','revoked'))`, `added_by_id (FK SET NULL)`, `added_at`, `UNIQUE(project_id, user_id)`.

## 7. `targets` & 8. `authorization_records`
- **`targets`**: `id (PK)`, `workspace_id`, `project_id`, composite FK `(project_id, workspace_id) -> projects(id, workspace_id) CASCADE`, `UNIQUE(id, project_id, workspace_id)`, `display_name`, `description`, `base_url`, `normalized_base_url`, `scheme`, `hostname`, `port (CHECK 1..65535)`, `base_path`, `environment (CHECK IN ('local_lab','staging'))`, `authorization_status (CHECK IN ('pending_review','authorized','revoked','needs_revalidation'))`, `ownership_declaration`, `permission_reference`, `current_scope_version_id`, `last_authorization_review_at`, `created_at`, `updated_at`.
- **`authorization_records`**: `id (PK)`, `target_id (FK targets.id CASCADE)`, `declaring_user_id (FK users.id RESTRICT)`, `reviewed_by_user_id (FK users.id SET NULL)`, `permission_reference`, `ownership_declaration`, `declaration_hash (SHA-256)`, `state (CHECK controlled)`, `scope_version_label`, `notes`, `effective_at`, `expires_at`, `revoked_at`, `created_at`.

## 9. `scope_versions`
Purpose: Immutable versioned scope boundary per target.
- Columns: `id (PK)`, `target_id (FK targets.id CASCADE)`, `version_number (CHECK >= 1)`, `version_label`, `approval_state (CHECK IN ('pending_approval','approved','rejected','superseded','revoked'))`, `allowed_hosts (JSONB)`, `allowed_ports (JSONB)`, `allowed_path_prefixes (JSONB)`, `excluded_paths (JSONB)`, `allowed_methods (JSONB)`, `follow_redirects_in_scope_only (BOOLEAN)`, `state_changing_methods_enabled (BOOLEAN)`, `block_private_and_link_local (BOOLEAN)`, `local_lab_exception_active (BOOLEAN)`, `budgets (JSONB)`, `normalized_preview (TEXT)`, `policy_hash (VARCHAR(64))`, `change_summary (TEXT)`, `created_by_id (FK RESTRICT)`, `approved_by_id (FK SET NULL)`, `created_at`, `approved_at`.
- Constraints: `UNIQUE(target_id, version_number)`, `UNIQUE(id, target_id)`.

## 10. `assessment_runs` & 11. `run_events`
- **`assessment_runs`**: `id (PK)`, `run_code (UNIQUE)`, `workspace_id`, `project_id`, `target_id`, `scope_version_id`, `initiated_by_id (FK users.id RESTRICT)`, `rq_job_id`, `modules (JSONB)`, `run_plan_json (JSONB immutable snapshot)`, `plan_hash (VARCHAR(64))`, `state (CHECK IN ('queued','running','cancellation_requested','completed','partial','cancelled','failed','interrupted'))`, `current_phase`, `phases_json (JSONB)`, `progress_percent`, `request_count (CHECK >= 0)`, `request_budget (CHECK > 0)`, `discovered_urls_count (CHECK >= 0)`, `in_scope_urls_count (CHECK >= 0)`, `excluded_urls_count (CHECK >= 0)`, `duplicate_urls_count (CHECK >= 0)`, `blocked_redirects_count (CHECK >= 0)`, `retained_summary`, `started_at`, `heartbeat_at`, `completed_at`, `duration_seconds`, `created_at`.
  - Composite FKs: `(target_id, project_id, workspace_id) -> targets(id, project_id, workspace_id) CASCADE`, `(scope_version_id, target_id) -> scope_versions(id, target_id) RESTRICT`.
  - Partial Unique Index: `uq_assessment_runs_one_active_per_target` on `(target_id) WHERE state IN ('queued','running','cancellation_requested')`.
- **`run_events`**: `id (PK)`, `run_id (FK assessment_runs.id CASCADE)`, `event_type`, `level`, `phase`, `message`, `detail_json (JSONB redacted)`, `correlation_id`, `created_at`.

## 12. `url_inventory` & 13. `discovery_sources`
- **`url_inventory`**: `id (PK)`, `workspace_id (FK CASCADE)`, `project_id (FK CASCADE)`, `target_id (FK CASCADE)`, `run_id (FK CASCADE)`, `canonical_key`, `normalized_url`, `scheme`, `host`, `port (CHECK 1..65535)`, `path`, `method_hint`, `asset_type`, `primary_source`, `scope_status (CHECK controlled)`, `scope_reason`, `test_status`, `parameter_names (JSONB keys only)`, `form_metadata (JSONB schema only, no values)`, `status_code`, `content_type`, `depth (CHECK >= 0)`, `hit_count (CHECK >= 1)`, `first_seen_at`, `last_seen_at`. Constraint: `UNIQUE(run_id, canonical_key)`.
- **`discovery_sources`**: `id (PK)`, `url_inventory_id (FK CASCADE)`, `run_id (FK CASCADE)`, `source_type`, `referring_url`, `element_context`, `observed_at`.

## 14. `audit_logs`
- Columns: `id (PK)`, `workspace_id (FK SET NULL)`, `project_id (FK SET NULL)`, `target_id (FK SET NULL)`, `actor_user_id (FK SET NULL)`, `actor_email`, `actor_role`, `action`, `resource_type`, `resource_id`, `outcome`, `correlation_id`, `correlation_run_id`, `detail`, `metadata_json (JSONB redacted)`, `integrity_hash (SHA-256)`, `created_at`.
