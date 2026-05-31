from datetime import datetime
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import and_, select
from sqlmodel import Session

from app import auth
from app.auth import create_access_token, decode_access_token, verify_password
from app.db import get_session
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
from app.services.crm import (
    DEAL_PROBABILITY_MAP,
    create_deal,
    create_note,
    create_task,
    filter_records_by_user_access,
    update_deal,
    update_note,
    update_task,
    validate_record_access,
)
from app.schemas.crm import DealCreate, DealUpdate, NoteCreate, NoteUpdate, TaskCreate, TaskUpdate
from app.services.naming import assign_public_id
from app.services.resolve import format_record_for_api, resolve_record as resolve_entity

router = APIRouter(prefix="/api")

ACCESS_COOKIE_NAME = "crm_access_token"
TOKEN_EXPIRE_MINUTES = 60

FIELD_MAP = {
    "user": "user_id",
    "deal": "deal_id",
    "organization": "organization_id",
    "lead": "lead_id",
    "contact": "contact_id",
    "contact_name": "contact_id",
    "product": "product_id",
    "note_content": "content",
    "enabled": "is_active",
}

DOCTYPE_MODEL_MAP = {
    "Product": Product,
    "User": User,
    "User Product Access": UserProductAccess,
    "Organization": Organization,
    "Contact": Contact,
    "Lead": Lead,
    "Deal": Deal,
    "Task": Task,
    "Note": Note,
    "Activity": Activity,
    "Expense": Expense,
    "Client Payment": ClientPayment,
    "Comment": Comment,
}

DOCTYPE_TO_ENDPOINT = {
    "Product": "products",
    "User": "users",
    "User Product Access": "user-product-access",
    "Organization": "organizations",
    "Contact": "contacts",
    "Lead": "leads",
    "Deal": "deals",
    "Task": "tasks",
    "Note": "notes",
    "Activity": "activities",
    "Expense": "expenses",
    "Client Payment": "client-payments",
}

