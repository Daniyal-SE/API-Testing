"""Centralized, testable ContainerSecurityProfile for ephemeral Semester 7 runners."""
from __future__ import annotations

import re
from dataclasses import dataclass

SAFE_ID_RE = re.compile(r"[^a-zA-Z0-9_.-]")


@dataclass(frozen=True)
class ContainerSecurityProfile:
    image: str = "abm-safe-runner:sem7"
    uid_gid: str = "10001:10001"
    read_only_rootfs: bool = True
    no_new_privileges: bool = True
    cap_drop: tuple[str, ...] = ("ALL",)
    pids_limit: int = 64
    memory_limit: str = "512m"
    cpus: str = "0.5"
    ulimit_nofile: str = "256:256"
    tmpfs_spec: str = "/tmp:rw,noexec,nosuid,size=32m"
    network_mode: str = "none"
    max_response_bytes: int = 2_097_152


def build_hardened_docker_command(
    profile: ContainerSecurityProfile,
    *,
    run_id: str,
    correlation_id: str,
) -> list[str]:
    """Construct a strict `docker run` argument vector with zero user-supplied flags."""
    safe_run = SAFE_ID_RE.sub("", run_id)[:48] or "local"
    safe_cid = SAFE_ID_RE.sub("", correlation_id)[:48] or "req"

    cmd = [
        "docker",
        "run",
        "--rm",
        "-i",
        f"--name=abm-runner-{safe_run}",
        f"--network={profile.network_mode}",
        f"--user={profile.uid_gid}",
        f"--pids-limit={profile.pids_limit}",
        f"--memory={profile.memory_limit}",
        f"--cpus={profile.cpus}",
        f"--ulimit=nofile={profile.ulimit_nofile}",
        f"--tmpfs={profile.tmpfs_spec}",
        "--restart=no",
        "--label=abm.managed=true",
        f"--label=abm.run_id={safe_run}",
        f"--label=abm.correlation_id={safe_cid}",
        "-e",
        f"RUNNER_MAX_RESPONSE_BYTES={profile.max_response_bytes}",
    ]
    if profile.read_only_rootfs:
        cmd.append("--read-only")
    for cap in profile.cap_drop:
        cmd.append(f"--cap-drop={cap}")
    if profile.no_new_privileges:
        cmd.append("--security-opt=no-new-privileges:true")
    if profile.network_mode != "none":
        cmd.append("--add-host=host.docker.internal:host-gateway")

    cmd.append(profile.image)
    return cmd
