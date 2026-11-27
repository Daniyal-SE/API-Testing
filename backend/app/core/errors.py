from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.correlation import get_correlation_id

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Structured domain/application exception mapped to the consistent API error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def error_response(
    *,
    code: str,
    message: str,
    status_code: int,
    details: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    """Build sanitized JSON error response matching SRS & API contract."""
    cid = get_correlation_id()
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or [],
                "correlation_id": cid,
            }
        },
        headers={"X-Correlation-ID": cid},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers that never leak stack traces or SQL details."""

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details,
        )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request could not be completed."
        code_map = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            429: "RATE_LIMITED",
        }
        return error_response(
            code=code_map.get(exc.status_code, "HTTP_ERROR"),
            message=detail,
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        safe_details = [
            {
                "field": ".".join(str(p) for p in err.get("loc", []) if p != "body"),
                "message": str(err.get("msg", "Invalid value")),
            }
            for err in exc.errors()[:20]
        ]
        return error_response(
            code="VALIDATION_ERROR",
            message="The submitted request payload failed validation.",
            status_code=422,
            details=safe_details,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled backend exception: %s", type(exc).__name__)
        return error_response(
            code="INTERNAL_ERROR",
            message="An internal server error occurred. Reference the correlation ID for support.",
            status_code=500,
        )

