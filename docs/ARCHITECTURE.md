# Backend Architecture — Semester 7 (Control Plane, Queue, & Safe Runner)

## 1. High-Level Component Architecture

The Semester 7 backend enforces strict separation between the **authoritative control plane** (FastAPI), **durable persistence** (PostgreSQL), **asynchronous job coordination** (Redis + Python RQ), and **untrusted target interaction** (Trusted Runner Controller + Restricted Runner Boundary).

```mermaid
flowchart LR
  FE["React Frontend (Vite / Port 3000)"] -->|"HTTPS/JSON + Session Cookie + X-CSRF-Token"| API["FastAPI Control Plane (/api/v1)"]
  API -->|"SQLAlchemy 2.x + Alembic"| PG[("PostgreSQL (Primary Store)")]
  API -->|"Enqueue Run Job + Cancellation Flag"| RD[("Redis / RQ Queue")]
  RD -->|"Dequeue Job"| WK["RQ Background Worker"]
  WK -->|"Immutable RunPlan Snapshot"| RC["Trusted Runner Controller"]
  RC -->|"Policy-Gated Execution"| RR["Restricted Runner Boundary (Docker / Local Adapter)"]
  RR -->|"HTTPX (Validated Host/Port/IP/Path/Method Only)"| TGT["Authorized Local Lab / Staging Target"]
  RC -->|"Persist Sanitized Events, URL Inventory, Provenance"| PG
```

---

## 2. Responsibility Boundaries

| Layer | Responsibilities | Explicit Prohibitions |
| :--- | :--- | :--- |
| **React Frontend** | Presentation, form validation UX, polling run status | Never sends direct HTTP requests to target URLs; never holds authoritative RBAC/scope authority |
| **FastAPI Control Plane** | Auth/session validation, CSRF check, RBAC, project isolation, target authorization, scope versioning, preflight gating, immutable run-plan creation, inventory & audit APIs | Never runs crawls inside HTTP request handlers; never trusts client-supplied roles or scope decisions |
| **PostgreSQL** | Durable relational state for users, sessions, workspaces, projects, targets, authorization records, scope versions, runs, events, URL inventory, provenance, and append-only audit logs | Never stores plaintext passwords, raw target secrets, or raw session tokens |
| **Redis + Python RQ** | Asynchronous job queue, short-lived cancellation signal (`abm:run:cancel:{run_id}`) | Not the source of truth for run history or URL inventory (survives Redis restart via PostgreSQL) |
| **Trusted Runner Controller** | Reads immutable `RunPlan`, checks cancellation signal, invokes restricted runner boundary, persists `run_events`, `url_inventory`, `discovery_sources`, and updates run counters/state | Never trusts unvalidated crawler output; enforces output size and count caps |
| **Restricted Runner Boundary** | Executes HTTPX same-origin crawl under pre-request normalization, scope allowlist, DNS/IP validation, manual redirect revalidation, and depth/request/rate/concurrency/time budgets | No Docker daemon socket; no DB credentials; no control-plane secrets; non-root; read-only rootfs in container mode |

---

## 3. Core Workflows

### 3.1 Assessment Launch & Immutable Snapshot Flow

```mermaid
sequenceDiagram
  participant U as User (Owner/Tester)
  participant API as FastAPI Control Plane
  participant DB as PostgreSQL
  participant Q as Redis / RQ
  participant W as RQ Worker & Runner

  U->>API: POST /api/v1/assessments/preflight
  API->>DB: Verify workspace membership, target authz, approved scope
  API-->>U: PreflightResult (canLaunch, blockers[], runnerReadiness)
  U->>API: POST /api/v1/assessments
  API->>DB: Re-verify RBAC + authz + approved scope + active-run conflict (409)
  API->>DB: Persist AssessmentRun (queued) with immutable run_plan_json + plan_hash
  API->>DB: Append ASSESSMENT_LAUNCHED audit log
  API->>Q: Enqueue run_assessment_job(run_id)
  API-->>U: 202 Accepted (run_id, state=queued)
  Q->>W: Worker claims job
  W->>DB: Transition queued -> running
  loop While queue not empty & budgets remain & not cancelled
    W->>W: Normalize URL -> Scope Check -> DNS/IP Check -> Rate Limit -> HTTPX GET (follow_redirects=False)
    alt Redirect 3xx
      W->>W: Normalize Location -> Scope Check -> DNS/IP Check (block & log if out-of-scope)
    end
    W->>DB: Persist url_inventory, discovery_sources, run_events, counters
    W->>Q: Check cancellation key
  end
  W->>DB: Transition to completed | partial | cancelled | failed + retainedSummary + audit_log
```

### 3.2 Run State Machine

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> queued : Enqueued to RQ
  pending --> failed : Preflight/enqueue error
  queued --> running : Worker claims job
  queued --> cancellation_requested : Operator cancels before start
  queued --> cancelled : Worker observes cancel before 1st request
  queued --> interrupted : Stale timeout reconciliation
  running --> cancellation_requested : POST /assessments/{id}/cancel
  running --> completed : Crawl queue exhausted within budget
  running --> partial : Budget exhausted or stopped mid-crawl
  running --> failed : Unrecoverable runner/target error
  running --> interrupted : Worker heartbeat lost
  cancellation_requested --> cancelled : Runner stops with 0 discovered URLs
  cancellation_requested --> partial : Runner stops with >=1 discovered URLs
  cancellation_requested --> failed : Unrecoverable error during stop
```

---

## 4. Runner Isolation Model

1. **Docker Container Runner (`DockerRunnerExecutor`):**
   - Uses `backend/Dockerfile.runner` built as a dedicated unprivileged user (`runner`, UID 10001).
   - Launched with `--read-only`, `--cap-drop=ALL`, `--security-opt=no-new-privileges:true`, `--pids-limit=64`, `--memory=256m`, `--cpus=0.5`, `--tmpfs=/tmp:rw,noexec,nosuid,size=32m`.
   - Receives ONLY the serialized immutable `RunPlan` JSON on stdin and writes bounded JSON output to stdout.
   - Never mounts `/var/run/docker.sock`, `.env`, or PostgreSQL/Redis credentials.
2. **Restricted Local Runner Adapter (`LocalRestrictedRunnerExecutor`):**
   - Used when Docker daemon is unavailable in local academic development/CI environments (including the current Windows host without Docker).
   - Executes the exact same `crawler.py` policy/normalization/DNS/redirect/budget engine with zero database or control-plane access.
   - `/api/v1/runner/health` reports the active runner mode (`docker` vs `local_restricted`) truthfully.
