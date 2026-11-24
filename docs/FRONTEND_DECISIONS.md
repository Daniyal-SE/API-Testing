# Frontend Architectural Decisions — API Behavior Miner

## 1. Authoritative Source Handling
- **Missing External SRS / Spec Files**: `API_Behavior_Miner_Complete_Frontend_Specification.md` and `SRS Version 4.0` were not committed to this starter repository. All decisions derive directly from the Master Implementation Prompt provided by the user, with any undefined backend contracts recorded in `docs/API_CONTRACT_GAPS.md`.

## 2. Authentication & Storage Security
- **No Browser Token Storage**: Per Section 8.1 and Section 11, passwords, access tokens, refresh tokens, and session identifiers are **never** stored in `localStorage` or `sessionStorage`. Session state in the frontend is held strictly in React memory (simulating HttpOnly cookie-backed `/api/auth/session` in live mode and an isolated memory session in Demo Mode).
- **Registration & Recovery Configurability**: Controlled via environment/runtime capability flags (`VITE_ALLOW_SELF_REGISTRATION` / adapter capability metadata). In Demo Mode, `/register` and `/forgot-password` render truthful capability-gated screens explaining the pending SRS registration-mode decision and demonstrating validation UX without persisting credentials.

## 3. Isolated Mock / Demo Adapter
- Because no backend FastAPI server exists in this frontend-only repository, `src/lib/api-client.ts` delegates to `src/lib/mock-adapter.ts` when `VITE_API_BASE_URL` is unconfigured or Demo Mode is active.
- Every page displaying mock data renders a persistent, subtle `DEMO DATA` indicator in the top workspace bar and records simulated state mutations in memory so Flows A–E work end-to-end without faking live target connectivity.
- **No Target-Direct Traffic**: The browser never sends `fetch` or XHR requests to any registered target URL (e.g., `http://localhost:8080` or staging URLs). All actions route exclusively through `apiClient`.

## 4. Visual System & Typography
- **Dark Security-Console Theme (Default)** with optional Light Mode toggle in Settings (`@custom-variant dark` in Tailwind v4).
- **Typography**: `Plus Jakarta Sans` for display/headings, `Public Sans` for dense UI prose, and `JetBrains Mono` (`tabular-nums`) for run IDs, HTTP methods, timestamps, counters, and metrics.
- **Semantic States**: Every status badge and severity indicator pairs color with an icon and explicit text label. Unknown backend enum strings safely map to an `Unknown` neutral badge rather than `Success`.

## 5. Semester 8 Availability Representation
- All Semester 8 routes are fully implemented in the navigation and router architecture with realistic FYP workflows (OpenAPI import parser preview, `@xyflow/react` dependency graph, synthetic test identities, business invariant editor/runs, evidence explorer, finding triage, HTML/JSON reports, benchmarks).
- Each Semester 8 view clearly labels its module status (`Semester 8 · Demo Mode` or `Backend capability pending` when simulated) and includes an optional P3 AI Advisor review panel that strictly marks outputs as non-authoritative suggestions.

## 6. Charting Decision
- Custom accessible SVG charts with `tabular-nums` legends, explicit sample denominators, and filter/time-range captions are used instead of heavyweight third-party charting wrappers to ensure zero React 19 peer dependency conflicts and predictable layout stability across desktop and tablet viewports.
