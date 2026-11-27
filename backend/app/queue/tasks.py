from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import SessionLocal
from app.runner.controller import RunnerController


def run_assessment_job(run_id: str) -> str:
    """RQ background task entrypoint executing a single Semester 7 URL discovery run."""
    settings = get_settings()
    configure_logging(settings.log_level, service_name="abm-worker")
    controller = RunnerController(settings=settings)
    with SessionLocal() as db:
        run = controller.execute_run(db, run_id)
        return run.state if run else "missing"

