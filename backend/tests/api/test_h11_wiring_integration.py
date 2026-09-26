"""Task H11 core integration test: runs a REAL trace through the real
`POST /api/v1/cases/{id}/trace` endpoint and confirms every one of this task's wired
integration points actually fired, end to end -- not just that the individual modules
(H1/H2/H4/H6) work in isolation, which every one of THEIR own test suites already covers.

Per the task brief's own "Tests" section: a fixture that passes the deposit gate must
result in (1) a real, queryable `AttributionCandidate` row; (2) a follow-up
`GET /api/v1/campaigns` call (given 2+ such cases sharing a hub) returning a real,
non-empty campaign; (3) a sanctioned-address fixture producing a non-empty
`sanctionsMatches` in the trace response; (4) a qualifying case producing a `FlaggedWallet`
row, verified via the VASP feed's own pull API; (5) at least one audit log entry, with
`verify_chain()` still passing clean afterward.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest

from app.db import Base, get_db
from app.main import app
from app.chains.base import Transfer
from app.labels.seed_labels import VaspLabelSeed
from app.models import AttributionCandidate
from app.audit.chain import verify_chain

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


@pytest.fixture(autouse=True)
def _reset_db_override():
    # Same shared-`app.dependency_overrides` fragility documented in
    # tests/api/test_sanctions_api.py / test_traces_api.py / test_vasp_feed_api.py -- every
    # sibling `tests/api/test_*.py` module sets this same global at import time, so this
    # module's own requests must re-assert it belongs to THIS module's own engine before
    # each test, regardless of import/collection order across the suite.
    app.dependency_overrides[get_db] = override_get_db
    yield


# A real OFAC SDN seed address (see tests/unit/test_sanctions_screen.py) -- used here as the
# shared hub BOTH cases' traced money converges on, so this one fixture exercises attribution,
# campaign clustering, AND sanctions screening at once.
HUB = "149w62rY42aZBox8fGcmqNsXUzSStKeq8C"
PAYER1 = "1Payer1AAAAAAAAAAAAAAAAAAAAAAAAAAA"
PAYER2 = "1Payer2BBBBBBBBBBBBBBBBBBBBBBBBBBB"
PAYER3 = "1Payer3CCCCCCCCCCCCCCCCCCCCCCCCCCC"
SINK = "1SinkDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def mk(frm, to, amount, ts, tx):
    return Transfer(tx_hash=tx, chain="bitcoin", from_address=frm, to_address=to,
                     amount=Decimal(str(amount)), asset="BTC", timestamp=ts, fee=Decimal("0"), raw={})


def _make_chain_client(suspect_wallet: str):
    class FakeChainClient:
        chain = "bitcoin"

        def get_transfers(self, address, since=None):
            data = {
                suspect_wallet: [mk(suspect_wallet, HUB, 1.0, T0, f"tx-{suspect_wallet}-to-hub")],
                HUB: [
                    mk(PAYER1, HUB, 2.0, T0 - timedelta(seconds=60), "tx-p1"),
                    mk(PAYER2, HUB, 2.0, T0 - timedelta(seconds=40), "tx-p2"),
                    mk(PAYER3, HUB, 2.0, T0 - timedelta(seconds=20), "tx-p3"),
                    mk(suspect_wallet, HUB, 1.0, T0, f"tx-{suspect_wallet}-to-hub"),
                    mk(HUB, SINK, 0.98, T0 + timedelta(seconds=30), f"tx-hub-sweep-{suspect_wallet}"),
                ],
            }
            return data.get(address, [])

    return FakeChainClient()


VETTED_LABEL = VaspLabelSeed(
    address=HUB, chain="bitcoin", entity_name="DEMO DATA Test Exchange (Sanctioned Fixture)",
    source_url="https://example.test/labels", verified_at=T0, vetting_status="vetted",
)


def _make_case(suspect_wallet: str, ncrp: str) -> str:
    payload = {
        "ncrp": ncrp, "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 100000, "amountCrypto": 1.0, "asset": "BTC", "chain": "bitcoin",
        "suspectWallet": suspect_wallet,
    }
    return client.post("/api/v1/cases", json=payload).json()["id"]


def _run_trace(case_id: str, suspect_wallet: str) -> dict:
    with patch("app.api.v1.traces.get_chain_client", return_value=_make_chain_client(suspect_wallet)), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        response = client.post(f"/api/v1/cases/{case_id}/trace")
    assert response.status_code == 200
    return response.json()


def test_full_trace_wires_attribution_campaigns_sanctions_vasp_flag_and_audit_log():
    suspect1 = "1Suspect1EEEEEEEEEEEEEEEEEEEEEEEEE"
    suspect2 = "1Suspect2FFFFFFFFFFFFFFFFFFFFFFFFF"
    case1 = _make_case(suspect1, "NCRP-H11-1")
    case2 = _make_case(suspect2, "NCRP-H11-2")

    body1 = _run_trace(case1, suspect1)

    # (1) Attribution passed the full gate on the shared hub wallet.
    assert body1["attribution"]["gatePassed"] is True
    assert body1["attribution"]["walletAddress"] == HUB

    # (3) The hub wallet is a real OFAC SDN seed address -- sanctionsMatches must be non-empty.
    assert body1["sanctionsMatches"], "expected a non-empty sanctionsMatches list"
    assert any(m["walletAddress"] == HUB for m in body1["sanctionsMatches"])

    # (1, DB-level) a real AttributionCandidate row now exists for this case, queryable
    # directly -- this is the persistence gap this task exists to close.
    db = TestSession()
    try:
        rows = db.query(AttributionCandidate).filter(
            AttributionCandidate.case_id == case1, AttributionCandidate.wallet_address == HUB,
        ).all()
        assert len(rows) == 1
        assert rows[0].gate_passed is True
    finally:
        db.close()

    # (4) A qualifying case results in a FlaggedWallet row -- verify via the VASP feed's own
    # pull API (not a direct DB peek), per the brief.
    flagged = client.get("/api/v1/vasp-feed/flagged-wallets", params={"chain": "bitcoin"}).json()
    matching = [w for w in flagged["items"] if w["address"] == HUB]
    assert len(matching) == 1
    assert case1 in matching[0]["caseIds"]

    # (5) At least one audit log entry exists, and the chain still verifies clean.
    audit_entries = client.get("/api/v1/audit").json()
    assert len(audit_entries) >= 2  # trace.run + attribution.result, at minimum
    verify = client.get("/api/v1/audit/verify").json()
    assert verify["valid"] is True
    assert verify["brokenAtEntryId"] is None

    # (2) A second case converging on the same hub must now cluster into one real campaign.
    body2 = _run_trace(case2, suspect2)
    assert body2["attribution"]["gatePassed"] is True

    matching_flagged_after_2nd = client.get(
        "/api/v1/vasp-feed/flagged-wallets", params={"chain": "bitcoin"}
    ).json()["items"]
    hub_row = next(w for w in matching_flagged_after_2nd if w["address"] == HUB)
    assert sorted(hub_row["caseIds"]) == sorted([case1, case2])  # merged, not duplicated

    campaigns = client.get("/api/v1/campaigns").json()
    matching_campaign = [c for c in campaigns if set(c["caseIds"]) >= {case1, case2}]
    assert len(matching_campaign) == 1
    assert matching_campaign[0]["hubAddress"] == HUB

    # verify_chain must still be clean after the second trace's own audit entries too.
    verify_after = client.get("/api/v1/audit/verify").json()
    assert verify_after["valid"] is True
