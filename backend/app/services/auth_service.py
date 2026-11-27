"""Authentication, session management, registration, and login rate limiting."""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import timezone
from threading import Lock

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import (
    generate_opaque_token,
    hash_password,
    hash_token,
    utc_expiry,
    utc_now,
    verify_password,
)
from app.models.user import User, UserSession
from app.models.workspace import Workspace, WorkspaceMember
from app.services.audit_service import append_audit

_rate_lock = Lock()
_login_attempts: dict[str, list[float]] = defaultdict(list)


def reset_rate_limiter() -> None:
    with _rate_lock:
        _login_attempts.clear()


clear_rate_limits = reset_rate_limiter


def _check_and_record_attempt(key: str, settings: Settings) -> None:
    now = time.monotonic()
    window = settings.login_rate_limit_window_seconds
    max_attempts = settings.login_rate_limit_max_attempts
    with _rate_lock:
        attempts = [ts for ts in _login_attempts[key] if now - ts < window]
        if len(attempts) >= max_attempts:
            _login_attempts[key] = attempts
            raise AppError(
                code="RATE_LIMITED",
                message="Too many failed login attempts. Please try again later.",
                status_code=429,
            )
        attempts.append(now)
        _login_attempts[key] = attempts


def _clear_attempts(key: str) -> None:
    with _rate_lock:
        _login_attempts.pop(key, None)


def get_capabilities(settings: Settings) -> dict:
    return {
        "registration_mode": settings.registration_mode,
        "password_recovery_enabled": False,
        "ai_advisor_enabled": False,
        "semester8_enabled": False,
    }


def authenticate_and_create_session(
    db: Session,
    *,
    identifier: str,
    password: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
    settings: Settings | None = None,
) -> tuple[User, str, str, list[str]]:
    cfg = settings or get_settings()
    norm_id = identifier.strip().lower()
    rate_key = f"{ip_address or 'local'}:{norm_id}"

    user = db.scalar(
        select(User).where(or_(User.email == norm_id, User.username == norm_id))
    )
    if user is None or not verify_password(password, user.password_hash):
        _check_and_record_attempt(rate_key, cfg)
        append_audit(
            db,
            action="auth.login_failed",
            resource_type="user_session",
            resource_id="anonymous",
            detail=f"Failed login attempt for identifier '{norm_id}'.",
            actor_email=norm_id,
            actor_role="anonymous",
            outcome="denied",
        )
        db.commit()
        raise AppError(
            code="INVALID_CREDENTIALS",
            message="Invalid email/username or password.",
            status_code=401,
        )

    if user.account_status != "active":
        raise AppError(
            code="ACCOUNT_DISABLED",
            message="This user account is not active.",
            status_code=403,
        )

    _clear_attempts(rate_key)
    raw_session = generate_opaque_token(32)
    raw_csrf = generate_opaque_token(24)

    session = UserSession(
        user_id=user.id,
        token_hash=hash_token(raw_session),
        csrf_token_hash=hash_token(raw_csrf),
        expires_at=utc_expiry(cfg.session_ttl_minutes),
        ip_address=ip_address,
        user_agent_summary=(user_agent or "")[:200] or None,
    )
    user.last_login_at = utc_now()
    user.failed_login_count = 0
    db.add(session)
    db.flush()

    ws_ids = list(
        db.scalars(
            select(WorkspaceMember.workspace_id).where(
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.status == "active",
            )
        )
    )
    append_audit(
        db,
        action="auth.login",
        resource_type="user_session",
        resource_id=session.id,
        detail="Authenticated session created.",
        actor_user=user,
        workspace_id=ws_ids[0] if ws_ids else None,
        outcome="success",
    )
    db.commit()
    return user, raw_session, raw_csrf, ws_ids


def validate_session_token(db: Session, raw_token: str) -> tuple[User, UserSession]:
    token_hash = hash_token(raw_token)
    session = db.scalar(select(UserSession).where(UserSession.token_hash == token_hash))
    if session is None or session.revoked_at is not None:
        raise AppError(
            code="SESSION_INVALID",
            message="Session is invalid or has been revoked.",
            status_code=401,
        )
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= utc_now():
        raise AppError(
            code="SESSION_EXPIRED",
            message="Session has expired.",
            status_code=401,
        )
    user = db.scalar(select(User).where(User.id == session.user_id))
    if user is None or user.account_status != "active":
        raise AppError(
            code="SESSION_INVALID",
            message="Authenticated user is inactive.",
            status_code=401,
        )
    return user, session


def revoke_session(db: Session, *, session: UserSession, user: User) -> None:
    session.revoked_at = utc_now()
    ws_id = db.scalar(
        select(WorkspaceMember.workspace_id).where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
    )
    append_audit(
        db,
        action="auth.logout",
        resource_type="user_session",
        resource_id=session.id,
        detail="Session revoked by user logout.",
        actor_user=user,
        workspace_id=ws_id,
        outcome="success",
    )
    db.commit()


def register_user(
    db: Session,
    *,
    email: str,
    username: str | None,
    display_name: str,
    password: str,
    department: str | None,
    role: str = "project_owner",
    workspace_option: str = "create_new",
    workspace_name: str | None = None,
    settings: Settings,
) -> User:
    if settings.registration_mode != "self_service":
        raise AppError(
            code="REGISTRATION_DISABLED",
            message=f"Self-service registration is disabled (mode={settings.registration_mode}).",
            status_code=403,
        )
    if len(password) < settings.min_password_length:
        raise AppError(
            code="WEAK_PASSWORD",
            message=f"Password must be at least {settings.min_password_length} characters.",
            status_code=422,
        )

    norm_email = email.strip().lower()
    norm_username = (username or norm_email.split("@")[0]).strip().lower()

    existing = db.scalar(
        select(User).where(or_(User.email == norm_email, User.username == norm_username))
    )
    if existing is not None:
        raise AppError(
            code="USER_EXISTS",
            message="An account with this email or username already exists.",
            status_code=409,
        )

    user = User(
        email=norm_email,
        username=norm_username,
        display_name=display_name.strip(),
        password_hash=hash_password(password),
        global_role=role,
        account_status="active",
        department=department,
    )
    db.add(user)
    db.flush()

    ws: Workspace | None = None
    if workspace_option == "join_lab":
        ws = db.scalar(
            select(Workspace).where(Workspace.name == "FYP Security Assessment Lab")
        )

    if ws is None:
        resolved_ws_name = (workspace_name or "").strip() or f"{display_name.strip()} Workspace"
        ws = Workspace(
            slug=f"ws-{norm_username}-{user.id[:8]}",
            name=resolved_ws_name,
            description="Self-service Semester 7 academic workspace.",
            semester_label="Semester 7",
            owner_id=user.id,
        )
        db.add(ws)
        db.flush()

    db.add(
        WorkspaceMember(
            workspace_id=ws.id,
            user_id=user.id,
            role=role,
            status="active",
            granted_by_id=user.id,
        )
    )
    append_audit(
        db,
        action="auth.register",
        resource_type="user",
        resource_id=user.id,
        detail="Self-service user account created.",
        actor_user=user,
        workspace_id=ws.id,
        outcome="success",
    )
    db.commit()
    return user
