from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.user import User
from app.queue.connection import get_redis_client
from app.schemas.assessment import RunnerReadinessOut
from app.services.preflight_service import get_runner_health

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Public health check reporting app, database, and Redis status without internal secrets."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    redis_status = "healthy"
    try:
        get_redis_client().ping()
    except Exception:
        redis_status = "unhealthy"

    overall = "ok" if db_status == "healthy" and redis_status == "healthy" else "degraded"
    return {
        "status": overall,
        "service": settings.app_name,
        "version": settings.app_version,
        "semesterScope": "semester_7",
        "database": db_status,
        "redis": redis_status,
    }


@router.get("/runner/health", response_model=RunnerReadinessOut)
def runner_health(
    _: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> RunnerReadinessOut:
    """Authenticated operational readiness for the Semester 7 runner controller and RQ queue."""
    return RunnerReadinessOut(**get_runner_health(settings))
