# backend/tests/api/test_narrative_api.py
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.chains.base import Transfer
from app.db import Base, get_db
from app.labels.seed_labels import VaspLabelSeed
from app.main import app

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

T0 = datetime(2026, 1, 1, 14, 0, 0, tzinfo=timezone.utc)

VETTED = VaspLabelSeed(address="TExchangeHotWallet0000000000000000", chain="tron",
                        entity_name="Test Exchange", source_url="https://example.test",
                        verified_at=T0, vetting_status="vetted")


def mk(from_addr, to_addr, amount, ts, tx):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})


def _make_and_trace_case(suspect="TSuspectNarrative00000000000000001",
                          terminal="TTerminalNarrative0000000000000001",
                          ncrp="NCRP-NARR-1"):
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
                    mk(terminal, "cold", 147.0,
                       T0.fromtimestamp(T0.timestamp() + 30, tz=timezone.utc), "tx-sweep"),
                ],
            }
            return data.get(address, [])

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED):
        client.post(f"/api/v1/cases/{case_id}/trace")
    return case_id


def test_narrative_404_for_unknown_case():
    response = client.get("/api/v1/cases/does-not-exist/narrative")
    assert response.status_code == 404


def test_narrative_end_to_end_response_shape_with_mocked_openai():
    case_id = _make_and_trace_case()

    fake_response = MagicMock()
    fake_response.choices = [
        MagicMock(message=MagicMock(content="Funds moved from the suspect wallet to a terminal "
                                              "wallet linked to Test Exchange."))
    ]
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response

    with patch("app.narrative.summary.settings.openai_api_key", "sk-test-fake-key"), \
         patch("openai.OpenAI", return_value=fake_client):
        response = client.get(f"/api/v1/cases/{case_id}/narrative")

    assert response.status_code == 200
    body = response.json()
    assert body["caseId"] == case_id
    assert body["available"] is True
    assert body["reason"] is None
    assert "Test Exchange" in body["narrative"]
    assert "disclosure" in body
    assert "AI language model" in body["disclosure"]


def test_narrative_unavailable_response_still_carries_disclosure_when_key_unconfigured():
    case_id = _make_and_trace_case(
        suspect="TSuspectNarrative00000000000000002",
        terminal="TTerminalNarrative0000000000000002",
        ncrp="NCRP-NARR-2",
    )

    with patch("app.narrative.summary.settings.openai_api_key", None):
        response = client.get(f"/api/v1/cases/{case_id}/narrative")

    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["narrative"] is None
    assert body["reason"] == "OpenAI API key not configured"
    # disclosure is present unconditionally, even when the narrative is unavailable
    assert "disclosure" in body and "AI language model" in body["disclosure"]
