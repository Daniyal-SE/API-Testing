from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import Settings, get_settings
from app.core.correlation import set_correlation_id
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging


def create_app(settings_override: Settings | None = None) -> FastAPI:
    """FastAPI application factory for the Semester 7 Control Plane."""
    settings = settings_override or get_settings()
    configure_logging(settings.log_level, service_name="abm-api")

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Semester 7 (40%) Control Plane for API Behavior Miner & Business-Logic Vulnerability Tester. "
            "Includes authentication, workspace/project isolation, target authorization, versioned scope "
            "enforcement, asynchronous URL discovery, inventory provenance, and append-only audit logs. "
            "Semester 8 modules (ZAP, OpenAPI, behavior graph, invariants, reports, benchmarks) are deferred."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", settings.csrf_header_name, "X-Correlation-ID"],
        expose_headers=["X-Correlation-ID"],
    )

    @app.middleware("http")
    async def correlation_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        cid = set_correlation_id(request.headers.get("X-Correlation-ID"))
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response

    register_exception_handlers(app)
    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
