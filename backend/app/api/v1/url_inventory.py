from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.url_inventory import DiscoveredUrlItemOut, UrlInventoryDetailOut
from app.services.url_inventory_service import get_url_inventory_detail, list_url_inventory

router = APIRouter(prefix="/url-inventory", tags=["url-inventory"])


@router.get("", response_model=PaginatedResponse[DiscoveredUrlItemOut])
def get_url_inventory(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="pageSize"),
    run_id: str | None = Query(default=None, alias="runId"),
    target_id: str | None = Query(default=None, alias="targetId"),
    project_id: str | None = Query(default=None, alias="projectId"),
    method: str | None = Query(default=None),
    source: str | None = Query(default=None),
    scope_status: str | None = Query(default=None, alias="scopeStatus"),
    test_status: str | None = Query(default=None, alias="testStatus"),
    search: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PaginatedResponse[DiscoveredUrlItemOut]:
    bounded_size = min(page_size, settings.max_page_size)
    items, total = list_url_inventory(
        db,
        user=user,
        page=page,
        page_size=bounded_size,
        run_id=run_id,
        target_id=target_id,
        project_id=project_id,
        method=method,
        source=source,
        scope_status=scope_status,
        test_status=test_status,
        search=search,
    )
    total_pages = max(1, math.ceil(total / bounded_size)) if total else 1
    return PaginatedResponse(
        items=[DiscoveredUrlItemOut(**i) for i in items],
        pagination=PaginationMeta(
            page=page,
            page_size=bounded_size,
            total_items=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{url_id}", response_model=UrlInventoryDetailOut)
def read_url_inventory_item(
    url_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UrlInventoryDetailOut:
    return UrlInventoryDetailOut(**get_url_inventory_detail(db, user=user, url_id=url_id))
