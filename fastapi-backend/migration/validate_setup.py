#!/usr/bin/env python3
"""
Migration Setup Validator

This script validates that the migration environment is properly configured
before running the actual data migration.
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Add parent directory to path
sys.path.append('..')

# Change to parent directory to find .env file
os.chdir('..')

try:
    from app.config import settings
    from app.db import get_session
    from app.models.crm import Product, Organization, Contact
except ImportError as e:
    print(f"❌ Failed to import FastAPI modules: {e}")
    print("Make sure you're running this from the fastapi-backend directory")
    sys.exit(1)

def test_fastapi_connection():
    """Test connection to FastAPI database."""
    print("Testing FastAPI database connection...")
    try:
        session = next(get_session())
        # Simple query to test connection
        result = session.execute(text("SELECT 1"))
        session.close()
        print("✅ FastAPI database connection successful")
        return True
    except SQLAlchemyError as e:
        print(f"❌ FastAPI database connection failed: {e}")
        return False

def test_frappe_connection():
    """Test connection to Frappe database."""
    print("Testing Frappe database connection...")

    # Try to get Frappe DB URL from environment or config
    frappe_db_url = os.getenv('FRAPPE_DATABASE_URL') or getattr(settings, 'FRAPPE_DATABASE_URL', None)

    if not frappe_db_url:
        print("❌ FRAPPE_DATABASE_URL not configured")
        print("Please set FRAPPE_DATABASE_URL in your environment or config")
        return False

    try:
        engine = create_engine(frappe_db_url)
        with engine.connect() as conn:
            # Test basic connectivity
            result = conn.execute(text("SELECT 1"))
            print("✅ Frappe database connection successful")
            return True
    except SQLAlchemyError as e:
        print(f"❌ Frappe database connection failed: {e}")
        return False

def test_frappe_tables():
    """Test that required Frappe tables exist."""
    print("Testing Frappe table availability...")

    frappe_db_url = os.getenv('FRAPPE_DATABASE_URL') or getattr(settings, 'FRAPPE_DATABASE_URL', None)
    if not frappe_db_url:
        return False

    required_tables = [
        'tabProduct',
        'tabOrganization',
        'tabContact',
        'tabLead',
        'tabDeal',
        'tabTask',
        'tabNote',
        'tabActivity',
        'tabExpense',
        'tabClient Payment'
    ]

    try:
        engine = create_engine(frappe_db_url)
        with engine.connect() as conn:
            for table in required_tables:
                try:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM `{table}`"))
                    count = result.fetchone()[0]
                    print(f"✅ {table}: {count} records")
                except SQLAlchemyError as e:
                    print(f"❌ {table}: Table not found or inaccessible - {e}")
                    return False
        return True
    except SQLAlchemyError as e:
        print(f"❌ Failed to check Frappe tables: {e}")
        return False

def test_fastapi_tables():
    """Test that FastAPI tables are created."""
    print("Testing FastAPI table creation...")

    try:
        session = next(get_session())

        # Try to query each table
        tables_to_check = [
            (Product, "Product"),
            (Organization, "Organization"),
            (Contact, "Contact")
        ]

        for model, name in tables_to_check:
            try:
                count = session.query(model).count()
                print(f"✅ {name} table: {count} records")
            except SQLAlchemyError as e:
                print(f"❌ {name} table: Not accessible - {e}")
                return False

        session.close()
        return True
    except Exception as e:
        print(f"❌ Failed to check FastAPI tables: {e}")
        return False

def main():
    """Run all validation tests."""
    print("🔍 Migration Setup Validator")
    print("=" * 40)

    tests = [
        test_fastapi_connection,
        test_frappe_connection,
        test_frappe_tables,
        test_fastapi_tables
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1
        print()

    print("=" * 40)
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Migration environment is ready.")
        return 0
    else:
        print("⚠️  Some tests failed. Please fix the issues before running migration.")
        return 1

if __name__ == '__main__':
    sys.exit(main())