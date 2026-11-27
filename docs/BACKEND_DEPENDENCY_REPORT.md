# Backend Dependency Report

Verified inside `backend/.venv` (Python `3.14.2`):

| Package | Installed Version | Role |
|---|---|---|
| `fastapi` | `0.165.0` | Control plane API |
| `uvicorn` | `0.54.0` | ASGI server |
| `pydantic` / `pydantic-settings` | `2.14.4` / `2.16.3` | Schema & settings validation |
| `SQLAlchemy` | `2.1.9` | ORM & PostgreSQL dialect |
| `alembic` | `1.20.1` | Schema migrations |
| `psycopg` / `psycopg-binary` | `3.3.9` | PostgreSQL 16 driver |
| `redis` | `8.2.0` | Redis client |
| `rq` | `3.0.0` | Background job queue |
| `httpx` | `0.28.1` | Bounded HTTP discovery client |
| `beautifulsoup4` | `4.15.0` | HTML link & form metadata parser |
| `argon2-cffi` | `25.1.0` | Password hashing |
| `pytest` / `pytest-asyncio` | `9.2.0` / `1.5.0` | Automated test runner |
