from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized environment-based configuration for the Semester 7 backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "API Behavior Miner (Semester 7)"
    app_version: str = "0.7.0"
    environment: Literal["development", "test", "staging", "demo"] = "development"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    database_url: str = "postgresql+psycopg://abm_user:abm_dev_pass@localhost:5432/abm_sem7"
    redis_url: str = "redis://localhost:6379/0"
    rq_queue_name: str = "abm_assessments"

    session_secret_key: str = "local-dev-change-me-32-bytes-minimum-key"
    session_ttl_minutes: int = Field(default=480, ge=5, le=10080)
    session_cookie_name: str = "abm_session"
    csrf_cookie_name: str = "abm_csrf"
    csrf_header_name: str = "X-CSRF-Token"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    allow_bearer_header: bool = True

    registration_mode: Literal["disabled", "invite_only", "self_service"] = "invite_only"
    min_password_length: int = Field(default=10, ge=8, le=128)
    login_rate_limit_max_attempts: int = Field(default=5, ge=3, le=50)
    login_rate_limit_window_seconds: int = Field(default=300, ge=30, le=3600)

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
        ]
    )

    runner_mode: Literal["local_restricted", "docker"] = "local_restricted"
    runner_docker_image: str = "abm-safe-runner:sem7"
    runner_max_response_bytes: int = Field(default=2_097_152, ge=16_384, le=10_485_760)
    runner_connect_timeout_seconds: float = Field(default=5.0, ge=0.5, le=30.0)
    runner_read_timeout_seconds: float = Field(default=10.0, ge=0.5, le=60.0)

    platform_max_crawl_depth: int = Field(default=8, ge=1, le=20)
    platform_max_requests: int = Field(default=5000, ge=1, le=50000)
    platform_max_rate_rps: float = Field(default=20.0, ge=0.5, le=100.0)
    platform_max_concurrency: int = Field(default=10, ge=1, le=50)
    platform_max_wall_clock_seconds: int = Field(default=3600, ge=10, le=7200)

    max_page_size: int = Field(default=100, ge=10, le=500)
    stale_run_timeout_seconds: int = Field(default=900, ge=30, le=86400)
    log_level: str = "INFO"

    @field_validator("cors_origins")
    @classmethod
    def reject_wildcard_cors(cls, v: list[str]) -> list[str]:
        if "*" in v:
            raise ValueError("Wildcard '*' CORS origin is prohibited when credentials are enabled.")
        return v

    @field_validator("session_secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v.strip()) < 16:
            raise ValueError("SESSION_SECRET_KEY must be at least 16 characters.")
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings validated from environment."""
    return Settings()

