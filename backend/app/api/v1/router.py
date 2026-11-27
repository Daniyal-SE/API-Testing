from fastapi import APIRouter

from app.api.v1 import (
    assessments,
    audit,
    auth,
    health,
    projects,
    scopes,
    targets,
    url_inventory,
    workspaces,
)

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth.router)
api_v1_router.include_router(workspaces.router)
api_v1_router.include_router(projects.router)
api_v1_router.include_router(targets.router)
api_v1_router.include_router(scopes.router)
api_v1_router.include_router(assessments.router)
api_v1_router.include_router(url_inventory.router)
api_v1_router.include_router(audit.router)
