import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Case, Hop

# StaticPool: see test_cases_api.py / test_traces_api.py for why this is required with
# FastAPI's TestClient (sync path operations run in a worker thread pool).
engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
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


@pytest.fixture(autouse=True)
def _reset_db_override():
    # Every sibling test module in this suite also does `app.dependency_overrides[get_db] =
    # <its own override>` at import time, on the SAME shared `app` instance -- whichever
    # module was imported last "wins" for every other module's tests for the rest of the
    # run (dependency_overrides is looked up per-request, not frozen at TestClient/module
    # creation time). This test module inserts fixture rows directly via this module's own
    # `TestSession` (bypassing the API) and then reads them back through `client`, so it
    # needs the override to genuinely point at *this* module's engine at request time, not
    # whichever module happened to import last during collection. Resetting it here, right
    # before each test in this file runs, makes this file's tests independent of import
    # order when run alongside the rest of `tests/`.
    app.dependency_overrides[get_db] = override_get_db
    yield

SANCTIONED_BTC = "149w62rY42aZBox8fGcmqNsXUzSStKeq8C"
BENIGN_BTC = "1BenignWalletNeverSanctionedAAAAAA"
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _make_case(suspect_wallet: str) -> str:
    db = TestSession()
    try:
        case_id = str(uuid.uuid4())
        db.add(
            Case(
                id=case_id, ncrp="NCRP-SANCTIONS", complainant="Test User", location="Delhi",
                phone="9999999999", incident_at=T0, fraud_type="investment_scam",
                amount_inr=100000, amount_crypto=100.0, asset="BTC", chain="bitcoin",
                suspect_wallet=suspect_wallet,
            )
        )
        db.commit()
        return case_id
    finally:
        db.close()


def _add_hop(case_id: str, wallet_address: str, chain: str, hop_index: int) -> None:
    db = TestSession()
    try:
        db.add(
            Hop(
                case_id=case_id, route_label="routeA", hop_index=hop_index,
                wallet_address=wallet_address, chain=chain, tx_hash=f"tx{hop_index}",
                amount=50.0, at=T0,
            )
        )
        db.commit()
    finally:
        db.close()


def test_case_with_sanctioned_hop_is_flagged():
    case_id = _make_case(BENIGN_BTC)
    _add_hop(case_id, BENIGN_BTC, "bitcoin", 0)
    _add_hop(case_id, SANCTIONED_BTC, "bitcoin", 1)

    response = client.get(f"/api/v1/sanctions/matches/{case_id}")
    assert response.status_code == 200
    matches = response.json()
    assert len(matches) == 1
    assert matches[0]["walletAddress"] == SANCTIONED_BTC
    assert matches[0]["listSource"] == "OFAC_SDN"


def test_case_with_no_sanctioned_hops_returns_empty_list():
    case_id = _make_case(BENIGN_BTC)
    _add_hop(case_id, BENIGN_BTC, "bitcoin", 0)

    response = client.get(f"/api/v1/sanctions/matches/{case_id}")
    assert response.status_code == 200
    assert response.json() == []


def test_unknown_case_returns_404():
    response = client.get("/api/v1/sanctions/matches/does-not-exist")
    assert response.status_code == 404


def test_repeated_screening_does_not_duplicate_audit_log_rows():
    from app.models import SanctionsMatch

    case_id = _make_case(BENIGN_BTC)
    _add_hop(case_id, SANCTIONED_BTC, "bitcoin", 0)

    client.get(f"/api/v1/sanctions/matches/{case_id}")
    client.get(f"/api/v1/sanctions/matches/{case_id}")

    db = TestSession()
    try:
        rows = (
            db.query(SanctionsMatch)
            .filter(SanctionsMatch.wallet_address == SANCTIONED_BTC)
            .all()
        )
        assert len(rows) == 1
    finally:
        db.close()
