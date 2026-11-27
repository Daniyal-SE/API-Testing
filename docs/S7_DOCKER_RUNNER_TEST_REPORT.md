# Semester 7 Docker Runner Test Report

- **Docker Engine:** `29.9.3` (WSL2 `docker-desktop`, `OS=linux`)
- **Runner Image:** `abm-safe-runner:sem7` (`python:3.12.8-slim`, non-root UID `10001`, `httpx==0.28.1`, `beautifulsoup4==4.15.0`)
- **Live Container Execution:**
  - `docker run --rm --read-only --cap-drop=ALL --security-opt no-new-privileges:true --network none --memory 256m --pids-limit 64 --user 10001:10001 --entrypoint python abm-safe-runner:sem7 -c "import os, httpx, bs4; print('uid:', os.getuid(), 'httpx:', httpx.__version__, 'bs4:', bs4.__version__)"`
  - **Result:** `uid: 10001 httpx: 0.28.1 bs4: 4.15.0`; `docker ps -a --filter "ancestor=abm-safe-runner:sem7"` returned 0 containers (clean removal).
- **Unit & Security Suite (`tests/unit/runner/test_docker_runner_suite.py`):** 4/4 passed (security profile, default-deny network, plan validation, bounded output capture + ANSI/secret redaction, orphan container reconciliation).
- **Status:** **PASS**
