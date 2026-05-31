from typing import Iterable
import re

from sqlmodel import Session, select, update, func

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
from app.services.naming import assign_public_id
from app.services.resolve import resolve_record
from app.schemas.crm import (
    ActivityCreate,
    ActivityUpdate,
    ClientPaymentCreate,
    ClientPaymentUpdate,
    ContactCreate,
    ContactUpdate,
    DealCreate,
    DealUpdate,
    ExpenseCreate,
    ExpenseUpdate,
    LeadCreate,
    LeadUpdate,
    NoteCreate,
    NoteUpdate,
    OrganizationCreate,
    OrganizationUpdate,
    ProductCreate,
    ProductUpdate,
    TaskCreate,
    TaskUpdate,
    UserProductAccessCreate,
    UserProductAccessUpdate,
)

LEAD_STATUSES = {"Open", "In Progress", "Interested", "Qualified", "Lost", "Converted", "New", "Contacted", "Proposal"}


def relink_lead_children(session: Session, lead: Lead, deal: Deal) -> None:
    """Attach existing lead tasks/notes/activities to the converted deal."""
    for task in session.exec(select(Task).where(Task.lead_id == lead.id)).all():
        task.deal_id = deal.id
        if deal.organization_id and not task.organization_id:
            task.organization_id = deal.organization_id
        if deal.contact_id and not task.contact_id:
            task.contact_id = deal.contact_id
        session.add(task)

    for note in session.exec(select(Note).where(Note.lead_id == lead.id)).all():
        note.deal_id = deal.id
        if deal.organization_id and not note.organization_id:
            note.organization_id = deal.organization_id
        if deal.contact_id and not note.contact_id:
            note.contact_id = deal.contact_id
        session.add(note)

    for activity in session.exec(select(Activity).where(Activity.lead_id == lead.id)).all():
        activity.deal_id = deal.id
        if deal.organization_id and not activity.organization_id:
            activity.organization_id = deal.organization_id
        if deal.contact_id and not activity.contact_id:
            activity.contact_id = deal.contact_id
        session.add(activity)


def get_leads(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Lead]:
    statement = select(Lead).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_lead(session: Session, lead_id: int | str) -> Lead | None:
    return resolve_record(session, Lead, lead_id)


def create_lead(session: Session, lead_in: LeadCreate) -> Lead:
    normalized_data = normalize_contact_fields(lead_in.dict())
    lead = Lead.from_orm(LeadCreate(**normalized_data))
    errors = validate_lead_business_rules(lead)
    if errors:
        raise ValueError("; ".join(errors))
    assign_public_id(session, lead)
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


def update_lead(session: Session, lead: Lead, lead_in: LeadUpdate) -> Lead:
    lead_data = normalize_contact_fields(lead_in.dict(exclude_unset=True))
    for key, value in lead_data.items():
        setattr(lead, key, value)
    errors = validate_lead_business_rules(lead)
    if errors:
        raise ValueError("; ".join(errors))
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead


def delete_lead(session: Session, lead: Lead) -> None:
    session.delete(lead)
    session.commit()


def convert_lead(session: Session, lead: Lead) -> tuple[Lead, Organization, Contact, Deal]:
    """Convert a lead into organization + contact + deal in one transaction."""
    if lead.converted:
        raise ValueError("Lead is already converted")

    if not (lead.contact_name or lead.lead_name or "").strip():
        raise ValueError("Contact name is required before conversion")

    contact_display = (lead.contact_name or lead.lead_name or "").strip()

    organization = Organization(
        organization_name=lead.lead_name,
        product_id=lead.product_id,
        assigned_to=lead.assigned_to,
        status="Active",
        email=lead.email,
        phone=lead.mobile_no,
    )
    assign_public_id(session, organization)
    session.add(organization)
    session.flush()

    contact = Contact(
        full_name=contact_display,
        product_id=lead.product_id,
        organization_id=organization.id,
        assigned_to=lead.assigned_to,
        status="Active",
        email=lead.email,
        mobile_no=lead.mobile_no,
    )
    assign_public_id(session, contact)
    session.add(contact)
    session.flush()

    organization.contact_id = contact.id
    session.add(organization)

    deal = Deal(
        deal_title=lead.lead_name,
        product_id=lead.product_id,
        assigned_to=lead.assigned_to,
        lead_id=lead.id,
        organization_id=organization.id,
        contact_id=contact.id,
        deal_status="Qualification",
        deal_value=0.0,
    )
    assign_public_id(session, deal)
    apply_deal_probability(deal)
    session.add(deal)
    session.flush()

    relink_lead_children(session, lead, deal)

    lead.contact_id = contact.id
    lead.organization_id = organization.id
    lead.converted = True
    lead.status = "Converted"
    session.add(lead)
    session.commit()

    session.refresh(lead)
    session.refresh(organization)
    session.refresh(contact)
    session.refresh(deal)
    return lead, organization, contact, deal


