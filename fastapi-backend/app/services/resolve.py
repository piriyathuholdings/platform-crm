"""Resolve CRM records by public name or legacy numeric id."""

from __future__ import annotations

from typing import Any, Type, TypeVar

from sqlmodel import Session, SQLModel, select

T = TypeVar("T", bound=SQLModel)


def normalize_identifier(identifier: Any) -> str:
    return str(identifier or "").strip()


def resolve_record(session: Session, model: type[T], identifier: Any) -> T | None:
    ident = normalize_identifier(identifier)
    if not ident:
        return None

    if hasattr(model, "name"):
        by_name = session.exec(select(model).where(model.name == ident)).first()
        if by_name:
            return by_name

    if ident.isdigit():
        by_id = session.get(model, int(ident))
        if by_id:
            return by_id

    from app.models.crm import User

    if model is User:
        return session.exec(
            select(User).where((User.username == ident) | (User.email == ident))
        ).first()

    return None


def resolve_record_or_raise(session: Session, model: type[T], identifier: Any, label: str) -> T:
    record = resolve_record(session, model, identifier)
    if not record:
        raise ValueError(f"{label} not found")
    return record


def public_id_for_record(record: SQLModel) -> str:
    name = getattr(record, "name", None)
    if isinstance(name, str) and name.strip():
        return name.strip()
    record_id = getattr(record, "id", None)
    if record_id is not None:
        return str(record_id)
    return ""


LINK_FIELD_MAP: dict[str, tuple[type[SQLModel], str]] = {}


def _init_link_field_map() -> None:
    from app.models.crm import Contact, Deal, Lead, Organization, Product

    global LINK_FIELD_MAP
    LINK_FIELD_MAP = {
        "product_id": (Product, "product"),
        "organization_id": (Organization, "organization"),
        "contact_id": (Contact, "contact"),
        "lead_id": (Lead, "lead"),
        "deal_id": (Deal, "deal"),
    }


def enrich_public_links(session: Session, data: dict[str, Any]) -> None:
    if not LINK_FIELD_MAP:
        _init_link_field_map()
    for fk_field, (model, frappe_field) in LINK_FIELD_MAP.items():
        fk_value = data.get(fk_field)
        if fk_value is None:
            continue
        related = session.get(model, fk_value)
        if related:
            data[frappe_field] = public_id_for_record(related)


def format_record_for_api(record: SQLModel, session: Session | None = None) -> dict[str, Any]:
    data = record.model_dump(exclude_none=True) if hasattr(record, "model_dump") else record.dict(exclude_none=True)
    from app.models.crm import User

    if isinstance(record, User):
        data.pop("hashed_password", None)
        public_id = record.username or record.email or str(getattr(record, "id", ""))
        data["name"] = public_id
        data["id"] = public_id
        data["record_id"] = public_id
    else:
        public_id = public_id_for_record(record)
        if public_id:
            data["name"] = public_id
            data["id"] = public_id
            data["record_id"] = public_id
    internal_id = getattr(record, "id", None)
    if internal_id is not None:
        data["internal_id"] = internal_id
    if session is not None:
        enrich_public_links(session, data)
    updated_at = data.get("updated_at")
    created_at = data.get("created_at")
    if updated_at and "modified" not in data:
        data["modified"] = updated_at.isoformat() if hasattr(updated_at, "isoformat") else str(updated_at)
    if created_at and "creation" not in data:
        data["creation"] = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
    return data
