#!/usr/bin/env python3
"""
Frappe to FastAPI Data Migration Script

This script migrates data from Frappe CRM to FastAPI backend.
It handles all doctypes and their relationships, custom fields, and naming series.

Usage:
    python migration/migrate_data.py [--dry-run] [--limit N] [--doctype DOCTYPE]

Options:
    --dry-run: Show what would be migrated without actually migrating
    --limit N: Limit migration to N records per doctype
    --doctype DOCTYPE: Migrate only the specified doctype
"""

import argparse
import logging
import sys
from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError
import pymysql

# Add parent directory to path for imports
sys.path.append('.')

from app.config import settings
from app.db import get_session
from app.models.crm import (
    Product, Organization, Contact, Lead, Deal, Task, Note,
    Activity, Expense, ClientPayment, UserProductAccess
)
from app.services.naming import generate_naming_series
from app.services.crm import (
    apply_deal_probability,
    recalculate_deal_financials, apply_note_follow_up_date
)

# Frappe database connection
frappe_db_url = settings.frappe_database_url

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DataMigration:
    def __init__(self, dry_run: bool = False, limit: Optional[int] = None):
        self.dry_run = dry_run
        self.limit = limit
        self.frappe_engine = create_engine(frappe_db_url)
        self.fastapi_session = next(get_session())

        # Migration statistics
        self.stats = {
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'skipped': 0
        }

    def get_frappe_data(self, doctype: str, limit: Optional[int] = None) -> List[Dict]:
        """Fetch data from Frappe database for a specific doctype."""
        try:
            with self.frappe_engine.connect() as conn:
                table_name = f"tab{doctype}"

                # Get main table data
                query = f"SELECT * FROM `{table_name}` WHERE docstatus = 0"
                if limit:
                    query += f" LIMIT {limit}"

                result = conn.execute(text(query))
                rows = result.fetchall()

                data = []
                for row in rows:
                    record = dict(row._mapping)

                    # Get custom fields if any
                    custom_query = f"""
                        SELECT fieldname, value
                        FROM `tabCustom Field`
                        LEFT JOIN `tabCustom Field Value` ON `tabCustom Field`.name = `tabCustom Field Value`.field_name
                        WHERE `tabCustom Field`.dt = '{doctype}' AND `tabCustom Field Value`.doc_name = '{record.get('name', '')}'
                    """
                    custom_result = conn.execute(text(custom_query))
                    custom_fields = {row.fieldname: row.value for row in custom_result}

                    # Merge custom fields
                    record.update(custom_fields)
                    data.append(record)

                logger.info(f"Fetched {len(data)} records from {doctype}")
                return data

        except Exception as e:
            logger.error(f"Error fetching data from {doctype}: {e}")
            return []

    def migrate_user(self, data: Dict) -> Optional[User]:
        """Migrate User doctype."""
        try:
            # Check if user already exists in FastAPI
            existing = self.fastapi_session.query(User).filter_by(email=data.get('email')).first()
            if existing:
                return None

            user = User(
                username=data.get('email', ''),
                email=data.get('email', ''),
                full_name=data.get('full_name', ''),
                role="Business User" if data.get('name') != 'Administrator' else 'Business Admin',
                hashed_password="migrated_user_needs_reset", # Placeholder
                is_active=data.get('enabled', True),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return user
        except Exception as e:
            logger.error(f"Error migrating user {data.get('email')}: {e}")
            return None

    def migrate_product(self, data: Dict) -> Optional[Product]:
        """Migrate Product doctype."""
        try:
            product = Product(
                product_code=data.get('name', ''),
                product_name=data.get('product_name', ''),
                product_type=data.get('product_type', ''),
                description=data.get('description', ''),
                is_active=data.get('is_active', True),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return product
        except Exception as e:
            logger.error(f"Error migrating product {data.get('name')}: {e}")
            return None

    def migrate_organization(self, data: Dict) -> Optional[Organization]:
        """Migrate Organization doctype."""
        try:
            # Find product_id by matching product name
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(product_code=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for organization {data.get('name')}")
                return None

            organization = Organization(
                organization_name=data.get('organization_name', ''),
                product_id=product.id,
                assigned_to=data.get('assigned_to', ''),
                status=data.get('status', 'Active'),
                industry=data.get('industry', ''),
                phone=data.get('phone', ''),
                email=data.get('email', ''),
                website=data.get('website', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return organization
        except Exception as e:
            logger.error(f"Error migrating organization {data.get('name')}: {e}")
            return None

    def migrate_contact(self, data: Dict) -> Optional[Contact]:
        """Migrate Contact doctype."""
        try:
            # Find product_id by matching product name
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(product_code=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for contact {data.get('name')}")
                return None

            # Find organization_id if exists
            organization_id = None
            if data.get('organization'):
                org = self.fastapi_session.query(Organization).filter_by(name=data.get('organization')).first()
                organization_id = org.id if org else None

            contact = Contact(
                name=data.get('name', ''),
                full_name=data.get('full_name', ''),
                product_id=product.id,
                organization_id=organization_id,
                assigned_to=data.get('assigned_to', ''),
                status=data.get('status', 'Active'),
                email=data.get('email', ''),
                mobile_no=data.get('mobile_no', ''),
                job_title=data.get('job_title', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return contact
        except Exception as e:
            logger.error(f"Error migrating contact {data.get('name')}: {e}")
            return None

    def migrate_lead(self, data: Dict) -> Optional[Lead]:
        """Migrate Lead doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for lead {data.get('name')}")
                return None

            lead = Lead(
                name=data.get('name', ''),
                lead_name=data.get('lead_name', ''),
                product_id=product.id,
                organization_name=data.get('organization_name', ''),
                contact_name=data.get('contact_name', ''),
                email=data.get('email', ''),
                mobile_no=data.get('mobile_no', ''),
                lead_source=data.get('lead_source', ''),
                status=data.get('status', 'Open'),
                assigned_to=data.get('assigned_to', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return lead
        except Exception as e:
            logger.error(f"Error migrating lead {data.get('name')}: {e}")
            return None

    def migrate_deal(self, data: Dict) -> Optional[Deal]:
        """Migrate Deal doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for deal {data.get('name')}")
                return None

            # Find related entities
            organization_id = None
            contact_id = None
            lead_id = None

            if data.get('organization'):
                org = self.fastapi_session.query(Organization).filter_by(name=data.get('organization')).first()
                organization_id = org.id if org else None

            if data.get('contact'):
                contact = self.fastapi_session.query(Contact).filter_by(name=data.get('contact')).first()
                contact_id = contact.id if contact else None

            if data.get('lead'):
                lead = self.fastapi_session.query(Lead).filter_by(name=data.get('lead')).first()
                lead_id = lead.id if lead else None

            deal = Deal(
                deal_title=data.get('deal_name', ''),
                product_id=product.id,
                organization_id=organization_id,
                contact_id=contact_id,
                lead_id=lead_id,
                deal_value=data.get('deal_amount', 0),
                probability=data.get('probability', 0),
                assigned_to=data.get('assigned_to', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )

            # Apply automations
            apply_deal_probability(deal)

            # Save deal first to get ID, then recalculate financials
            if not self.dry_run:
                self.fastapi_session.add(deal)
                self.fastapi_session.commit()
                self.fastapi_session.refresh(deal)
                recalculate_deal_financials(self.fastapi_session, deal)

            return deal
        except Exception as e:
            logger.error(f"Error migrating deal {data.get('name')}: {e}")
            return None

    def migrate_task(self, data: Dict) -> Optional[Task]:
        """Migrate Task doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for task {data.get('name')}")
                return None

            # Find related entities
            lead_id = None
            deal_id = None
            contact_id = None

            if data.get('lead'):
                lead = self.fastapi_session.query(Lead).filter_by(name=data.get('lead')).first()
                lead_id = lead.id if lead else None

            if data.get('deal'):
                deal = self.fastapi_session.query(Deal).filter_by(name=data.get('deal')).first()
                deal_id = deal.id if deal else None

            if data.get('contact'):
                contact = self.fastapi_session.query(Contact).filter_by(name=data.get('contact')).first()
                contact_id = contact.id if contact else None

            task = Task(
                name=data.get('name', ''),
                subject=data.get('subject', ''),
                product_id=product.id,
                assigned_to=data.get('assigned_to', ''),
                lead_id=lead_id,
                deal_id=deal_id,
                contact_id=contact_id,
                task_type=data.get('task_type', ''),
                priority=data.get('priority', 'Medium'),
                status=data.get('status', 'Open'),
                due_date=data.get('due_date'),
                description=data.get('description', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return task
        except Exception as e:
            logger.error(f"Error migrating task {data.get('name')}: {e}")
            return None

    def migrate_note(self, data: Dict) -> Optional[Note]:
        """Migrate Note doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for note {data.get('name')}")
                return None

            # Find related entities
            lead_id = None
            deal_id = None
            organization_id = None
            contact_id = None

            if data.get('lead'):
                lead = self.fastapi_session.query(Lead).filter_by(name=data.get('lead')).first()
                lead_id = lead.id if lead else None

            if data.get('deal'):
                deal = self.fastapi_session.query(Deal).filter_by(name=data.get('deal')).first()
                deal_id = deal.id if deal else None

            if data.get('organization'):
                org = self.fastapi_session.query(Organization).filter_by(name=data.get('organization')).first()
                organization_id = org.id if org else None

            if data.get('contact'):
                contact = self.fastapi_session.query(Contact).filter_by(name=data.get('contact')).first()
                contact_id = contact.id if contact else None

            note = Note(
                name=data.get('name', ''),
                title=data.get('title', ''),
                content=data.get('note_content', ''),  # Custom field
                product_id=product.id,
                assigned_to=data.get('assigned_to', ''),
                lead_id=lead_id,
                deal_id=deal_id,
                organization_id=organization_id,
                contact_id=contact_id,
                follow_up_when=data.get('follow_up_when', ''),
                follow_up_date=data.get('follow_up_date'),
                create_follow_up_task=data.get('create_follow_up_task', False),
                follow_up_task_type=data.get('follow_up_task_type', ''),  # Custom field
                follow_up_task_title=data.get('follow_up_task_title', ''),
                follow_up_task_description=data.get('follow_up_task_description', ''),  # Custom field
                follow_up_task=data.get('follow_up_task', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )

            # Apply automations
            apply_note_follow_up_date(note)

            return note
        except Exception as e:
            logger.error(f"Error migrating note {data.get('name')}: {e}")
            return None

    def migrate_activity(self, data: Dict) -> Optional[Activity]:
        """Migrate Activity doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for activity {data.get('name')}")
                return None

            activity = Activity(
                name=data.get('name', ''),
                activity_type=data.get('activity_type', ''),
                subject=data.get('subject', ''),
                product_id=product.id,
                assigned_to=data.get('assigned_to', ''),
                description=data.get('description', ''),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return activity
        except Exception as e:
            logger.error(f"Error migrating activity {data.get('name')}: {e}")
            return None

    def migrate_expense(self, data: Dict) -> Optional[Expense]:
        """Migrate Expense doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for expense {data.get('name')}")
                return None

            expense = Expense(
                name=data.get('name', ''),
                expense_type=data.get('expense_type', ''),
                amount=data.get('amount', 0),
                currency=data.get('currency', 'USD'),
                product_id=product.id,
                description=data.get('description', ''),
                expense_date=data.get('expense_date'),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return expense
        except Exception as e:
            logger.error(f"Error migrating expense {data.get('name')}: {e}")
            return None

    def migrate_client_payment(self, data: Dict) -> Optional[ClientPayment]:
        """Migrate Client Payment doctype."""
        try:
            # Find product_id
            product_name = data.get('product')
            product = self.fastapi_session.query(Product).filter_by(name=product_name).first()
            if not product:
                logger.warning(f"Product {product_name} not found for client payment {data.get('name')}")
                return None

            # Find deal_id if exists
            deal_id = None
            if data.get('deal'):
                deal = self.fastapi_session.query(Deal).filter_by(name=data.get('deal')).first()
                deal_id = deal.id if deal else None

            payment = ClientPayment(
                name=data.get('name', ''),
                payment_type=data.get('payment_type', ''),
                amount=data.get('amount', 0),
                currency=data.get('currency', 'USD'),
                product_id=product.id,
                deal_id=deal_id,
                payment_date=data.get('payment_date'),
                payment_method=data.get('payment_method', ''),
                reference_no=data.get('reference_no', ''),
                status=data.get('status', 'Unpaid'),
                created_at=data.get('creation'),
                updated_at=data.get('modified')
            )
            return payment
        except Exception as e:
            logger.error(f"Error migrating client payment {data.get('name')}: {e}")
            return None

    def migrate_doctype(self, doctype: str) -> None:
        """Migrate a specific doctype."""
        logger.info(f"Starting migration of {doctype}")

        # Get migration data
        data_list = self.get_frappe_data(doctype, self.limit)

        # Get the appropriate migration method
        migrate_method = getattr(self, f"migrate_{doctype.lower().replace(' ', '_')}", None)
        if not migrate_method:
            logger.error(f"No migration method found for {doctype}")
            return

        for data in data_list:
            self.stats['processed'] += 1

            try:
                # Migrate the record
                migrated_record = migrate_method(data)

                if migrated_record:
                    if not self.dry_run:
                        self.fastapi_session.add(migrated_record)
                        self.fastapi_session.commit()
                        logger.info(f"Successfully migrated {doctype}: {data.get('name', '')}")
                    else:
                        logger.info(f"Would migrate {doctype}: {data.get('name', '')}")

                    self.stats['successful'] += 1
                else:
                    self.stats['skipped'] += 1
                    logger.warning(f"Skipped {doctype}: {data.get('name', '')}")

            except IntegrityError as e:
                self.fastapi_session.rollback()
                self.stats['failed'] += 1
                logger.error(f"Integrity error migrating {doctype} {data.get('name', '')}: {e}")
            except Exception as e:
                self.fastapi_session.rollback()
                self.stats['failed'] += 1
                logger.error(f"Error migrating {doctype} {data.get('name', '')}: {e}")

        logger.info(f"Completed migration of {doctype}: {self.stats}")

    def migrate_all(self) -> None:
        """Migrate all doctypes in the correct order (respecting foreign keys)."""
        doctypes_order = [
            'User',
            'Product',
            'Organization',
            'Contact',
            'Lead',
            'Deal',
            'Task',
            'Note',
            'Activity',
            'Expense',
            'Client Payment'
        ]

        logger.info("Starting full data migration")
        start_time = datetime.now()

        for doctype in doctypes_order:
            self.migrate_doctype(doctype)

        end_time = datetime.now()
        duration = end_time - start_time

        logger.info(f"Migration completed in {duration}")
        logger.info(f"Final statistics: {self.stats}")

    def close(self):
        """Clean up resources."""
        self.fastapi_session.close()
        self.frappe_engine.dispose()


def main():
    parser = argparse.ArgumentParser(description='Migrate Frappe CRM data to FastAPI')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be migrated')
    parser.add_argument('--limit', type=int, help='Limit records per doctype')
    parser.add_argument('--doctype', help='Migrate only specific doctype')

    args = parser.parse_args()

    migration = DataMigration(dry_run=args.dry_run, limit=args.limit)

    try:
        if args.doctype:
            migration.migrate_doctype(args.doctype)
        else:
            migration.migrate_all()
    finally:
        migration.close()


if __name__ == '__main__':
    main()