# Product CRUD operations
def get_products(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Product]:
    statement = select(Product).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_product(session: Session, product_id: int | str) -> Product | None:
    return resolve_record(session, Product, product_id)


def create_product(session: Session, product_in: ProductCreate) -> Product:
    product = Product.from_orm(product_in)
    assign_public_id(session, product)
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def update_product(session: Session, product: Product, product_in: ProductUpdate) -> Product:
    product_data = product_in.dict(exclude_unset=True)
    for key, value in product_data.items():
        setattr(product, key, value)
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


def delete_product(session: Session, product: Product) -> None:
    session.delete(product)
    session.commit()


# UserProductAccess CRUD operations
def get_user_product_accesses(session: Session, skip: int = 0, limit: int = 100) -> Iterable[UserProductAccess]:
    statement = select(UserProductAccess).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_user_product_access(session: Session, access_id: int | str) -> UserProductAccess | None:
    return resolve_record(session, UserProductAccess, access_id)


def create_user_product_access(session: Session, access_in: UserProductAccessCreate) -> UserProductAccess:
    # Validate unique user product access
    errors = validate_unique_user_product_access(session, access_in.user_id, access_in.product_id)
    if errors:
        raise ValueError("; ".join(errors))
    
    access = UserProductAccess.from_orm(access_in)
    assign_public_id(session, access)
    session.add(access)
    session.commit()
    session.refresh(access)
    return access


def update_user_product_access(session: Session, access: UserProductAccess, access_in: UserProductAccessUpdate) -> UserProductAccess:
    access_data = access_in.dict(exclude_unset=True)
    for key, value in access_data.items():
        setattr(access, key, value)
    session.add(access)
    session.commit()
    session.refresh(access)
    return access


def delete_user_product_access(session: Session, access: UserProductAccess) -> None:
    session.delete(access)
    session.commit()


# Organization CRUD operations
def get_organizations(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Organization]:
    statement = select(Organization).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_organization(session: Session, organization_id: int | str) -> Organization | None:
    return resolve_record(session, Organization, organization_id)


def create_organization(session: Session, organization_in: OrganizationCreate) -> Organization:
    # Normalize contact fields
    normalized_data = normalize_contact_fields(organization_in.dict())
    organization_in = OrganizationCreate(**normalized_data)
    
    # Validate duplicate organization
    errors = validate_duplicate_organization(session, organization_in.product_id, organization_in.organization_name)
    if errors:
        raise ValueError("; ".join(errors))
    
    organization = Organization.from_orm(organization_in)
    assign_public_id(session, organization)
    session.add(organization)
    session.commit()
    session.refresh(organization)
    return organization


def update_organization(session: Session, organization: Organization, organization_in: OrganizationUpdate) -> Organization:
    # Normalize contact fields
    normalized_data = normalize_contact_fields(organization_in.dict(exclude_unset=True))
    
    # Validate duplicate organization if name is being changed
    if 'organization_name' in normalized_data:
        errors = validate_duplicate_organization(session, organization.product_id, normalized_data['organization_name'], organization.id)
        if errors:
            raise ValueError("; ".join(errors))
    
    for key, value in normalized_data.items():
        setattr(organization, key, value)
    session.add(organization)
    session.commit()
    session.refresh(organization)
    return organization


def delete_organization(session: Session, organization: Organization) -> None:
    session.delete(organization)
    session.commit()


# Contact CRUD operations
def get_contacts(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Contact]:
    statement = select(Contact).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_contact(session: Session, contact_id: int | str) -> Contact | None:
    return resolve_record(session, Contact, contact_id)


