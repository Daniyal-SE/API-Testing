from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.assessment import (
    AssessmentCreateRequest,
    AssessmentDetailOut,
    AssessmentRunOut,
    PreflightRequest,
    PreflightResultOut,
    RunLogEventOut,
)
from app.services.assessment_service import (
    create_and_enqueue_run,
    delete_run,
    get_run_detail,
    list_run_events,
    list_runs,
    reconcile_stale_runs,
    request_run_cancellation,
)
from app.services.preflight_service import evaluate_preflight

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.post("/preflight", response_model=PreflightResultOut)
def run_preflight(
    payload: PreflightRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> PreflightResultOut:
    data = evaluate_preflight(
        db,
        user=user,
        target_id=payload.target_id,
        scope_version_id=payload.scope_version_id,
        modules=payload.modules,
        settings=settings,
    )
    return PreflightResultOut(**data)


@router.get("", response_model=list[AssessmentRunOut])
def get_assessments(
    project_id: str | None = Query(default=None, alias="projectId"),
    state: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssessmentRunOut]:
    return [AssessmentRunOut(**r) for r in list_runs(db, user=user, project_id=project_id, state=state)]


@router.post("", response_model=AssessmentRunOut, status_code=202)
def create_assessment(
    payload: AssessmentCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AssessmentRunOut:
    data = create_and_enqueue_run(
        db,
        user=user,
        target_id=payload.target_id,
        scope_version_id=payload.scope_version_id,
        modules=payload.modules,
        settings=settings,
    )
    return AssessmentRunOut(**data)


@router.post("/reconcile-stale")
def reconcile_stale(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    count = reconcile_stale_runs(db, settings=settings, user=user)
    return {"reconciledCount": count}


@router.get("/{run_id}", response_model=AssessmentDetailOut)
def read_assessment(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssessmentDetailOut:
    return AssessmentDetailOut(**get_run_detail(db, user=user, run_identifier=run_id))


@router.get("/{run_id}/events", response_model=list[RunLogEventOut])
def read_assessment_events(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RunLogEventOut]:
    return [RunLogEventOut(**e) for e in list_run_events(db, user=user, run_identifier=run_id)]


@router.post("/{run_id}/cancel", response_model=AssessmentRunOut, status_code=202)
def cancel_assessment(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssessmentRunOut:
    return AssessmentRunOut(**request_run_cancellation(db, user=user, run_identifier=run_id))


@router.delete("/{run_id}")
def remove_assessment(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return delete_run(db, user=user, run_identifier=run_id)
