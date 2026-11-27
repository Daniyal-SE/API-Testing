# Semester 8 Deferred Scope (60% Final Defense)

Per Section 2.2 of the Master Backend Implementation Prompt, **none** of the following Semester 8 subsystems, database tables, worker tasks, or API routes are implemented in this Semester 7 (40%) delivery:

| Deferred Capability | SRS Area | Status in Semester 7 | Planned Semester 8 Integration Point |
| :--- | :--- | :--- | :--- |
| **OWASP ZAP Passive/Active Scanning & Alert Pipeline** | Ch. 4 | Deferred to Semester 8 | `zap_passive` module + `zap_alerts` table |
| **OpenAPI JSON/YAML Contract Importer & Operation Inventory** | Ch. 4 | Deferred to Semester 8 | `openapi_contracts` & `api_operations` tables |
| **Schemathesis / Hypothesis Contract Testing** | Ch. 4 | Deferred to Semester 8 | `openapi_contract` module |
| **Custom API Behavior Mining & NetworkX Dependency Graph** | Ch. 4 | Deferred to Semester 8 | `behavior_graph_nodes` & `behavior_graph_edges` |
| **Synthetic Test Identity Matrix & Secret Ref Store** | Ch. 4 | Deferred to Semester 8 | `test_identities` table |
| **Business-Invariant Engine (BOLA, Workflow-Order, Replay, Quota)** | Ch. 4 | Deferred to Semester 8 | `business_invariants` & `invariant_runs` |
| **Evidence Capture, Redaction & Validation Subsystem** | Ch. 4, 5 | Deferred to Semester 8 | `evidence_records` table |
| **Vulnerability Finding Classification & Triage Lifecycle** | Ch. 4 | Deferred to Semester 8 | `findings` table |
| **HTML / JSON Assessment Report Export** | Ch. 4 | Deferred to Semester 8 | `assessment_reports` async export job |
| **Benchmark Ground Truth, Precision/Recall/FPR Evaluation** | Ch. 4, 8 | Deferred to Semester 8 | `benchmark_evaluations` table |
| **Optional LLM / AI Invariant Advisor (P3)** | Ch. 4 | Deferred to Semester 8 | `aiAdvisorEnabled=false` in Sem 7 backend |
| **RESTler / Stateful API Fuzzing** | Ch. 4 | Deferred to Semester 8 | — |
| **Password / Account Recovery (P2)** | FR-AUTH (P2) | Deferred to Semester 8 | `passwordRecoveryEnabled=false` |
| **Full Project Retention / Soft-Delete Administration (P2)** | FR-PROJ (P2) | Deferred to Semester 8 | Nullable `projects.deleted_at` column preserved |
