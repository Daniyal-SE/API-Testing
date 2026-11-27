from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.audit import AuditLogEntryOut
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.services.audit_service import list_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=PaginatedResponse[AuditLogEntryOut])
def get_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="pageSize"),
    project_id: str | None = Query(default=None, alias="projectId"),
    target_id: str | None = Query(default=None, alias="targetId"),
    action: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
    resource_type: str | None = Query(default=None, alias="resourceType"),
    search: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PaginatedResponse[AuditLogEntryOut]:
    bounded_size = min(page_size, settings.max_page_size)
    items, total = list_audit_logs(
        db,
        user_id=user.id,
        page=page,
        page_size=bounded_size,
        project_id=project_id,
        target_id=target_id,
        action=action,
        outcome=outcome,
        resource_type=resource_type,
        search=search,
    )
    total_pages = max(1, math.ceil(total / bounded_size)) if total else 1
    return PaginatedResponse(
        items=[AuditLogEntryOut(**i) for i in items],
        pagination=PaginationMeta(
            page=page,
            page_size=bounded_size,
            total_items=total,
            total_pages=total_pages,
        ),
    )
