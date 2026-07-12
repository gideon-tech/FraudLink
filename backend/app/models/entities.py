from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), unique=True)
    institution_type: Mapped[str] = mapped_column(String(30))
    regulated: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    institution: Mapped[Institution] = relationship()


class FraudIncident(Base):
    __tablename__ = "fraud_incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    reporting_institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    fraud_type: Mapped[str] = mapped_column(String(80))
    institution_risk_score: Mapped[int]
    risk_level: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[int]
    institution_decision: Mapped[str] = mapped_column(String(40))
    indicator_codes: Mapped[list[str]] = mapped_column(JSON, default=list)
    evidence_summary: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(30), default="CONFIRMED")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    reporting_institution: Mapped[Institution] = relationship()
    subjects: Mapped[list[FraudSubject]] = relationship(back_populates="incident", cascade="all, delete-orphan")


class FraudSubject(Base):
    __tablename__ = "fraud_subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("fraud_incidents.id"), index=True)
    subject_type: Mapped[str] = mapped_column(String(30))
    canonical_value_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    protected_reference: Mapped[str] = mapped_column(String(100), index=True)
    primary_subject: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    incident: Mapped[FraudIncident] = relationship(back_populates="subjects")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_reference: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    source_institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    source_subject_reference: Mapped[str] = mapped_column(String(100), index=True)
    destination_institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    destination_subject_reference: Mapped[str] = mapped_column(String(100), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), default="UGX")
    transaction_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="COMPLETED")
    risk: Mapped[str] = mapped_column(String(20), default="LOW")
    flag_reason: Mapped[Optional[str]] = mapped_column(Text)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    source_institution: Mapped[Institution] = relationship(foreign_keys=[source_institution_id])
    destination_institution: Mapped[Institution] = relationship(foreign_keys=[destination_institution_id])


class FraudRelationship(Base):
    __tablename__ = "fraud_relationships"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("fraud_incidents.id"), index=True)
    source_protected_reference: Mapped[str] = mapped_column(String(100), index=True)
    target_protected_reference: Mapped[str] = mapped_column(String(100), index=True)
    target_institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    relationship_type: Mapped[str] = mapped_column(String(40))
    transaction_count: Mapped[int] = mapped_column(default=0)
    total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    confidence: Mapped[int] = mapped_column(default=80)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    relationship_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    alert_reference: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("fraud_incidents.id"), index=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"), index=True)
    protected_reference: Mapped[str] = mapped_column(String(100))
    indicator_codes: Mapped[list[str]] = mapped_column(JSON, default=list)
    relationship_type: Mapped[str] = mapped_column(String(40))
    risk_score: Mapped[int]
    risk_level: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[int]
    reason: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str] = mapped_column(String(80))
    score_breakdown: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    supporting_transaction_count: Mapped[int] = mapped_column(default=0)
    supporting_total_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    time_window_minutes: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(40), default="NEW")
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    institution: Mapped[Institution] = relationship()
    incident: Mapped[FraudIncident] = relationship()


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    institution_id: Mapped[Optional[int]] = mapped_column(ForeignKey("institutions.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text)
    event_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    user: Mapped[Optional[User]] = relationship()
    institution: Mapped[Optional[Institution]] = relationship()
