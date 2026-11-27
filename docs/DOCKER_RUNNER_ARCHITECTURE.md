# Docker Runner Architecture (`DOCKER_RUNNER_ARCHITECTURE.md`)

## 1. Trust Boundaries
```
[Trusted Control Plane: FastAPI + PostgreSQL + Redis/RQ Worker]
       |  Validated ExecutionPlanV1 (schema_version=1, policy_hash, budgets)
       v
[Trusted RunnerController / DockerRunnerExecutor]  (only component invoking Docker CLI/API)
       |  docker run --rm -i --read-only --cap-drop=ALL --user=10001:10001
       |  --security-opt=no-new-privileges:true --network=<none|abm_internal>
       |  --label abm.managed=true --label abm.run_id=<id>
       v
[Untrusted Ephemeral Runner Container (UID 10001)]
  - NO /var/run/docker.sock
  - NO PostgreSQL / Redis credentials
  - NO host source mounts
  - Last-mile URL normalization, DNS/IP SSRF blocking, redirect revalidation
```
