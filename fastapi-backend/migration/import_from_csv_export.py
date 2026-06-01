#!/usr/bin/env python3
"""
Import Piriyathu CRM data from server CSV exports (manifest + per-doctype CSV files).

The export bundle uses Frappe-style public IDs in the `name` column (e.g. DEAL-00004,
PROD-00213, ORG-R2S) and link fields that reference those same public IDs.

Usage:
    python migration/import_from_csv_export.py --data-dir ~/Downloads
    python migration/import_from_csv_export.py --data-dir ~/Downloads --reset-db
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import bcrypt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session, SQLModel, create_engine, delete, select

from app.config import settings
from app.db import init_db
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
    User,
    UserProductAccess,
)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

IMPORT_ORDER = [
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

DOCTYPE_TO_FILE_PREFIX = {
    "Product": "piriyathu-crm-product-",
    "User Product Access": "piriyathu-crm-user-product-access-",
    "Organization": "piriyathu-crm-organization-",
    "Contact": "piriyathu-crm-contact-",
    "Lead": "piriyathu-crm-lead-",
    "Deal": "piriyathu-crm-deal-",
    "Task": "piriyathu-crm-task-",
    "Note": "piriyathu-crm-note-",
    "Activity": "piriyathu-crm-activity-",
    "Expense": "piriyathu-crm-expense-",
    "Client Payment": "piriyathu-crm-client-payment-",
}

KNOWN_USERS = [
    ("joseph.p.j@icloud.com", "Joseph P J", "Business Admin"),
    ("anjusabu7@gmail.com", "Anju", "Business User"),
    ("ivangeorgearouje@gmail.com", "Ivan George Arouje", "Business User"),
    ("johnthathampally@gmail.com", "John P Joseph", "Business User"),
    ("business.admin@piriyathu.com", "Business Admin", "Business Admin"),
]

BUSINESS_ADMIN_USER = "business.admin@piriyathu.com"


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def clean(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_bool(value: Any) -> bool:
    text = clean(value)
    if not text:
        return False
    return text.lower() in {"1", "true", "yes", "y"}


def parse_float(value: Any, default: float = 0.0) -> float:
    text = clean(value)
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def parse_int(value: Any, default: int = 0) -> int:
    return int(parse_float(value, float(default)))


def parse_datetime(value: Any) -> datetime:
    text = clean(value)
    if not text:
        return datetime.utcnow()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return datetime.utcnow()


def parse_date(value: Any) -> Optional[date]:
    text = clean(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def normalize_user_ref(value: Any) -> Optional[str]:
    text = clean(value)
    if not text:
        return None
    if text == "Administrator":
        return "joseph.p.j@icloud.com"
    return text if EMAIL_RE.match(text) else text


def find_export_file(data_dir: Path, doctype: str) -> Optional[Path]:
    prefix = DOCTYPE_TO_FILE_PREFIX.get(doctype)
    if not prefix:
        return None
    matches = sorted(data_dir.glob(f"{prefix}*.csv"))
    return matches[-1] if matches else None


def read_csv_rows(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


class CsvImporter:
    def __init__(self, session: Session, data_dir: Path):
        self.session = session
        self.data_dir = data_dir
        self.products: Dict[str, int] = {}
        self.organizations: Dict[str, int] = {}
        self.contacts: Dict[str, int] = {}
        self.leads: Dict[str, int] = {}
        self.deals: Dict[str, int] = {}
        self.stats: Dict[str, int] = {}

    def bump(self, doctype: str, count: int = 1) -> None:
        self.stats[doctype] = self.stats.get(doctype, 0) + count

    def resolve_product_id(self, public_id: Optional[str], *, required: bool = True) -> Optional[int]:
        key = clean(public_id)
        if not key:
            if self.products:
                return next(iter(self.products.values()))
            if required:
                raise ValueError("Missing product reference")
            return None
        product_id = self.products.get(key)
        if product_id is None and required:
            raise ValueError(f"Unknown product: {key}")
        return product_id

    def resolve_org_id(self, public_id: Optional[str]) -> Optional[int]:
        key = clean(public_id)
        return self.organizations.get(key) if key else None

    def resolve_contact_id(self, public_id: Optional[str]) -> Optional[int]:
        key = clean(public_id)
        return self.contacts.get(key) if key else None

    def resolve_lead_id(self, public_id: Optional[str]) -> Optional[int]:
        key = clean(public_id)
        return self.leads.get(key) if key else None

    def resolve_deal_id(self, public_id: Optional[str]) -> Optional[int]:
        key = clean(public_id)
        return self.deals.get(key) if key else None

    def import_products(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            product = Product(
                name=public_id,
                product_code=clean(row.get("product_code")) or public_id,
                product_name=clean(row.get("product_name")) or public_id,
                product_type=clean(row.get("product_type")),
                description=clean(row.get("description")),
                is_active=parse_bool(row.get("is_active")) if clean(row.get("is_active")) else True,
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(product)
            self.session.flush()
            self.products[public_id] = product.id
            self.bump("Product")

    def import_user_product_access(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            user_id = normalize_user_ref(row.get("user"))
            product_id = self.resolve_product_id(row.get("product"))
            if not public_id or not user_id or product_id is None:
                continue
            record = UserProductAccess(
                name=public_id,
                user_id=user_id,
                product_id=product_id,
                role_in_product=clean(row.get("role_in_product")),
                is_active=parse_bool(row.get("is_active")) if clean(row.get("is_active")) else True,
                created_at=parse_datetime(row.get("creation")),
            )
            self.session.add(record)
            self.bump("User Product Access")

    def import_organizations(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            product_id = self.resolve_product_id(row.get("product"))
            organization = Organization(
                name=public_id,
                organization_name=clean(row.get("organization_name")) or public_id,
                product_id=product_id,
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                status=clean(row.get("status")) or "Active",
                industry=clean(row.get("industry")),
                phone=clean(row.get("phone")),
                email=clean(row.get("email")),
                website=clean(row.get("website")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(organization)
            self.session.flush()
            self.organizations[public_id] = organization.id
            self.bump("Organization")

    def import_contacts(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            product_id = self.resolve_product_id(row.get("product"), required=False)
            organization_id = self.resolve_org_id(row.get("organization"))
            contact = Contact(
                name=public_id,
                full_name=clean(row.get("full_name")) or public_id,
                product_id=product_id or self.resolve_product_id(None),
                organization_id=organization_id,
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                status=clean(row.get("status")) or "Passive",
                email=clean(row.get("email")) or clean(row.get("email_id")),
                mobile_no=clean(row.get("mobile_no")) or clean(row.get("phone")),
                job_title=clean(row.get("job_title")) or clean(row.get("designation")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(contact)
            self.session.flush()
            self.contacts[public_id] = contact.id
            self.bump("Contact")

    def link_organization_contacts(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id or public_id not in self.organizations:
                continue
            org = self.session.get(Organization, self.organizations[public_id])
            if not org:
                continue
            contact_name = clean(row.get("contact_name"))
            contact_id = None
            if contact_name:
                for contact in self.session.exec(select(Contact)).all():
                    if contact.name == contact_name or contact.full_name == contact_name:
                        contact_id = contact.id
                        break
            if contact_id is None:
                for contact in self.session.exec(select(Contact)).all():
                    if contact.organization_id == org.id:
                        contact_id = contact.id
                        break
            if contact_id is not None:
                org.contact_id = contact_id
                self.session.add(org)

    def import_leads(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            lead = Lead(
                name=public_id,
                lead_name=clean(row.get("lead_name")) or public_id,
                contact_name=clean(row.get("contact")),
                product_id=self.resolve_product_id(row.get("product")),
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                status=clean(row.get("status")) or "Open",
                source=clean(row.get("source")),
                email=clean(row.get("email")),
                mobile_no=clean(row.get("mobile_no")),
                organization_id=self.resolve_org_id(row.get("organization")),
                contact_id=self.resolve_contact_id(row.get("contact")),
                converted=parse_bool(row.get("converted")),
                lost_reason=clean(row.get("lost_reason")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(lead)
            self.session.flush()
            self.leads[public_id] = lead.id
            self.bump("Lead")

    def import_deals(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            deal = Deal(
                name=public_id,
                deal_title=clean(row.get("deal_title")) or public_id,
                product_id=self.resolve_product_id(row.get("product")),
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                lead_id=self.resolve_lead_id(row.get("lead")),
                organization_id=self.resolve_org_id(row.get("organization")),
                contact_id=self.resolve_contact_id(row.get("contact")),
                deal_status=clean(row.get("deal_status")) or "Qualification",
                probability=parse_int(row.get("probability")),
                deal_value=parse_float(row.get("deal_value")),
                total_expenses=parse_float(row.get("total_expenses")),
                total_payments_received=parse_float(row.get("total_payments_received")),
                to_collect=parse_float(row.get("to_collect")),
                payment_summary_status=clean(row.get("payment_summary_status")) or "Pending",
                lost_reason=clean(row.get("lost_reason")),
                deal_value_change_reason=clean(row.get("deal_value_change_reason")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(deal)
            self.session.flush()
            self.deals[public_id] = deal.id
            self.bump("Deal")

    def import_tasks(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            task = Task(
                name=public_id,
                title=clean(row.get("title")) or public_id,
                product_id=self.resolve_product_id(row.get("product")),
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                lead_id=self.resolve_lead_id(row.get("lead")),
                deal_id=self.resolve_deal_id(row.get("deal")),
                organization_id=self.resolve_org_id(row.get("organization")),
                contact_id=self.resolve_contact_id(row.get("contact")),
                status=clean(row.get("status")) or "Open",
                priority=clean(row.get("priority")) or "Medium",
                due_date=parse_date(row.get("due_date")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(task)
            self.bump("Task")

    def import_notes(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            content = clean(row.get("note_content")) or clean(row.get("content")) or ""
            note = Note(
                name=public_id,
                title=clean(row.get("title")) or public_id,
                content=content,
                product_id=self.resolve_product_id(row.get("product")),
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                lead_id=self.resolve_lead_id(row.get("lead")),
                deal_id=self.resolve_deal_id(row.get("deal")),
                organization_id=self.resolve_org_id(row.get("organization")),
                contact_id=self.resolve_contact_id(row.get("contact")),
                follow_up_when=clean(row.get("follow_up_when")),
                follow_up_date=parse_date(row.get("follow_up_date")),
                create_follow_up_task=parse_bool(row.get("create_follow_up_task")),
                follow_up_task_type=clean(row.get("follow_up_task_type")),
                follow_up_task_title=clean(row.get("follow_up_task_title")),
                follow_up_task_description=clean(row.get("follow_up_task_description")),
                follow_up_task=clean(row.get("follow_up_task")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(note)
            self.bump("Note")

    def import_activities(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            if not public_id:
                continue
            activity = Activity(
                name=public_id,
                activity_type=clean(row.get("activity_type")) or "Other",
                description=clean(row.get("description")) or clean(row.get("subject")) or "",
                product_id=self.resolve_product_id(row.get("product")),
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                lead_id=self.resolve_lead_id(row.get("lead")),
                deal_id=self.resolve_deal_id(row.get("deal")),
                organization_id=self.resolve_org_id(row.get("organization")),
                contact_id=self.resolve_contact_id(row.get("contact")),
                activity_date=parse_datetime(row.get("activity_date")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(activity)
            self.bump("Activity")

    def import_expenses(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            expense_date = parse_date(row.get("expense_date"))
            if not public_id or not expense_date:
                continue
            expense = Expense(
                name=public_id,
                expense_title=clean(row.get("expense_title")) or public_id,
                expense_scope=clean(row.get("expense_scope")) or "Deal",
                assigned_to=normalize_user_ref(row.get("assigned_to")),
                borne_by=normalize_user_ref(row.get("borne_by")) or BUSINESS_ADMIN_USER,
                expense_date=expense_date,
                amount=parse_float(row.get("amount")),
                deal_id=self.resolve_deal_id(row.get("deal")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(expense)
            self.bump("Expense")

    def import_client_payments(self, rows: Iterable[Dict[str, str]]) -> None:
        for row in rows:
            public_id = clean(row.get("name"))
            deal_id = self.resolve_deal_id(row.get("deal"))
            if not public_id or deal_id is None:
                continue
            payment = ClientPayment(
                name=public_id,
                deal_id=deal_id,
                amount=parse_float(row.get("amount")),
                status=clean(row.get("status")) or "Expected",
                received_date=parse_date(row.get("payment_date")),
                created_at=parse_datetime(row.get("creation")),
                updated_at=parse_datetime(row.get("modified")),
            )
            self.session.add(payment)
            self.bump("Client Payment")

    def recalculate_all_deals(self) -> None:
        for deal in self.session.exec(select(Deal)).all():
            expenses = self.session.exec(select(Expense).where(Expense.deal_id == deal.id)).all()
            payments = self.session.exec(select(ClientPayment).where(ClientPayment.deal_id == deal.id)).all()
            deal.total_expenses = sum(exp.amount for exp in expenses)
            received = sum(
                payment.amount
                for payment in payments
                if (payment.status or "").lower() in {"received", "cleared", "partially collected", "fully paid"}
            )
            deal.total_payments_received = received
            deal.to_collect = max(deal.deal_value - received, 0.0)
            if received <= 0:
                deal.payment_summary_status = "Unpaid"
            elif received >= deal.deal_value and deal.deal_value > 0:
                deal.payment_summary_status = "Fully Paid"
            else:
                deal.payment_summary_status = "Partially Collected"
            self.session.add(deal)

    def import_doctype(self, doctype: str) -> None:
        path = find_export_file(self.data_dir, doctype)
        if not path:
            print(f"  skip {doctype}: no CSV found")
            return
        rows = read_csv_rows(path)
        if not rows:
            print(f"  skip {doctype}: empty ({path.name})")
            return

        if doctype == "Product":
            self.import_products(rows)
        elif doctype == "User Product Access":
            self.import_user_product_access(rows)
        elif doctype == "Organization":
            self.import_organizations(rows)
            self.link_organization_contacts(rows)
        elif doctype == "Contact":
            self.import_contacts(rows)
        elif doctype == "Lead":
            self.import_leads(rows)
        elif doctype == "Deal":
            self.import_deals(rows)
        elif doctype == "Task":
            self.import_tasks(rows)
        elif doctype == "Note":
            self.import_notes(rows)
        elif doctype == "Activity":
            self.import_activities(rows)
        elif doctype == "Expense":
            self.import_expenses(rows)
        elif doctype == "Client Payment":
            self.import_client_payments(rows)
        else:
            print(f"  skip {doctype}: unsupported")
            return

        print(f"  imported {doctype}: {self.stats.get(doctype, 0)} rows from {path.name}")


def seed_users(session: Session) -> None:
    password_hash = get_password_hash("password")
    for email, full_name, role in KNOWN_USERS:
        existing = session.exec(
            select(User).where((User.username == email) | (User.email == email))
        ).first()
        if existing:
            continue
        session.add(
            User(
                username=email,
                email=email,
                full_name=full_name,
                hashed_password=password_hash,
                role=role,
                is_active=True,
            )
        )
    session.commit()


def clear_database(db_path: Path) -> None:
    if db_path.exists():
        db_path.unlink()
    init_db()


def wipe_all_rows(session: Session, *, keep_users: bool = False) -> None:
    models = (
        Comment,
        ClientPayment,
        Expense,
        Activity,
        Note,
        Task,
        Deal,
        Lead,
        Contact,
        Organization,
        UserProductAccess,
        Product,
    )
    if not keep_users:
        models = (*models, User)
    for model in models:
        session.exec(delete(model))
    session.commit()


def load_manifest(data_dir: Path) -> List[Dict[str, Any]]:
    manifests = sorted(data_dir.glob("piriyathu-crm-manifest-*.json"))
    if not manifests:
        return []
    return json.loads(manifests[-1].read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Import CRM CSV export into local SQLite")
    parser.add_argument(
        "--data-dir",
        default=str(Path.home() / "Downloads"),
        help="Directory containing piriyathu-crm-*.csv export files",
    )
    parser.add_argument(
        "--reset-db",
        action="store_true",
        help="Delete and recreate dev.db before import",
    )
    parser.add_argument(
        "--keep-users",
        action="store_true",
        help="When wiping data, preserve existing users and passwords",
    )
    args = parser.parse_args()

    data_dir = Path(args.data_dir).expanduser().resolve()
    if not data_dir.is_dir():
        raise SystemExit(f"Data directory not found: {data_dir}")

    manifest = load_manifest(data_dir)
    if manifest:
        print(f"Using manifest with {len(manifest)} doctypes from {data_dir}")
        for entry in manifest:
            print(f"  - {entry['doctype']}: {entry.get('rows', '?')} rows ({entry.get('file')})")
    else:
        print(f"No manifest found in {data_dir}; importing known doctypes in FK order")

    engine = create_engine(settings.database_url)
    is_sqlite = settings.database_url.startswith("sqlite")

    if is_sqlite:
        db_path = Path(settings.database_url.replace("sqlite:///", ""))
        if not db_path.is_absolute():
            db_path = Path(__file__).resolve().parents[1] / db_path
        if args.reset_db or not db_path.exists():
            print(f"Resetting database at {db_path}")
            clear_database(db_path)
        else:
            print(f"Wiping rows in {db_path}")
            with Session(engine) as session:
                wipe_all_rows(session, keep_users=args.keep_users)
    else:
        print("Wiping CRM rows in database")
        with Session(engine) as session:
            wipe_all_rows(session, keep_users=args.keep_users)

    with Session(engine) as session:
        if not args.keep_users:
            seed_users(session)
        importer = CsvImporter(session, data_dir)
        for doctype in IMPORT_ORDER:
            importer.import_doctype(doctype)
        session.commit()
        importer.recalculate_all_deals()
        session.commit()
        print("\nImport complete:")
        for doctype, count in sorted(importer.stats.items()):
            print(f"  {doctype}: {count}")
        print(f"  Users seeded: {len(KNOWN_USERS)}")


if __name__ == "__main__":
    main()
