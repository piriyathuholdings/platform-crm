#!/usr/bin/env python3
"""Compare Frappe (old) MariaDB with FastAPI (new) Postgres CRM data."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings

DOCTYPES = [
    "Product",
    "User Product Access",
    "Organization",
    "Contact",
    "Lead",
    "Deal",
    "Task",
    "Note",
    "Activity",
    "Expense",
    "Client Payment",
]

NEW_TABLES = {
    "Product": "product",
    "User Product Access": "userproductaccess",
    "Organization": "organization",
    "Contact": "contact",
    "Lead": "lead",
    "Deal": "deal",
    "Task": "task",
    "Note": "note",
    "Activity": "activity",
    "Expense": "expense",
    "Client Payment": "clientpayment",
}


def fetch_old_rows(frappe_url: str) -> dict[str, list[dict[str, Any]]]:
    engine = create_engine(frappe_url)
    rows_by_doctype: dict[str, list[dict[str, Any]]] = {}
    with engine.connect() as conn:
        for doctype in DOCTYPES:
            result = conn.execute(
                text(
                    f"""
                    SELECT name, modified, creation, owner, modified_by
                    FROM `tab{doctype}`
                    WHERE docstatus = 0
                    ORDER BY name
                    """
                )
            )
            rows_by_doctype[doctype] = [dict(row._mapping) for row in result]
    return rows_by_doctype


def fetch_new_rows() -> dict[str, list[dict[str, Any]]]:
    engine = create_engine(settings.database_url)
    rows_by_doctype: dict[str, list[dict[str, Any]]] = {}
    with engine.connect() as conn:
        for doctype, table in NEW_TABLES.items():
            result = conn.execute(
                text(
                    f"""
                    SELECT name, updated_at AS modified, created_at AS creation
                    FROM {table}
                    ORDER BY name
                    """
                )
            )
            rows_by_doctype[doctype] = [dict(row._mapping) for row in result]
    return rows_by_doctype


def normalize_ts(value: Any) -> str:
    if value is None:
        return ""
    text_value = str(value)
    return text_value[:19]


def compare(old_rows: dict[str, list[dict]], new_rows: dict[str, list[dict]]) -> dict[str, Any]:
    report: dict[str, Any] = {"summary": [], "details": {}}

    for doctype in DOCTYPES:
        old_map = {row["name"]: row for row in old_rows.get(doctype, [])}
        new_map = {row["name"]: row for row in new_rows.get(doctype, [])}

        missing_in_new = sorted(set(old_map) - set(new_map))
        extra_in_new = sorted(set(new_map) - set(old_map))
        modified_diffs = []
        for name in sorted(set(old_map) & set(new_map)):
            old_modified = normalize_ts(old_map[name].get("modified"))
            new_modified = normalize_ts(new_map[name].get("modified"))
            if old_modified != new_modified:
                modified_diffs.append(
                    {
                        "name": name,
                        "old_modified": old_modified,
                        "new_modified": new_modified,
                    }
                )

        report["summary"].append(
            {
                "doctype": doctype,
                "old_count": len(old_map),
                "new_count": len(new_map),
                "missing_in_new": len(missing_in_new),
                "extra_in_new": len(extra_in_new),
                "modified_mismatch": len(modified_diffs),
            }
        )
        if missing_in_new or extra_in_new or modified_diffs:
            report["details"][doctype] = {
                "missing_in_new": missing_in_new,
                "extra_in_new": extra_in_new,
                "modified_mismatch": modified_diffs,
            }

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare old Frappe DB with new Postgres CRM DB")
    parser.add_argument(
        "--frappe-database-url",
        required=True,
        help="SQLAlchemy URL for Frappe MariaDB site database",
    )
    parser.add_argument("--json", action="store_true", help="Print full JSON report")
    args = parser.parse_args()

    old_rows = fetch_old_rows(args.frappe_database_url)
    new_rows = fetch_new_rows()
    report = compare(old_rows, new_rows)

    if args.json:
        print(json.dumps(report, indent=2, default=str))
        return

    print("=== CRM database comparison ===")
    print(f"Old: {args.frappe_database_url.split('@')[-1]}")
    print(f"New: {settings.database_url.split('@')[-1]}")
    print()
    print(f"{'Doctype':<22} {'Old':>5} {'New':>5} {'Missing':>8} {'Extra':>6} {'Changed':>8}")
    print("-" * 60)
    for row in report["summary"]:
        print(
            f"{row['doctype']:<22} {row['old_count']:>5} {row['new_count']:>5} "
            f"{row['missing_in_new']:>8} {row['extra_in_new']:>6} {row['modified_mismatch']:>8}"
        )

    for doctype, detail in report["details"].items():
        print()
        print(f"## {doctype}")
        if detail["missing_in_new"]:
            print(f"  Missing in new ({len(detail['missing_in_new'])}):")
            for name in detail["missing_in_new"][:20]:
                print(f"    - {name}")
            if len(detail["missing_in_new"]) > 20:
                print(f"    ... and {len(detail['missing_in_new']) - 20} more")
        if detail["extra_in_new"]:
            print(f"  Extra in new ({len(detail['extra_in_new'])}):")
            for name in detail["extra_in_new"][:20]:
                print(f"    - {name}")
        if detail["modified_mismatch"]:
            print(f"  Modified timestamp mismatch ({len(detail['modified_mismatch'])}):")
            for item in detail["modified_mismatch"][:20]:
                print(
                    f"    - {item['name']}: old={item['old_modified']} new={item['new_modified']}"
                )
            if len(detail["modified_mismatch"]) > 20:
                print(f"    ... and {len(detail['modified_mismatch']) - 20} more")


if __name__ == "__main__":
    main()
