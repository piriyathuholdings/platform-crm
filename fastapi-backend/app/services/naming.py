"""Public ID (naming series) generation for CRM entities."""

from __future__ import annotations

import re
from typing import Type

from sqlmodel import Session, SQLModel, select
from sqlalchemy import text

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

DEFAULT_DIGITS = 4

NAMING_PREFIXES: dict[str, str] = {
    "Product": "PROD-",
    "User Product Access": "UPA-",
    "Organization": "ORG-",
    "Contact": "CONT-",
    "Lead": "LEAD-",
    "Deal": "DEAL-",
    "Task": "TASK-",
    "Note": "NOTE-",
    "Activity": "ACT-",
    "Expense": "EXP-",
    "Client Payment": "PAY-",
    "Comment": "COMM-",
}

PREFIX_BY_MODEL: dict[type[SQLModel], str] = {
    Product: "PROD-",
    UserProductAccess: "UPA-",
    Organization: "ORG-",
    Contact: "CONT-",
    Lead: "LEAD-",
    Deal: "DEAL-",
    Task: "TASK-",
    Note: "NOTE-",
    Activity: "ACT-",
    Expense: "EXP-",
    ClientPayment: "PAY-",
    Comment: "COMM-",
}

MODELS_WITH_PUBLIC_ID: tuple[type[SQLModel], ...] = tuple(PREFIX_BY_MODEL.keys())

_SUFFIX_PATTERN = re.compile(r"^(\d+)$")


def parse_suffix(value: str, prefix: str) -> int | None:
    if not value or not value.startswith(prefix):
        return None
    suffix = value[len(prefix) :]
    match = _SUFFIX_PATTERN.match(suffix)
    if not match:
        return None
    return int(match.group(1))


def next_suffix_for_model(session: Session, model: type[SQLModel], prefix: str) -> int:
    if not hasattr(model, "name"):
        return 1

    table_name = model.__tablename__
    try:
        rows = session.execute(
            text(f"SELECT name FROM {table_name} WHERE name LIKE :pattern"),
            {"pattern": f"{prefix}%"},
        ).all()
    except Exception:
        session.rollback()
        return 1

    max_suffix = 0
    for row in rows:
        name = row[0] if isinstance(row, tuple) else row
        if not isinstance(name, str):
            continue
        parsed = parse_suffix(name, prefix)
        if parsed is not None:
            max_suffix = max(max_suffix, parsed)
    return max_suffix + 1


def generate_public_id(
    session: Session,
    model: type[SQLModel],
    prefix: str,
    digits: int = DEFAULT_DIGITS,
) -> str:
    next_number = next_suffix_for_model(session, model, prefix)
    for _ in range(20):
        candidate = f"{prefix}{next_number:0{digits}d}"
        try:
            existing = session.execute(
                text(f"SELECT id FROM {model.__tablename__} WHERE name = :name LIMIT 1"),
                {"name": candidate},
            ).first()
        except Exception:
            session.rollback()
            existing = None
        if not existing:
            return candidate
        next_number += 1
    raise RuntimeError(f"Unable to generate unique public id for {model.__name__} with prefix {prefix}")


def assign_public_id(session: Session, record: SQLModel, digits: int = DEFAULT_DIGITS) -> None:
    if not hasattr(record, "name"):
        return
    current = getattr(record, "name", None)
    if isinstance(current, str) and current.strip():
        return
    prefix = PREFIX_BY_MODEL.get(type(record))
    if not prefix:
        return
    record.name = generate_public_id(session, type(record), prefix, digits=digits)


def generate_naming_series(session: Session, prefix: str, digits: int = DEFAULT_DIGITS) -> str:
    """Backward-compatible alias used by legacy service code."""
    model_for_prefix = next((model for model, value in PREFIX_BY_MODEL.items() if value == prefix), None)
    if model_for_prefix is None:
        raise ValueError(f"No model registered for prefix {prefix}")
    return generate_public_id(session, model_for_prefix, prefix, digits=digits)