def create_contact(session: Session, contact_in: ContactCreate) -> Contact:
    # Normalize contact fields
    normalized_data = normalize_contact_fields(contact_in.dict())
    contact_in = ContactCreate(**normalized_data)
    
    # Validate duplicate contact
    errors = validate_duplicate_contact(session, contact_in.product_id, contact_in.email, contact_in.mobile_no)
    if errors:
        raise ValueError("; ".join(errors))
    
    contact = Contact.from_orm(contact_in)
    assign_public_id(session, contact)
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


def update_contact(session: Session, contact: Contact, contact_in: ContactUpdate) -> Contact:
    # Normalize contact fields
    normalized_data = normalize_contact_fields(contact_in.dict(exclude_unset=True))
    
    # Validate duplicate contact if email or mobile is being changed
    if 'email' in normalized_data or 'mobile_no' in normalized_data:
        email = normalized_data.get('email', contact.email)
        mobile_no = normalized_data.get('mobile_no', contact.mobile_no)
        errors = validate_duplicate_contact(session, contact.product_id, email, mobile_no, contact.id)
        if errors:
            raise ValueError("; ".join(errors))
    
    for key, value in normalized_data.items():
        setattr(contact, key, value)
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact


def delete_contact(session: Session, contact: Contact) -> None:
    session.delete(contact)
    session.commit()


# Deal CRUD operations
def get_deals(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Deal]:
    statement = select(Deal).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_deal(session: Session, deal_id: int | str) -> Deal | None:
    return resolve_record(session, Deal, deal_id)


def create_deal(session: Session, deal_in: DealCreate) -> Deal:
    # Validate business rules
    temp_deal = Deal.from_orm(deal_in)
    errors = validate_deal_business_rules(session, temp_deal)
    if errors:
        raise ValueError("; ".join(errors))
    
    # Apply automations
    apply_deal_probability(temp_deal)
    set_deal_won_date(temp_deal)
    assign_public_id(session, temp_deal)
    session.add(temp_deal)
    session.commit()
    session.refresh(temp_deal)
    return temp_deal


def update_deal(session: Session, deal: Deal, deal_in: DealUpdate) -> Deal:
    original_deal_value = deal.deal_value
    original_assigned_to = deal.assigned_to
    original_deal_status = deal.deal_status

    deal_data = deal_in.dict(exclude_unset=True)
    for key, value in deal_data.items():
        setattr(deal, key, value)

    if (original_deal_value or 0) != (deal.deal_value or 0) and not (deal.deal_value_change_reason or "").strip():
        raise ValueError("Deal value change reason is mandatory when deal value changes")

    errors = validate_deal_business_rules(session, deal)
    if errors:
        raise ValueError("; ".join(errors))

    apply_deal_probability(deal)
    set_deal_won_date(deal)

    session.add(deal)
    session.commit()
    session.refresh(deal)

    log_deal_key_changes(
        session,
        deal,
        assigned_from=original_assigned_to,
        assigned_to=deal.assigned_to,
        status_from=original_deal_status,
        status_to=deal.deal_status,
        value_from=original_deal_value,
        value_to=deal.deal_value,
    )
    session.refresh(deal)
    return deal


def delete_deal(session: Session, deal: Deal) -> None:
    session.delete(deal)
    session.commit()


# Task CRUD operations
def get_tasks(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Task]:
    statement = select(Task).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_task(session: Session, task_id: int | str) -> Task | None:
    return resolve_record(session, Task, task_id)


def create_task(session: Session, task_in: TaskCreate) -> Task:
    task = Task.from_orm(task_in)
    errors = validate_task_parent(session, task)
    if errors:
        raise ValueError("; ".join(errors))
    assign_public_id(session, task)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def update_task(session: Session, task: Task, task_in: TaskUpdate) -> Task:
    task_data = task_in.dict(exclude_unset=True)
    for key, value in task_data.items():
        setattr(task, key, value)
    errors = validate_task_parent(session, task)
    if errors:
        raise ValueError("; ".join(errors))
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def delete_task(session: Session, task: Task) -> None:
    session.delete(task)
    session.commit()


# Note CRUD operations
def get_notes(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Note]:
    statement = select(Note).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_note(session: Session, note_id: int | str) -> Note | None:
    return resolve_record(session, Note, note_id)


