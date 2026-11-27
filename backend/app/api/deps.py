from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import constant_time_compare, hash_token
from app.db.session import get_db
from app.models.user import User, UserSession
from app.services.auth_service import validate_session_token

STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@dataclass
class AuthContext:
    user: User
    session: UserSession


def get_auth_context(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    """
    Validate session from HttpOnly cookie (primary browser path) or optional Bearer header.
    Enforces CSRF double-submit header on cookie-authenticated state-changing requests.
    """
    cookie_token = request.cookies.get(settings.session_cookie_name)
    bearer_token: str | None = None
    auth_header = request.headers.get("Authorization")
    if settings.allow_bearer_header and auth_header and auth_header.lower().startswith("bearer "):
        bearer_token = auth_header[7:].strip()

    raw_token = cookie_token or bearer_token
    if not raw_token:
        raise AppError(code="UNAUTHORIZED", message="Authentication required.", status_code=401)

    user, session = validate_session_token(db, raw_token)

    # Enforce CSRF protection when authenticated via browser cookie on state-changing routes
    if cookie_token and not bearer_token and request.method.upper() in STATE_CHANGING_METHODS:
        csrf_header = request.headers.get(settings.csrf_header_name, "")
        csrf_cookie = request.cookies.get(settings.csrf_cookie_name, "")
        if not csrf_header or not csrf_cookie:
            raise AppError(
                code="CSRF_MISSING",
                message="Missing CSRF verification token.",
                status_code=403,
            )
        if not constant_time_compare(csrf_header, csrf_cookie) or not constant_time_compare(
            hash_token(csrf_header), session.csrf_token_hash
        ):
            raise AppError(
                code="CSRF_INVALID",
                message="Invalid CSRF verification token.",
                status_code=403,
            )

    return AuthContext(user=user, session=session)


def get_current_user(ctx: AuthContext = Depends(get_auth_context)) -> User:
    return ctx.user