META_FIELD_MAP: Dict[str, List[Dict[str, Any]]] = {
    "Product": [
        {"fieldname": "product_code", "label": "Product Code", "fieldtype": "Data"},
        {"fieldname": "product_name", "label": "Product Name", "fieldtype": "Data"},
        {"fieldname": "product_type", "label": "Product Type", "fieldtype": "Select", "options": "Standard\nCustom"},
        {"fieldname": "description", "label": "Description", "fieldtype": "Text"},
        {"fieldname": "is_active", "label": "Is Active", "fieldtype": "Check"},
    ],
    "User": [
        {"fieldname": "username", "label": "Username", "fieldtype": "Data"},
        {"fieldname": "email", "label": "Email", "fieldtype": "Data"},
        {"fieldname": "full_name", "label": "Full Name", "fieldtype": "Data"},
        {"fieldname": "role", "label": "Role", "fieldtype": "Select", "options": "Business Admin\nBusiness User"},
        {"fieldname": "is_active", "label": "Active", "fieldtype": "Check"},
    ],
    "Lead": [
        {"fieldname": "lead_name", "label": "Lead Name", "fieldtype": "Data"},
        {"fieldname": "product", "label": "Product", "fieldtype": "Link", "options": "Product"},
        {"fieldname": "assigned_to", "label": "Assigned To", "fieldtype": "Data"},
        {"fieldname": "contact_name", "label": "Contact Name", "fieldtype": "Data"},
        {
            "fieldname": "status",
            "label": "Status",
            "fieldtype": "Select",
            "options": "Open\nIn Progress\nInterested\nQualified\nLost\nConverted",
        },
        {"fieldname": "email", "label": "Email", "fieldtype": "Data"},
        {"fieldname": "mobile_no", "label": "Mobile", "fieldtype": "Data"},
    ],
    "Deal": [
        {"fieldname": "deal_title", "label": "Deal Title", "fieldtype": "Data"},
        {"fieldname": "product", "label": "Product", "fieldtype": "Link", "options": "Product"},
        {"fieldname": "assigned_to", "label": "Assigned To", "fieldtype": "Data"},
        {"fieldname": "deal_status", "label": "Status", "fieldtype": "Select", "options": "\n".join(DEAL_PROBABILITY_MAP.keys())},
        {"fieldname": "deal_value", "label": "Value", "fieldtype": "Currency"},
        {"fieldname": "lead", "label": "Source Lead", "fieldtype": "Link", "options": "Lead"},
        {"fieldname": "organization", "label": "Organization", "fieldtype": "Link", "options": "Organization"},
        {"fieldname": "contact", "label": "Contact", "fieldtype": "Link", "options": "Contact"},
    ],
    "Contact": [
        {"fieldname": "full_name", "label": "Full Name", "fieldtype": "Data"},
        {"fieldname": "product", "label": "Product", "fieldtype": "Link", "options": "Product"},
        {"fieldname": "organization_id", "label": "Organization", "fieldtype": "Link", "options": "Organization"},
        {"fieldname": "email", "label": "Email", "fieldtype": "Data"},
        {"fieldname": "mobile_no", "label": "Mobile", "fieldtype": "Data"},
    ],
    "Organization": [
        {"fieldname": "organization_name", "label": "Organization Name", "fieldtype": "Data"},
        {"fieldname": "product", "label": "Product", "fieldtype": "Link", "options": "Product"},
        {"fieldname": "assigned_to", "label": "Assigned To", "fieldtype": "Data"},
        {"fieldname": "contact_name", "label": "Contact Name", "fieldtype": "Link", "options": "Contact"},
        {"fieldname": "email", "label": "Email", "fieldtype": "Data"},
        {"fieldname": "phone", "label": "Phone", "fieldtype": "Data"},
    ],
    "Task": [
        {"fieldname": "title", "label": "Title", "fieldtype": "Data"},
        {"fieldname": "product", "label": "Product", "fieldtype": "Link", "options": "Product"},
        {"fieldname": "assigned_to", "label": "Assigned To", "fieldtype": "Data"},
        {"fieldname": "lead", "label": "Lead", "fieldtype": "Link", "options": "Lead"},
        {"fieldname": "deal", "label": "Deal", "fieldtype": "Link", "options": "Deal"},
        {"fieldname": "organization", "label": "Organization", "fieldtype": "Link", "options": "Organization"},
        {"fieldname": "contact", "label": "Contact", "fieldtype": "Link", "options": "Contact"},
        {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "Open\nCompleted\nOverdue"},
        {"fieldname": "priority", "label": "Priority", "fieldtype": "Select", "options": "Low\nMedium\nHigh"},
    ],
    "Note": [
        {"fieldname": "title", "label": "Title", "fieldtype": "Data"},
        {"fieldname": "content", "label": "Content", "fieldtype": "Text"},
        {"fieldname": "product_id", "label": "Product", "fieldtype": "Link", "options": "Product"},
        {"fieldname": "assigned_to", "label": "Assigned To", "fieldtype": "Data"},
        {"fieldname": "follow_up_date", "label": "Follow Up Date", "fieldtype": "Date"},
    ],
    "Expense": [
        {"fieldname": "expense_title", "label": "Title", "fieldtype": "Data"},
        {"fieldname": "expense_scope", "label": "Scope", "fieldtype": "Select", "options": "Deal\nCompany"},
        {"fieldname": "amount", "label": "Amount", "fieldtype": "Currency"},
        {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "Pending\nApproved\nRejected"},
    ],
    "Client Payment": [
        {"fieldname": "payment_type", "label": "Payment Type", "fieldtype": "Select", "options": "Cash\nBank Transfer\nCredit"},
        {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "Pending\nReceived\nFailed"},
        {"fieldname": "amount", "label": "Amount", "fieldtype": "Currency"},
    ],
    "Activity": [
        {"fieldname": "subject", "label": "Subject", "fieldtype": "Data"},
        {"fieldname": "activity_type", "label": "Activity Type", "fieldtype": "Select", "options": "Call\nMeeting\nEmail"},
        {"fieldname": "status", "label": "Status", "fieldtype": "Select", "options": "Planned\nCompleted\nCancelled"},
        {"fieldname": "activity_date", "label": "Activity Date", "fieldtype": "Date"},
    ],
    "Comment": [
        {"fieldname": "content", "label": "Content", "fieldtype": "Small Text"},
        {"fieldname": "comment_by", "label": "Comment By", "fieldtype": "Data"},
        {"fieldname": "comment_email", "label": "Comment Email", "fieldtype": "Data"},
        {"fieldname": "reference_doctype", "label": "Ref Doctype", "fieldtype": "Data"},
        {"fieldname": "reference_name", "label": "Ref Name", "fieldtype": "Data"},
        {"fieldname": "creation", "label": "Creation", "fieldtype": "Datetime"},
    ],
}


