"""Reset local demo database tables cleanly and re-seed synthetic Semester 7 data."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.base import Base
from app.db.session import SessionLocal, engine
import app.models  # noqa: F401
from scripts.seed_demo import seed_database


def main() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        res = seed_database(db)
        print("Reset & seed complete:", res)


if __name__ == "__main__":
    main()
