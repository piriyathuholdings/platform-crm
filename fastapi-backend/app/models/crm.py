from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True)
    email: str = Field(unique=True)
    full_name: str
    hashed_password: str
    is_active: bool = Field(default=True)
    role: str = Field(default="Business User")  # Business Admin or Business User
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    product_code: str
    product_name: str
    product_type: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserProductAccess(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    user_id: str
    product_id: int = Field(foreign_key="product.id")
    role_in_product: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Organization(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    organization_name: str
    product_id: int = Field(foreign_key="product.id")
    assigned_to: Optional[str] = None
    contact_id: Optional[int] = Field(default=None, foreign_key="contact.id")
    status: str = Field(default="Active")
    industry: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Contact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)  # Naming series: CONT-00001
    full_name: str
    product_id: int = Field(foreign_key="product.id")
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    assigned_to: Optional[str] = None
    status: str = Field(default="Active")
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    job_title: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Lead(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    lead_name: str
    contact_name: Optional[str] = None
    product_id: int = Field(foreign_key="product.id")
    assigned_to: Optional[str] = None
    status: str = Field(default="New")
    source: Optional[str] = None
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    contact_id: Optional[int] = Field(default=None, foreign_key="contact.id")
    converted: bool = Field(default=False)
    lost_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Deal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    deal_title: str
    product_id: int = Field(foreign_key="product.id")
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id")
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    contact_id: Optional[int] = Field(default=None, foreign_key="contact.id")
    deal_status: str = Field(default="Open")
    probability: int = Field(default=0)
    deal_value: float = Field(default=0.0)
    total_expenses: float = Field(default=0.0)
    total_payments_received: float = Field(default=0.0)
    to_collect: float = Field(default=0.0)
    payment_summary_status: str = Field(default="Pending")
    won_date: Optional[date] = None
    deal_value_change_reason: Optional[str] = None
    lost_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    title: str
    product_id: int = Field(foreign_key="product.id")
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id")
    deal_id: Optional[int] = Field(default=None, foreign_key="deal.id")
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    contact_id: Optional[int] = Field(default=None, foreign_key="contact.id")
    due_date: Optional[date] = None
    status: str = Field(default="Open")
    priority: str = Field(default="Medium")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)  # Naming series: NOTE-00001
    title: str
    content: Optional[str] = None  # note_content from custom fields
    product_id: int = Field(foreign_key="product.id")
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id")
    deal_id: Optional[int] = Field(default=None, foreign_key="deal.id")
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    contact_id: Optional[int] = Field(default=None, foreign_key="contact.id")
    follow_up_when: Optional[str] = None
    follow_up_date: Optional[date] = None
    create_follow_up_task: bool = Field(default=False)
    follow_up_task_type: Optional[str] = None
    follow_up_task_title: Optional[str] = None
    follow_up_task_description: Optional[str] = None
    follow_up_task: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Activity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    activity_type: str
    description: str
    product_id: int = Field(foreign_key="product.id")
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id")
    deal_id: Optional[int] = Field(default=None, foreign_key="deal.id")
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id")
    contact_id: Optional[int] = Field(default=None, foreign_key="contact.id")
    activity_date: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    expense_title: str
    expense_scope: str = Field(default="Deal")  # Deal or Company
    assigned_to: Optional[str] = None
    borne_by: str = Field(default="Company")  # Company or Customer
    expense_date: date
    amount: float
    deal_id: Optional[int] = Field(default=None, foreign_key="deal.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ClientPayment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    deal_id: int = Field(foreign_key="deal.id")
    amount: float
    status: str = Field(default="Pending")
    received_date: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, unique=True, index=True)
    content: str
    comment_type: str = Field(default="Comment")
    reference_doctype: str
    reference_name: str
    comment_by: Optional[str] = None
    comment_email: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

