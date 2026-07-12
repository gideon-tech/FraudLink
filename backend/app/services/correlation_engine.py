import asyncio
from decimal import Decimal

from sqlalchemy import func, or_, select

from ..config import get_settings
from ..database import SessionLocal
from ..models import Alert, FraudIncident, FraudRelationship, Transaction
from .audit_service import write_audit
from .fraud_engine import analyse_relationship
from .websocket_manager import manager


async def correlate_incident(incident_id: int) -> None:
    with SessionLocal() as db:
        incident = db.get(FraudIncident, incident_id)
        if not incident or not incident.subjects:
            return
        source_ref = incident.subjects[0].protected_reference
        await manager.publish("CORRELATION_STARTED", {"incident_id": incident.id, "incident_reference": incident.incident_reference}, incident.reporting_institution_id)
        write_audit(db, "CORRELATION_STARTED", "INCIDENT", incident.id, "Cross-institution correlation started.", institution_id=incident.reporting_institution_id)
        db.commit()
        await asyncio.sleep(0.15)

        transactions = list(db.scalars(select(Transaction).where(or_(Transaction.source_subject_reference == source_ref, Transaction.destination_subject_reference == source_ref)).order_by(Transaction.event_time)))
        groups: dict[tuple[str, int, str], list[Transaction]] = {}
        for tx in transactions:
            outgoing = tx.source_subject_reference == source_ref
            target = tx.destination_subject_reference if outgoing else tx.source_subject_reference
            institution_id = tx.destination_institution_id if outgoing else tx.source_institution_id
            relationship_type = "SENT_FUNDS_TO" if outgoing else "RECEIVED_FUNDS_FROM"
            if institution_id != incident.reporting_institution_id:
                groups.setdefault((target, institution_id, relationship_type), []).append(tx)

        for (target_ref, institution_id, relationship_type), linked in groups.items():
            total = sum((Decimal(tx.amount) for tx in linked), Decimal(0))
            cashouts = list(db.scalars(select(Transaction).where(Transaction.source_subject_reference == target_ref, Transaction.transaction_type == "CASH_OUT")))
            cashout_total = sum((Decimal(tx.amount) for tx in cashouts), Decimal(0))
            rapid_cashout = bool(total and cashout_total / total >= Decimal("0.70"))
            result = analyse_relationship(len(linked), total, rapid_cashout, high_value_threshold=get_settings().high_value_transaction_threshold)
            relationship = FraudRelationship(incident_id=incident.id, source_protected_reference=source_ref, target_protected_reference=target_ref, target_institution_id=institution_id, relationship_type=relationship_type, transaction_count=len(linked), total_value=total, confidence=95, first_seen_at=linked[0].event_time, last_seen_at=linked[-1].event_time, relationship_metadata={"indicator_codes": result.indicators})
            db.add(relationship)
            db.flush()
            write_audit(db, "RELATIONSHIP_FOUND", "RELATIONSHIP", relationship.id, f"{relationship_type} relationship found across {len(linked)} transactions.", institution_id=institution_id)
            db.commit()
            await manager.publish("RELATIONSHIP_FOUND", {"incident_id": incident.id, "relationship_type": relationship_type, "transaction_count": len(linked), "total_value": float(total)}, institution_id)
            await asyncio.sleep(0.15)

            next_id = (db.scalar(select(func.max(Alert.id))) or 0) + 1
            reporting_name = incident.reporting_institution.name
            reason = f"This subject received {len(linked)} transactions totalling UGX {total:,.0f} from a subject reported and blocked for fraud by {reporting_name}."
            alert = Alert(alert_reference=f"ALT-{incident.created_at.year}-{next_id:05d}", incident_id=incident.id, institution_id=institution_id, protected_reference=target_ref, indicator_codes=result.indicators, relationship_type=relationship_type, risk_score=result.score, risk_level=result.level, confidence=95, reason=reason, recommended_action=result.recommended_action, score_breakdown=result.breakdown, supporting_transaction_count=len(linked), supporting_total_value=total, time_window_minutes=20, status="NEW")
            db.add(alert)
            db.flush()
            write_audit(db, "ALERT_CREATED", "ALERT", alert.id, f"{result.level} institution-scoped alert created.", institution_id=institution_id, metadata={"score": result.score})
            db.commit()
            await manager.publish("ALERT_CREATED", serialize_alert(alert), institution_id)


def serialize_alert(alert: Alert) -> dict:
    return {"id": alert.id, "alert_reference": alert.alert_reference, "incident_id": alert.incident_id, "institution_id": alert.institution_id, "institution_name": alert.institution.name if alert.institution else None, "reporting_institution": alert.incident.reporting_institution.name if alert.incident else None, "protected_reference": alert.protected_reference, "indicator_codes": alert.indicator_codes, "relationship_type": alert.relationship_type, "risk_score": alert.risk_score, "risk_level": alert.risk_level, "confidence": alert.confidence, "reason": alert.reason, "recommended_action": alert.recommended_action, "score_breakdown": alert.score_breakdown, "supporting_transaction_count": alert.supporting_transaction_count, "supporting_total_value": float(alert.supporting_total_value), "time_window_minutes": alert.time_window_minutes, "status": alert.status, "created_at": alert.created_at.isoformat(), "reviewed_at": alert.reviewed_at.isoformat() if alert.reviewed_at else None}

