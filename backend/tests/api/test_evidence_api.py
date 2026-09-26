"""Task H5: GET /api/v1/evidence/{case_id}/pack and POST /api/v1/evidence/{case_id}/verify."""
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base, get_db
from app.chains.base import Transfer
from app.models import Hop, AttributionCandidate

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

SUSPECT = "TSuspectAAAAAAAAAAAAAAAAAAAAAAAAAA"
T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def mk(tx, frm, to, amount, ts):
    return Transfer(tx_hash=tx, chain="tron", from_address=frm, to_address=to,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts,
                     fee=Decimal("0"), raw={})


class FakeChainClient:
    chain = "tron"

    def __init__(self, transfers=None, raises=False):
        self._transfers = transfers if transfers is not None else []
        self._raises = raises

    def get_transfers(self, address, since=None):
        if self._raises:
            raise RuntimeError("chain API unavailable")
        return self._transfers


def _current_db_session():
    """Other `tests/api/test_*.py` modules in this suite also set
    `app.dependency_overrides[get_db]` at module-import time, and pytest imports every
    test module during collection before any test runs -- so whichever module's import
    happens to run last silently wins that global for the whole process, regardless of
    which file's test is actually executing. Rather than assume this module's own
    `override_get_db` is the one in effect (true when this file runs alone, not
    necessarily true inside the full `tests/` run), fetch a session from whatever
    override is CURRENTLY installed so direct DB writes below land in the same
    database the TestClient's requests actually use."""
    gen = app.dependency_overrides[get_db]()
    return next(gen)


def _make_case_with_hop():
    payload = {
        "ncrp": "NCRP-EV1", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": SUSPECT,
    }
    case_id = client.post("/api/v1/cases", json=payload).json()["id"]
    db = _current_db_session()
    db.add(Hop(case_id=case_id, route_label="routeA", hop_index=0, wallet_address=SUSPECT,
               chain="tron", tx_hash="tx1", amount=150.0, at=T0, stop_reason=None, flag=None))
    db.add(AttributionCandidate(
        case_id=case_id, wallet_address=SUSPECT, chain="tron", gate_passed=True,
        gate_breakdown={"distinct_payers_ok": True}, entity_name="DEMO DATA Exchange",
        reasoning="test reasoning", limitations="test limitations",
    ))
    db.commit()
    db.close()
    return case_id


def test_pack_endpoint_returns_hash_and_manifest():
    case_id = _make_case_with_hop()
    fixed_transfers = [mk("tx1", "X", SUSPECT, 150, T0)]
    with patch("app.evidence.pack.get_chain_client", return_value=FakeChainClient(fixed_transfers)):
        response = client.get(f"/api/v1/evidence/{case_id}/pack")

    assert response.status_code == 200
    body = response.json()
    assert body["caseId"] == case_id
    assert isinstance(body["packHash"], str) and len(body["packHash"]) == 64  # sha256 hex
    assert len(body["manifestEntries"]) == 1
    entry = body["manifestEntries"][0]
    assert "sourceUrl" in entry or "source_url" in entry
    assert "createdAt" in body


def test_pack_endpoint_404_for_unknown_case():
    response = client.get("/api/v1/evidence/does-not-exist/pack")
    assert response.status_code == 404


def test_verify_endpoint_reproduces_identical_hash_when_chain_data_unchanged():
    case_id = _make_case_with_hop()
    fixed_transfers = [mk("tx1", "X", SUSPECT, 150, T0)]

    with patch("app.evidence.pack.get_chain_client", return_value=FakeChainClient(fixed_transfers)):
        pack_response = client.get(f"/api/v1/evidence/{case_id}/pack")
    assert pack_response.status_code == 200

    with patch("app.api.v1.evidence.get_chain_client", return_value=FakeChainClient(fixed_transfers)):
        verify_response = client.post(f"/api/v1/evidence/{case_id}/verify")

    assert verify_response.status_code == 200
    body = verify_response.json()
    assert body["valid"] is True
    assert body["packHashMatches"] is True
    assert body["sourcesReproduced"] == body["sourcesChecked"]
    assert body["dataUnavailable"] is False


def test_verify_endpoint_flags_mismatch_when_chain_data_changed():
    case_id = _make_case_with_hop()
    original_transfers = [mk("tx1", "X", SUSPECT, 150, T0)]
    changed_transfers = [mk("tx1", "X", SUSPECT, 150, T0), mk("tx2", SUSPECT, "Y", 149, T0)]

    with patch("app.evidence.pack.get_chain_client", return_value=FakeChainClient(original_transfers)):
        client.get(f"/api/v1/evidence/{case_id}/pack")

    # On re-verification the wallet now has an extra transfer -- the chain data
    # genuinely changed since the pack was generated, so verification must honestly
    # report non-reproduction, never silently claim "valid".
    with patch("app.api.v1.evidence.get_chain_client", return_value=FakeChainClient(changed_transfers)):
        verify_response = client.post(f"/api/v1/evidence/{case_id}/verify")

    assert verify_response.status_code == 200
    body = verify_response.json()
    assert body["valid"] is False
    assert body["sourcesReproduced"] < body["sourcesChecked"]


def test_verify_endpoint_never_claims_valid_when_chain_read_fails():
    case_id = _make_case_with_hop()
    fixed_transfers = [mk("tx1", "X", SUSPECT, 150, T0)]
    with patch("app.evidence.pack.get_chain_client", return_value=FakeChainClient(fixed_transfers)):
        client.get(f"/api/v1/evidence/{case_id}/pack")

    with patch("app.api.v1.evidence.get_chain_client", return_value=FakeChainClient(raises=True)):
        verify_response = client.post(f"/api/v1/evidence/{case_id}/verify")

    assert verify_response.status_code == 200
    body = verify_response.json()
    assert body["valid"] is False
    assert body["dataUnavailable"] is True


def test_verify_endpoint_404_when_no_pack_generated_yet():
    case_id = _make_case_with_hop()
    response = client.post(f"/api/v1/evidence/{case_id}/verify")
    assert response.status_code == 404
