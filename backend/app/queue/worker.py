"""Standalone Python RQ worker entry point with 5s heartbeat and graceful SIGTERM shutdown."""
from __future__ import annotations

import os
import signal
import threading

from rq import SimpleWorker, Worker
from rq.serializers import JSONSerializer

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.redis_config import RedisConfig
from app.jobs.heartbeat import (
    clear_worker_heartbeat,
    default_worker_id,
    publish_worker_heartbeat,
)
from app.queue.connection import get_redis_client

logger = get_logger(__name__)


def _heartbeat_loop(
    worker_id: str,
    stop_event: threading.Event,
    redis_conn,
    cfg: RedisConfig,
) -> None:
    while not stop_event.is_set():
        try:
            publish_worker_heartbeat(worker_id, redis_conn=redis_conn, config=cfg)
        except Exception:
            pass
        stop_event.wait(cfg.heartbeat_interval_seconds)


def install_shutdown_handler(
    worker: Worker,
    worker_id: str,
    stop_event: threading.Event,
    redis_conn,
    cfg: RedisConfig,
) -> None:
    def _handle_signal(signum: int, _frame: object) -> None:
        logger.info("worker.shutdown signal=%s worker_id=%s", signum, worker_id)
        stop_event.set()
        try:
            worker.request_stop(signum, _frame)
        except Exception:
            pass
        try:
            clear_worker_heartbeat(worker_id, redis_conn=redis_conn, config=cfg)
        except Exception:
            pass

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)


def main() -> None:
    """Start standalone Python RQ worker process outside FastAPI request handlers."""
    settings = get_settings()
    cfg = RedisConfig.from_settings(settings)
    configure_logging(settings.log_level, service_name="abm-worker")
    redis_conn = get_redis_client()
    worker_id = default_worker_id()
    stop_event = threading.Event()

    worker_cls = Worker if hasattr(os, "fork") else SimpleWorker
    worker = worker_cls(
        [cfg.queue_name],
        connection=redis_conn,
        name=worker_id,
        serializer=JSONSerializer,
    )
    install_shutdown_handler(worker, worker_id, stop_event, redis_conn, cfg)

    hb_thread = threading.Thread(
        target=_heartbeat_loop,
        args=(worker_id, stop_event, redis_conn, cfg),
        daemon=True,
    )
    hb_thread.start()
    try:
        worker.work(with_scheduler=False)
    finally:
        stop_event.set()
        clear_worker_heartbeat(worker_id, redis_conn=redis_conn, config=cfg)
        try:
            redis_conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
