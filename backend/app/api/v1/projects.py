from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectDetailOut,
    ProjectOut,
    ProjectUpdateRequest,
)
from app.services.project_service import (
    create_project,
    delete_project,
    get_project_detail,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def get_projects(
    workspace_id: str | None = Query(default=None, alias="workspaceId"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectOut]:
    return [ProjectOut(**p) for p in list_projects(db, user=user, workspace_id=workspace_id)]


@router.post("", response_model=ProjectOut, status_code=201)
def create_new_project(
    payload: ProjectCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    data = create_project(
        db,
        user=user,
        workspace_id=payload.workspace_id,
        name=payload.name,
        description=payload.description,
        environment_context=payload.environment_context,
    )
    return ProjectOut(**data)


@router.get("/{project_id}", response_model=ProjectDetailOut)
def read_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetailOut:
    return ProjectDetailOut(**get_project_detail(db, user=user, project_id=project_id))


@router.patch("/{project_id}", response_model=ProjectOut)
def patch_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    data = update_project(
        db,
        user=user,
        project_id=project_id,
        name=payload.name,
        description=payload.description,
    )
    return ProjectOut(**data)


@router.delete("/{project_id}")
def remove_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return delete_project(db, user=user, project_id=project_id)
