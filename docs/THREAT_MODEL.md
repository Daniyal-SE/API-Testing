# Threat Model — Semester 7 Backend

## 1. Scope & Trust Boundaries

The Semester 7 backend exposes an authenticated web API (`/api/v1`) and performs outbound HTTP requests **only** from a policy-gated runner toward explicitly authorized Local Lab or Staging targets.

Trust boundaries:
1. **Browser <-> FastAPI Control Plane:** Untrusted network client; all identity, role, workspace, and scope inputs are untrusted.
2. **FastAPI Control Plane <-> PostgreSQL / Redis:** Trusted internal data plane; credentials never leave the control plane.
3. **Worker / Runner Controller <-> Restricted Runner:** Semi-trusted/isolated boundary; runner receives only the immutable `RunPlan` for one run and returns untrusted target-derived URLs/HTML metadata.
4. **Restricted Runner <-> Target Website:** Untrusted external target; HTML, headers, URLs, and HTTP redirects may be adversarial.

---

## 2. Threats, Mitigations & Semester 7 Controls

| ID | Threat / Attack Vector | Impact | Mitigations Implemented in Semester 7 | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **TM-01** | **SSRF** via target URL, DNS rebinding, IPv4-mapped IPv6 (`::ffff:127.0.0.1`), or `169.254.169.254` metadata | Unauthorized access to internal host services or cloud metadata | `destination_validation.py` resolves A/AAAA, unpacks IPv4-mapped IPv6, and blocks loopback, RFC1918 private, link-local, multicast, unspecified, reserved, and CGNAT ranges by default. Loopback/private is permitted **only** when `environment == "local_lab"`, `local_lab_exception_active == True`, and host matches the exact registered target host. Metadata & link-local remain blocked even in `local_lab`. | `tests/unit/test_scope_and_runner_units.py` |
| **TM-02** | **Open Redirect / Scope Escape** via HTTP 3xx pointing to external host or private IP | Crawler fetches unauthorized third-party or internal endpoint | HTTPX uses `follow_redirects=False`. `redirect_validation.py` parses `Location`, normalizes URL, checks `ScopePolicy`, and re-validates DNS/IP before following. Out-of-scope redirects are logged as `blocked_redirect` without fetching. | `tests/unit/test_scope_and_runner_units.py`, `tests/e2e/test_local_demo_e2e.py` |
| **TM-03** | **Path-Prefix Collision & Traversal Bypass** (`/api-admin` matching `/api`, `/api/../admin`, `%2f`, `//`) | Crawler accesses excluded or out-of-scope endpoints | `url_normalization.py` rejects embedded credentials, `%2f`/`%5c`, backslashes, and resolves dot segments; `policy.py` uses segment-aware matching. | `tests/unit/test_scope_and_runner_units.py` |
| **TM-04** | **Unauthorized Target Scanning / Missing Governance** | Scanning targets without owner consent | Registration starts in `pending_review`. Preflight & launch require `authorized` status, non-expired authorization record, and `approved` scope. Changing URL/env forces `needs_revalidation`. | `tests/integration/test_api_workflows.py`, `tests/security/test_security_controls.py` |
| **TM-05** | **Cross-Tenant / Cross-Workspace IDOR** | User in Workspace A reads/modifies Workspace B records | Every query verifies active `WorkspaceMember` / `ProjectMember` for `current_user`, returning `404` for unauthorized resource IDs. | `tests/security/test_security_controls.py` |
| **TM-06** | **Privilege Escalation (Tester/Evaluator/Admin)** | Non-owner approves scope/target or read-only user launches run | Server-side RBAC on every route (`project_owner` only for authorization/scope approval; `supervisor_evaluator` read-only; `system_admin` health/reconciliation only). | `tests/security/test_security_controls.py` |
| **TM-07** | **Session Hijacking, CSRF, & Brute Force** | Account takeover or forged state-changing requests | Argon2id hashing; SHA-256 hashed 256-bit session tokens; `HttpOnly`/`SameSite=Lax` cookies; `X-CSRF-Token` verification; per-identifier/IP rate limiter; generic 401 errors. | `tests/integration/test_api_workflows.py`, `tests/security/test_security_controls.py` |
| **TM-08** | **Resource Exhaustion / Target DoS** | Runaway crawl overwhelms target or worker | Hard bounds in `budgets.py` (`max_crawl_depth`, `max_requests`, `per_host_rate_rps`, `concurrency`, `max_wall_clock_seconds`, `max_response_bytes`). | `tests/unit/test_scope_and_runner_units.py`, `tests/e2e/test_local_demo_e2e.py` |
| **TM-09** | **Secret Leakage in Logs, Audit, or URL Inventory** | Exposure of passwords, cookies, tokens, or query secrets | `logging.py` & `audit_service.py` redact sensitive keys. `url_inventory` omits query parameter values and stores parameter names only. | `tests/unit/test_scope_and_runner_units.py`, `tests/security/test_security_controls.py` |
