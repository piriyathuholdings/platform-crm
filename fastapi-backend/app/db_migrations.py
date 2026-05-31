"""Lightweight schema/data migrations for SQLite deployments."""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel

from app.models.crm import (
    Activity,
    ClientPayment,
    Comment,
    Contact,
    Deal,
    Expense,
    Lead,
    Note,
    Organization,
    Product,
    Task,
    UserProductAccess,
)
from app.services.naming import MODELS_WITH_PUBLIC_ID, PREFIX_BY_MODEL, generate_public_id, parse_suffix

logger = logging.getLogger(__name__)

TABLES_NEEDING_NAME_COLUMN = (
    "product",
    "userproductaccess",
    "organization",
    "contact",
    "lead",
    "deal",
    "task",
    "note",
    "activity",
    "expense",
    "clientpayment",
    "comment",
)

MODEL_TABLE_MAP: dict[type[SQLModel], str] = {
    Product: "product",
    UserProductAccess: "userproductaccess",
    Organization: "organization",
    Contact: "contact",
    Lead: "lead",
    Deal: "deal",
    Task: "task",
    Note: "note",
    Activity: "activity",
    Expense: "expense",
    ClientPayment: "clientpayment",
    Comment: "comment",
}


def _table_columns(session: Session, table_name: str) -> set[str]:
    bind = session.get_bind()
    inspector = inspect(bind)
    try:
        return {column["name"] for column in inspector.get_columns(table_name)}
    except Exception:
        return set()


OPTIONAL_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "lead": [("contact_name", "VARCHAR")],
    "task": [("lead_id", "INTEGER")],
}


def ensure_optional_columns(session: Session) -> None:
    for table_name, columns in OPTIONAL_COLUMNS.items():
        existing = _table_columns(session, table_name)
        if not existing:
            continue
        for column_name, column_type in columns:
            if column_name in existing:
                continue
            session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
            session.commit()


def ensure_name_columns(session: Session) -> None:
    ensure_optional_columns(session)
    for table_name in TABLES_NEEDING_NAME_COLUMN:
        columns = _table_columns(session, table_name)
        if not columns or "name" in columns:
            continue
        session.execute(text(f"ALTER TABLE {table_name} ADD COLUMN name VARCHAR"))
        session.commit()


def _has_valid_public_id(name: str | None, prefix: str) -> bool:
    if not isinstance(name, str) or not name.strip():
        return False
    return parse_suffix(name.strip(), prefix) is not None


def backfill_public_ids(session: Session) -> dict[str, int]:
    ensure_name_columns(session)
    counts: dict[str, int] = {}

    for model in MODELS_WITH_PUBLIC_ID:
        table_name = MODEL_TABLE_MAP.get(model)
        prefix = PREFIX_BY_MODEL.get(model)
        if not table_name or not prefix:
            continue

        columns = _table_columns(session, table_name)
        if not columns or "name" not in columns:
            counts[model.__name__] = 0
            continue

        try:
            rows = session.execute(text(f"SELECT id, name FROM {table_name} ORDER BY id")).all()
        except Exception as error:
            logger.warning("Skipping backfill for %s: %s", model.__name__, error)
            session.rollback()
            counts[model.__name__] = 0
            continue

        updated = 0
        for row in rows:
            record_id = row[0]
            current_name = row[1]
            if _has_valid_public_id(current_name, prefix):
                continue

            public_id = generate_public_id(session, model, prefix)
            session.execute(
                text(f"UPDATE {table_name} SET name = :name WHERE id = :id"),
                {"name": public_id, "id": record_id},
            )
            updated += 1

        if updated:
            session.commit()
        counts[model.__name__] = updated

    backfill_relinked_children(session)
    return counts


def backfill_relinked_children(session: Session) -> None:
    """Set deal_id on lead-scoped child records when a converted deal exists."""
    task_columns = _table_columns(session, "task")
    if "lead_id" not in task_columns:
        return

    deals = session.execute(text("SELECT id, lead_id, organization_id, contact_id FROM deal WHERE lead_id IS NOT NULL")).all()
    for deal_row in deals:
        deal_id, lead_id, organization_id, contact_id = deal_row
        if not lead_id:
            continue
        session.execute(
            text(
                """
                UPDATE task
                SET deal_id = :deal_id,
                    organization_id = COALESCE(organization_id, :organization_id),
                    contact_id = COALESCE(contact_id, :contact_id)
                WHERE lead_id = :lead_id AND (deal_id IS NULL OR deal_id = :deal_id)
                """
            ),
            {
                "deal_id": deal_id,
                "lead_id": lead_id,
                "organization_id": organization_id,
                "contact_id": contact_id,
            },
        )
        session.execute(
            text(
                """
                UPDATE note
                SET deal_id = :deal_id,
                    organization_id = COALESCE(organization_id, :organization_id),
                    contact_id = COALESCE(contact_id, :contact_id)
                WHERE lead_id = :lead_id AND (deal_id IS NULL OR deal_id = :deal_id)
                """
            ),
            {
                "deal_id": deal_id,
                "lead_id": lead_id,
                "organization_id": organization_id,
                "contact_id": contact_id,
            },
        )
        session.execute(
            text(
                """
                UPDATE activity
                SET deal_id = :deal_id,
                    organization_id = COALESCE(organization_id, :organization_id),
                    contact_id = COALESCE(contact_id, :contact_id)
                WHERE lead_id = :lead_id AND (deal_id IS NULL OR deal_id = :deal_id)
                """
            ),
            {
                "deal_id": deal_id,
                "lead_id": lead_id,
                "organization_id": organization_id,
                "contact_id": contact_id,
            },
        )
    session.commit()