def create_note(session: Session, note_in: NoteCreate) -> Note:
    note = Note.from_orm(note_in)
    errors = validate_note_parent(note)
    if errors:
        raise ValueError("; ".join(errors))
    assign_public_id(session, note)
    apply_note_follow_up_date(note)
    session.add(note)
    session.commit()
    session.refresh(note)
    create_follow_up_task_from_note(session, note)
    session.refresh(note)
    return note


def update_note(session: Session, note: Note, note_in: NoteUpdate) -> Note:
    note_data = note_in.dict(exclude_unset=True)
    for key, value in note_data.items():
        setattr(note, key, value)
    errors = validate_note_parent(note)
    if errors:
        raise ValueError("; ".join(errors))
    apply_note_follow_up_date(note)
    session.add(note)
    session.commit()
    session.refresh(note)
    create_follow_up_task_from_note(session, note)
    session.refresh(note)
    return note


def delete_note(session: Session, note: Note) -> None:
    session.delete(note)
    session.commit()


# Activity CRUD operations
def get_activities(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Activity]:
    statement = select(Activity).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_activity(session: Session, activity_id: int | str) -> Activity | None:
    return resolve_record(session, Activity, activity_id)


def create_activity(session: Session, activity_in: ActivityCreate) -> Activity:
    activity = Activity.from_orm(activity_in)
    assign_public_id(session, activity)
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


def update_activity(session: Session, activity: Activity, activity_in: ActivityUpdate) -> Activity:
    activity_data = activity_in.dict(exclude_unset=True)
    for key, value in activity_data.items():
        setattr(activity, key, value)
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return activity


def delete_activity(session: Session, activity: Activity) -> None:
    session.delete(activity)
    session.commit()


# Expense CRUD operations
def get_expenses(session: Session, skip: int = 0, limit: int = 100) -> Iterable[Expense]:
    statement = select(Expense).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_expense(session: Session, expense_id: int | str) -> Expense | None:
    return resolve_record(session, Expense, expense_id)


def create_expense(session: Session, expense_in: ExpenseCreate, current_user: User) -> Expense:
    # Validate expense business rules
    temp_expense = Expense.from_orm(expense_in)
    errors = validate_expense_business_rules(temp_expense)
    if errors:
        raise ValueError("; ".join(errors))
    
    # Validate company expense admin only
    errors = validate_company_expense_admin_only(session, temp_expense, current_user)
    if errors:
        raise ValueError("; ".join(errors))
    
    # Validate expense scope requirements
    errors = validate_expense_scope_requirements(temp_expense)
    if errors:
        raise ValueError("; ".join(errors))

    assign_public_id(session, temp_expense)
    session.add(temp_expense)
    session.commit()
    session.refresh(temp_expense)
    
    # Recalculate deal financials if expense is linked to a deal
    if temp_expense.deal_id:
        recalculate_deal_financials(session, temp_expense.deal_id)
    
    return temp_expense


def update_expense(session: Session, expense: Expense, expense_in: ExpenseUpdate, current_user: User) -> Expense:
    expense_data = expense_in.dict(exclude_unset=True)
    
    # Apply updates to create temp expense for validation
    temp_expense = expense
    for key, value in expense_data.items():
        setattr(temp_expense, key, value)
    
    # Validate expense business rules
    errors = validate_expense_business_rules(temp_expense)
    if errors:
        raise ValueError("; ".join(errors))
    
    # Validate company expense admin only
    errors = validate_company_expense_admin_only(session, temp_expense, current_user)
    if errors:
        raise ValueError("; ".join(errors))
    
    # Validate expense scope requirements
    errors = validate_expense_scope_requirements(temp_expense)
    if errors:
        raise ValueError("; ".join(errors))
    
    # Apply the updates
    for key, value in expense_data.items():
        setattr(expense, key, value)
    session.add(expense)
    session.commit()
    session.refresh(expense)
    
    # Recalculate deal financials if expense is linked to a deal
    if expense.deal_id:
        recalculate_deal_financials(session, expense.deal_id)
    
    return expense


def delete_expense(session: Session, expense: Expense) -> None:
    session.delete(expense)
    session.commit()


