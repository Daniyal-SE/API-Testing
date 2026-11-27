"""Deterministic local-only target website fixture for Semester 7 URL discovery demos and tests."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

fixture_app = FastAPI(title="Campus Shop Local Lab Fixture (Semester 7 Demo)", docs_url=None, redoc_url=None)

# Records every path received by the fixture so tests can prove excluded/redirect targets were never fetched
REQUEST_LOG: list[str] = []


def reset_fixture_log() -> None:
    REQUEST_LOG.clear()


@fixture_app.get("/", response_class=HTMLResponse)
def home() -> str:
    REQUEST_LOG.append("/")
    return """
    <html>
      <head><title>Campus Shop Local Lab</title></head>
      <body>
        <h1>Campus Shop Local Lab</h1>
        <nav>
          <a href="/api">API Home</a>
          <a href="/auth/login">Sign In Page</a>
          <a href="/rest/admin/reset">Excluded Admin Reset</a>
          <a href="https://blocked-external.invalid/tracker.js">External Script</a>
        </nav>
      </body>
    </html>
    """


@fixture_app.get("/api", response_class=HTMLResponse)
def api_index() -> str:
    REQUEST_LOG.append("/api")
    return """
    <html>
      <body>
        <h2>API Endpoints</h2>
        <a href="/api/catalog">Catalog</a>
        <a href="/api/orders">Orders</a>
        <a href="/auth/login">Login Form</a>
        <a href="/api/catalog?category=books&page=1">Books Catalog</a>
        <a href="/api/redirect-in-scope">In-Scope Redirect</a>
        <a href="/api/redirect-external">Out-of-Scope External Redirect</a>
        <a href="/api/redirect-metadata">Metadata SSRF Redirect</a>
        <a href="/api-admin/secret">Prefix Collision Admin</a>
        <form action="/api/catalog" method="GET">
          <input type="text" name="q" />
          <select name="sort"><option value="asc">Asc</option></select>
        </form>
      </body>
    </html>
    """


@fixture_app.get("/api/catalog", response_class=HTMLResponse)
def catalog() -> str:
    REQUEST_LOG.append("/api/catalog")
    return """
    <html>
      <body>
        <h3>Catalog Items</h3>
        <a href="/api/orders">View Orders</a>
        <a href="/api">Back to API</a>
      </body>
    </html>
    """


@fixture_app.get("/api/orders")
def orders() -> JSONResponse:
    REQUEST_LOG.append("/api/orders")
    return JSONResponse({"orders": [{"id": "ORD-101", "status": "paid"}]})


@fixture_app.get("/auth/login", response_class=HTMLResponse)
def login_page() -> str:
    REQUEST_LOG.append("/auth/login")
    return """
    <html>
      <body>
        <h3>Lab Login</h3>
        <form action="/auth/login" method="POST">
          <input type="email" name="email" />
          <input type="password" name="password" />
          <input type="hidden" name="csrf_token" value="demo" />
        </form>
        <a href="/api">API Root</a>
      </body>
    </html>
    """


@fixture_app.post("/auth/login")
def login_submit() -> JSONResponse:
    REQUEST_LOG.append("POST /auth/login")
    return JSONResponse({"warning": "Crawler must never submit forms!"}, status_code=400)


@fixture_app.get("/rest/admin/reset")
def admin_reset() -> JSONResponse:
    REQUEST_LOG.append("/rest/admin/reset")
    return JSONResponse({"error": "Excluded route should never be fetched"}, status_code=403)


@fixture_app.get("/api-admin/secret")
def prefix_collision() -> JSONResponse:
    REQUEST_LOG.append("/api-admin/secret")
    return JSONResponse({"error": "Prefix collision route should never be fetched"}, status_code=403)


@fixture_app.get("/api/redirect-in-scope")
def redirect_in_scope() -> RedirectResponse:
    REQUEST_LOG.append("/api/redirect-in-scope")
    return RedirectResponse(url="/api/orders", status_code=302)


@fixture_app.get("/api/redirect-external")
def redirect_external() -> RedirectResponse:
    REQUEST_LOG.append("/api/redirect-external")
    return RedirectResponse(url="https://blocked-external.invalid/exfiltrate", status_code=302)


@fixture_app.get("/api/redirect-metadata")
def redirect_metadata() -> RedirectResponse:
    REQUEST_LOG.append("/api/redirect-metadata")
    return RedirectResponse(url="http://169.254.169.254/latest/meta-data/", status_code=302)


@fixture_app.get("/__fixture_requests")
def get_request_log() -> JSONResponse:
    return JSONResponse({"requests": REQUEST_LOG})
