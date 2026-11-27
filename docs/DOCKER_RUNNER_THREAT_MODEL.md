# Docker Runner Threat Model (`DOCKER_RUNNER_THREAT_MODEL.md`)

| Threat | Mitigation |
|---|---|
| **Container Escape / Privilege Escalation** | Non-root UID `10001:10001`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--read-only`, no `--privileged`, no Docker socket mount |
| **Resource Exhaustion (Fork Bomb / OOM / Disk Fill)** | `--pids-limit=64`, `--memory=512m`, `--cpus=0.5`, `--tmpfs=/tmp:rw,noexec,nosuid,size=32m`, `--ulimit nofile=256:256`, wall-clock deadline |
| **SSRF / Internal Service Pivot (Postgres/Redis/Metadata)** | Default `network_mode=none` or restricted `abm_internal`; last-mile `destination_validation.py` blocks private/loopback/link-local/metadata IPs unless exact Local Lab exception applies; manual redirect revalidation |
| **Arbitrary Image / Flag Injection** | Controller constructs `docker run` args from typed `ContainerSecurityProfile` and `ExecutionPlanV1`; image checked against allowlist |
| **Untrusted Stdout / Secret Leakage** | `BoundedOutputCapture` caps bytes, strips ANSI/control chars, and redacts secrets; no secrets passed in Docker labels or CLI args |
| **Orphaned Containers on Crash** | `abm.managed=true` + `abm.run_id` labels allow startup `reconcile_orphaned_containers()` to clean only ABM-owned containers |
