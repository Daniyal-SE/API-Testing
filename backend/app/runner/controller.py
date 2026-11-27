"""RunnerController: assessment state machine, execution adapter dispatch, and inventory persistence."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.correlation import get_correlation_id
from app.core.logging import get_logger
from app.core.security import utc_now
from app.models.assessment import AssessmentRun, RunEvent
from app.models.url_inventory import DiscoverySource, UrlInventory
from app.queue.connection import check_cancel_signal, clear_cancel_signal
from app.runner.container import DockerRunnerExecutor, LocalRestrictedRunnerExecutor, RunnerExecutor
from app.runner.crawler import CrawlResult
from app.services.audit_service import append_audit

logger = get_logger(__name__)

VALID_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"running", "cancellation_requested", "cancelled", "failed"},
    "running": {"completed", "partial", "cancellation_requested", "cancelled", "failed"},
    "cancellation_requested": {"cancelled", "partial", "failed"},
    "completed": set(),
    "partial": set(),
    "cancelled": set(),
    "failed": set(),
}


def transition_run_state(run: AssessmentRun, target_state: str) -> None:
    allowed = VALID_TRANSITIONS.get(run.state, set())
    if target_state not in allowed:
        raise ValueError(f"Invalid run state transition: {run.state} -> {target_state}")
    run.state = target_state


def build_executor(settings: Settings) -> RunnerExecutor:
    if settings.runner_mode == "docker":
        return DockerRunnerExecutor(
            image=settings.runner_docker_image,
            max_response_bytes=settings.runner_max_response_bytes,
        )
    return LocalRestrictedRunnerExecutor(
        max_response_bytes=settings.runner_max_response_bytes,
        connect_timeout=settings.runner_connect_timeout_seconds,
        read_timeout=settings.runner_read_timeout_seconds,
    )


class RunnerController:
    """Trusted control-plane orchestrator that invokes the restricted runner and persists results."""

    def __init__(
        self,
        *,
        executor: RunnerExecutor | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.executor = executor or build_executor(self.settings)

    def execute_run(self, db: Session, run_id: str) -> AssessmentRun | None:
        run = db.scalar(select(AssessmentRun).where(AssessmentRun.id == run_id))
        if run is None:
            logger.error("Assessment run %s not found", run_id)
            return None

        if run.state == "cancellation_requested" or check_cancel_signal(run.id):
            transition_run_state(run, "cancelled")
            run.current_phase = "Cancelled"
            run.completed_at = utc_now()
            run.duration_seconds = 0
            run.progress_percent = 100
            run.retained_summary = "Cancelled before crawler execution started."
            db.add(
                RunEvent(
                    run_id=run.id,
                    event_type="run.cancelled",
                    level="warning",
                    phase="control",
                    message="Run cancelled before starting discovery.",
                    correlation_id=get_correlation_id(),
                )
            )
            append_audit(
                db,
                action="assessment.cancelled",
                resource_type="assessment_run",
                resource_id=run.id,
                detail=f"Run {run.run_code} cancelled prior to execution.",
                workspace_id=run.workspace_id,
                project_id=run.project_id,
                target_id=run.target_id,
                correlation_run_id=run.id,
            )
            clear_cancel_signal(run.id)
            db.commit()
            return run

        transition_run_state(run, "running")
        run.started_at = utc_now()
        run.heartbeat_at = utc_now()
        run.current_phase = "Bounded Same-Origin URL Discovery"
        run.progress_percent = 20
        db.add(
            RunEvent(
                run_id=run.id,
                event_type="run.started",
                level="info",
                phase="crawl",
                message=f"Started bounded URL discovery using {self.executor.mode_name} runner.",
                correlation_id=get_correlation_id(),
            )
        )
        db.commit()

        try:
            def _is_cancelled() -> bool:
                return check_cancel_signal(run.id)

            result: CrawlResult = self.executor.execute_discovery(
                run_plan=run.run_plan_json,
                is_cancelled=_is_cancelled,
            )

            self._persist_crawl_result(db, run, result)

            final_state = result.terminal_state
            if final_state not in {"completed", "partial", "cancelled", "failed"}:
                final_state = "completed"
            transition_run_state(run, final_state)

            run.current_phase = (
                "Completed" if final_state == "completed" else f"Finished ({final_state})"
            )
            run.progress_percent = 100
            run.completed_at = utc_now()
            run.heartbeat_at = utc_now()
            run.duration_seconds = result.duration_seconds
            run.request_count = result.request_count
            run.discovered_urls_count = result.discovered_urls_count
            run.in_scope_urls_count = result.in_scope_urls_count
            run.excluded_urls_count = result.excluded_urls_count
            run.duplicate_urls_count = result.duplicate_urls_count
            run.blocked_redirects_count = result.blocked_redirects_count
            run.retained_summary = (
                f"Discovery {final_state} ({result.stop_reason}): "
                f"{result.in_scope_urls_count} in-scope URLs, "
                f"{result.excluded_urls_count} excluded, "
                f"{result.blocked_redirects_count} blocked redirects."
            )
            run.phases_json = [
                {"id": "preflight", "label": "Preflight & Scope Snapshot", "status": "completed"},
                {"id": "crawl", "label": "Bounded Same-Origin URL Discovery", "status": "completed"},
                {"id": "persist", "label": "Inventory & Provenance Persistence", "status": "completed"},
            ]

            append_audit(
                db,
                action=f"assessment.{final_state}",
                resource_type="assessment_run",
                resource_id=run.id,
                detail=run.retained_summary,
                workspace_id=run.workspace_id,
                project_id=run.project_id,
                target_id=run.target_id,
                correlation_run_id=run.id,
            )
            db.commit()
            return run
        except Exception as exc:
            logger.exception("RunnerController error on run %s", run_id)
            db.rollback()
            run = db.scalar(select(AssessmentRun).where(AssessmentRun.id == run_id))
            if run is not None and run.state not in {"completed", "partial", "cancelled", "failed"}:
                transition_run_state(run, "failed")
                run.current_phase = "Failed"
                run.completed_at = utc_now()
                run.retained_summary = f"Runner execution failed: {type(exc).__name__}"
                db.add(
                    RunEvent(
                        run_id=run.id,
                        event_type="run.failed",
                        level="error",
                        phase="crawl",
                        message=f"Execution failed: {exc}",
                        correlation_id=get_correlation_id(),
                    )
                )
                db.commit()
            return run
        finally:
            clear_cancel_signal(run_id)

    def _persist_crawl_result(
        self,
        db: Session,
        run: AssessmentRun,
        result: CrawlResult,
    ) -> None:
        cid = get_correlation_id()
        for rec in result.records:
            item = UrlInventory(
                workspace_id=run.workspace_id,
                project_id=run.project_id,
                target_id=run.target_id,
                run_id=run.id,
                canonical_key=rec.canonical_key,
                normalized_url=rec.normalized_url,
                scheme=rec.scheme,
                host=rec.host,
                port=rec.port,
                path=rec.path,
                method_hint=rec.method_hint,
                asset_type=rec.asset_type,
                primary_source=rec.primary_source,
                scope_status=rec.scope_status,
                scope_reason=rec.scope_reason,
                test_status=rec.test_status,
                parameter_names=rec.parameter_names,
                form_metadata=rec.form_metadata,
                status_code=rec.status_code,
                content_type=rec.content_type,
                depth=rec.depth,
                hit_count=rec.hit_count,
            )
            db.add(item)
            db.flush()

            for src in rec.sources:
                db.add(
                    DiscoverySource(
                        url_inventory_id=item.id,
                        run_id=run.id,
                        source_type=src.get("source_type", rec.primary_source),
                        referring_url=src.get("referring_url"),
                        element_context=src.get("element_context"),
                    )
                )

        for ev in result.events:
            db.add(
                RunEvent(
                    run_id=run.id,
                    event_type=ev.event_type,
                    level=ev.level,
                    phase=ev.phase,
                    message=ev.message,
                    detail_json=ev.detail,
                    correlation_id=cid,
                )
            )
        db.flush()
