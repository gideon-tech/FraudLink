import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Alert, AuditEvent, FraudIncident, FraudRelationship, FraudSubject, Institution, Transaction, User
from .security.auth import hash_password
from .security.protected_reference import create_protected_reference

INSTITUTIONS = [
    ("BOU", "Bank of Uganda", "REGULATOR"),
    ("MTN_MOMO_UG", "MTN Mobile Money Uganda Limited", "MOBILE_MONEY"),
    ("AIRTEL_MONEY_UG", "Airtel Mobile Commerce Uganda Limited", "MOBILE_MONEY"),
    ("STANBIC_UG", "Stanbic Bank Uganda Limited", "BANK"),
    ("CENTENARY_UG", "Centenary Rural Development Bank Limited", "BANK"),
]

# These are synthetic demonstration identities using the five project team names.
# The shared demo password comes from configuration and is hashed before insertion.
USERS = [
    ("bou@fraudlink.demo", "Malcolm Mark Okabo", "BOU", "BOU_OVERSIGHT"),
    ("bou.compliance@fraudlink.demo", "Esther Nampiina", "BOU", "COMPLIANCE"),
    ("mtn.analyst@fraudlink.demo", "Daniella Mukisa", "MTN_MOMO_UG", "FRAUD_ANALYST"),
    ("mtn.supervisor@fraudlink.demo", "Kevin Mugabi", "MTN_MOMO_UG", "FRAUD_SUPERVISOR"),
    ("airtel.analyst@fraudlink.demo", "Gideon Maku", "AIRTEL_MONEY_UG", "FRAUD_ANALYST"),
    ("airtel.supervisor@fraudlink.demo", "Malcolm Mark Okabo", "AIRTEL_MONEY_UG", "FRAUD_SUPERVISOR"),
    ("stanbic.analyst@fraudlink.demo", "Esther Nampiina", "STANBIC_UG", "FRAUD_ANALYST"),
    ("stanbic.compliance@fraudlink.demo", "Daniella Mukisa", "STANBIC_UG", "COMPLIANCE"),
    ("centenary.analyst@fraudlink.demo", "Gideon Maku", "CENTENARY_UG", "FRAUD_ANALYST"),
    ("admin@fraudlink.demo", "Kevin Mugabi", "BOU", "SYSTEM_ADMIN"),
]


