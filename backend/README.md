# API Behavior Miner & Business-Logic Vulnerability Tester — Semester 7 Backend

Reproducible local-only academic prototype for **Semester 7 Internal Defense (40%)**.

## Scope Boundary
- **Implemented:** Auth/sessions (Argon2id + HttpOnly/SameSite cookies + CSRF + rate limiting), workspace/project isolation & RBAC, target registration & auditable authorization declarations, versioned scope & path/DNS/IP/redirect/budget enforcement, Redis/RQ async assessment lifecycle & cancellation, bounded same-origin HTTPX URL discovery with provenance, and append-only audit logging.
- **Deferred to Semester 8:** OWASP ZAP scanning, OpenAPI importer, Schemathesis contract testing, NetworkX behavior graph, test identities, business-logic invariants, findings triage, HTML/JSON reports, benchmarks, and AI advisor.

## Quick Local Setup (Docker Compose)

1. Copy environment placeholder:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Start PostgreSQL, Redis, Local Lab Fixture, FastAPI Backend, and RQ Worker:
   ```bash
   docker compose up --build -d
   ```
3. Seed synthetic demo accounts and local targets:
   ```bash
   docker compose exec backend python scripts/seed_demo.py
   ```
   To reset cleanly to initial state:
   ```bash
   docker compose exec backend python scripts/reset_demo.py
   ```
4. Inspect API docs at `http://localhost:8000/docs` and health at `http://localhost:8000/api/v1/health`.

## Synthetic Demo Accounts (`seed_demo.py`)
Default password (configurable via `DEMO_USER_PASSWORD`): `FypDemoPass!2026`
- `owner@fyp-lab.edu` (`project_owner`)
- `tester@fyp-lab.edu` (`security_tester`)
- `evaluator@fyp-lab.edu` (`supervisor_evaluator`)
- `admin@fyp-lab.edu` (`system_admin`)
- `outsider@other-lab.edu` (isolated Workspace B for tenant isolation verification)

## Running Tests Locally (Python 3.12+ / 3.14)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate  |  Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
pytest -v
```