# ClientPayment CRUD operations
def get_client_payments(session: Session, skip: int = 0, limit: int = 100) -> Iterable[ClientPayment]:
    statement = select(ClientPayment).offset(skip).limit(limit)
    results = session.exec(statement)
    return results.all()


def get_client_payment(session: Session, payment_id: int | str) -> ClientPayment | None:
    return resolve_record(session, ClientPayment, payment_id)


def create_client_payment(session: Session, payment_in: ClientPaymentCreate) -> ClientPayment:
    payment = ClientPayment.from_orm(payment_in)
    assign_public_id(session, payment)
    session.add(payment)
    session.commit()
    session.refresh(payment)
    
    # Recalculate deal financials if payment is linked to a deal
    if payment.deal_id:
        recalculate_deal_financials(session, payment.deal_id)
    
    return payment


def update_client_payment(session: Session, payment: ClientPayment, payment_in: ClientPaymentUpdate) -> ClientPayment:
    payment_data = payment_in.dict(exclude_unset=True)
    for key, value in payment_data.items():
        setattr(payment, key, value)
    session.add(payment)
    session.commit()
    session.refresh(payment)
    
    # Recalculate deal financials if payment is linked to a deal
    if payment.deal_id:
        recalculate_deal_financials(session, payment.deal_id)
    
    return payment


def delete_client_payment(session: Session, payment: ClientPayment) -> None:
    session.delete(payment)
    session.commit()


# Business logic validations and automations

def validate_product_access(session: Session, user_id: str, product_id: int) -> bool:
    """Check if user has access to the specified product."""
    statement = select(UserProductAccess).where(
        UserProductAccess.user_id == user_id,
        UserProductAccess.product_id == product_id
    )
    result = session.exec(statement).first()
    return result is not None


def validate_cross_product_links(session: Session, product_id: int, organization_id: int = None, contact_id: int = None, deal_id: int = None) -> bool:
    """Ensure all linked entities belong to the same product."""
    if organization_id:
        org = session.get(Organization, organization_id)
        if not org or org.product_id != product_id:
            return False
    
    if contact_id:
        contact = session.get(Contact, contact_id)
        if not contact or contact.product_id != product_id:
            return False
            
    if deal_id:
        deal = session.get(Deal, deal_id)
        if not deal or deal.product_id != product_id:
            return False
            
    return True


def validate_deal_business_rules(session: Session, deal: Deal) -> list[str]:
    """Validate deal business rules and return list of error messages."""
    errors = []

    if deal.lead_id:
        existing = session.exec(select(Deal).where(Deal.lead_id == deal.lead_id)).all()
        for other in existing:
            if other.id != deal.id:
                errors.append("A deal already exists for this lead")
                break

    if deal.deal_status == "Won" and deal.id:
        payment_statement = select(ClientPayment).where(ClientPayment.deal_id == deal.id)
        payments = session.exec(payment_statement).all()
        if not payments:
            errors.append("Won deals must have at least one client payment")

    if deal.deal_status == "Lost" and not deal.lost_reason:
        errors.append("Lost deals must have a lost reason")

    if not validate_cross_product_links(
        session, deal.product_id, deal.organization_id, deal.contact_id
    ):
        errors.append("All linked entities must belong to the same product")

    return errors


def validate_task_parent(session: Session, task: Task) -> list[str]:
    errors = []
    if not any([task.lead_id, task.deal_id, task.organization_id, task.contact_id]):
        errors.append("Task must be linked to a lead, deal, organization, or contact")
    if task.deal_id:
        deal = session.get(Deal, task.deal_id)
        if not deal:
            errors.append("Linked deal not found")
        elif deal.product_id != task.product_id:
            errors.append("Task and deal must belong to the same product")
    if task.lead_id:
        lead = session.get(Lead, task.lead_id)
        if not lead:
            errors.append("Linked lead not found")
        elif lead.product_id != task.product_id:
            errors.append("Task and lead must belong to the same product")
    return errors


def validate_note_parent(note: Note) -> list[str]:
    if not any([note.lead_id, note.deal_id, note.organization_id, note.contact_id]):
        return ["Note must be linked to a lead, deal, organization, or contact"]
    return []


