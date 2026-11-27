# Stack Installation Report

**Date:** 2026-11-27

1. **WSL2 Update:** Updated WSL2 kernel (`wsl --update`), confirmed `Default Distribution: docker-desktop`, `Default Version: 2`.
2. **Docker Desktop:** Installed `Docker.DockerDesktop` v4.100.1 via `winget` / cached installer with WSL2 backend (`Docker version 29.9.3`, `Docker Compose version v5.7.1`).
3. **Containerized Infrastructure:** Pulled and started `postgres:16.2-alpine` and `redis:7.2.4-alpine` via `docker compose up -d postgres redis`.
4. **Runner Image:** Built `abm-safe-runner:sem7` from `backend/Dockerfile.runner` (`python:3.12.8-slim`, UID `10001`, `httpx==0.28.1`, `beautifulsoup4==4.15.0`).
5. **Backend Environment:** Configured `backend/.env` pointing to `127.0.0.1:5432/abm_sem7` and `127.0.0.1:6379/0`.
