from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any, Dict


def create_response(payload: Dict[str, Any], institution: str = "Demo Institution") -> Dict[str, Any]:
    required_fields = ["ref", "fraudType", "riskLevel", "description", "walletId", "indicatorCode"]
    missing = [field for field in required_fields if not str(payload.get(field, "")).strip()]

    if missing or not payload.get("confirm1") or not payload.get("confirm2") or not payload.get("confirm3"):
        return {
            "status": "error",
            "message": "Submission rejected. Please complete all required fields and confirmations.",
            "missing_fields": missing,
        }

    protected_subject_ref = f"SUBJ_{hashlib.sha256(payload['walletId'].encode('utf-8')).hexdigest()[:16].upper()}"
    incident_ref = f"FL-UG-{datetime.now(timezone.utc).strftime('%Y')}-{secrets.randbelow(900000) + 100000:06d}"
    risk_level = str(payload.get("riskLevel", "High")).upper()
    match_status = "MATCH DETECTED"

    return {
        "status": "accepted",
        "incident_ref": incident_ref,
        "protected_subject_ref": protected_subject_ref,
        "schema_version": "1.0",
        "submission_timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S%z"),
        "reporting_institution": institution,
        "initial_risk_level": risk_level,
        "match_status": match_status,
        "alert_ref": "ALT-2026-00891",
        "audit_event_ref": f"AUD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "message": "Fraud intelligence accepted and routed to the matching engine.",
    }
