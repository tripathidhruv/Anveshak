from datetime import datetime, timezone
from unittest.mock import patch
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.chains.base import Transfer
from app.labels.seed_labels import VaspLabelSeed
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False},
                        poolclass=StaticPool)
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

SUSPECT = "TRiskSuspectWalletAAAAAAAAAAAAAAAAA"
DEPOSIT = "TRiskDepositWalletBBBBBBBBBBBBBBBBBB"
PAYER1 = "TRiskPayer1CCCCCCCCCCCCCCCCCCCCCCCCC"
PAYER2 = "TRiskPayer2DDDDDDDDDDDDDDDDDDDDDDDDD"
PAYER3 = "TRiskPayer3EEEEEEEEEEEEEEEEEEEEEEEEE"
DOWNSTREAM = "TRiskDownstreamFFFFFFFFFFFFFFFFFFFFF"

T0 = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)


def mk(from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})


VETTED_LABEL = VaspLabelSeed(
    address=DEPOSIT, chain="tron", entity_name="Risk Test Vetted Exchange",
    source_url="https://example.test/labels", verified_at=T0, vetting_status="vetted",
)


def _make_case(suspect_wallet: str = SUSPECT):
    payload = {
        "ncrp": "NCRP-RISK", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": suspect_wallet,
    }
    return client.post("/api/v1/cases", json=payload).json()["id"]


class WellEvidencedClient:
    """A wallet that sweeps a real deposit-gate-passing collection point -- well-evidenced
    enough to clear the data-quality gate: multiple hops, a vetted label match, no read
    failures."""
    chain = "tron"

    def get_transfers(self, address, since=None):
        data = {
            SUSPECT: [mk(SUSPECT, DEPOSIT, 150, T0, "tx-suspect-to-deposit")],
            DEPOSIT: [
                mk(SUSPECT, DEPOSIT, 150, T0, "tx-suspect-to-deposit"),
                mk(PAYER1, DEPOSIT, 60, T0.fromtimestamp(T0.timestamp() - 40, tz=timezone.utc), "tx-p1"),
                mk(PAYER2, DEPOSIT, 75, T0.fromtimestamp(T0.timestamp() - 20, tz=timezone.utc), "tx-p2"),
                mk(PAYER3, DEPOSIT, 50, T0.fromtimestamp(T0.timestamp() - 10, tz=timezone.utc), "tx-p3"),
                mk(DEPOSIT, DOWNSTREAM, 148.5, T0.fromtimestamp(T0.timestamp() + 30, tz=timezone.utc),
                   "tx-deposit-sweep"),
            ],
            DOWNSTREAM: [],
        }
        return data.get(address, [])


class ThinDataClient:
    """The suspect wallet never sent the money anywhere -- a single-hop, no-label, no-sweep
    trace: exactly the kind of thin trace the gate must disable ML scoring for."""
    chain = "tron"

    def get_transfers(self, address, since=None):
        return []


def test_well_evidenced_case_gets_a_real_ml_score_and_shap_breakdown():
    case_id = _make_case()
    with patch("app.api.v1.risk.get_chain_client", return_value=WellEvidencedClient()), \
         patch("app.api.v1.risk.lookup_label", return_value=VETTED_LABEL):
        response = client.get(f"/api/v1/risk/{case_id}/score")

    assert response.status_code == 200
    body = response.json()

    assert body["dataQualitySufficientForMl"] is True
    assert body["dataQualityReasons"] == []
    assert body["mlScore"] is not None
    assert 0.0 <= body["mlScore"]["score"] <= 100.0
    assert set(body["mlScore"]["shapBreakdown"].keys()) == {
        "hop_count", "distinct_payers", "gate_passed", "sweep_gap_seconds",
        "value_preserved_pct", "innocence_score",
    }
    assert body["ruleBasedScore"]["score"] > 0.0
    assert "synthetic" in body["syntheticDataDisclosure"].lower()


def test_thin_trace_disables_ml_score_and_falls_back_to_rule_based():
    case_id = _make_case()
    with patch("app.api.v1.risk.get_chain_client", return_value=ThinDataClient()), \
         patch("app.api.v1.risk.lookup_label", return_value=None):
        response = client.get(f"/api/v1/risk/{case_id}/score")

    assert response.status_code == 200
    body = response.json()

    assert body["dataQualitySufficientForMl"] is False
    assert len(body["dataQualityReasons"]) > 0
    assert body["mlScore"] is None
    assert body["combinedScore"] == body["ruleBasedScore"]["score"]
    # Mandatory disclosure present even when ML did not run.
    assert "synthetic" in body["syntheticDataDisclosure"].lower()


def test_synthetic_disclosure_present_in_every_response_shape():
    for make_client, label in [
        (WellEvidencedClient, VETTED_LABEL),
        (ThinDataClient, None),
    ]:
        case_id = _make_case()
        with patch("app.api.v1.risk.get_chain_client", return_value=make_client()), \
             patch("app.api.v1.risk.lookup_label", return_value=label):
            response = client.get(f"/api/v1/risk/{case_id}/score")
        assert response.status_code == 200
        assert "syntheticDataDisclosure" in response.json()
        assert response.json()["syntheticDataDisclosure"]


def test_risk_score_404s_for_unknown_case():
    response = client.get("/api/v1/risk/does-not-exist/score")
    assert response.status_code == 404
