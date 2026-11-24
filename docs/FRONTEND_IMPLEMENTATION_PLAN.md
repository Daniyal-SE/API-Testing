# Frontend Implementation Plan — API Behavior Miner & Business-Logic Vulnerability Tester

## 1. Scope & Boundary
This document defines the frontend-only implementation plan for the **API Behavior Miner & Business-Logic Vulnerability Tester** (FYP Semester 7 — 40% & Semester 8 — 60%).
- **Stack**: React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router DOM, TanStack Query, Zod, `@xyflow/react`, Lucide React.
- **Boundary**: Strictly browser-side presentation and control UI. No backend FastAPI services, databases, queues, Docker runners, or direct browser-to-target scanning traffic are implemented.

## 2. Architecture & Folder Structure
```
src/
  app/
    App.tsx              # Root routes & layout bindings
    providers.tsx        # QueryClient, AuthSession, Theme, WorkspaceContext
  components/
    ui/                  # Reusable primitives (Button, Badge, Card, Dialog, Drawer, Input, Select, Tabs)
    layout/              # AppShell, AppHeader, AppSidebar, WorkspaceSwitcher, Breadcrumbs, PageHeader
    data-display/        # DataTable, FilterToolbar, Pagination, MetricCard, ChartPanel
    feedback/            # EmptyState, LoadingSkeleton, ErrorState, ForbiddenState, RetryPanel, DemoBanner
    security/            # SafeText, StatusBadge, SeverityBadge, ScopeVersionBadge, RunnerReadinessPanel, RunStateTimeline, AuditTimeline
  features/
    auth/                # Login, session-expired, access-denied, registration/recovery conditional views
    dashboard/           # Overview metrics, recent runs, severity distribution, audit feed, empty workspace guide
    projects/            # Project list, create/edit form, project detail tabs, members & roles
    targets/             # Target list, registration form, authorization detail & chronological history
    scope/               # Structured scope editor, normalized preview, version history & approval state
    assessments/         # Multi-step assessment wizard, preflight blockers, runs list, live monitoring & cancellation
    url-inventory/       # URL discovery summary, URL inventory table, URL detail & provenance
    web-security/        # ZAP alerts & low-impact passive web security results
    api-contracts/       # OpenAPI JSON/YAML import dropzone, parser warnings, contract detail
    api-inventory/       # Normalized API operations inventory
    contract-testing/    # Schema/contract test setup, positive/negative/type/boundary cases & results
    behavior-graph/      # @xyflow/react interactive dependency graph with documented vs inferred edges
    identities/          # Synthetic test identity references (secret-reference only, no raw credentials)
    invariants/          # Business invariant library, editor (BOLA, Workflow-order, One-time/Replay), invariant runs
    evidence/            # Evidence explorer with bounded safe text rendering & redaction markers
    findings/            # Finding triage list, detail review workflow, rationale & state updates
    reports/             # HTML/JSON report export lifecycle & secret-free preview
    benchmarks/          # Benchmark runs & evaluation metrics (Precision, Recall, FPR, Coverage, Reproducibility, Time-to-Triage)
    audit/               # Filterable governance audit log
    settings/            # Minimal user profile, theme switch, workspace membership, optional admin health
  lib/
    api-client.ts        # Typed frontend API client boundary (live vs isolated mock adapter)
    mock-adapter.ts      # Deterministic, isolated FYP demo dataset & stateful simulation
    status-mappers.ts    # Centralized canonical status/severity/role enum mappers with Unknown fallback
    validators.ts        # Pure validation schemas & scope/URL normalization helpers (unit-tested)
    permissions.ts       # Role-aware UI helpers (non-authoritative; backend remains authoritative)
    formatters.ts        # Date, duration, byte, and safe text truncation formatters
  types/
    domain.ts            # Typed frontend interfaces for all Semester 7 & Semester 8 entities
```

## 3. Implementation Stages
1. **Stage 1 — Documentation & Design Tokens**: Establish plan, decisions, API contract gaps, dark security-console theme tokens in `src/index.css`, and domain types.
2. **Stage 2 — Core Shell & Reusable Components**: Build `AppShell`, `AppHeader`, `AppSidebar`, `DataTable`, `StatusBadge`, `SafeText`, `ConfirmDialog`, `SideDrawer`, and isolated `mock-adapter.ts` + `api-client.ts`.
3. **Stage 3 — Semester 7 Workflows (Internal Defense 40%)**:
   - Auth (`/login`, session expiry, conditional `/register` & `/forgot-password`)
   - Dashboard (`/app/dashboard`)
   - Workspaces & Projects (`/app/projects`, `/app/projects/new`, `/app/projects/:projectId`, `/app/projects/:projectId/members`)
   - Targets & Authorization (`/app/targets`, `/app/targets/new`, `/app/targets/:targetId`, `/app/targets/:targetId/authorization`)
   - Scope Configuration & Versions (`/app/targets/:targetId/scope`, `/app/targets/:targetId/scope/versions`)
   - Assessment Wizard, Preflight & Safe Runner Readiness (`/app/assessments/new`)
   - Assessment Runs, Monitoring & Cancellation (`/app/assessments`, `/app/assessments/:runId`, `/app/assessments/:runId/monitor`)
   - URL Discovery & Inventory (`/app/inventory/urls`, `/app/inventory/urls/:urlId`)
   - Audit History Foundation (`/app/audit`)
4. **Stage 4 — Semester 8 Workflows (Final Defense 60%)**:
   - URL Security Results & ZAP Alerts (`/app/security/url-findings`)
   - OpenAPI Contracts & Import (`/app/contracts`, `/app/contracts/import`, `/app/contracts/:contractId`)
   - API Operations & Contract Testing (`/app/api-operations`, `/app/api-tests`, `/app/api-tests/:runId`)
   - Behavior Dependency Graph (`/app/behavior-graph`)
   - Test Identities (`/app/identities`)
   - Business Invariants & Runs (`/app/invariants`, `/app/invariants/new`, `/app/invariants/:invariantId`, `/app/invariant-runs`)
   - Evidence & Findings Triage (`/app/findings`, `/app/findings/:findingId`, `/app/evidence/:evidenceId`, `/app/evidence`)
   - Reports & Export (`/app/reports`, `/app/reports/:reportId`)
   - Benchmarks & Evaluation (`/app/benchmarks`, `/app/benchmarks/:benchmarkId`, `/app/evaluation`)
   - Settings & Optional Admin Status (`/app/settings`)
5. **Stage 5 — Testing & Verification**:
   - Unit tests for pure logic (`status-mappers`, `validators`, `permissions`, `formatters`) via `node:test`.
   - Browser E2E verification across Flows A–E via `playwright-cli`.
   - Typecheck (`npm run lint`) and production build (`npm run build`).
