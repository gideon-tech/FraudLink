from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class IncidentCreate(BaseModel):
    subject_type: Literal["MSISDN", "NIN", "BANK_ACCOUNT", "DEVICE", "SIM", "AGENT"]
    identifier: str
    fraud_type: str
    indicator_codes: list[str] = Field(min_length=1)
    institution_risk_score: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    institution_decision: str
    evidence_summary: dict[str, Any] = Field(default_factory=dict)
    detected_at: Optional[datetime] = None


class AlertStatusUpdate(BaseModel):
    status: Literal["MONITORING", "ACKNOWLEDGED", "UNDER_REVIEW", "INVESTIGATING", "RESTRICTED", "CLEARED_FALSE_POSITIVE", "ESCALATED", "CLOSED"]
