#!/usr/bin/env python3
"""
Test Data Migration Script

This script creates test data and validates the migration process
without requiring a live Frappe database connection.
"""

import sys
import json
from datetime import datetime, date
from sqlalchemy.orm import Session

# Add current directory to path for imports
sys.path.append('.')

from app.db import get_session
from app.models.crm import (
    Product, Organization, Contact, Lead, Deal, Task, Note,
    Activity, Expense, ClientPayment, UserProductAccess
)
from app.services.naming import generate_naming_series
from app.services.crm import (
    apply_deal_probability,
    recalculate_deal_financials, apply_note_follow_up_date,
    create_follow_up_task_from_note
)

def create_test_data(session: Session) -> None:
    """Create test data in FastAPI database to simulate migrated data."""

    # Create test products
    products = [
        Product(
            name="PROD-001",
            product_name="CRM Basic",
            description="Basic CRM functionality",
            status="Active",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        ),
        Product(
            name="PROD-002",
            product_name="CRM Pro",
            description="Advanced CRM features",
            status="Active",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for product in products:
        session.add(product)
    session.commit()

    # Create test organizations
    organizations = [
        Organization(
            name="ORG-001",
            organization_name="TechCorp Inc",
            industry="Technology",
            website="https://techcorp.com",
            status="Active",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        ),
        Organization(
            name="ORG-002",
            organization_name="Global Solutions Ltd",
            industry="Consulting",
            website="https://globalsolutions.com",
            status="Active",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for org in organizations:
        session.add(org)
    session.commit()

    # Create test contacts
    contacts = [
        Contact(
            name="CONT-00001",
            full_name="John Smith",
            product_id=1,  # CRM Basic
            organization_id=1,  # TechCorp
            assigned_to="user1",
            status="Active",
            email="john.smith@techcorp.com",
            mobile_no="+1234567890",
            job_title="CEO",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        ),
        Contact(
            name="CONT-00002",
            full_name="Jane Doe",
            product_id=2,  # CRM Pro
            organization_id=2,  # Global Solutions
            assigned_to="user2",
            status="Active",
            email="jane.doe@globalsolutions.com",
            mobile_no="+0987654321",
            job_title="CTO",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for contact in contacts:
        session.add(contact)
    session.commit()

    # Create test leads
    leads = [
        Lead(
            name="LEAD-001",
            lead_name="ABC Company",
            product_id=1,
            organization_name="ABC Company",
            contact_name="Bob Wilson",
            email="bob@abc.com",
            mobile_no="+1111111111",
            lead_source="Website",
            status="Open",
            assigned_to="user1",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for lead in leads:
        session.add(lead)
    session.commit()

    # Create test deals
    deals = [
        Deal(
            name="DEAL-001",
            deal_name="CRM Implementation for TechCorp",
            product_id=1,
            organization_id=1,
            contact_id=1,
            lead_id=1,
            deal_amount=50000.00,
            currency="USD",
            deal_stage="Proposal",
            probability=75,
            expected_closing_date=date(2024, 3, 31),
            assigned_to="user1",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for deal in deals:
        # Apply automations
        apply_deal_probability(deal)
        recalculate_deal_financials(deal)
        session.add(deal)
    session.commit()

    # Create test tasks
    tasks = [
        Task(
            name="TASK-001",
            subject="Follow up with TechCorp",
            product_id=1,
            assigned_to="user1",
            deal_id=1,
            contact_id=1,
            task_type="Call",
            priority="High",
            status="Open",
            due_date=date(2024, 2, 15),
            description="Schedule demo call",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for task in tasks:
        session.add(task)
    session.commit()

    # Create test notes
    notes = [
        Note(
            name="NOTE-00001",
            title="Initial Meeting Notes",
            content="Discussed CRM requirements and timeline",
            product_id=1,
            assigned_to="user1",
            deal_id=1,
            contact_id=1,
            follow_up_when="Next Week",
            follow_up_date=date(2024, 2, 10),
            create_follow_up_task=True,
            follow_up_task_type="Follow-up Call",
            follow_up_task_title="Follow up on CRM demo",
            follow_up_task_description="Call TechCorp to schedule demo",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for note in notes:
        # Apply automations
        apply_note_follow_up_date(note)
        create_follow_up_task_from_note(session, note)
        session.add(note)
    session.commit()

    # Create test activities
    activities = [
        Activity(
            name="ACT-001",
            activity_type="Call",
            subject="Initial consultation",
            product_id=1,
            assigned_to="user1",
            description="Discussed project requirements",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for activity in activities:
        session.add(activity)
    session.commit()

    # Create test expenses
    expenses = [
        Expense(
            name="EXP-001",
            expense_type="Travel",
            amount=500.00,
            currency="USD",
            product_id=1,
            description="Flight to client meeting",
            expense_date=date(2024, 1, 15),
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for expense in expenses:
        session.add(expense)
    session.commit()

    # Create test client payments
    payments = [
        ClientPayment(
            name="PAY-001",
            payment_type="Deposit",
            amount=10000.00,
            currency="USD",
            product_id=1,
            deal_id=1,
            payment_date=date(2024, 1, 20),
            payment_method="Bank Transfer",
            reference_no="REF001",
            status="Paid",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1)
        )
    ]

    for payment in payments:
        session.add(payment)
    session.commit()

    print("✅ Test data created successfully")

def validate_relationships(session: Session) -> bool:
    """Validate that all relationships are properly established."""
    print("🔍 Validating data relationships...")

    issues = []

    # Check contact-organization relationships
    contacts = session.query(Contact).all()
    for contact in contacts:
        if contact.organization_id:
            org = session.query(Organization).filter_by(id=contact.organization_id).first()
            if not org:
                issues.append(f"Contact {contact.name} references non-existent organization {contact.organization_id}")

    # Check deal relationships
    deals = session.query(Deal).all()
    for deal in deals:
        if deal.organization_id:
            org = session.query(Organization).filter_by(id=deal.organization_id).first()
            if not org:
                issues.append(f"Deal {deal.name} references non-existent organization {deal.organization_id}")

        if deal.contact_id:
            contact = session.query(Contact).filter_by(id=deal.contact_id).first()
            if not contact:
                issues.append(f"Deal {deal.name} references non-existent contact {deal.contact_id}")

        if deal.lead_id:
            lead = session.query(Lead).filter_by(id=deal.lead_id).first()
            if not lead:
                issues.append(f"Deal {deal.name} references non-existent lead {deal.lead_id}")

    # Check task relationships
    tasks = session.query(Task).all()
    for task in tasks:
        if task.deal_id:
            deal = session.query(Deal).filter_by(id=task.deal_id).first()
            if not deal:
                issues.append(f"Task {task.name} references non-existent deal {task.deal_id}")

        if task.contact_id:
            contact = session.query(Contact).filter_by(id=task.contact_id).first()
            if not contact:
                issues.append(f"Task {task.name} references non-existent contact {task.contact_id}")

    # Check note relationships
    notes = session.query(Note).all()
    for note in notes:
        if note.deal_id:
            deal = session.query(Deal).filter_by(id=note.deal_id).first()
            if not deal:
                issues.append(f"Note {note.name} references non-existent deal {note.deal_id}")

        if note.contact_id:
            contact = session.query(Contact).filter_by(id=note.contact_id).first()
            if not contact:
                issues.append(f"Note {note.name} references non-existent contact {note.contact_id}")

        if note.organization_id:
            org = session.query(Organization).filter_by(id=note.organization_id).first()
            if not org:
                issues.append(f"Note {note.name} references non-existent organization {note.organization_id}")

    # Check payment relationships
    payments = session.query(ClientPayment).all()
    for payment in payments:
        if payment.deal_id:
            deal = session.query(Deal).filter_by(id=payment.deal_id).first()
            if not deal:
                issues.append(f"Payment {payment.name} references non-existent deal {payment.deal_id}")

    if issues:
        print("❌ Relationship validation failed:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ All relationships validated successfully")
        return True

def validate_business_logic(session: Session) -> bool:
    """Validate that business logic rules are applied correctly."""
    print("🔍 Validating business logic...")

    issues = []

    # Check deal probabilities
    deals = session.query(Deal).all()
    for deal in deals:
        if deal.probability < 0 or deal.probability > 100:
            issues.append(f"Deal {deal.name} has invalid probability: {deal.probability}")

    # Check naming series format
    contacts = session.query(Contact).all()
    for contact in contacts:
        if not contact.name.startswith("CONT-"):
            issues.append(f"Contact has invalid naming series: {contact.name}")

    notes = session.query(Note).all()
    for note in notes:
        if not note.name.startswith("NOTE-"):
            issues.append(f"Note has invalid naming series: {note.name}")

    # Check follow-up task creation from notes
    notes_with_followup = session.query(Note).filter_by(create_follow_up_task=True).all()
    for note in notes_with_followup:
        # Check if follow-up task was created
        followup_task = session.query(Task).filter_by(
            subject=note.follow_up_task_title,
            contact_id=note.contact_id,
            deal_id=note.deal_id
        ).first()
        if not followup_task:
            issues.append(f"Note {note.name} should have created follow-up task but none found")

    if issues:
        print("❌ Business logic validation failed:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("✅ Business logic validated successfully")
        return True

def generate_migration_report(session: Session) -> None:
    """Generate a comprehensive migration report."""
    print("📊 Generating Migration Report")
    print("=" * 50)

    # Count records by type
    counts = {
        "Products": session.query(Product).count(),
        "Organizations": session.query(Organization).count(),
        "Contacts": session.query(Contact).count(),
        "Leads": session.query(Lead).count(),
        "Deals": session.query(Deal).count(),
        "Tasks": session.query(Task).count(),
        "Notes": session.query(Note).count(),
        "Activities": session.query(Activity).count(),
        "Expenses": session.query(Expense).count(),
        "Client Payments": session.query(ClientPayment).count(),
    }

    print("Record Counts:")
    for entity, count in counts.items():
        print(f"  {entity}: {count}")

    print(f"\nTotal Records: {sum(counts.values())}")

    # Sample records for verification
    print("\nSample Records:")
    if counts["Contacts"] > 0:
        contact = session.query(Contact).first()
        print(f"  Contact: {contact.name} - {contact.full_name}")

    if counts["Deals"] > 0:
        deal = session.query(Deal).first()
        print(f"  Deal: {deal.name} - {deal.deal_name} (${deal.deal_amount})")

    if counts["Notes"] > 0:
        note = session.query(Note).first()
        print(f"  Note: {note.name} - {note.title}")

def run_test_migration():
    """Run the complete test migration and validation."""
    print("🧪 Starting Test Data Migration")
    print("=" * 40)

    session = next(get_session())

    try:
        # Create test data
        create_test_data(session)

        # Validate relationships
        relationships_ok = validate_relationships(session)

        # Validate business logic
        business_logic_ok = validate_business_logic(session)

        # Generate report
        generate_migration_report(session)

        print("=" * 40)
        if relationships_ok and business_logic_ok:
            print("🎉 Test migration completed successfully!")
            return True
        else:
            print("⚠️  Test migration completed with issues")
            return False

    except Exception as e:
        print(f"❌ Test migration failed: {e}")
        session.rollback()
        return False
    finally:
        session.close()

if __name__ == '__main__':
    success = run_test_migration()
    sys.exit(0 if success else 1)