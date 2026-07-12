from fastapi import HTTPException

from ..models import User


def ensure_institution_access(user: User, institution_id: int) -> None:
    if user.role != "BOU_OVERSIGHT" and user.institution_id != institution_id:
        raise HTTPException(403, detail={"code": "INSTITUTION_SCOPE_DENIED", "message": "This record belongs to another institution."})

