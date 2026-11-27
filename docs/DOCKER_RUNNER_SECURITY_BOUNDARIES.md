# Docker Runner Security Boundaries (`DOCKER_RUNNER_SECURITY_BOUNDARIES.md`)

1. **Container Hardening (`ContainerSecurityProfile`):** `privileged=False`, `user=10001:10001`, `cap_drop=["ALL"]`, `no_new_privileges=True`, `read_only_rootfs=True`, `tmpfs=/tmp:rw,noexec,nosuid,size=32m`, `pids_limit=64`, `memory=512m` (configurable up to 1024m), `cpus=0.5` (configurable up to 1.0), `ulimit_nofile=256`.
2. **No Runtime Control / No Secrets:** Zero Docker socket mounts, zero DB/Redis credentials, zero host bind mounts.
3. **Default-Deny Network Egress:** `network_mode="none"` by default; only when an explicit `local_lab_exception_active=True` is approved for a Compose local fixture is the restricted network (`abm_internal`) used, combined with last-mile DNS/IP/port/path/method validation in `destination_validation.py` and `policy.py`.
4. **Host Limitations (Windows):** Docker Engine is not installed on the current Windows host, so container runtime enforcement is verified via command/profile tests and `LocalRestrictedRunnerExecutor` in CI; live container enforcement must be verified on a Docker-enabled Linux/WSL2 host.