def envelope(data: Any) -> Dict[str, Any]:
    return {"data": data, "error": None, "meta": {}}


def error_envelope(message: str, code: str = "API_ERROR") -> Dict[str, Any]:
    return {"data": None, "error": {"code": code, "message": message}, "meta": {}}


def get_token_from_request(request: Request) -> Optional[str]:
    authorization = request.headers.get("Authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1]
    return request.cookies.get(ACCESS_COOKIE_NAME)


def get_current_user(request: Request, session: Session = Depends(get_session)) -> User:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = session.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return user


def format_record(record: Any, session: Session | None = None) -> Dict[str, Any]:
    return format_record_for_api(record, session=session)


def map_frappe_payload(payload: Dict[str, Any], session: Session, doctype: Optional[str] = None) -> Dict[str, Any]:
    mapped = {}
    for key, value in payload.items():
        if key == "contact_name" and doctype == "Lead":
            model_field = "contact_name"
        elif key == "contact_name" and doctype == "Organization":
            model_field = "contact_id"
        else:
            model_field = FIELD_MAP.get(key, key)
        # Type conversion for ID fields
        if model_field.endswith("_id") or model_field == "id":
            if isinstance(value, str) and value:
                if value.isdigit():
                    value = int(value)
                else:
                    # Attempt to resolve naming series to ID
                    target_model = None
                    if "contact" in model_field:
                        target_model = Contact
                    elif "organization" in model_field:
                        target_model = Organization
                    elif "lead" in model_field:
                        target_model = Lead
                    elif "deal" in model_field:
                        target_model = Deal
                    elif "product" in model_field:
                        target_model = Product
                    elif "user" in model_field:
                        target_model = User
                        
                    if target_model:
                        record = resolve_entity(session, target_model, value)
                        if record:
                            if target_model is User:
                                value = record.username
                            else:
                                value = record.id
                        elif model_field == "user_id":
                            # Keep assignee email/username even when User row is missing locally.
                            pass
                        else:
                            value = None
                    else:
                        # If it's a string but not a digit, and we couldn't identify a target model, set to None
                        value = None
                                
        mapped[model_field] = value
    return mapped


FIELD_RESOLVE_MODEL_MAP = {
    "lead_id": Lead,
    "deal_id": Deal,
    "organization_id": Organization,
    "contact_id": Contact,
    "product_id": Product,
}


def resolve_filter_value(session: Session, field: str, value: Any) -> Any:
    if field in FIELD_RESOLVE_MODEL_MAP and isinstance(value, str) and value.strip():
        if value.isdigit():
            return int(value)
        record = resolve_entity(session, FIELD_RESOLVE_MODEL_MAP[field], value)
        if record:
            return record.id
        return value
    if isinstance(value, str):
        return parse_identifier(value)
    if isinstance(value, list):
        return [resolve_filter_value(session, field, item) if isinstance(item, str) else item for item in value]
def parse_identifier(value: str) -> Any:
    if value.isdigit():
        return int(value)
    return value


def parse_filter_conditions(model, filters: Optional[str], session: Session | None = None) -> List[Any]:
    if not filters:
        return []
    try:
        parsed = json.loads(filters)
    except Exception:
        return []
    conditions = []
    for condition in parsed:
        if not isinstance(condition, list) or len(condition) != 3:
            continue
        field, operator, value = condition

        field = FIELD_MAP.get(field, field)

        if not hasattr(model, field):
            continue

        if session is not None:
            value = resolve_filter_value(session, field, value)
        elif isinstance(value, str):
            value = parse_identifier(value)
        elif isinstance(value, list):
            value = [parse_identifier(v) if isinstance(v, str) else v for v in value]

        column = getattr(model, field)
        if operator in ("=", "=="):
            conditions.append(column == value)
        elif operator in ("!=", "<>"):
            conditions.append(column != value)
        elif operator == "in":
            conditions.append(column.in_(value if isinstance(value, list) else [value]))
        elif operator == "like":
            conditions.append(column.like(str(value)))
        elif operator == ">":
            conditions.append(column > value)
        elif operator == "<":
            conditions.append(column < value)
        elif operator == ">=":
            conditions.append(column >= value)
        elif operator == "<=":
            conditions.append(column <= value)
    return conditions


def get_model_for_doctype(doctype: str):
    return DOCTYPE_MODEL_MAP.get(doctype)


@router.post("/method/login")
async def frappe_compatible_login(request: Request, session: Session = Depends(get_session)):
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/x-www-form-urlencoded"):
        form = await request.form()
        username = str(form.get("usr") or form.get("username") or "").strip()
        password = str(form.get("pwd") or form.get("password") or "").strip()
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        username = str(body.get("usr") or body.get("username") or body.get("email") or "").strip()
        password = str(body.get("pwd") or body.get("password") or "").strip()

    if not username or not password:
        return JSONResponse({"message": "Missing credentials"}, status_code=status.HTTP_400_BAD_REQUEST)

    user = session.query(User).filter((User.username == username) | (User.email == username)).first()
    if not user or not verify_password(password, user.hashed_password):
        return JSONResponse({"message": "Invalid credentials"}, status_code=status.HTTP_401_UNAUTHORIZED)

    token = create_access_token({"sub": user.username, "role": user.role}, expires_delta=None)
    response = JSONResponse({"full_name": user.full_name, "email": user.email})
    response.set_cookie(ACCESS_COOKIE_NAME, token, httponly=True, samesite="lax")
    return response


@router.get("/method/logout")
async def frappe_compatible_logout() -> JSONResponse:
    response = JSONResponse({"message": "Logged out"})
    response.delete_cookie(ACCESS_COOKIE_NAME)
    return response


@router.get("/method/frappe.auth.get_logged_user")
async def frappe_get_logged_user(user: User = Depends(get_current_user)) -> Dict[str, str]:
    return {"message": user.email}


@router.get("/method/frappe.core.doctype.user.user.get_roles")
async def frappe_get_user_roles(
    uid: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, List[str]]:
    target_key = (uid or user.email or user.username or "").strip()
    if not target_key:
        return {"message": []}
    target = session.query(User).filter(
        (User.username == target_key) | (User.email == target_key)
    ).first()
    if not target and target_key.isdigit():
        target = session.get(User, int(target_key))
    if not target:
        return {"message": []}
    return {"message": [target.role]}


@router.get("/method/frappe.client.get_count")
async def frappe_get_count(doctype: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)) -> Dict[str, int]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")
    if doctype == "User":
        records = session.exec(select(User)).all() if user.role == "Business Admin" else [user]
    else:
        records = filter_records_by_user_access(session, user, model)
    return {"message": len(records)}


