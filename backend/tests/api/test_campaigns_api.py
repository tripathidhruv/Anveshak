from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import AttributionCandidate, Case

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


def _seed_converging_campaign(case_id_1: str, case_id_2: str, hub_address: str):
    # Re-assert this module's override right before use: multiple test files in this suite
    # each register their own `app.dependency_overrides[get_db]` at import time (same
    # pattern as test_cases_api.py / test_traces_api.py), and only the last one imported by
    # pytest's collection stays active globally. Re-setting it here guarantees the client
    # calls in *this* file's tests actually hit *this* file's in-memory engine, regardless of
    # import order across the suite.
    app.dependency_overrides[get_db] = override_get_db
    db = TestSession()
    try:
        db.add(Case(
            id=case_id_1, ncrp=f"NCRP-{case_id_1}", complainant="Victim 1", location="Delhi",
            phone="9999999999", incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            reported_at=datetime(2026, 1, 2, tzinfo=timezone.utc), fraud_type="investment_scam",
            amount_inr=100000.0, amount_crypto=100.0, asset="USDT-TRC20", chain="tron",
            suspect_wallet=f"TSuspect1{case_id_1}",
        ))
        db.add(Case(
            id=case_id_2, ncrp=f"NCRP-{case_id_2}", complainant="Victim 2", location="Mumbai",
            phone="9999999999", incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            reported_at=datetime(2026, 1, 2, tzinfo=timezone.utc), fraud_type="investment_scam",
            amount_inr=200000.0, amount_crypto=100.0, asset="USDT-TRC20", chain="tron",
            suspect_wallet=f"TSuspect2{case_id_2}",
        ))
        db.add(AttributionCandidate(
            case_id=case_id_1, wallet_address=hub_address,
            chain="tron", gate_passed=True, gate_breakdown={},
            entity_name="Meridian Digital Exchange", reasoning="test", limitations="test",
        ))
        db.add(AttributionCandidate(
            case_id=case_id_2, wallet_address=hub_address,
            chain="tron", gate_passed=True, gate_breakdown={},
            entity_name="Meridian Digital Exchange", reasoning="test", limitations="test",
        ))
        db.commit()
    finally:
        db.close()


def test_list_campaigns_returns_converged_cluster():
    _seed_converging_campaign("camp-case-1a", "camp-case-1b", "THubShared00000000000000000001")

    response = client.get("/api/v1/campaigns")

    assert response.status_code == 200
    body = response.json()
    matching = [c for c in body if set(c["caseIds"]) == {"camp-case-1a", "camp-case-1b"}]
    assert len(matching) == 1
    assert matching[0]["hubAddress"] == "THubShared00000000000000000001"
    assert matching[0]["totalAmountINR"] == 300000.0


def test_get_campaign_detail_includes_states_touched():
    _seed_converging_campaign("camp-case-2a", "camp-case-2b", "THubShared00000000000000000002")

    listed = client.get("/api/v1/campaigns").json()
    matching = next(c for c in listed if set(c["caseIds"]) == {"camp-case-2a", "camp-case-2b"})
    campaign_id = matching["id"]

    response = client.get(f"/api/v1/campaigns/{campaign_id}")

    assert response.status_code == 200
    body = response.json()
    assert set(body["caseIds"]) == {"camp-case-2a", "camp-case-2b"}
    assert body["statesTouched"] == ["Delhi", "Mumbai"]


def test_get_unknown_campaign_returns_404():
    app.dependency_overrides[get_db] = override_get_db
    response = client.get("/api/v1/campaigns/does-not-exist")
    assert response.status_code == 404
