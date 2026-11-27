from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, utc_now_dt


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Authenticated platform user with normalized email/username and Argon2id password hash."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("failed_login_count >= 0", name="failed_login_nonneg"),
        CheckConstraint(
            "account_status IN ('active', 'suspended', 'deactivated')",
            name="account_status_valid",
        ),
        Index("uq_users_email_lower", text("lower(email)"), unique=True),
        Index("uq_users_username_lower", text("lower(username)"), unique=True),
    )

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    global_role: Mapped[str] = mapped_column(String(40), nullable=False, default="security_tester")
    account_status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base, UUIDPrimaryKeyMixin):
    """Expiring, revocable user session storing hashed opaque token and CSRF digest only."""

    __tablename__ = "user_sessions"
    __table_args__ = (
        Index(
            "ix_user_sessions_active_user_exp",
            "user_id",
            "expires_at",
            postgresql_where=text("revoked_at IS NULL"),
            sqlite_where=text("revoked_at IS NULL"),
        ),
    )

    user_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    csrf_token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent_summary: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now_dt, nullable=False)

    user: Mapped[User] = relationship(back_populates="sessions")

