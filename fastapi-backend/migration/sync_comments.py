#!/usr/bin/env python3
"""Import CRM comments from a Frappe tabComment TSV export."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

from sqlmodel import Session, create_engine, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.models.crm import Comment


def parse_dt(value: str) -> datetime:
    value = (value or "").strip()
    if not value:
        return datetime.utcnow()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Frappe comments TSV into Postgres")
    parser.add_argument("tsv_path", help="Path to tab-separated comment export")
    args = parser.parse_args()

    engine = create_engine(settings.database_url)
    added = 0
    skipped = 0
    with Session(engine) as session:
        for line in Path(args.tsv_path).read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 8:
                continue
            name, ref_doctype, ref_name, comment_type, comment_by, content, creation, modified = parts[:8]
            if session.exec(select(Comment).where(Comment.name == name)).first():
                skipped += 1
                continue
            if comment_type == "Deleted" and not ref_name:
                skipped += 1
                continue
            session.add(
                Comment(
                    name=name,
                    reference_doctype=ref_doctype,
                    reference_name=ref_name or "",
                    comment_type=comment_type or "Comment",
                    comment_by=comment_by or None,
                    content=content or "",
                    created_at=parse_dt(creation),
                    updated_at=parse_dt(modified),
                )
            )
            added += 1
        session.commit()
        total = len(session.exec(select(Comment)).all())

    print(f"Comments added: {added}, skipped: {skipped}, total: {total}")


if __name__ == "__main__":
    main()
