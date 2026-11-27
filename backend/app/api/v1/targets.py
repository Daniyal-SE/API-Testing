from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.target import AuthorizationRecord
from app.models.user import User
from app.schemas.target import (
    AuthorizationDecisionRequest,
    AuthorizationDeclarationRequest,
    TargetAuthorizationRecordOut,
    TargetCreateRequest,
    TargetDetailOut,
    TargetOut,
    TargetUpdateRequest,
    UrlNormalizePreviewOut,
    UrlNormalizePreviewRequest,
)
from app.services.target_service import (
    create_target,
    decide_target_authorization,
    delete_target,
    get_target_detail,
    get_target_or_404,
    list_targets,
    preview_normalize_target_url,
    serialize_auth_record,
    submit_authorization_declaration,
    update_target,
)

router = APIRouter(prefix="/targets", tags=["targets"])


@router.post("/preview-normalize", response_model=UrlNormalizePreviewOut)
def preview_normalize(
    payload: UrlNormalizePreviewRequest,
    _: User = Depends(get_current_user),
) -> UrlNormalizePreviewOut:
    return UrlNormalizePreviewOut(**preview_normalize_target_url(payload.base_url))


@router.get("", response_model=list[TargetOut])
def get_targets(
    project_id: str | None = Query(default=None, alias="projectId"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TargetOut]:
    return [TargetOut(**t) for t in list_targets(db, user=user, project_id=project_id)]


@router.post("", response_model=TargetOut, status_code=201)
def register_target(
    payload: TargetCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TargetOut:
    data = create_target(
        db,
        user=user,
        project_id=payload.project_id,
        display_name=payload.display_name,
        base_url=payload.base_url,
        environment=payload.environment,
        description=payload.description,
        ownership_declaration=payload.ownership_declaration,
        permission_reference=payload.permission_reference,
    )
    return TargetOut(**data)


@router.get("/{target_id}", response_model=TargetDetailOut)
def read_target(
    target_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TargetDetailOut:
    return TargetDetailOut(**get_target_detail(db, user=user, target_id=target_id))


@router.patch("/{target_id}", response_model=TargetOut)
def patch_target(
    target_id: str,
    payload: TargetUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TargetOut:
    data = update_target(
        db,
        user=user,
        target_id=target_id,
        display_name=payload.display_name,
        base_url=payload.base_url,
        environment=payload.environment,
        description=payload.description,
    )
    return TargetOut(**data)


@router.delete("/{target_id}")
def remove_target(
    target_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return delete_target(db, user=user, target_id=target_id)


@router.get("/{target_id}/authorizations", response_model=list[TargetAuthorizationRecordOut])
def list_authorizations(
    target_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TargetAuthorizationRecordOut]:
    target, _, _ = get_target_or_404(db, user=user, target_id=target_id)
    rows = list(
        db.scalars(
            select(AuthorizationRecord)
            .where(AuthorizationRecord.target_id == target.id)
            .order_by(AuthorizationRecord.created_at.desc())
        )
    )
    return [TargetAuthorizationRecordOut(**serialize_auth_record(db, r)) for r in rows]


@router.post("/{target_id}/authorizations", response_model=TargetAuthorizationRecordOut, status_code=201)
def declare_authorization(
    target_id: str,
    payload: AuthorizationDeclarationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TargetAuthorizationRecordOut:
    rec = submit_authorization_declaration(
        db,
        user=user,
        target_id=target_id,
        ownership_declaration=payload.ownership_declaration,
        permission_reference=payload.permission_reference,
        notes=payload.notes,
        expires_at=payload.expires_at,
    )
    return TargetAuthorizationRecordOut(**rec)


@router.post("/{target_id}/authorization-decision", response_model=TargetOut)
def authorization_decision(
    target_id: str,
    payload: AuthorizationDecisionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TargetOut:
    data = decide_target_authorization(
        db,
        user=user,
        target_id=target_id,
        next_state=payload.state,
        notes=payload.notes,
        expires_at=payload.expires_at,
    )
    return TargetOut(**data)
