# API Behavior Miner & Business-Logic Vulnerability Tester (Frontend Workspace)

Academic Final Year Project (Semester 7 — 40% & Semester 8 — 60%) browser-side security-assessment console built with React, TypeScript, Vite, and Tailwind CSS v4.

## Architecture Boundary
- **Frontend-only application**: Browser code never sends crawling, scanning, or fuzzing traffic directly to target URLs.
- **No browser token storage**: Passwords, access tokens, and target credentials are never stored in `localStorage` or `sessionStorage`.
- **Isolated Demo Mode**: When `VITE_API_BASE_URL` is unset, `src/lib/api-client.ts` delegates to `src/lib/mock-adapter.ts` and renders a persistent `DEMO DATA` indicator.

## Setup & Development
```bash
npm install
npm run dev
```
The dev server listens on port `3000`.

## Verification Commands
```bash
# Pure logic & enum/validator unit tests
npx --yes tsx --test src/lib/core-logic.test.ts

# TypeScript typecheck
npm run lint

# Production build
npm run build
```

## Documentation
- `docs/FRONTEND_IMPLEMENTATION_PLAN.md`
- `docs/FRONTEND_DECISIONS.md`
- `docs/API_CONTRACT_GAPS.md`
- `docs/FRONTEND_PROGRESS.md`
