# backend/tests/api/test_operator_fingerprint_api.py
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.chains.base import Transfer
from app.labels.seed_labels import VaspLabelSeed
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

T0 = datetime(2026, 1, 1, 14, 0, 0, tzinfo=timezone.utc)  # same hour-of-day (14) for both cases

def mk(from_addr, to_addr, amount, ts, tx):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

VETTED = VaspLabelSeed(address="TExchangeHotWallet0000000000000000", chain="tron",
                        entity_name="Test Exchange", source_url="https://example.test",
                        verified_at=T0, vetting_status="vetted")

def _make_and_trace_case(suspect, terminal, ncrp):
    payload = {
        "ncrp": ncrp, "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": T0.isoformat(), "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": suspect,
    }
    case_id = client.post("/api/v1/cases", json=payload).json()["id"]

    class FakeClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            data = {
                suspect: [mk(suspect, terminal, 148.5, T0, "tx-deposit")],
                terminal: [
                    mk(f"payer{i}", terminal, 50, T0, f"tx-payer-{i}") for i in range(4)
                ] + [
                    mk(suspect, terminal, 148.5, T0, "tx-deposit"),
                    mk(terminal, "cold", 147.0, T0.fromtimestamp(T0.timestamp() + 30, tz=timezone.utc), "tx-sweep"),
                ],
            }
            return data.get(address, [])

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED):
        client.post(f"/api/v1/cases/{case_id}/trace")
    return case_id

def test_similar_operators_finds_a_matching_case_and_excludes_itself():
    case_a = _make_and_trace_case("TSuspectA00000000000000000000000001", "TTerminalShared0000000000000000001", "NCRP-FP-A")
    case_b = _make_and_trace_case("TSuspectB00000000000000000000000002", "TTerminalShared0000000000000000002", "NCRP-FP-B")

    response = client.get(f"/api/v1/cases/{case_a}/similar-operators")
    assert response.status_code == 200
    body = response.json()

    assert "disclaimer" in body and "not proof" in body["disclaimer"]
    result_ids = [r["caseId"] for r in body["results"]]
    assert case_a not in result_ids
    assert case_b in result_ids
    matching = next(r for r in body["results"] if r["caseId"] == case_b)
    assert matching["similarityScore"] > 0.7
    assert "featureBreakdown" in matching

def test_similar_operators_returns_empty_for_a_case_with_no_gate_passed_candidate():
    payload = {
        "ncrp": "NCRP-FP-NONE", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": T0.isoformat(), "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": "TNoActivity0000000000000000000000003",
    }
    case_id = client.post("/api/v1/cases", json=payload).json()["id"]

    class NoActivityClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            return []

    with patch("app.api.v1.traces.get_chain_client", return_value=NoActivityClient()):
        client.post(f"/api/v1/cases/{case_id}/trace")

    response = client.get(f"/api/v1/cases/{case_id}/similar-operators")
    assert response.status_code == 200
    assert response.json()["results"] == []

def test_similar_operators_404_for_unknown_case():
    response = client.get("/api/v1/cases/does-not-exist/similar-operators")
    assert response.status_code == 404
