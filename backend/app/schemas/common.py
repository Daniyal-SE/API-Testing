from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")


class CamelModel(BaseModel):
    """Base schema serializing camelCase JSON aligned with the React frontend domain types."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
    )


class PaginationMeta(CamelModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PaginatedResponse(CamelModel, Generic[T]):
    items: list[T]
    pagination: PaginationMeta


def utc_iso(dt: datetime | None) -> str | None:
    """Serialize UTC datetime consistently."""
    return dt.isoformat() if dt else None

