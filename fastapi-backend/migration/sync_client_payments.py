#!/usr/bin/env python3
"""Upsert Client Payment rows from a Frappe tabClient Payment TSV export."""

from __future__ import annotations

import argparse
from datetime import date, datetime
from pathlib import Path
import sys

from sqlmodel import Session, create_engine, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.models.crm import ClientPayment, Deal, Expense
from migration.import_from_csv_export import parse_date, parse_datetime, parse_float


def parse_dt(value: str) -> datetime:
    parsed = parse_datetime(value)
    return parsed or datetime.utcnow()


def resolve_deal_id(session: Session, deal_name: str) -> int | None:
    deal_name = (deal_name or "").strip()
    if not deal_name:
        return None
    deal = session.exec(select(Deal).where(Deal.name == deal_name)).first()
    return deal.id if deal else None


def recalculate_all_deals(session: Session) -> None:
    for deal in session.exec(select(Deal)).all():
        expenses = session.exec(select(Expense).where(Expense.deal_id == deal.id)).all()
        payments = session.exec(select(ClientPayment).where(ClientPayment.deal_id == deal.id)).all()
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
        session.add(deal)


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Frappe client payments TSV into Postgres")
    parser.add_argument("tsv_path", help="Path to tab-separated payment export")
    args = parser.parse_args()

    engine = create_engine(settings.database_url)
    added = 0
    updated = 0
    skipped = 0

    with Session(engine) as session:
        for line in Path(args.tsv_path).read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) < 8:
                skipped += 1
                continue

            name, deal_name, amount_raw, status, payment_date, _payment_type, _reference, modified = parts[:8]
            deal_id = resolve_deal_id(session, deal_name)
            if not name or deal_id is None:
                skipped += 1
                continue

            amount = parse_float(amount_raw)
            received_date: date | None = parse_date(payment_date)
            status = (status or "Expected").strip() or "Expected"
            existing = session.exec(select(ClientPayment).where(ClientPayment.name == name)).first()

            if existing:
                changed = False
                if existing.deal_id != deal_id:
                    existing.deal_id = deal_id
                    changed = True
                if existing.amount != amount:
                    existing.amount = amount
                    changed = True
                if existing.status != status:
                    existing.status = status
                    changed = True
                if existing.received_date != received_date:
                    existing.received_date = received_date
                    changed = True
                new_modified = parse_dt(modified)
                if existing.updated_at != new_modified:
                    existing.updated_at = new_modified
                    changed = True
                if changed:
                    session.add(existing)
                    updated += 1
                continue

            session.add(
                ClientPayment(
                    name=name,
                    deal_id=deal_id,
                    amount=amount,
                    status=status,
                    received_date=received_date,
                    created_at=parse_dt(modified),
                    updated_at=parse_dt(modified),
                )
            )
            added += 1

        recalculate_all_deals(session)
        session.commit()
        total = len(session.exec(select(ClientPayment)).all())

    print(f"Payments added: {added}, updated: {updated}, skipped: {skipped}, total: {total}")


if __name__ == "__main__":
    main()
