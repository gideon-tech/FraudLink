from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Alert, AuditEvent, FraudIncident, FraudRelationship, FraudSubject, Institution, Transaction, User
from ..schemas import AlertStatusUpdate, IncidentCreate, LoginRequest
from ..security.auth import create_access_token, get_current_user, require_roles, verify_password
from ..security.permissions import ensure_institution_access
from ..security.protected_reference import create_protected_reference
from ..seed import reset_demo_scenario
from ..services.audit_service import write_audit
from ..services.correlation_engine import correlate_incident, serialize_alert
from ..services.fraud_engine import risk_level
from ..services.transaction_simulator import serialize_transaction, simulator
from ..services.websocket_manager import manager

router = APIRouter()

INDICATORS = {
    "MULTIPLE_FRAUD_REPORTS": "Multiple independent fraud complaints were recorded.",
    "FRAUD_RELATED_CALLS": "Communications were linked to reported fraudulent activity.",
    "SUSPICIOUS_TRANSACTIONS": "The institution detected suspicious transaction behaviour.",
    "RAPID_TRANSFER_PATTERN": "Three or more related transfers occurred inside 20 minutes.",
    "ACCOUNT_TAKEOVER": "Signals indicate possible unauthorised control of an account.",
    "SIM_SWAP_ABUSE": "Activity is consistent with possible SIM-swap abuse.",
    "SOCIAL_ENGINEERING": "A customer reported or exhibited social-engineering indicators.",
    "SUSPICIOUS_FUNDS": "Funds have a relationship to a reported fraud subject.",
    "RAPID_TRANSFER": "Funds moved through accounts unusually quickly.",
    "DEVICE_REUSE": "A protected device reference appears across suspicious subjects.",
    "IDENTITY_REUSE": "A protected identity reference appears across suspicious subjects.",
    "LINKED_TO_CONFIRMED_FRAUD": "A direct transaction relationship to a confirmed fraud incident exists.",
    "CASHOUT_CONCENTRATION": "Suspicious funds concentrated at a cash-out endpoint.",
    "NEWLY_REGISTERED_WALLET": "A recently registered wallet shows elevated-risk activity.",
    "RAPID_CASHOUT": "At least 70% of linked incoming funds were cashed out within 30 minutes.",
    "HIGH_VALUE_TRANSACTION": "Linked transaction value exceeded the configured demo threshold.",
}


def user_json(user: User) -> dict:
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role, "institution_id": user.institution_id, "institution_code": user.institution.code, "institution_name": user.institution.name}


def incident_json(incident: FraudIncident) -> dict:
    subject = incident.subjects[0] if incident.subjects else None
    return {"id": incident.id, "incident_reference": incident.incident_reference, "reporting_institution_id": incident.reporting_institution_id, "reporting_institution": incident.reporting_institution.name, "fraud_type": incident.fraud_type, "institution_risk_score": incident.institution_risk_score, "risk_level": incident.risk_level, "confidence": incident.confidence, "institution_decision": incident.institution_decision, "indicator_codes": incident.indicator_codes, "evidence_summary": incident.evidence_summary, "status": incident.status, "subject_type": subject.subject_type if subject else None, "canonical_identifier": subject.canonical_value_encrypted if subject else None, "protected_reference": subject.protected_reference if subject else None, "detected_at": incident.detected_at.isoformat(), "created_at": incident.created_at.isoformat()}


@router.post("/auth/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, detail={"code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect."})
    user.last_login_at = datetime.now(timezone.utc)
    # Authentication is auditable: the event, actor, institution, and source IP are
    # committed in the same unit of work as the last-login update.
    write_audit(db, "LOGIN", "SESSION", user.id, "User authenticated successfully.", user=user, metadata={"ip": request.client.host if request.client else None})
    db.commit()
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_json(user)}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)) -> dict:
    return user_json(user)


