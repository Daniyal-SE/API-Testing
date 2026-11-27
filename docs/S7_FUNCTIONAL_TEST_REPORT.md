# Semester 7 Functional Test Report

| Test Case ID | Requirement ID | Objective | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|---|
| TC-AUTH-001 | FR-AUTH-001 | Valid login (`owner@fyp-lab.edu`) | Redirect to `/app/dashboard` | Redirected to `/app/dashboard` | **PASS** | `02-dashboard.png` |
| TC-AUTH-002 | FR-AUTH-002 | Invalid credentials rejected | Error alert shown, stays on `/login` | Alert displayed, stayed on `/login` | **PASS** | `s7-master-verification.spec.ts` |
| TC-AUTH-003 | FR-AUTH-002 | Empty login fields validation | Validation errors rendered | Validation message shown | **PASS** | `s7-master-verification.spec.ts` |
| TC-AUTH-004 | FR-AUTH-003 | Session persistence across reload | Remains authenticated after `page.reload()` | Stayed on `/app/dashboard` | **PASS** | `s7-master-verification.spec.ts` |
| TC-AUTH-005 | FR-AUTH-004 | Logout & protected route guard | Redirects to `/login`, blocks `/app/projects` | Redirected to `/login` | **PASS** | `15-logout.png` |
| TC-PROJ-001 | FR-PROJ-001 | Create Workspace UI/API | Create workspace via UI | Only workspace listing (`GET /workspaces`) exists; creation UI/API absent | **NOT IMPLEMENTED** | `backend/app/api/v1/workspaces.py` |
| TC-PROJ-002..003 | FR-PROJ-002 | Create Project & reload persistence | Project saved in PostgreSQL & survives reload | Project persisted across reload | **PASS** | `04-project-created.png` |
| TC-TARG-001..004 | FR-TARG-001..004 | Register Target, invalid URL guard, approval & reload | Invalid `ftp://` rejected; `http://localhost:8080/api` registered, approved, persisted | All assertions passed | **PASS** | `05-target-registered.png`, `07-authorization-approved.png` |
| TC-SCOPE-001..003 | FR-SCOPE-001..006 | Scope v1 & immutable v2 versioning | `v1` and `v2` created and approved | `v1` & `v2` approved | **PASS** | `08-scope-v1-approved.png` |
| TC-RUN-001..003 | FR-RUN-001..006 | Preflight, RQ enqueue, Worker execution & reload | Run reaches `Completed` via RQ worker | `Completed` persisted & survived reload | **PASS** | `09-assessment-preflight.png`, `11-assessment-completed.png` |
| TC-RUN-004 | FR-RUN-007 | Mid-crawl cancellation | Cooperative cancel stops run & preserves partial state | Verified in `test_local_demo_e2e.py` | **PASS** | `backend/tests/e2e/test_local_demo_e2e.py` |
| TC-URL-001..005 | FR-URL-001..006 | URL Discovery & Inventory provenance | `/api/catalog`, `/api/orders` discovered & persisted | Rendered in `/app/inventory/urls` & detail | **PASS** | `12-url-discovery-inventory.png`, `13-url-provenance-detail.png` |
| TC-AUDIT-001 | FR-AUDIT-001 | Audit History persistence | Events recorded for project/target/authz/scope/run | Verified in `/app/audit` | **PASS** | `14-audit-history.png` |
