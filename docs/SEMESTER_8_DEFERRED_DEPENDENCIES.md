# Semester 8 Deferred Dependencies

**Project:** API Behavior Miner & Business-Logic Vulnerability Tester  
**Baseline:** SRS Version 4.0 — Consolidated Technical Baseline  
**Current Delivery Boundary:** Semester 7 — Internal Defense (40%) Only

The following dependencies and subsystems belong to the **Semester 8 (100% FYP)** scope and are intentionally **deferred**. They MUST NOT be installed or enabled in the Semester 7 runtime environment.

| Technology / Subsystem | Purpose | Intended Milestone | Reason for Deferral |
|---|---|---|---|
| **OWASP ZAP** (`zaproxy` / ZAP daemon & API client) | Automated passive/active web & API vulnerability scanning | Semester 8 (Weeks 17–24) | Out of scope for Semester 7 (40% baseline covers control plane, DB, Redis/RQ, Docker Runner, and HTTPX URL discovery only). |
| **Schemathesis** | OpenAPI/Swagger schema-driven property-based API fuzzing | Semester 8 | Depends on parsed API contracts & behavior mining phase in Semester 8. |
| **Hypothesis** | Property-based test case generation for API business logic | Semester 8 | Required only by Schemathesis / Semester 8 invariant fuzzing engine. |
| **NetworkX** | API behavior graph construction, state-transition modeling, and workflow mining | Semester 8 | Behavior Graph & Workflow Mining module is a Semester 8 deliverable (UI route exists as preview/scaffold only). |
| **Business-Invariant Engine** | Automated detection of IDOR, state-skipping, replay, and business-logic flaws | Semester 8 | Core Semester 8 assessment logic; Semester 7 ends at URL & form metadata discovery (`S7-AC-05`). |
| **Advanced Evidence & Findings Pipeline** | Vulnerability deduplication, severity scoring, PoC replay, and PDF/SARIF report generation | Semester 8 | Findings & Reports backend processing is deferred to Semester 8. |
| **Benchmark Evaluation Harness** | Quantitative precision/recall evaluation against vulnerable target suites | Semester 8 | Final FYP evaluation milestone in Semester 8. |
| **Optional AI Advisor** | LLM-assisted invariant/finding explanation and remediation guidance | Semester 8 (Optional) | Explicitly optional and deferred beyond Semester 7 internal defense. |