@router.get("/method/frappe.client.get_meta")
async def frappe_client_get_meta(doctype: str) -> Dict[str, Any]:
    fields = META_FIELD_MAP.get(doctype, [])
    return {"message": {"docs": [{"fields": fields}]}}


@router.get("/method/frappe.desk.form.load.getdoctype")
async def frappe_desk_form_load_getdoctype(doctype: str) -> Dict[str, Any]:
    fields = META_FIELD_MAP.get(doctype, [])
    return {"message": {"docs": [{"fields": fields}]}}


@router.get("/resource/{doctype}")
async def frappe_compatible_list_resource(
    doctype: str,
    limit_page_length: int = 20,
    limit_start: int = 0,
    filters: Optional[str] = None,
    order_by: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        if doctype == "Version":
            return {"data": []}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")

    if doctype == "User":
        records = session.exec(select(model)).scalars().all() if user.role == "Business Admin" else [user]
    else:
        query = select(model)
        if user.role != "Business Admin" and hasattr(model, "product_id"):
            accessible_products = session.exec(
                select(UserProductAccess.product_id).where(UserProductAccess.user_id == user.username)
            ).scalars().all()
            if accessible_products:
                query = query.where(model.product_id.in_(accessible_products))
            else:
                return {"data": []}

        filter_conditions = parse_filter_conditions(model, filters, session)
        if filter_conditions:
            query = query.where(and_(*filter_conditions))
            
        if order_by:
            # Simple order_by parsing (e.g. "modified desc")
            parts = order_by.split(" ")
            field = parts[0]
            direction = parts[1].lower() if len(parts) > 1 else "asc"
            
            # Map field name
            field = FIELD_MAP.get(field, field)
            if field == "creation":
                field = "created_at"
            elif field == "modified":
                field = "updated_at"
                
            if hasattr(model, field):
                column = getattr(model, field)
                if direction == "desc":
                    query = query.order_by(column.desc())
                else:
                    query = query.order_by(column.asc())

        records = session.exec(query).scalars().all()

    items = [format_record(record, session) for record in records[limit_start : limit_start + limit_page_length]]
    return {"data": items}


@router.get("/resource/{doctype}/{identifier}")
async def frappe_compatible_get_resource(
    doctype: str,
    identifier: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")
    record = resolve_entity(session, model, identifier)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    if doctype != "User" and not validate_record_access(session, user, record, "read"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return {"data": format_record(record, session)}


@router.post("/resource/{doctype}")
async def frappe_compatible_create_resource(
    doctype: str,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")
    payload = await request.json()
    mapped_payload = map_frappe_payload(payload, session, doctype)
    if doctype == "User":
        username = str(payload.get("username") or payload.get("email") or "").strip()
        email = str(payload.get("email") or username).strip().lower()
        full_name = str(payload.get("full_name") or username).strip()
        password = str(payload.get("password") or payload.get("new_password") or "").strip()
        if not username or not email or not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing required fields")
        is_active_raw = mapped_payload.get("is_active", payload.get("enabled", 1))
        is_active = is_active_raw not in (0, "0", False, "false", "False")
        hashed_password = auth.get_password_hash(password)
        record = User(
            username=username,
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            role=str(mapped_payload.get("role") or payload.get("role") or "Business User"),
            is_active=is_active,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return {"data": format_record(record, session)}
    elif doctype == "Deal":
        mapped_payload.pop("name", None)
        try:
            record = create_deal(session, DealCreate(**mapped_payload))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return {"data": format_record(record, session)}
    elif doctype == "Task":
        mapped_payload.pop("name", None)
        try:
            record = create_task(session, TaskCreate(**mapped_payload))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return {"data": format_record(record, session)}
    elif doctype == "Note":
        mapped_payload.pop("name", None)
        try:
            record = create_note(session, NoteCreate(**mapped_payload))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return {"data": format_record(record, session)}
    else:
        mapped_payload.pop("name", None)
        record = model(**mapped_payload)
        assign_public_id(session, record)
        session.add(record)
        session.commit()
        session.refresh(record)
        return {"data": format_record(record, session)}


@router.put("/resource/{doctype}/{identifier}")
async def frappe_compatible_update_resource(
    doctype: str,
    identifier: str,
    request: Request,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")
    record = resolve_entity(session, model, identifier)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    if doctype != "User" and not validate_record_access(session, user, record, "update"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    payload = await request.json()
    mapped_payload = map_frappe_payload(payload, session, doctype)
    mapped_payload.pop("name", None)

    if doctype == "Deal":
        try:
            record = update_deal(session, record, DealUpdate(**mapped_payload))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return {"data": format_record(record, session)}
    if doctype == "Task":
        try:
            record = update_task(session, record, TaskUpdate(**mapped_payload))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return {"data": format_record(record, session)}
    if doctype == "Note":
        try:
            record = update_note(session, record, NoteUpdate(**mapped_payload))
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return {"data": format_record(record, session)}
    if doctype == "User":
        from datetime import datetime

        if "is_active" in mapped_payload:
            active_raw = mapped_payload.pop("is_active")
            record.is_active = active_raw not in (0, "0", False, "false", "False")
        if "role" in mapped_payload:
            record.role = str(mapped_payload.pop("role"))
        password = str(payload.get("new_password") or payload.get("password") or "").strip()
        if password:
            record.hashed_password = auth.get_password_hash(password)
        for key, value in mapped_payload.items():
            if hasattr(record, key) and key not in {"id", "hashed_password"}:
                setattr(record, key, value)
        record.updated_at = datetime.utcnow()
        session.add(record)
        session.commit()
        session.refresh(record)
        return {"data": format_record(record, session)}

    from datetime import date, datetime

    for key, value in mapped_payload.items():
        if hasattr(record, key) and key != "id":
            # Handle date/datetime parsing for update
            if isinstance(value, str) and value:
                field_info = model.model_fields.get(key)
                if field_info:
                    # Check for date/datetime in the annotation
                    annotation_str = str(field_info.annotation)
                    if "date" in annotation_str.lower() and "datetime" not in annotation_str.lower():
                        try:
                            # Handle both "2026-04-28" and "2026-04-28T00:00:00"
                            date_str = value.split("T")[0]
                            value = date.fromisoformat(date_str)
                        except Exception:
                            pass
                    elif "datetime" in annotation_str.lower():
                        try:
                            # Handle "2026-04-28T04:42:53.623Z"
                            dt_str = value.replace("Z", "+00:00")
                            value = datetime.fromisoformat(dt_str)
                        except Exception:
                            pass
            setattr(record, key, value)

    record.updated_at = datetime.utcnow()
    session.add(record)
    session.commit()
    session.refresh(record)
    return {"data": format_record(record, session)}


@router.delete("/resource/{doctype}/{identifier}")
async def frappe_compatible_delete_resource(
    doctype: str,
    identifier: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")
    record = resolve_entity(session, model, identifier)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    if doctype != "User" and not validate_record_access(session, user, record, "delete"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    session.delete(record)
    session.commit()
    return {"data": {"ok": True, "id": identifier}}


@router.get("/resource/DocType/{doctype}")
async def frappe_compatible_doctype_meta(doctype: str) -> Dict[str, Any]:
    fields = META_FIELD_MAP.get(doctype, [])
    return {"data": {"fields": fields}}


@router.get("/resource/DocField")
async def frappe_compatible_docfield(
    parent: Optional[str] = None,
    fieldtype: Optional[str] = None,
    fieldname: Optional[str] = None,
    limit_start: int = 0,
    limit_page_length: int = 50,
) -> Dict[str, Any]:
    if not parent:
        return {"data": []}
    fields = META_FIELD_MAP.get(parent, [])
    if fieldtype:
        fields = [field for field in fields if field.get("fieldtype") == fieldtype]
    if fieldname:
        fields = [field for field in fields if field.get("fieldname") == fieldname]
    return {"data": fields[limit_start : limit_start + limit_page_length]}


@router.get("/resource/Custom Field")
async def frappe_compatible_custom_field(
    dt: Optional[str] = None,
    fieldtype: Optional[str] = None,
    fieldname: Optional[str] = None,
    limit_start: int = 0,
    limit_page_length: int = 50,
) -> Dict[str, Any]:
    if not dt:
        return {"data": []}
    fields = META_FIELD_MAP.get(dt, [])
    if fieldtype:
        fields = [field for field in fields if field.get("fieldtype") == fieldtype]
    if fieldname:
        fields = [field for field in fields if field.get("fieldname") == fieldname]
    return {"data": fields[limit_start : limit_start + limit_page_length]}


@router.get("/method/frappe.client.get_list")
async def frappe_client_get_list(
    doctype: str,
    fields: Optional[str] = None,
    filters: Optional[str] = None,
    limit_start: int = 0,
    limit_page_length: int = 20,
    order_by: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")

    query = select(model)
    if user.role != "Business Admin" and hasattr(model, "product_id"):
        accessible_products = session.exec(
            select(UserProductAccess.product_id).where(UserProductAccess.user_id == user.username)
        ).scalars().all()
        if accessible_products:
            query = query.where(model.product_id.in_(accessible_products))
        else:
            return {"data": {"data": []}}

    filter_conditions = parse_filter_conditions(model, filters, session)
    if filter_conditions:
        query = query.where(and_(*filter_conditions))

    records = session.exec(query).scalars().all()
    items = [format_record(record, session) for record in records[limit_start : limit_start + limit_page_length]]
    return {"data": {"data": items}}


@router.get("/method/frappe.client.get_value")
async def frappe_client_get_value(
    doctype: str,
    fieldname: str,
    filters: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    model = get_model_for_doctype(doctype)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctype not found")
    records = filter_records_by_user_access(session, user, model)
    if not records:
        return {"message": None}
    first = format_record(records[0], session)
    return {"message": first.get(fieldname)}


@router.get("/method/auth/refresh")
async def auth_refresh(user: User = Depends(get_current_user)) -> Dict[str, bool]:
    return {"ok": True}
