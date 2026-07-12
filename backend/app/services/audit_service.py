from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import AuditEvent, User


def write_audit(db: Session, event_type: str, entity_type: str, entity_id: str | int, description: str, user: User | None = None, institution_id: int | None = None, metadata: dict | None = None) -> AuditEvent:
    event = AuditEvent(user_id=user.id if user else None, institution_id=institution_id or (user.institution_id if user else None), event_type=event_type, entity_type=entity_type, entity_id=str(entity_id), description=description, event_metadata=metadata or {})
    db.add(event)
    return event