def log_deal_key_changes(
    session: Session,
    deal: Deal,
    *,
    assigned_from: str | None,
    assigned_to: str | None,
    status_from: str | None,
    status_to: str | None,
    value_from: float | None,
    value_to: float | None,
) -> None:
    messages: list[str] = []
    if assigned_from != assigned_to:
        messages.append(f"Assignee changed: {assigned_from or '-'} -> {assigned_to or '-'}")
    if status_from != status_to:
        messages.append(f"Status changed: {status_from or '-'} -> {status_to or '-'}")
    if (value_from or 0) != (value_to or 0):
        messages.append(f"Deal value changed: {value_from or 0} -> {value_to or 0}")

    reference_name = deal.name or str(deal.id)
    for message in messages:
        comment = Comment(
            content=message,
            reference_doctype="Deal",
            reference_name=reference_name,
            comment_type="Comment",
        )
        assign_public_id(session, comment)
        session.add(comment)
    if messages:
        session.commit()


def validate_lead_business_rules(lead: Lead) -> list[str]:
    """Validate lead business rules and return list of error messages."""
    errors = []

    if lead.status not in LEAD_STATUSES:
        errors.append(f"Lead status must be one of: {', '.join(sorted(LEAD_STATUSES))}")
    
    # Lost leads require a reason
    if lead.status == "Lost" and not lead.lost_reason:
        errors.append("Lost leads must have a lost reason")
    
    return errors


def validate_expense_business_rules(expense: Expense) -> list[str]:
    """Validate expense business rules and return list of error messages."""
    errors = []
    scope = (expense.expense_scope or "Deal").strip()
    if scope == "Deal" and expense.deal_id is None:
        errors.append("Deal-scoped expenses must be linked to a deal")
    return errors


# Permission validation functions
def validate_user_product_access(session: Session, user_id: str, product_id: int) -> bool:
    """Check if user has access to the specified product."""
    statement = select(UserProductAccess).where(
        UserProductAccess.user_id == user_id,
        UserProductAccess.product_id == product_id
    )
    result = session.exec(statement).first()
    return result is not None


def validate_record_access(session: Session, user: User, record, operation: str = "read") -> bool:
    """Validate if user has access to perform operation on record."""
    # Business Admins have full access
    if user.role == "Business Admin":
        return True
    
    # Check product access if record has product_id
    if hasattr(record, 'product_id') and record.product_id:
        if not validate_user_product_access(session, user.username, record.product_id):
            return False
    
    # For write operations, check ownership/assignee
    if operation in ["update", "delete"]:
        ownership_fields = ['assigned_to', 'created_by', 'comment_by']
        is_owner = False
        for field in ownership_fields:
            if hasattr(record, field) and getattr(record, field) == user.username:
                is_owner = True
                break
        if not is_owner:
            return False
    
    return True


def filter_records_by_user_access(session: Session, user: User, model_class, additional_filters=None):
    """Filter records based on user's access permissions."""
    query = select(model_class)
    
    # Business Admins see everything
    if user.role == "Business Admin":
        if additional_filters:
            for filter_condition in additional_filters:
                query = query.where(filter_condition)
        return session.exec(query).all()
    
    # Get user's accessible products
    product_access_statement = select(UserProductAccess.product_id).where(
        UserProductAccess.user_id == user.username
    )
    accessible_products = session.exec(product_access_statement).all()
    
    # Filter by accessible products if model has product_id
    if hasattr(model_class, 'product_id'):
        query = query.where(model_class.product_id.in_(accessible_products))
    
    # Apply additional filters
    if additional_filters:
        for filter_condition in additional_filters:
            query = query.where(filter_condition)
    
    return session.exec(query).all()


# Automation constants
DEAL_PROBABILITY_MAP = {
    "Qualification": 10,
    "Discovery": 20,
    "Demo / Making": 35,
    "Proposal / Quotation": 50,
    "Negotiation": 70,
    "Ready to Close": 90,
    "Won": 100,
    "Lost": 0,
}

FOLLOW_UP_PRESET_DAYS = {
    "Next Week": 7,
    "2 Weeks Later": 14,
}


# Automation functions
def apply_deal_probability(deal: Deal) -> None:
    """Apply probability based on deal status."""
    if deal.deal_status in DEAL_PROBABILITY_MAP:
        deal.probability = DEAL_PROBABILITY_MAP[deal.deal_status]


