# Docker Runner Implementation Plan (Semester 7 — 40%)

## 1. Initial Audit Findings
- `backend/Dockerfile.runner`: Uses `python:3.12-slim` (unpinned patch), UID `10001` non-root `runner`, missing `dnspython==2.9.2` needed by `destination_validation.py`.
- `backend/app/runner/container.py`: Implements `LocalRestrictedRunnerExecutor` and `DockerRunnerExecutor` (`--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--pids-limit=64`, `--user=10001:10001`, `--tmpfs=/tmp`).
- **Gaps identified:**
  1. No typed `ExecutionPlanV1` schema or fail-closed `validate_execution_plan` before container launch.
  2. No centralized `ContainerSecurityProfile` (missing `--network`, `--name`, `--label abm.managed=true`, `--ulimit nofile`, and image allowlist check).
  3. No wall-clock timeout enforcement inside `DockerRunnerExecutor.execute_discovery` wait loop.
  4. Unbounded `proc.stdout.read()` without byte cap or ANSI/control-char sanitization.
  5. No orphaned container reconciliation (`abm.managed=true`) on startup/worker loss.

## 2. Implementation Phases
1. **Docs:** Create all 8 `docs/DOCKER_RUNNER_*` documents.
2. **Contracts & Security Profile:** `plan_schema.py`, `plan_validator.py`, `security_profile.py`, `output_capture.py`.
3. **Lifecycle, Timeout & Orphan Reconciliation:** `reconciliation.py` + `DockerRunnerExecutor` hardening + `Dockerfile.runner` pinning.
4. **Verification:** Comprehensive unit, container-config, output-sanitization, timeout/cancellation, and orphan-reconciliation tests in `backend/tests/unit/runner/test_docker_runner_suite.py`.
