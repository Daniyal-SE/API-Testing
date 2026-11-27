# Docker Runner Interface Contract (`DOCKER_RUNNER_INTERFACE.md`)

- **Input Contract (`ExecutionPlanV1`):** `plan_schema_version=1`, `run_id`, `correlation_id`, `target` (`normalized_base_url`, `scheme`, `hostname`, `port`, `environment`), `scope` (`allowed_hosts`, `allowed_ports`, `allowed_path_prefixes`, `excluded_paths`, `allowed_methods`, `follow_redirects_in_scope_only`, `block_private_and_link_local`, `local_lab_exception_active`, `budgets`), `modules` (`["url_discovery"]` only in S7), `runner_image` (must be in allowlist).
- **Output Contract (`RunnerResultEnvelope`):** Bounded JSON stdout (`max_output_bytes=4_194_304`), sanitized against ANSI/control characters, containing `terminal_state`, `stop_reason`, counters, `records`, and `events`.
- **Lifecycle Operations:** `validate_execution_plan`, `build_docker_command`, `execute_discovery` (with wall-clock timeout + cooperative cancellation), and `reconcile_orphaned_containers`.
