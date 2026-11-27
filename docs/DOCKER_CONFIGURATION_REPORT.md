# Docker Configuration Report

- **Docker Engine:** `29.9.3` (desktop-linux / WSL2)
- **Docker Compose:** `v5.7.1`
- **Compose Services Running:**
  - `api-testing-main-postgres-1` (`postgres:16.2-alpine`, bound `127.0.0.1:5432->5432/tcp`, healthcheck `pg_isready`, persistent volume `pgdata_sem7`)
  - `api-testing-main-redis-1` (`redis:7.2.4-alpine`, bound `127.0.0.1:6379->6379/tcp`, healthcheck `redis-cli ping`, AOF persistence enabled)
- **Internal Network:** `api-testing-main_abm_internal` (bridge)
- **Hardened Runner Verification (`abm-safe-runner:sem7`):**
  - Executed `docker run --rm --read-only --cap-drop=ALL --security-opt no-new-privileges:true --network none --memory 256m --pids-limit 64 --user 10001:10001 --entrypoint python abm-safe-runner:sem7 -c "..."`
  - Verified non-root UID (`uid: 10001`), read-only rootfs, zero capabilities, no Docker socket, and automatic removal (`docker ps -a` returned 0 containers).
