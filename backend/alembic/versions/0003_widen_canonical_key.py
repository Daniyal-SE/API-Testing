"""Widen url_inventory.canonical_key to VARCHAR(128) for method-prefixed SHA-256 keys.

Revision ID: 0003_widen_canonical_key
Revises: 0002_sem7_pg_integrity
Create Date: 2026-11-27 00:43:00+00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0003_widen_canonical_key"
down_revision = "0002_sem7_pg_integrity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("url_inventory") as batch_op:
        batch_op.alter_column(
            "canonical_key",
            existing_type=sa.String(length=64),
            type_=sa.String(length=128),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("url_inventory") as batch_op:
        batch_op.alter_column(
            "canonical_key",
            existing_type=sa.String(length=128),
            type_=sa.String(length=64),
            existing_nullable=False,
        )
