# Docker Runner Decisions & Assumptions (`DOCKER_RUNNER_DECISIONS.md`)

1. **Docker CLI Subprocess vs `docker-py` SDK:** Preserved the repository's `subprocess.Popen(["docker", "run", ...])` pattern in `DockerRunnerExecutor` rather than adding a new `docker` SDK dependency, keeping `requirements.txt` minimal and deterministic.
2. **Runner Image Pinning:** Pinned `Dockerfile.runner` base image to `python:3.12.8-slim` (from floating `python:3.12-slim`) and added `dnspython==2.9.2` so DNS A/AAAA resolution works inside the runner container.
3. **Default-Deny Networking:** `ContainerSecurityProfile` defaults to `network_mode="none"` and only attaches to `abm_internal` when `local_lab_exception_active=True` is explicitly set in the validated plan.
4. **Windows Host Limitation:** Docker Engine is not installed on the local Windows machine; `LocalRestrictedRunnerExecutor` executes local tests while `DockerRunnerExecutor` security profile, plan validation, output capture, timeout/cancellation, and orphan reconciliation are verified via unit/mocked-subprocess tests.
