from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_password_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hash a plaintext password with Argon2id."""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify plaintext password against stored Argon2id hash in constant time."""
    try:
        return _password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_opaque_token(num_bytes: int = 32) -> str:
    """Generate a high-entropy URL-safe session or CSRF token."""
    return secrets.token_urlsafe(num_bytes)


def hash_token(raw_token: str) -> str:
    """Return deterministic SHA-256 hex digest of an opaque token for DB storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def constant_time_compare(a: str, b: str) -> bool:
    """Compare two strings using constant-time HMAC comparison."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def sha256_canonical_json(payload_str: str) -> str:
    """Compute SHA-256 hex digest for policy snapshots, declarations, and audit records."""
    return hashlib.sha256(payload_str.encode("utf-8")).hexdigest()


def utc_now() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def utc_expiry(minutes: int) -> datetime:
    """Return future timezone-aware UTC datetime."""
    return utc_now() + timedelta(minutes=minutes)

