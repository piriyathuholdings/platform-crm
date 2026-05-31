"""Backfill missing public IDs (name) for all CRM tables."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlmodel import Session

from app.db import engine
from app.db_migrations import backfill_public_ids


def main() -> None:
    with Session(engine) as session:
        counts = backfill_public_ids(session)
    print("Backfill complete:")
    for model_name, updated in sorted(counts.items()):
        print(f"  {model_name}: {updated} updated")


if __name__ == "__main__":
    main()
