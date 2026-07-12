from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.database import Base, SessionLocal, engine
from backend.app.main import app
from backend.app.models import Alert, FraudIncident
from backend.app.security.protected_reference import create_protected_reference
from backend.app.seed import seed_database
from backend.app.services.correlation_engine import correlate_incident
from backend.app.services.fraud_engine import analyse_relationship, risk_level
from backend.app.services.identifier_service import canonicalize_msisdn, canonicalize_nin


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_database(db)
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "FraudLinkDemo2026!"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_identifier_canonicalisation_and_type_separation():
    assert canonicalize_msisdn("0772-315-500") == "+256772315500"
    assert canonicalize_msisdn("+256 772 315 500") == "+256772315500"
    assert canonicalize_nin("cm-12345678900000") == "CM12345678900000"
    assert create_protected_reference("MSISDN", "0772315500") == create_protected_reference("MSISDN", "+256 772 315 500")
    assert create_protected_reference("MSISDN", "0772315500")[1] != create_protected_reference("NIN", "CM077231550000")[1]


def test_risk_rules_are_explainable_and_capped():
    result = analyse_relationship(5, Decimal("2800000"), True, previous_alert=True)
    assert result.score == 100
    assert result.level == "CRITICAL"
    assert {"LINKED_TO_CONFIRMED_FRAUD", "RAPID_TRANSFER_PATTERN", "RAPID_CASHOUT", "HIGH_VALUE_TRANSACTION"} <= set(result.indicators)
    assert risk_level(29) == "LOW" and risk_level(30) == "MEDIUM" and risk_level(80) == "CRITICAL"


def test_authentication_dashboard_and_seed_counts(client: TestClient):
    headers = login(client, "bou@fraudlink.demo")
    me = client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["role"] == "BOU_OVERSIGHT"
    stats = client.get("/api/v1/dashboard/stats", headers=headers).json()
    assert stats["transactions_analysed"] >= 100
    assert stats["institutions_participating"] == 5


def test_institution_scoped_alert_access(client: TestClient):
    airtel = login(client, "airtel.analyst@fraudlink.demo")
    stanbic = login(client, "stanbic.analyst@fraudlink.demo")
    airtel_alerts = client.get("/api/v1/alerts", headers=airtel).json()
    stanbic_alerts = client.get("/api/v1/alerts", headers=stanbic).json()
    assert airtel_alerts and stanbic_alerts
    assert {a["institution_id"] for a in airtel_alerts}.isdisjoint({a["institution_id"] for a in stanbic_alerts})
    response = client.get(f"/api/v1/alerts/{stanbic_alerts[0]['id']}", headers=airtel)
    assert response.status_code == 403


@pytest.mark.anyio
async def test_exact_demo_scenario_creates_airtel_critical_alert(client: TestClient):
    headers = login(client, "mtn.analyst@fraudlink.demo")
    response = client.post("/api/v1/incidents", headers=headers, json={
        "subject_type": "MSISDN", "identifier": "0772315500", "fraud_type": "Account Takeover",
        "indicator_codes": ["MULTIPLE_FRAUD_REPORTS", "FRAUD_RELATED_CALLS", "SUSPICIOUS_TRANSACTIONS"],
        "institution_risk_score": 96, "confidence": 95, "institution_decision": "BLOCKED",
        "evidence_summary": {"complaints": 4, "blocked": True},
    })
    assert response.status_code == 201, response.text
    incident = response.json()
    assert incident["canonical_identifier"] == "+256772315500"
    assert incident["protected_reference"].startswith("MSISDN:v1:")
    await correlate_incident(incident["id"])
    with SessionLocal() as db:
        alert = db.scalar(select(Alert).where(Alert.incident_id == incident["id"], Alert.risk_level == "CRITICAL"))
        assert alert is not None
        assert alert.supporting_transaction_count == 5
        assert int(alert.supporting_total_value) == 2_800_000
        assert "RAPID_CASHOUT" in alert.indicator_codes


def test_alert_status_creates_audit_and_bou_has_oversight(client: TestClient):
    airtel = login(client, "airtel.analyst@fraudlink.demo")
    alerts = client.get("/api/v1/alerts", headers=airtel).json()
    target = next(a for a in alerts if a["risk_level"] == "CRITICAL")
    updated = client.patch(f"/api/v1/alerts/{target['id']}/status", headers=airtel, json={"status": "INVESTIGATING"})
    assert updated.status_code == 200 and updated.json()["status"] == "INVESTIGATING"
    bou = login(client, "bou@fraudlink.demo")
    assert any(e["entity_id"] == str(target["id"]) and e["event_type"] == "ALERT_STATUS_CHANGED" for e in client.get("/api/v1/audit", headers=bou).json())


def test_simulator_reset_is_bou_only(client: TestClient):
    analyst = login(client, "airtel.analyst@fraudlink.demo")
    assert client.post("/api/v1/simulator/reset", headers=analyst).status_code == 403
    bou = login(client, "bou@fraudlink.demo")
    response = client.post("/api/v1/simulator/reset", headers=bou)
    assert response.status_code == 200 and "0772315500" in response.json()["message"]

