from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, get_auth_context
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.auth import (
    AuthCapabilitiesOut,
    AuthSessionOut,
    LoginRequest,
    RegisterRequest,
    UserProfileOut,
    WorkspaceOut,
)
from app.services.auth_service import (
    authenticate_and_create_session,
    get_capabilities,
    register_user,
    revoke_session,
)
from app.services.workspace_service import list_user_workspaces

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/capabilities", response_model=AuthCapabilitiesOut)
def auth_capabilities(settings: Settings = Depends(get_settings)) -> AuthCapabilitiesOut:
    """Return configured registration mode and Semester 7 feature flags."""
    return AuthCapabilitiesOut(**get_capabilities(settings))


@router.post("/login", response_model=AuthSessionOut)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthSessionOut:
    """Authenticate credentials and issue HttpOnly session cookie + CSRF token."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    user, raw_session, raw_csrf, ws_ids = authenticate_and_create_session(
        db,
        identifier=payload.email,
        password=payload.password,
        ip_address=client_ip,
        user_agent=user_agent,
        settings=settings,
    )

    max_age = settings.session_ttl_minutes * 60
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_session,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=raw_csrf,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=max_age,
        path="/",
    )

    workspaces = [WorkspaceOut(**w) for w in list_user_workspaces(db, user)]
    return AuthSessionOut(
        user=UserProfileOut(
            id=user.id,
            email=user.email,
            username=user.username,
            display_name=user.display_name,
            role=user.global_role,
            workspace_ids=ws_ids,
            department=user.department,
        ),
        session_expired=False,
        capabilities=AuthCapabilitiesOut(**get_capabilities(settings)),
        workspaces=workspaces,
        csrf_token=raw_csrf,
    )


@router.post("/logout")
def logout(
    response: Response,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Invalidate current session and clear cookies."""
    revoke_session(db, session=ctx.session, user=ctx.user)
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")
    return {"loggedOut": True}


@router.get("/me", response_model=AuthSessionOut)
def current_session(
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AuthSessionOut:
    """Return authenticated user profile, capabilities, and accessible workspaces."""
    workspaces = [WorkspaceOut(**w) for w in list_user_workspaces(db, ctx.user)]
    return AuthSessionOut(
        user=UserProfileOut(
            id=ctx.user.id,
            email=ctx.user.email,
            username=ctx.user.username,
            display_name=ctx.user.display_name,
            role=ctx.user.global_role,
            workspace_ids=[w.id for w in workspaces],
            department=ctx.user.department,
        ),
        session_expired=False,
        capabilities=AuthCapabilitiesOut(**get_capabilities(settings)),
        workspaces=workspaces,
        csrf_token=request.cookies.get(settings.csrf_cookie_name),
    )


@router.post("/register", response_model=UserProfileOut, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UserProfileOut:
    """Create account when REGISTRATION_MODE=self_service; blocked otherwise."""
    user = register_user(
        db,
        email=str(payload.email),
        username=payload.username,
        display_name=payload.display_name,
        password=payload.password,
        department=payload.department,
        settings=settings,
    )
    workspaces = list_user_workspaces(db, user)
    return UserProfileOut(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        role=user.global_role,
        workspace_ids=[w["id"] for w in workspaces],
        department=user.department,
    )