def set_deal_won_date(deal: Deal) -> None:
    """Set won date when deal status becomes Won."""
    if deal.deal_status == "Won" and not deal.won_date:
        from datetime import date
        deal.won_date = date.today()


def recalculate_deal_financials(session: Session, deal_id: int) -> None:
    """Recalculate financial totals for a deal."""
    # Get total expenses
    expense_stmt = select(func.sum(Expense.amount)).where(
        Expense.deal_id == deal_id,
        Expense.status != "Rejected"
    )
    total_expenses = session.exec(expense_stmt).first() or 0
    
    # Get total payments
    payment_stmt = select(func.sum(ClientPayment.amount)).where(
        ClientPayment.deal_id == deal_id,
        ClientPayment.status.in_(["Received", "Cleared"])
    )
    total_payments = session.exec(payment_stmt).first() or 0
    
    # Get deal value
    deal_stmt = select(Deal.deal_value).where(Deal.id == deal_id)
    deal_value = session.exec(deal_stmt).first() or 0
    
    # Calculate derived fields
    to_collect = float(deal_value) - float(total_payments)
    payment_summary = "Unpaid"
    if float(total_payments) > 0 and float(total_payments) < float(deal_value):
        payment_summary = "Partially Paid"
    elif float(total_payments) >= float(deal_value) and float(deal_value) > 0:
        payment_summary = "Fully Paid"
    
    # Update deal
    update_stmt = (
        update(Deal)
        .where(Deal.id == deal_id)
        .values(
            total_expenses=total_expenses,
            total_payments_received=total_payments,
            to_collect=to_collect,
            payment_summary_status=payment_summary
        )
    )
    session.exec(update_stmt)
    session.commit()


def apply_note_follow_up_date(note: Note) -> None:
    """Apply follow-up date based on preset."""
    if note.follow_up_date:
        return
    
    computed = _compute_follow_up_date(note.follow_up_when)
    if computed:
        note.follow_up_date = computed


