from __future__ import annotations

import os
from collections.abc import Generator

import pytest
import redis as redis_lib
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.queue.connection import set_redis_client_override
from app.services.auth_service import clear_rate_limits
import app.models  # noqa: F401
from scripts.seed_demo import DEMO_PASSWORD, seed_database

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://abm_user:abm_local_dev_pw_change_me@127.0.0.1:5432/abm_sem7_test",
)
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "redis://127.0.0.1:6379/15")


@pytest.fixture()
def test_settings() -> Settings:
    return Settings(
        environment="test",
        database_url=TEST_DATABASE_URL,
        redis_url=TEST_REDIS_URL,
        session_secret_key="pytest-semester7-secret-key-minimum-length",
        allow_bearer_header=True,
        registration_mode="invite_only",
        login_rate_limit_max_attempts=5,
        login_rate_limit_window_seconds=300,
        runner_mode="local_restricted",
    )


@pytest.fixture()
def db_session_factory():
    from app.db.session import build_engine

    engine = build_engine(TEST_DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    try:
        yield engine, TestingSession
    finally:
        engine.dispose()


@pytest.fixture()
def fake_redis() -> Generator[redis_lib.Redis, None, None]:
    client = redis_lib.Redis.from_url(TEST_REDIS_URL)
    client.flushdb()
    set_redis_client_override(client)
    try:
        yield client
    finally:
        client.flushdb()
        client.close()
        set_redis_client_override(None)


@pytest.fixture()
def seeded_db(db_session_factory, fake_redis) -> Generator[Session, None, None]:
    _, TestingSession = db_session_factory
    with TestingSession() as db:
        seed_database(db)
        yield db


@pytest.fixture()
def client(
    db_session_factory,
    fake_redis,
    test_settings: Settings,
) -> Generator[tuple[TestClient, sessionmaker], None, None]:
    clear_rate_limits()
    _, TestingSession = db_session_factory
    with TestingSession() as db:
        seed_database(db)

    app = create_app(test_settings)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    from app.core.config import get_settings

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_settings] = lambda: test_settings

    with TestClient(app) as tc:
        yield tc, TestingSession


def login_client(tc: TestClient, email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    resp = tc.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    csrf = resp.json()["csrfToken"]
    return {"X-CSRF-Token": csrf}