def seed_database(db: Session, reset: bool = False) -> None:
    if reset:
        for model in [AuditEvent, Alert, FraudRelationship, Transaction, FraudSubject, FraudIncident, User, Institution]:
            db.execute(delete(model))
        db.commit()
    # Seeding is idempotent: normal API restarts preserve operational demo data.
    # Existing user display names are still synchronized with the team-name fixture.
    if db.scalar(select(Institution.id).limit(1)):
        names_by_email = {email: name for email, name, _, _ in USERS}
        for user in db.scalars(select(User).where(User.email.in_(names_by_email))):
            user.full_name = names_by_email[user.email]
        db.commit()
        return
    institutions = {code: Institution(code=code, name=name, institution_type=kind) for code, name, kind in INSTITUTIONS}
    db.add_all(institutions.values())
    db.flush()
    password_hash = hash_password(get_settings().demo_password)
    users: dict[str, User] = {}
    for email, name, code, role in USERS:
        user = User(email=email, full_name=name, institution_id=institutions[code].id, role=role, password_hash=password_hash)
        users[email] = user
        db.add(user)
    db.flush()

    now = datetime.now(timezone.utc)
    # Cross-institution correlation uses deterministic protected references rather
    # than exposing the direct phone/account identifier in shared records.
    fraud_canonical, fraud_ref = create_protected_reference("MSISDN", "0772315500")
    _, airtel_ref = create_protected_reference("MSISDN", "0752445001")
    _, stanbic_ref = create_protected_reference("BANK_ACCOUNT", "STB-DEMO-00421")
    institution_list = [institutions[c] for c in ("MTN_MOMO_UG", "AIRTEL_MONEY_UG", "STANBIC_UG", "CENTENARY_UG")]

    # 100 synthetic historical transactions, including the deterministic MTN -> Airtel scenario.
    for index in range(95):
        source, destination = random.sample(institution_list, 2)
        db.add(Transaction(transaction_reference=f"HIST-{index+1:06d}", source_institution_id=source.id, source_subject_reference=f"MSISDN:v1:SRC{index:013d}", destination_institution_id=destination.id, destination_subject_reference=f"MSISDN:v1:DST{index:013d}", amount=Decimal(20_000 + (index * 7919) % 900_000), currency="UGX", transaction_type="TRANSFER", status="COMPLETED", risk="LOW", event_time=now - timedelta(hours=48, minutes=index), simulated=True))
    amounts = [500_000, 600_000, 450_000, 700_000, 550_000]
    for index, amount in enumerate(amounts):
        db.add(Transaction(transaction_reference=f"DEMO-MTN-AIRTEL-{index+1}", source_institution_id=institutions["MTN_MOMO_UG"].id, source_subject_reference=fraud_ref, destination_institution_id=institutions["AIRTEL_MONEY_UG"].id, destination_subject_reference=airtel_ref, amount=Decimal(amount), currency="UGX", transaction_type="TRANSFER", status="COMPLETED", risk="HIGH", flag_reason="Linked demo transaction", event_time=now - timedelta(minutes=19-index*4), simulated=True))
    db.add(Transaction(transaction_reference="DEMO-AIRTEL-CASHOUT", source_institution_id=institutions["AIRTEL_MONEY_UG"].id, source_subject_reference=airtel_ref, destination_institution_id=institutions["AIRTEL_MONEY_UG"].id, destination_subject_reference="AGENT:v1:DEMOAGENT000001", amount=Decimal(2_100_000), currency="UGX", transaction_type="CASH_OUT", status="COMPLETED", risk="HIGH", flag_reason="Rapid cash-out after linked incoming funds", event_time=now - timedelta(minutes=1), simulated=True))

    # Four historical incidents plus a reproducible fifth MTN scenario fixture.
    incident_specs = [
        ("FL-UG-2026-000001", "STANBIC_UG", stanbic_ref, "SIM Swap Abuse", 78, "HIGH"),
        ("FL-UG-2026-000002", "CENTENARY_UG", "MSISDN:v1:HISTORICAL00001", "Social Engineering", 55, "MEDIUM"),
        ("FL-UG-2026-000003", "AIRTEL_MONEY_UG", "MSISDN:v1:HISTORICAL00002", "Account Takeover", 88, "CRITICAL"),
        ("FL-UG-2026-000004", "MTN_MOMO_UG", "MSISDN:v1:HISTORICAL00003", "Suspicious Transactions", 68, "HIGH"),
    ]
    for index, (reference, code, protected, fraud_type, score, level) in enumerate(incident_specs):
        owner = next(u for u in users.values() if u.institution_id == institutions[code].id and u.role == "FRAUD_ANALYST")
        incident = FraudIncident(incident_reference=reference, reporting_institution_id=institutions[code].id, fraud_type=fraud_type, institution_risk_score=score, risk_level=level, confidence=85, institution_decision="BLOCKED", indicator_codes=["SUSPICIOUS_TRANSACTIONS"], evidence_summary={"summary": "Synthetic historical demonstration record"}, detected_at=now-timedelta(days=index+1), status="CONFIRMED", created_by=owner.id)
        db.add(incident); db.flush()
        db.add(FraudSubject(incident_id=incident.id, subject_type="MSISDN", canonical_value_encrypted=None, protected_reference=protected, primary_subject=True))

    db.commit()
    # Seed 8 visible historical alerts and 20 relationships without leaking cross-institution records.
    incidents = list(db.scalars(select(FraudIncident)))
    for index in range(20):
        incident = incidents[index % len(incidents)]
        target = institution_list[index % len(institution_list)]
        relationship = FraudRelationship(incident_id=incident.id, source_protected_reference=incident.subjects[0].protected_reference, target_protected_reference=f"MSISDN:v1:LINKED{index:010d}", target_institution_id=target.id, relationship_type="SENT_FUNDS_TO", transaction_count=2 + index % 5, total_value=Decimal(150_000 * (index + 1)), confidence=75 + index % 20, first_seen_at=now-timedelta(days=2), last_seen_at=now-timedelta(days=1), relationship_metadata={"synthetic": True})
        db.add(relationship)
        if index < 8:
            db.add(Alert(alert_reference=f"ALT-2026-{index+1:05d}", incident_id=incident.id, institution_id=target.id, protected_reference=relationship.target_protected_reference, indicator_codes=["LINKED_TO_CONFIRMED_FRAUD"], relationship_type="SENT_FUNDS_TO", risk_score=45 + index*6, risk_level="CRITICAL" if index >= 6 else "HIGH" if index >= 3 else "MEDIUM", confidence=85, reason="Synthetic historical relationship requiring institution review.", recommended_action="ENHANCED_MONITORING", score_breakdown=[{"rule": "Direct relationship", "score": 30}], supporting_transaction_count=relationship.transaction_count, supporting_total_value=relationship.total_value, time_window_minutes=20, status="NEW"))
    for index in range(50):
        db.add(AuditEvent(user_id=None, institution_id=institution_list[index % 4].id, event_type="TRANSACTION_FLAGGED" if index % 4 == 0 else "INCIDENT_VIEWED", entity_type="TRANSACTION", entity_id=str(index+1), description="Synthetic audit event for the hackathon demonstration.", event_metadata={"synthetic": True}, created_at=now-timedelta(minutes=index*12)))
    db.commit()


def reset_demo_scenario(db: Session) -> None:
    # Restore the deterministic transaction set while preserving accounts and historical dashboard data.
    db.execute(delete(Alert).where(Alert.alert_reference.like("ALT-2026-00009%")))
    db.execute(delete(FraudIncident).where(FraudIncident.incident_reference.like("FL-UG-2026-000005%")))
    db.commit()
