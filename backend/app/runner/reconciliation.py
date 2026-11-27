"""Idempotent startup/periodic reconciliation for orphaned ABM-labeled Docker containers."""
from __future__ import annotations

import json
import subprocess
import uuid
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assessment import AssessmentRun

ACTIVE_RUN_STATES = {"queued", "running", "cancellation_requested"}


def list_managed_containers(
    run_cmd: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> list[dict[str, str]]:
    """Enumerate only containers carrying `abm.managed=true`."""
    proc = run_cmd(
        ["docker", "ps", "-a", "--filter", "label=abm.managed=true", "--format", "json"],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        return []
    containers: list[dict[str, str]] = []
    for line in proc.stdout.strip().splitlines():
        try:
            containers.append(json.loads(line))
        except Exception:
            continue
    return containers


def reconcile_orphaned_containers(
    db: Session,
    *,
    run_cmd: Callable[..., subprocess.CompletedProcess[str]] = subprocess.run,
) -> list[str]:
    """Remove ABM-labeled containers whose persisted run is missing, terminal, or cancelled."""
    containers = list_managed_containers(run_cmd=run_cmd)
    removed: list[str] = []
    for c in containers:
        cid = str(c.get("ID") or c.get("Id") or "")
        labels_str = str(c.get("Labels") or "")
        run_id = ""
        for part in labels_str.split(","):
            if part.startswith("abm.run_id="):
                run_id = part.split("=", 1)[1].strip()
                break
        if not cid:
            continue

        run = None
        if run_id:
            try:
                uuid.UUID(run_id)
                run = db.scalar(select(AssessmentRun).where(AssessmentRun.id == run_id))
            except ValueError:
                run = None
        if run is None or run.state not in ACTIVE_RUN_STATES:
            rm_proc = run_cmd(["docker", "rm", "-f", cid], capture_output=True, text=True, check=False)
            if rm_proc.returncode == 0:
                removed.append(cid)
    return removed
