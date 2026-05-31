from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.auth import get_current_active_user, require_product_access, require_record_access
from app.db import get_session
from app.models.crm import (
    Activity,
    ClientPayment,
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
from app.schemas.crm import (
    ActivityCreate,
    ActivityRead,
    ActivityUpdate,
    ClientPaymentCreate,
    ClientPaymentRead,
    ClientPaymentUpdate,
    ContactCreate,
    ContactRead,
    ContactUpdate,
    DealCreate,
    DealRead,
    DealUpdate,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    LeadCreate,
    LeadConvertResponse,
    LeadRead,
    LeadUpdate,
    NoteCreate,
    NoteRead,
    NoteUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    UserProductAccessCreate,
    UserProductAccessRead,
    UserProductAccessUpdate,
)
from app.services.crm import (
    create_activity,
    create_client_payment,
    create_contact,
    create_deal,
    create_expense,
    create_lead,
    create_note,
    create_organization,
    create_product,
    create_task,
    create_user_product_access,
    delete_activity,
    delete_client_payment,
    delete_contact,
    delete_deal,
    delete_expense,
    delete_lead,
    delete_note,
    delete_organization,
    delete_product,
    delete_task,
    delete_user_product_access,
    filter_records_by_user_access,
    get_activities,
    get_activity,
    get_client_payment,
    get_client_payments,
    get_contact,
    get_contacts,
    get_deal,
    get_deals,
    get_expense,
    get_expenses,
    get_lead,
    get_leads,
    get_note,
    get_notes,
    get_organization,
    get_organizations,
    get_product,
    get_products,
    get_task,
    get_tasks,
    get_user_product_access,
    get_user_product_accesses,
    update_activity,
    update_client_payment,
    update_contact,
    update_deal,
    update_expense,
    update_lead,
    convert_lead,
    update_note,
    update_organization,
    update_product,
    update_task,
    update_user_product_access,
    validate_record_access,
)

router = APIRouter()


@router.get("/leads", response_model=list[LeadRead])
def list_leads(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Lead]:
    return filter_records_by_user_access(session, current_user, Lead)


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_new_lead(*, session: Session = Depends(get_session), lead_in: LeadCreate, current_user: User = Depends(get_current_active_user)):
    try:
        return create_lead(session, lead_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/leads/{lead_id}", response_model=LeadRead)
def read_lead(*, lead_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> Lead:
    lead = get_lead(session, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if not validate_record_access(session, current_user, lead, "read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return lead


@router.put("/leads/{lead_id}", response_model=LeadRead)
def update_existing_lead(*, lead_id: str, session: Session = Depends(get_session), lead_in: LeadUpdate, current_user: User = Depends(get_current_active_user)):
    lead = get_lead(session, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if not validate_record_access(session, current_user, lead, "update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    try:
        return update_lead(session, lead, lead_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_lead(*, lead_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> None:
    lead = get_lead(session, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if not validate_record_access(session, current_user, lead, "delete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    delete_lead(session, lead)


@router.post("/leads/{lead_id}/convert", response_model=LeadConvertResponse)
def convert_existing_lead(*, lead_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)):
    lead = get_lead(session, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if not validate_record_access(session, current_user, lead, "update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    try:
        _, organization, contact, deal = convert_lead(session, lead)
        return LeadConvertResponse(
            lead_id=lead.name or str(lead.id),
            organization_id=organization.name or str(organization.id),
            contact_id=contact.name or str(contact.id),
            deal_id=deal.name or str(deal.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Product endpoints
@router.get("/products", response_model=list[ProductRead])
def list_products(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Product]:
    return filter_records_by_user_access(session, current_user, Product)


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_new_product(*, session: Session = Depends(get_session), product_in: ProductCreate, current_user: User = Depends(get_current_active_user)):
    return create_product(session, product_in)


@router.get("/products/{product_id}", response_model=ProductRead)
def read_product(*, product_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> Product:
    product = get_product(session, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not validate_record_access(session, current_user, product, "read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return product


@router.put("/products/{product_id}", response_model=ProductRead)
def update_existing_product(*, product_id: str, session: Session = Depends(get_session), product_in: ProductUpdate, current_user: User = Depends(get_current_active_user)):
    product = get_product(session, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not validate_record_access(session, current_user, product, "update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return update_product(session, product, product_in)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_product(*, product_id: str, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> None:
    product = get_product(session, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if not validate_record_access(session, current_user, product, "delete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    delete_product(session, product)


# UserProductAccess endpoints
@router.get("/user-product-access", response_model=list[UserProductAccessRead])
def list_user_product_accesses(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[UserProductAccess]:
    return filter_records_by_user_access(session, current_user, UserProductAccess)


@router.post("/user-product-access", response_model=UserProductAccessRead, status_code=status.HTTP_201_CREATED)
def create_new_user_product_access(*, session: Session = Depends(get_session), access_in: UserProductAccessCreate, current_user: User = Depends(get_current_active_user)):
    try:
        return create_user_product_access(session, access_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/user-product-access/{access_id}", response_model=UserProductAccessRead)
def read_user_product_access(*, access_id: str, session: Session = Depends(get_session)) -> UserProductAccess:
    access = get_user_product_access(session, access_id)
    if not access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User product access not found")
    return access


@router.put("/user-product-access/{access_id}", response_model=UserProductAccessRead)
def update_existing_user_product_access(*, access_id: str, session: Session = Depends(get_session), access_in: UserProductAccessUpdate):
    access = get_user_product_access(session, access_id)
    if not access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User product access not found")
    return update_user_product_access(session, access, access_in)


@router.delete("/user-product-access/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_user_product_access(*, access_id: str, session: Session = Depends(get_session)) -> None:
    access = get_user_product_access(session, access_id)
    if not access:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User product access not found")
    delete_user_product_access(session, access)


# Organization endpoints
@router.get("/organizations", response_model=list[OrganizationRead])
def list_organizations(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Organization]:
    return filter_records_by_user_access(session, current_user, Organization)


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_new_organization(*, session: Session = Depends(get_session), organization_in: OrganizationCreate, current_user: User = Depends(get_current_active_user)):
    try:
        return create_organization(session, organization_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/organizations/{organization_id}", response_model=OrganizationRead)
def read_organization(*, organization_id: str, session: Session = Depends(get_session)) -> Organization:
    organization = get_organization(session, organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return organization


@router.put("/organizations/{organization_id}", response_model=OrganizationRead)
def update_existing_organization(*, organization_id: str, session: Session = Depends(get_session), organization_in: OrganizationUpdate):
    organization = get_organization(session, organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    try:
        return update_organization(session, organization, organization_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/organizations/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_organization(*, organization_id: str, session: Session = Depends(get_session)) -> None:
    organization = get_organization(session, organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    delete_organization(session, organization)


# Contact endpoints
@router.get("/contacts", response_model=list[ContactRead])
def list_contacts(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Contact]:
    return filter_records_by_user_access(session, current_user, Contact)


@router.post("/contacts", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def create_new_contact(*, session: Session = Depends(get_session), contact_in: ContactCreate, current_user: User = Depends(get_current_active_user)):
    try:
        return create_contact(session, contact_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/contacts/{contact_id}", response_model=ContactRead)
def read_contact(*, contact_id: str, session: Session = Depends(get_session)) -> Contact:
    contact = get_contact(session, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.put("/contacts/{contact_id}", response_model=ContactRead)
def update_existing_contact(*, contact_id: str, session: Session = Depends(get_session), contact_in: ContactUpdate):
    contact = get_contact(session, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    try:
        return update_contact(session, contact, contact_in)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(*, contact_id: str, session: Session = Depends(get_session)) -> None:
    contact = get_contact(session, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    delete_contact(session, contact)


# Deal endpoints
@router.get("/deals", response_model=list[DealRead])
def list_deals(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Deal]:
    return filter_records_by_user_access(session, current_user, Deal)


@router.post("/deals", response_model=DealRead, status_code=status.HTTP_201_CREATED)
def create_new_deal(*, session: Session = Depends(get_session), deal_in: DealCreate, current_user: User = Depends(get_current_active_user)):
    return create_deal(session, deal_in)


@router.get("/deals/{deal_id}", response_model=DealRead)
def read_deal(*, deal_id: str, session: Session = Depends(get_session)) -> Deal:
    deal = get_deal(session, deal_id)
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return deal


@router.put("/deals/{deal_id}", response_model=DealRead)
def update_existing_deal(*, deal_id: str, session: Session = Depends(get_session), deal_in: DealUpdate):
    deal = get_deal(session, deal_id)
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return update_deal(session, deal, deal_in)


@router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_deal(*, deal_id: str, session: Session = Depends(get_session)) -> None:
    deal = get_deal(session, deal_id)
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    delete_deal(session, deal)


# Task endpoints
@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Task]:
    return filter_records_by_user_access(session, current_user, Task)


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_new_task(*, session: Session = Depends(get_session), task_in: TaskCreate, current_user: User = Depends(get_current_active_user)):
    return create_task(session, task_in)


@router.get("/tasks/{task_id}", response_model=TaskRead)
def read_task(*, task_id: str, session: Session = Depends(get_session)) -> Task:
    task = get_task(session, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.put("/tasks/{task_id}", response_model=TaskRead)
def update_existing_task(*, task_id: str, session: Session = Depends(get_session), task_in: TaskUpdate):
    task = get_task(session, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return update_task(session, task, task_in)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_task(*, task_id: str, session: Session = Depends(get_session)) -> None:
    task = get_task(session, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    delete_task(session, task)


# Note endpoints
@router.get("/notes", response_model=list[NoteRead])
def list_notes(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Note]:
    return filter_records_by_user_access(session, current_user, Note)


@router.post("/notes", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_new_note(*, session: Session = Depends(get_session), note_in: NoteCreate, current_user: User = Depends(get_current_active_user)):
    return create_note(session, note_in)


@router.get("/notes/{note_id}", response_model=NoteRead)
def read_note(*, note_id: str, session: Session = Depends(get_session)) -> Note:
    note = get_note(session, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.put("/notes/{note_id}", response_model=NoteRead)
def update_existing_note(*, note_id: str, session: Session = Depends(get_session), note_in: NoteUpdate):
    note = get_note(session, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return update_note(session, note, note_in)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_note(*, note_id: str, session: Session = Depends(get_session)) -> None:
    note = get_note(session, note_id)
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    delete_note(session, note)


# Activity endpoints
@router.get("/activities", response_model=list[ActivityRead])
def list_activities(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Activity]:
    return filter_records_by_user_access(session, current_user, Activity)


@router.post("/activities", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
def create_new_activity(*, session: Session = Depends(get_session), activity_in: ActivityCreate, current_user: User = Depends(get_current_active_user)):
    return create_activity(session, activity_in)


@router.get("/activities/{activity_id}", response_model=ActivityRead)
def read_activity(*, activity_id: str, session: Session = Depends(get_session)) -> Activity:
    activity = get_activity(session, activity_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return activity


@router.put("/activities/{activity_id}", response_model=ActivityRead)
def update_existing_activity(*, activity_id: str, session: Session = Depends(get_session), activity_in: ActivityUpdate):
    activity = get_activity(session, activity_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return update_activity(session, activity, activity_in)


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_activity(*, activity_id: str, session: Session = Depends(get_session)) -> None:
    activity = get_activity(session, activity_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    delete_activity(session, activity)


# Expense endpoints
@router.get("/expenses", response_model=list[ExpenseRead])
def list_expenses(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[Expense]:
    return filter_records_by_user_access(session, current_user, Expense)


@router.post("/expenses", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_new_expense(*, session: Session = Depends(get_session), expense_in: ExpenseCreate, current_user: User = Depends(get_current_active_user)):
    try:
        return create_expense(session, expense_in, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/expenses/{expense_id}", response_model=ExpenseRead)
def read_expense(*, expense_id: str, session: Session = Depends(get_session)) -> Expense:
    expense = get_expense(session, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


@router.put("/expenses/{expense_id}", response_model=ExpenseRead)
def update_existing_expense(*, expense_id: str, session: Session = Depends(get_session), expense_in: ExpenseUpdate, current_user: User = Depends(get_current_active_user)):
    expense = get_expense(session, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    try:
        return update_expense(session, expense, expense_in, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_expense(*, expense_id: str, session: Session = Depends(get_session)) -> None:
    expense = get_expense(session, expense_id)
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    delete_expense(session, expense)


# ClientPayment endpoints
@router.get("/client-payments", response_model=list[ClientPaymentRead])
def list_client_payments(*, session: Session = Depends(get_session), current_user: User = Depends(get_current_active_user)) -> list[ClientPayment]:
    return filter_records_by_user_access(session, current_user, ClientPayment)


@router.post("/client-payments", response_model=ClientPaymentRead, status_code=status.HTTP_201_CREATED)
def create_new_client_payment(*, session: Session = Depends(get_session), payment_in: ClientPaymentCreate, current_user: User = Depends(get_current_active_user)):
    return create_client_payment(session, payment_in)


@router.get("/client-payments/{payment_id}", response_model=ClientPaymentRead)
def read_client_payment(*, payment_id: str, session: Session = Depends(get_session)) -> ClientPayment:
    payment = get_client_payment(session, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client payment not found")
    return payment


@router.put("/client-payments/{payment_id}", response_model=ClientPaymentRead)
def update_existing_client_payment(*, payment_id: str, session: Session = Depends(get_session), payment_in: ClientPaymentUpdate):
    payment = get_client_payment(session, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client payment not found")
    return update_client_payment(session, payment, payment_in)


@router.delete("/client-payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_client_payment(*, payment_id: str, session: Session = Depends(get_session)) -> None:
    payment = get_client_payment(session, payment_id)
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client payment not found")
    delete_client_payment(session, payment)
