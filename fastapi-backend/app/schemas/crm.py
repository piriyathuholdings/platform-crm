from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel

LeadStatus = Literal["New", "Contacted", "Qualified", "Proposal", "Converted", "Lost"]


class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    role: Optional[str] = "Business User"


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    is_active: bool


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProductBase(BaseModel):
    product_code: str
    product_name: str
    product_type: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True


class ProductCreate(ProductBase):
    pass


class ProductRead(ProductBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class UserProductAccessBase(BaseModel):
    user_id: str
    product_id: int
    role_in_product: Optional[str] = None
    is_active: Optional[bool] = True


class UserProductAccessCreate(UserProductAccessBase):
    pass


class UserProductAccessRead(UserProductAccessBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class UserProductAccessUpdate(BaseModel):
    role_in_product: Optional[str] = None


class OrganizationBase(BaseModel):
    organization_name: str
    product_id: int
    assigned_to: Optional[str] = None
    status: Optional[str] = "Active"
    industry: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationRead(OrganizationBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class OrganizationUpdate(BaseModel):
    organization_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class ContactBase(BaseModel):
    full_name: str
    product_id: int
    organization_id: Optional[int] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = "Active"
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    job_title: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactRead(ContactBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class ContactUpdate(BaseModel):
    full_name: Optional[str] = None
    organization_id: Optional[int] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    job_title: Optional[str] = None


class LeadBase(BaseModel):
    lead_name: str
    contact_name: Optional[str] = None
    product_id: int
    assigned_to: Optional[str] = None
    status: Optional[LeadStatus] = "New"
    source: Optional[str] = None
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    organization_id: Optional[int] = None
    converted: Optional[bool] = False
    lost_reason: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadRead(LeadBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class LeadUpdate(BaseModel):
    lead_name: Optional[str] = None
    contact_name: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[LeadStatus] = None
    source: Optional[str] = None
    email: Optional[str] = None
    mobile_no: Optional[str] = None
    organization_id: Optional[int] = None
    converted: Optional[bool] = None
    lost_reason: Optional[str] = None


class LeadConvertResponse(BaseModel):
    lead_id: str
    organization_id: str
    contact_id: str
    deal_id: str


class DealBase(BaseModel):
    deal_title: str
    product_id: int
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    deal_status: Optional[str] = "Open"
    probability: Optional[int] = 0
    deal_value: Optional[float] = 0.0
    total_expenses: Optional[float] = 0.0
    total_payments_received: Optional[float] = 0.0
    to_collect: Optional[float] = 0.0
    payment_summary_status: Optional[str] = "Pending"
    won_date: Optional[date] = None
    deal_value_change_reason: Optional[str] = None
    lost_reason: Optional[str] = None


class DealCreate(DealBase):
    pass


class DealRead(DealBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class DealUpdate(BaseModel):
    deal_title: Optional[str] = None
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    deal_status: Optional[str] = None
    probability: Optional[int] = None
    deal_value: Optional[float] = None
    total_expenses: Optional[float] = None
    total_payments_received: Optional[float] = None
    to_collect: Optional[float] = None
    payment_summary_status: Optional[str] = None
    won_date: Optional[date] = None
    deal_value_change_reason: Optional[str] = None
    lost_reason: Optional[str] = None


class TaskBase(BaseModel):
    title: str
    product_id: int
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[str] = "Open"
    priority: Optional[str] = "Medium"


class TaskCreate(TaskBase):
    pass


class TaskRead(TaskBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None
    product_id: int
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    follow_up_when: Optional[str] = None
    follow_up_date: Optional[date] = None
    create_follow_up_task: Optional[bool] = False
    follow_up_task_type: Optional[str] = None
    follow_up_task_title: Optional[str] = None
    follow_up_task_description: Optional[str] = None
    follow_up_task: Optional[str] = None


class NoteCreate(NoteBase):
    pass


class NoteRead(NoteBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    follow_up_when: Optional[str] = None
    follow_up_date: Optional[date] = None
    create_follow_up_task: Optional[bool] = None
    follow_up_task_type: Optional[str] = None
    follow_up_task_title: Optional[str] = None
    follow_up_task_description: Optional[str] = None
    follow_up_task: Optional[str] = None


class ActivityBase(BaseModel):
    activity_type: str
    product_id: int
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    activity_date: Optional[date] = None
    description: Optional[str] = None


class ActivityCreate(ActivityBase):
    pass


class ActivityRead(ActivityBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class ActivityUpdate(BaseModel):
    activity_type: Optional[str] = None
    assigned_to: Optional[str] = None
    lead_id: Optional[int] = None
    deal_id: Optional[int] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    activity_date: Optional[date] = None
    description: Optional[str] = None


class ExpenseBase(BaseModel):
    title: str
    product_id: int
    deal_id: int
    amount: float
    expense_date: Optional[date] = None
    description: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseRead(ExpenseBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class ExpenseUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    expense_date: Optional[date] = None
    description: Optional[str] = None


class ClientPaymentBase(BaseModel):
    deal_id: int
    amount: float
    status: Optional[str] = "Pending"
    received_date: Optional[date] = None


class ClientPaymentCreate(ClientPaymentBase):
    pass


class ClientPaymentRead(ClientPaymentBase):
    id: int
    name: str

    class Config:
        from_attributes = True


class ClientPaymentUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[str] = None
    received_date: Optional[date] = None
