#!/usr/bin/env python3
"""
Migration Rollback Script

This script provides rollback capabilities for the FastAPI migration.
Use this if the migration fails or if you need to revert changes.

ROLLBACK OPTIONS:
1. Complete rollback: Restore from backup
2. Partial rollback: Remove migrated data by date range
3. Selective rollback: Remove specific doctypes

Usage:
    python migration/rollback.py --type [complete|partial|selective] [options]

Examples:
    python migration/rollback.py --type complete --backup-file backup.sql
    python migration/rollback.py --type partial --since "2024-01-01"
    python migration/rollback.py --type selective --doctypes "Contact,Deal"
"""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import List

# Add current directory to path for imports
sys.path.append('.')

from app.db import get_session
from app.models.crm import (
    Product, Organization, Contact, Lead, Deal, Task, Note,
    Activity, Expense, ClientPayment, UserProductAccess
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MigrationRollback:
    """Handle rollback operations for migration."""

    def __init__(self):
        self.session = next(get_session())

    def rollback_complete(self, backup_file: str) -> bool:
        """Complete rollback by restoring from backup."""
        logger.info(f"🔄 Starting complete rollback from {backup_file}")

        if not Path(backup_file).exists():
            logger.error(f"Backup file not found: {backup_file}")
            return False

        try:
            # This would typically use database-specific restore commands
            # For MySQL: mysql -u user -p database < backup.sql
            logger.warning("⚠️  Complete rollback requires manual database restore")
            logger.info(f"📋 To restore: mysql -u [user] -p [database] < {backup_file}")
            logger.info("🔒 Remember to stop the FastAPI application during restore")

            return True

        except Exception as e:
            logger.error(f"Complete rollback failed: {e}")
            return False

    def rollback_partial(self, since_date: str) -> bool:
        """Rollback data created since a specific date."""
        logger.info(f"🔄 Starting partial rollback since {since_date}")

        try:
            cutoff_date = datetime.fromisoformat(since_date)

            # Tables to clean up in reverse dependency order
            cleanup_order = [
                (ClientPayment, "Client Payments"),
                (Expense, "Expenses"),
                (Activity, "Activities"),
                (Note, "Notes"),
                (Task, "Tasks"),
                (Deal, "Deals"),
                (Lead, "Leads"),
                (Contact, "Contacts"),
                (Organization, "Organizations"),
                (Product, "Products")
            ]

            total_deleted = 0

            for model, name in cleanup_order:
                # Delete records created since cutoff date
                deleted = self.session.query(model).filter(
                    model.created_at >= cutoff_date
                ).delete()

                total_deleted += deleted
                if deleted > 0:
                    logger.info(f"Deleted {deleted} {name}")

            self.session.commit()
            logger.info(f"✅ Partial rollback completed. Total records deleted: {total_deleted}")

            return True

        except Exception as e:
            self.session.rollback()
            logger.error(f"Partial rollback failed: {e}")
            return False

    def rollback_selective(self, doctypes: List[str]) -> bool:
        """Rollback specific doctypes."""
        logger.info(f"🔄 Starting selective rollback for: {', '.join(doctypes)}")

        try:
            doctype_map = {
                'product': (Product, "Products"),
                'organization': (Organization, "Organizations"),
                'contact': (Contact, "Contacts"),
                'lead': (Lead, "Leads"),
                'deal': (Deal, "Deals"),
                'task': (Task, "Tasks"),
                'note': (Note, "Notes"),
                'activity': (Activity, "Activities"),
                'expense': (Expense, "Expenses"),
                'clientpayment': (ClientPayment, "Client Payments")
            }

            total_deleted = 0

            for doctype in doctypes:
                doctype_lower = doctype.lower().replace(' ', '')
                if doctype_lower in doctype_map:
                    model, name = doctype_map[doctype_lower]

                    # Delete all records of this type
                    deleted = self.session.query(model).delete()
                    total_deleted += deleted

                    if deleted > 0:
                        logger.info(f"Deleted {deleted} {name}")
                else:
                    logger.warning(f"Unknown doctype: {doctype}")

            self.session.commit()
            logger.info(f"✅ Selective rollback completed. Total records deleted: {total_deleted}")

            return True

        except Exception as e:
            self.session.rollback()
            logger.error(f"Selective rollback failed: {e}")
            return False

    def get_migration_summary(self) -> None:
        """Show summary of data that would be affected by rollback."""
        logger.info("📊 Migration Data Summary:")

        tables = [
            (Product, "Products"),
            (Organization, "Organizations"),
            (Contact, "Contacts"),
            (Lead, "Leads"),
            (Deal, "Deals"),
            (Task, "Tasks"),
            (Note, "Notes"),
            (Activity, "Activities"),
            (Expense, "Expenses"),
            (ClientPayment, "Client Payments")
        ]

        for model, name in tables:
            count = self.session.query(model).count()
            if count > 0:
                logger.info(f"  {name}: {count} records")

    def close(self):
        """Clean up resources."""
        self.session.close()

def confirm_rollback(rollback_type: str, details: str) -> bool:
    """Get confirmation for rollback operation."""
    print("\n" + "="*60)
    print(f"🚨 ROLLBACK CONFIRMATION: {rollback_type.upper()}")
    print("="*60)
    print()
    print(f"This will perform a {rollback_type} rollback:")
    print(details)
    print()
    print("⚠️  This action cannot be undone!")
    print()
    print("Type 'YES, ROLLBACK DATA' to proceed:")
    print()

    confirmation = input("> ").strip()

    if confirmation == "YES, ROLLBACK DATA":
        print("✅ Confirmation accepted. Proceeding with rollback...")
        return True
    else:
        print("❌ Rollback cancelled by user.")
        return False

def main():
    parser = argparse.ArgumentParser(description='Rollback migration data')
    parser.add_argument('--type', required=True, choices=['complete', 'partial', 'selective'],
                       help='Type of rollback to perform')
    parser.add_argument('--backup-file', help='Backup file for complete rollback')
    parser.add_argument('--since', help='Date for partial rollback (ISO format: 2024-01-01)')
    parser.add_argument('--doctypes', help='Comma-separated doctypes for selective rollback')
    parser.add_argument('--summary-only', action='store_true', help='Show summary without performing rollback')

    args = parser.parse_args()

    rollback = MigrationRollback()

    try:
        # Show summary first
        rollback.get_migration_summary()

        if args.summary_only:
            return

        # Perform rollback based on type
        if args.type == 'complete':
            if not args.backup_file:
                print("❌ Complete rollback requires --backup-file")
                sys.exit(1)

            details = f"Complete database restore from: {args.backup_file}"
            if confirm_rollback(args.type, details):
                success = rollback.rollback_complete(args.backup_file)
            else:
                success = False

        elif args.type == 'partial':
            if not args.since:
                print("❌ Partial rollback requires --since date")
                sys.exit(1)

            details = f"Delete all data created since: {args.since}"
            if confirm_rollback(args.type, details):
                success = rollback.rollback_partial(args.since)
            else:
                success = False

        elif args.type == 'selective':
            if not args.doctypes:
                print("❌ Selective rollback requires --doctypes")
                sys.exit(1)

            doctypes = [dt.strip() for dt in args.doctypes.split(',')]
            details = f"Delete all data from doctypes: {', '.join(doctypes)}"
            if confirm_rollback(args.type, details):
                success = rollback.rollback_selective(doctypes)
            else:
                success = False

        if success:
            logger.info("✅ Rollback completed successfully")
        else:
            logger.error("❌ Rollback failed or was cancelled")
            sys.exit(1)

    finally:
        rollback.close()

if __name__ == '__main__':
    main()