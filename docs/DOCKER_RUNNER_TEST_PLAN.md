# Docker Runner Test Plan (`DOCKER_RUNNER_TEST_PLAN.md`)

Covered in `backend/tests/unit/runner/test_docker_runner_suite.py`:
1. **Container Security Profile Tests:** Verify `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--user=10001:10001`, `--pids-limit`, `--memory`, `--cpus`, `--ulimit nofile`, `--network=none` default, `abm.managed=true` labels, zero Docker socket/host mounts.
2. **Plan Validation Tests:** Reject invalid schema version, unallowlisted image, Semester 8 module, or budget exceeding platform ceiling.
3. **Bounded Output & Secret Tests:** Verify byte-cap truncation, ANSI/control-char stripping, and secret redaction.
4. **Lifecycle, Timeout & Orphan Reconciliation Tests:** Verify wall-clock timeout kills container and returns `timed_out`; cancellation terminates container; `reconcile_orphaned_containers` removes only `abm.managed=true` containers whose runs are terminal/cancelled.
