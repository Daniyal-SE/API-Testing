# Assessment Engine Security (`ASSESSMENT_ENGINE_SECURITY.md`)

- **GET-Only Discovery:** Crawler never issues `POST`/`PUT`/`PATCH`/`DELETE` and never submits HTML forms.
- **Same-Origin + Segment-Aware Scope:** Origin `(scheme, hostname, port)` must match; `/api` never matches `/api-admin`. Dot segments, backslashes, encoded slashes (`%2f`, `%5c`), and embedded credentials are rejected.
- **SSRF & Redirect Protection:** Loopback, private, link-local, multicast, reserved, and cloud metadata (`169.254.169.254`) IPs are blocked unless an explicit target-specific `local_lab_exception_active` applies. Automatic redirects are disabled.
- **Data Minimization:** Sensitive query values (`password`, `token`, `secret`, `api_key`, etc.) and form input values are never retained in `UrlInventory` or logs.
