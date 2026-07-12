from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # bcrypt generates and embeds a unique salt, so equal passwords do not produce
    # equal stored hashes. Plain-text passwords are never persisted.
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(user: User) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    # Role and institution claims support fast authorization context, but endpoints
    # still reload the user below so suspended accounts are rejected immediately.
    return jwt.encode({"sub": str(user.id), "role": user.role, "institution_id": user.institution_id, "exp": expires}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_TOKEN", "message": "Authentication token is invalid or expired."}) from exc


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "AUTH_REQUIRED", "message": "Authentication is required."})
    payload = decode_token(credentials.credentials)
    user = db.get(User, int(payload["sub"]))
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "USER_INACTIVE", "message": "The user account is unavailable."})
    return user


def require_roles(*roles: str):
    # Returning a dependency makes role checks declarative at the route boundary,
    # keeping authorization policy out of individual business operations.
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "FORBIDDEN", "message": "Your role cannot perform this operation."})
        return user
    return dependency
