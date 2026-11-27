# Semester 7 Security Test Report

| Test Case | Requirement | Result | Status | Evidence |
|---|---|---|---|---|
| Unauthenticated API & UI access denied | NFR-SEC-001 | API returns 401; UI redirects `/app/*` to `/login` | **PASS** | `test_security_controls.py`, `s7-master-verification.spec.ts` |
| Cross-workspace IDOR isolation | NFR-SEC-002 | Cross-workspace reads/writes blocked | **PASS** | `test_cross_workspace_idor_isolation` |
| RBAC least-privilege (Evaluator read-only) | NFR-SEC-003 | Evaluator blocked from `/app/assessments/new` and mutating endpoints | **PASS** | `TC-SEC-RBAC` in `s7-master-verification.spec.ts`, `test_rbac_least_privilege_boundaries` |
| Login rate-limiting & no secret leakage | NFR-SEC-004 | Rate-limiter triggers cleanly; secrets redacted in logs/outputs | **PASS** | `test_login_rate_limiting_and_no_secret_leakage` |
| SSRF & out-of-scope redirect blocking | FR-SCOPE-004..006 | Private/link-local IPs & external redirects blocked | **PASS** | `test_destination_validation_ipv4_ipv6_ssrf_and_local_lab` |
- **Status:** **PASS**