def _compute_follow_up_date(preset: str = None):
    """Compute follow-up date from preset."""
    if not preset:
        return None
    
    from datetime import date, timedelta
    import calendar
    
    base = date.today()
    
    if preset in FOLLOW_UP_PRESET_DAYS:
        return base + timedelta(days=FOLLOW_UP_PRESET_DAYS[preset])
    elif preset == "1 Month Later":
        # Add one month
        year = base.year
        month = base.month + 1
        if month > 12:
            month = 1
            year += 1
        day = min(base.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    elif preset == "2 Months Later":
        # Add two months
        year = base.year
        month = base.month + 2
        if month > 12:
            month -= 12
            year += 1
        day = min(base.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    elif preset == "3 Months Later":
        # Add three months
        year = base.year
        month = base.month + 3
        if month > 12:
            month -= 12
            year += 1
        day = min(base.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)
    
    return None


def create_follow_up_task_from_note(session: Session, note: Note) -> None:
    """Create follow-up task from note if requested."""
    if not note.create_follow_up_task:
        return
    if note.follow_up_task:  # Already created
        return
    if not note.follow_up_date:
        return
    
    task_title = note.follow_up_task_title or f"Follow up: {note.title}"
    
    task = Task(
        title=task_title,
        product_id=note.product_id,
        assigned_to=note.assigned_to,
        lead_id=note.lead_id,
        deal_id=note.deal_id,
        organization_id=note.organization_id,
        contact_id=note.contact_id,
        due_date=note.follow_up_date,
        status="Open",
        priority="Medium",
    )
    assign_public_id(session, task)

    session.add(task)
    session.commit()
    session.refresh(task)

    note.follow_up_task = task.name or str(task.id)
    session.add(note)
    session.commit()


def normalize_contact_fields(contact_data: dict) -> dict:
    """Normalize email and phone fields for contacts, leads, and organizations."""
    normalized = contact_data.copy()
    
    # Normalize email fields
    for fieldname in ("email", "email_id"):
        if fieldname in normalized and normalized[fieldname]:
            normalized[fieldname] = str(normalized[fieldname]).strip().lower()
    
    # Normalize phone fields
    for fieldname in ("phone", "mobile_no"):
        if fieldname in normalized and normalized[fieldname]:
            value = re.sub(r"\s+", "", str(normalized[fieldname]))
            normalized[fieldname] = value
    
    return normalized


# Duplicate prevention validations
def validate_unique_user_product_access(session: Session, user_id: str, product_id: int, exclude_id: int = None) -> list[str]:
    """Prevent duplicate active User Product Access records."""
    errors = []
    
    query = select(UserProductAccess).where(
        UserProductAccess.user_id == user_id,
        UserProductAccess.product_id == product_id,
        UserProductAccess.is_active == True
    )
    
    if exclude_id:
        query = query.where(UserProductAccess.id != exclude_id)
    
    existing = session.exec(query).first()
    if existing:
        errors.append("An active User Product Access already exists for this user and product.")
    
    return errors


def validate_duplicate_organization(session: Session, product_id: int, organization_name: str, exclude_id: int = None) -> list[str]:
    """Prevent duplicate organizations with same name in same product."""
    errors = []
    
    query = select(Organization).where(
        Organization.product_id == product_id,
        Organization.organization_name == organization_name
    )
    
    if exclude_id:
        query = query.where(Organization.id != exclude_id)
    
    existing = session.exec(query).first()
    if existing:
        errors.append("Organization with same name already exists for this product.")
    
    return errors


def validate_duplicate_contact(session: Session, product_id: int, email: str = None, mobile_no: str = None, exclude_id: int = None) -> list[str]:
    """Prevent duplicate contacts by email or mobile number within a product."""
    errors = []
    
    if not email and not mobile_no:
        return errors
    
    query = select(Contact).where(Contact.product_id == product_id)
    
    if email:
        query = query.where(Contact.email == email)
    elif mobile_no:
        query = query.where(Contact.mobile_no == mobile_no)
    
    if exclude_id:
        query = query.where(Contact.id != exclude_id)
    
    existing = session.exec(query).first()
    if existing:
        errors.append("Contact with same email/mobile already exists for this product.")
    
    return errors


# Expense validations
def validate_company_expense_admin_only(session: Session, expense: Expense, current_user: User) -> list[str]:
    """Company scope expenses can only be created by Business Admin and cannot be linked to deals."""
    errors = []
    
    if expense.expense_scope == "Company":
        # Check if user is Business Admin (role-based check)
        if current_user.role != "Business Admin":
            errors.append("Only Business Admin can create Company scope expenses.")
        
        if expense.deal_id:
            errors.append("Company scope expense must not be linked to a Deal.")
    
    return errors


def validate_expense_scope_requirements(expense: Expense) -> list[str]:
    """Deal is mandatory when Expense Scope is Deal."""
    errors = []
    
    if expense.expense_scope == "Deal" and not expense.deal_id:
        errors.append("Deal is mandatory when Expense Scope is Deal.")
    
    return errors


# User security validations
def validate_business_admin_user_mutation(session: Session, target_user: User, current_user: User, requested_roles: list[str] = None) -> list[str]:
    """Business Admin cannot mutate protected accounts or assign privileged roles."""
    errors = []
    
    if current_user.role != "Business Admin":
        return errors
    
    # Protected accounts check
    protected_accounts = ["Administrator", "Guest"]  # Add more as needed
    if target_user.username in protected_accounts:
        errors.append(f"Business Admin cannot mutate protected account '{target_user.username}'.")
    
    # Privileged roles check
    privileged_roles = ["System Manager", "Administrator"]  # Add more as needed
    if requested_roles:
        requested_privileged = [role for role in requested_roles if role in privileged_roles]
        if requested_privileged:
            errors.append(f"Business Admin cannot assign privileged roles: {', '.join(requested_privileged)}")
    
    return errors


def validate_business_admin_role_assignment(session: Session, target_user: User, role: str, current_user: User) -> list[str]:
    """Business Admin cannot assign roles to protected accounts or privileged roles."""
    errors = []
    
    if current_user.role != "Business Admin":
        return errors
    
    # Protected accounts check
    protected_accounts = ["Administrator", "Guest"]  # Add more as needed
    if target_user.username in protected_accounts:
        errors.append(f"Business Admin cannot mutate roles for protected account '{target_user.username}'.")
    
    # Privileged roles check
    privileged_roles = ["System Manager", "Administrator"]  # Add more as needed
    if role in privileged_roles:
        errors.append(f"Business Admin cannot assign role '{role}'.")
    
    return errors
