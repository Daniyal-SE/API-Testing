from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.scope import (
    ScopeCreateRequest,
    ScopeDecisionRequest,
    ScopePreviewOut,
    ScopeVersionOut,
)
from app.services.scope_service import (
    build_normalized_scope_preview,
    create_scope_version,
    decide_scope_version,
    list_target_scopes,
    validate_scope_against_platform,
)

router = APIRouter(tags=["scopes"])


@router.post("/scopes/preview", response_model=ScopePreviewOut)
def preview_scope(
    payload: ScopeCreateRequest,
    _: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ScopePreviewOut:
    errors = validate_scope_against_platform(payload, settings)
    preview_text, policy_hash, _ = build_normalized_scope_preview(payload)
    return ScopePreviewOut(
        valid=len(errors) == 0,
        errors=errors,
        normalized_preview=preview_text,
        policy_hash=policy_hash,
    )


@router.get("/targets/{target_id}/scopes", response_model=list[ScopeVersionOut])
def get_target_scopes(
    target_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScopeVersionOut]:
    return [ScopeVersionOut(**s) for s in list_target_scopes(db, user=user, target_id=target_id)]


@router.post("/targets/{target_id}/scopes", response_model=ScopeVersionOut, status_code=201)
def create_target_scope(
    target_id: str,
    payload: ScopeCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ScopeVersionOut:
    data = create_scope_version(
        db,
        user=user,
        target_id=target_id,
        payload=payload,
        settings=settings,
    )
    return ScopeVersionOut(**data)


@router.post("/scopes/{scope_id}/decision", response_model=ScopeVersionOut)
def decide_scope(
    scope_id: str,
    payload: ScopeDecisionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScopeVersionOut:
    data = decide_scope_version(
        db,
        user=user,
        scope_id=scope_id,
        decision=payload.decision,
    )
    return ScopeVersionOut(**data)
