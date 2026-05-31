from datetime import datetime, timedelta
from typing import Any, Dict

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from sqlmodel import Session

from app.config import settings
from app.db import get_session
from app.models.crm import User

# Removed passlib CryptContext to use direct bcrypt
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)
ACCESS_COOKIE_NAME = "crm_access_token"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def create_access_token(data: Dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
):
    if not token:
        token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid token")
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    username = payload.get("sub")
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = session.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_role(required_role: str):
    def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role != required_role and current_user.role != "Business Admin":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker


# Permission functions for product-based access control
def check_product_access(session: Session, user_id: str, product_id: int) -> bool:
    """Check if user has access to a specific product."""
    from app.models.crm import UserProductAccess
    access = session.query(UserProductAccess).filter(
        UserProductAccess.user_id == user_id,
        UserProductAccess.product_id == product_id
    ).first()
    return access is not None


def require_product_access(product_id: int):
    """Dependency to check if user has access to a product."""
    def product_access_checker(
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        if current_user.role == "Business Admin":
            return current_user  # Business Admins have access to all products
        
        if not check_product_access(session, current_user.username, product_id):
            raise HTTPException(status_code=403, detail="Access denied to this product")
        return current_user
    return product_access_checker


def check_record_ownership(session: Session, record, user_id: str) -> bool:
    """Check if user owns or is assigned to a record."""
    # Check various ownership fields that might exist on different models
    ownership_fields = ['assigned_to', 'owner', 'created_by']
    for field in ownership_fields:
        if hasattr(record, field) and getattr(record, field) == user_id:
            return True
    return False


def require_record_access(record_id: int, model_class):
    """Dependency to check if user has access to a specific record."""
    def record_access_checker(
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        if current_user.role == "Business Admin":
            return current_user  # Business Admins have access to all records
        
        # Get the record
        record = session.get(model_class, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        # Check product access if the record has a product_id
        if hasattr(record, 'product_id') and record.product_id:
            if not check_product_access(session, current_user.username, record.product_id):
                raise HTTPException(status_code=403, detail="Access denied to this product's records")
        
        # Check ownership/assignee access
        if not check_record_ownership(session, record, current_user.username):
            raise HTTPException(status_code=403, detail="Access denied to this record")
        
        return current_user
    return record_access_checker


def filter_query_by_permissions(query, user: User, session: Session):
    """Apply permission filters to a SQLAlchemy query."""
    from app.models.crm import UserProductAccess
    
    if user.role == "Business Admin":
        return query  # Business Admins see everything
    
    # Get user's accessible products
    accessible_products = session.query(UserProductAccess.product_id).filter(
        UserProductAccess.user_id == user.username
    ).subquery()
    
    # Filter query by accessible products if the model has product_id
    # This is a simplified version - in practice, you'd need to check the model
    # For now, return the query as-is since we need model-specific filtering
    return query