@router.get("/institutions")
def institutions(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    records = list(db.scalars(select(Institution).where(Institution.active.is_(True)).order_by(Institution.name)))
    # BoU has national oversight; institution users are tenant-scoped to prevent
    # accidental cross-institution data disclosure.
    if user.role != "BOU_OVERSIGHT":
        records = [record for record in records if record.id == user.institution_id]
    return [{"id": record.id, "code": record.code, "name": record.name, "institution_type": record.institution_type, "regulated": record.regulated, "active": record.active} for record in records]


@router.get("/institutions/{institution_id}")
def institution_detail(institution_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    ensure_institution_access(user, institution_id)
    record = db.get(Institution, institution_id)
    if not record: raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Institution not found."})
    return {"id": record.id, "code": record.code, "name": record.name, "institution_type": record.institution_type, "regulated": record.regulated, "active": record.active}


@router.post("/incidents", status_code=201)
async def create_incident(payload: IncidentCreate, background_tasks: BackgroundTasks, user: User = Depends(require_roles("FRAUD_ANALYST", "FRAUD_SUPERVISOR")), db: Session = Depends(get_db)) -> dict:
    invalid = [code for code in payload.indicator_codes if code not in INDICATORS]
    if invalid: raise HTTPException(422, detail={"code": "INVALID_INDICATOR_CODE", "message": f"Unsupported indicator codes: {', '.join(invalid)}"})
    canonical, protected = create_protected_reference(payload.subject_type, payload.identifier)
    next_id = (db.scalar(select(func.max(FraudIncident.id))) or 0) + 1
    reference = f"FL-UG-{datetime.now(timezone.utc).year}-{next_id:06d}"
    incident = FraudIncident(incident_reference=reference, reporting_institution_id=user.institution_id, fraud_type=payload.fraud_type, institution_risk_score=payload.institution_risk_score, risk_level=risk_level(payload.institution_risk_score), confidence=payload.confidence, institution_decision=payload.institution_decision, indicator_codes=payload.indicator_codes, evidence_summary=payload.evidence_summary, detected_at=payload.detected_at or datetime.now(timezone.utc), status="CONFIRMED", created_by=user.id)
    db.add(incident); db.flush()
    db.add(FraudSubject(incident_id=incident.id, subject_type=payload.subject_type, canonical_value_encrypted=canonical, protected_reference=protected, primary_subject=True))
    write_audit(db, "IDENTIFIER_PROTECTED", "INCIDENT", incident.id, "Submitted identifier standardised and converted to a protected reference.", user=user)
    write_audit(db, "INCIDENT_SUBMITTED", "INCIDENT", incident.id, f"Confirmed fraud incident {reference} submitted.", user=user)
    db.commit(); db.refresh(incident)
    await manager.publish("INCIDENT_CREATED", {"id": incident.id, "incident_reference": incident.incident_reference, "risk_level": incident.risk_level}, user.institution_id)
    background_tasks.add_task(correlate_incident, incident.id)
    return incident_json(incident)


@router.get("/incidents")
def list_incidents(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    query = select(FraudIncident).order_by(FraudIncident.created_at.desc())
    if user.role != "BOU_OVERSIGHT": query = query.where(FraudIncident.reporting_institution_id == user.institution_id)
    return [incident_json(item) for item in db.scalars(query)]


def accessible_incident(incident_id: int, user: User, db: Session) -> FraudIncident:
    incident = db.get(FraudIncident, incident_id)
    if not incident: raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Incident not found."})
    if user.role != "BOU_OVERSIGHT" and incident.reporting_institution_id != user.institution_id:
        linked = db.scalar(select(Alert.id).where(Alert.incident_id == incident_id, Alert.institution_id == user.institution_id))
        if not linked: raise HTTPException(403, detail={"code": "INSTITUTION_SCOPE_DENIED", "message": "This incident is outside your institution scope."})
    return incident


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return incident_json(accessible_incident(incident_id, user, db))


@router.get("/incidents/{incident_id}/relationships")
def incident_relationships(incident_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    accessible_incident(incident_id, user, db)
    query = select(FraudRelationship).where(FraudRelationship.incident_id == incident_id)
    if user.role != "BOU_OVERSIGHT": query = query.where(FraudRelationship.target_institution_id == user.institution_id)
    return [{"id": r.id, "incident_id": r.incident_id, "source_protected_reference": r.source_protected_reference, "target_protected_reference": r.target_protected_reference, "target_institution_id": r.target_institution_id, "relationship_type": r.relationship_type, "transaction_count": r.transaction_count, "total_value": float(r.total_value), "confidence": r.confidence, "first_seen_at": r.first_seen_at.isoformat(), "last_seen_at": r.last_seen_at.isoformat(), "metadata": r.relationship_metadata} for r in db.scalars(query)]


@router.get("/alerts")
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    query = select(Alert).order_by(Alert.created_at.desc())
    if user.role != "BOU_OVERSIGHT": query = query.where(Alert.institution_id == user.institution_id)
    return [serialize_alert(item) for item in db.scalars(query)]


def accessible_alert(alert_id: int, user: User, db: Session) -> Alert:
    alert = db.get(Alert, alert_id)
    if not alert: raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Alert not found."})
    ensure_institution_access(user, alert.institution_id)
    return alert


@router.get("/alerts/{alert_id}")
def get_alert(alert_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return serialize_alert(accessible_alert(alert_id, user, db))


@router.patch("/alerts/{alert_id}/status")
async def update_alert_status(alert_id: int, payload: AlertStatusUpdate, user: User = Depends(require_roles("FRAUD_ANALYST", "FRAUD_SUPERVISOR", "BOU_OVERSIGHT")), db: Session = Depends(get_db)) -> dict:
    alert = accessible_alert(alert_id, user, db)
    if payload.status == "RESTRICTED" and user.role not in ("FRAUD_SUPERVISOR", "BOU_OVERSIGHT"):
        raise HTTPException(403, detail={"code": "SUPERVISOR_REQUIRED", "message": "Restriction requires fraud-supervisor approval."})
    alert.status = payload.status; alert.reviewed_at = datetime.now(timezone.utc); alert.assigned_user_id = user.id
    write_audit(db, "ALERT_STATUS_CHANGED", "ALERT", alert.id, f"Alert status changed to {payload.status} by {user.full_name}.", user=user, metadata={"status": payload.status})
    db.commit(); db.refresh(alert)
    result = serialize_alert(alert)
    await manager.publish("ALERT_UPDATED", result, alert.institution_id)
    return result


@router.get("/transactions")
@router.get("/transactions/live")
def transactions(limit: int = Query(100, ge=1, le=500), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    query = select(Transaction).order_by(Transaction.event_time.desc()).limit(limit)
    if user.role != "BOU_OVERSIGHT": query = query.where(or_(Transaction.source_institution_id == user.institution_id, Transaction.destination_institution_id == user.institution_id))
    return [serialize_transaction(tx) for tx in db.scalars(query)]


@router.get("/transactions/{transaction_id}")
def transaction(transaction_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    tx = db.get(Transaction, transaction_id)
    if not tx: raise HTTPException(404, detail={"code": "NOT_FOUND", "message": "Transaction not found."})
    if user.role != "BOU_OVERSIGHT" and user.institution_id not in (tx.source_institution_id, tx.destination_institution_id): raise HTTPException(403, detail={"code": "INSTITUTION_SCOPE_DENIED", "message": "Transaction is outside your institution scope."})
    return serialize_transaction(tx)


@router.get("/dashboard")
@router.get("/dashboard/stats")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    alert_filter = [] if user.role == "BOU_OVERSIGHT" else [Alert.institution_id == user.institution_id]
    incident_filter = [] if user.role == "BOU_OVERSIGHT" else [FraudIncident.reporting_institution_id == user.institution_id]
    return {"active_incidents": db.scalar(select(func.count()).select_from(FraudIncident).where(*incident_filter)) or 0, "critical_alerts": db.scalar(select(func.count()).select_from(Alert).where(Alert.risk_level == "CRITICAL", *alert_filter)) or 0, "high_risk_linked_subjects": db.scalar(select(func.count()).select_from(Alert).where(Alert.risk_level.in_(["HIGH", "CRITICAL"]), *alert_filter)) or 0, "transactions_analysed": db.scalar(select(func.count()).select_from(Transaction)) or 0, "institutions_participating": db.scalar(select(func.count()).select_from(Institution).where(Institution.active.is_(True))) or 0, "alerts_awaiting_review": db.scalar(select(func.count()).select_from(Alert).where(Alert.status == "NEW", *alert_filter)) or 0, "simulator": simulator.status(), "prototype_notice": "Scoring weights are demonstration rules, not official Bank of Uganda standards."}


@router.get("/fraud-network/{incident_id}")
def fraud_network(incident_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    incident = accessible_incident(incident_id, user, db)
    relationships = incident_relationships(incident_id, user, db)
    nodes = [{"id": incident.subjects[0].protected_reference, "label": "Confirmed reported subject", "type": "incident", "risk": incident.risk_level}]
    for relation in relationships: nodes.append({"id": relation["target_protected_reference"], "label": relation["target_protected_reference"][:24] + "…", "type": "subject", "risk": "HIGH"})
    return {"incident": incident_json(incident), "nodes": nodes, "edges": [{"source": r["source_protected_reference"], "target": r["target_protected_reference"], "label": r["relationship_type"], "transaction_count": r["transaction_count"], "total_value": r["total_value"]} for r in relationships]}


@router.get("/audit")
def audit(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    query = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(250)
    if user.role != "BOU_OVERSIGHT": query = query.where(AuditEvent.institution_id == user.institution_id)
    return [{"id": e.id, "user": e.user.full_name if e.user else "System", "institution": e.institution.name if e.institution else "Platform", "event_type": e.event_type, "entity_type": e.entity_type, "entity_id": e.entity_id, "description": e.description, "metadata": e.event_metadata, "created_at": e.created_at.isoformat()} for e in db.scalars(query)]


@router.get("/fraud-indicators")
def fraud_indicators(_: User = Depends(get_current_user)) -> list[dict]:
    return [{"code": code, "name": code.replace("_", " ").title(), "description": description} for code, description in INDICATORS.items()]


@router.post("/simulator/start")
async def simulator_start(_: User = Depends(require_roles("FRAUD_ANALYST", "FRAUD_SUPERVISOR", "BOU_OVERSIGHT", "SYSTEM_ADMIN"))) -> dict: return await simulator.start()


@router.post("/simulator/stop")
async def simulator_stop(_: User = Depends(require_roles("FRAUD_ANALYST", "FRAUD_SUPERVISOR", "BOU_OVERSIGHT", "SYSTEM_ADMIN"))) -> dict: return await simulator.stop()


@router.post("/simulator/reset")
async def simulator_reset(_: User = Depends(require_roles("BOU_OVERSIGHT", "SYSTEM_ADMIN")), db: Session = Depends(get_db)) -> dict:
    await simulator.stop(); reset_demo_scenario(db); simulator.generated = 0
    await manager.publish("SIMULATOR_STATUS_CHANGED", simulator.status())
    return {**simulator.status(), "message": "Deterministic 0772315500 scenario reset."}


@router.get("/simulator/status")
def simulator_status(_: User = Depends(get_current_user)) -> dict: return simulator.status()
