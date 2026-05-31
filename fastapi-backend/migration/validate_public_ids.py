"""Validate public ID coverage and prefix format."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlmodel import Session

from app.db import engine
from app.db_migrations import MODEL_TABLE_MAP
from app.services.naming import PREFIX_BY_MODEL

PREFIX_PATTERN = re.compile(r"^[A-Z]+-\d{4,5}$")


def main() -> int:
    issues: list[str] = []
    with Session(engine) as session:
        for model, table_name in MODEL_TABLE_MAP.items():
            prefix = PREFIX_BY_MODEL.get(model)
            if not prefix:
                continue
            rows = session.execute(text(f"SELECT id, name FROM {table_name}")).all()
            seen: set[str] = set()
            for row in rows:
                record_id, name = row[0], row[1]
                if not isinstance(name, str) or not name.strip():
                    issues.append(f"{table_name}#{record_id} missing name")
                    continue
                if not name.startswith(prefix):
                    issues.append(f"{table_name}#{record_id} has unexpected prefix: {name}")
                if not PREFIX_PATTERN.match(name):
                    issues.append(f"{table_name}#{record_id} invalid format: {name}")
                if name in seen:
                    issues.append(f"{table_name} duplicate name: {name}")
                seen.add(name)

    if issues:
        print("Validation failed:")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    print("Validation passed: all public IDs present and correctly prefixed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
