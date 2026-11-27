"""URL inventory listing and detail provenance service."""
from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.assessment import AssessmentRun
from app.models.url_inventory import DiscoverySource, UrlInventory
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.services.permissions import READ_ROLES, require_project_access


def serialize_url_item(
    db: Session,
    item: UrlInventory,
    run_code: str | None = None,
) -> dict:
    resolved_code = run_code
    if resolved_code is None:
        resolved_code = db.scalar(
            select(AssessmentRun.run_code).where(AssessmentRun.id == item.run_id)
        )
    form_fields = None
    if isinstance(item.form_metadata, dict) and "field_names" in item.form_metadata:
        form_fields = list(item.form_metadata["field_names"])

    return {
        "id": item.id,
        "project_id": item.project_id,
        "target_id": item.target_id,
        "run_id": item.run_id,
        "run_code": resolved_code,
        "normalized_url": item.normalized_url,
        "path": item.path,
        "method": item.method_hint,
        "asset_type": item.asset_type,
        "source": item.primary_source,
        "host": item.host,
        "port": item.port,
        "scope_status": item.scope_status,
        "scope_reason": item.scope_reason,
        "test_status": item.test_status,
        "parameters": item.parameter_names or [],
        "form_fields": form_fields,
        "form_metadata": item.form_metadata,
        "status_code": item.status_code,
        "content_type": item.content_type,
        "depth": item.depth,
        "hit_count": item.hit_count,
        "first_seen_at": item.first_seen_at,
        "last_seen_at": item.last_seen_at,
        "related_finding_ids": [],
    }


def list_url_inventory(
    db: Session,
    *,
    user: User,
    page: int = 1,
    page_size: int = 25,
    run_id: str | None = None,
    target_id: str | None = None,
    project_id: str | None = None,
    method: str | None = None,
    source: str | None = None,
    scope_status: str | None = None,
    test_status: str | None = None,
    search: str | None = None,
) -> tuple[list[dict], int]:
    if project_id:
        require_project_access(db, user, project_id, allowed_roles=READ_ROLES)
        stmt = select(UrlInventory).where(UrlInventory.project_id == project_id)
        count_stmt = (
            select(func.count())
            .select_from(UrlInventory)
            .where(UrlInventory.project_id == project_id)
        )
    else:
        ws_ids = list(
            db.scalars(
                select(WorkspaceMember.workspace_id).where(
                    WorkspaceMember.user_id == user.id,
                    WorkspaceMember.status == "active",
                )
            )
        )
        if not ws_ids:
            return [], 0
        stmt = select(UrlInventory).where(UrlInventory.workspace_id.in_(ws_ids))
        count_stmt = (
            select(func.count())
            .select_from(UrlInventory)
            .where(UrlInventory.workspace_id.in_(ws_ids))
        )

    filters = []
    if run_id:
        filters.append(UrlInventory.run_id == run_id)
    if target_id:
        filters.append(UrlInventory.target_id == target_id)
    if method:
        filters.append(UrlInventory.method_hint == method.upper())
    if source:
        filters.append(UrlInventory.primary_source == source)
    if scope_status:
        filters.append(UrlInventory.scope_status == scope_status)
    if test_status:
        filters.append(UrlInventory.test_status == test_status)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                UrlInventory.normalized_url.ilike(pattern),
                UrlInventory.path.ilike(pattern),
            )
        )

    for f in filters:
        stmt = stmt.where(f)
        count_stmt = count_stmt.where(f)

    total = int(db.scalar(count_stmt) or 0)
    offset = (page - 1) * page_size
    rows = list(
        db.scalars(
            stmt.order_by(UrlInventory.first_seen_at.desc(), UrlInventory.hit_count.asc())
            .offset(offset)
            .limit(page_size)
        )
    )
    return [serialize_url_item(db, r) for r in rows], total


def get_url_inventory_detail(db: Session, *, user: User, url_id: str) -> dict:
    item = db.scalar(select(UrlInventory).where(UrlInventory.id == url_id))
    if item is None:
        raise AppError(code="NOT_FOUND", message="URL inventory item not found.", status_code=404)
    require_project_access(db, user, item.project_id, allowed_roles=READ_ROLES)

    sources = list(
        db.scalars(
            select(DiscoverySource)
            .where(DiscoverySource.url_inventory_id == item.id)
            .order_by(DiscoverySource.observed_at.asc())
        )
    )
    return {
        "url": serialize_url_item(db, item),
        "sources": [
            {
                "id": s.id,
                "source_type": s.source_type,
                "referring_url": s.referring_url,
                "element_context": s.element_context,
                "observed_at": s.observed_at,
            }
            for s in sources
        ],
        "related_findings": [],
        "zap_alerts": [],
    }
