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

# StaticPool (not the sqlite in-memory default of SingletonThreadPool) is required here:
# FastAPI's TestClient runs sync path operations in a worker thread pool, so without a
# single shared connection each request could land on a different thread and see a
# separate, schema-less in-memory database ("no such table: cases").
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

SUSPECT = "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB"
TERMINAL = "TExchangeHotWalletCCCCCCCCCCCCCCCCC"
COLD = "TColdStorageDDDDDDDDDDDDDDDDDDDDDDD"
VICTIM0 = "TOtherVictim0EEEEEEEEEEEEEEEEEEEEEE"
VICTIM1 = "TOtherVictim1FFFFFFFFFFFFFFFFFFFFFF"
VICTIM2 = "TOtherVictim2GGGGGGGGGGGGGGGGGGGGGG"

T0 = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

def mk(from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

class FakeChainClient:
    chain = "tron"

    def get_transfers(self, address, since=None):
        data = {
            SUSPECT: [mk(SUSPECT, TERMINAL, 148.5, T0, "tx-suspect-to-terminal")],
            # Terminal wallet's FULL history (both directions) -- this is what fix #1 and #2
            # must read from `client.get_transfers(TERMINAL)`, not from the single funding
            # transfer. 4 distinct payers (>= Task 7's MIN_DISTINCT_PAYERS=3). One outgoing
            # sweep at T0-30s, 30s after the EARLIEST inbound (VICTIM0 at T0-60s) with 99% of
            # VICTIM0's amount preserved -- satisfies detect_sweep's gap/value thresholds.
            # The sweep transfer's timestamp (T0-30s) is BEFORE this hop's own since_ts (T0,
            # when the suspect's money arrived), so the tracer's causal filter (timestamp >=
            # since_ts) correctly excludes it -- the terminal wallet still stops the trace
            # here (stop_reason set) instead of being followed onward to COLD.
            TERMINAL: [
                mk(VICTIM0, TERMINAL, 200, T0.fromtimestamp(T0.timestamp() - 60, tz=timezone.utc), "tx-victim0"),
                mk(VICTIM1, TERMINAL, 60, T0.fromtimestamp(T0.timestamp() - 40, tz=timezone.utc), "tx-victim1"),
                mk(VICTIM2, TERMINAL, 75, T0.fromtimestamp(T0.timestamp() - 20, tz=timezone.utc), "tx-victim2"),
                mk(SUSPECT, TERMINAL, 148.5, T0, "tx-suspect-to-terminal"),
                mk(TERMINAL, COLD, 198, T0.fromtimestamp(T0.timestamp() - 30, tz=timezone.utc), "tx-sweep"),
            ],
        }
        return data.get(address, [])

VETTED_LABEL = VaspLabelSeed(
    address=TERMINAL, chain="tron", entity_name="Real Vetted Test Exchange",
    source_url="https://example.test/labels", verified_at=T0, vetting_status="vetted",
)

def _make_case():
    payload = {
        "ncrp": "NCRP-2", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": SUSPECT,
    }
    return client.post("/api/v1/cases", json=payload).json()["id"]

def test_trace_endpoint_confirms_attribution_when_payers_and_sweep_both_hold():
    case_id = _make_case()

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    # Fix #1: distinct payers must be counted from the terminal wallet's full history (4
    # distinct senders), not from the single funding transfer (which would cap at 1 and
    # could never pass MIN_DISTINCT_PAYERS=3). Fix #2: detect_sweep must be consulted and
    # AND-ed with the payer/label gate. Both hold in this fixture, so attribution passes.
    assert body["attribution"]["gatePassed"] is True
    assert body["attribution"]["entityName"] == "Real Vetted Test Exchange"
    assert body["attribution"]["breakdown"]["sweep_confirmed"] is True

    # Fix #3: conservation must compare the reported amount against terminal-hop taint, not
    # sum every hop's own funding transfer (which would double-count the suspect->terminal
    # hand-off). Terminal taint is FIFO-capped at 148.5 (< the 150 reported), so a genuine,
    # non-zero, unreconciled remainder is the correct, honest answer here.
    assert body["conservation"]["incomingTotal"] == pytest.approx(150.0)
    assert body["conservation"]["outgoingTotal"] == pytest.approx(148.5)
    assert body["conservation"]["remainder"] == pytest.approx(1.5)
    assert body["conservation"]["reconciled"] is False

    # Backward victim enumeration should surface the 3 other payers into the same wallet.
    assert len(body["unreportedVictims"]) == 3

    assert "hops" in body and len(body["hops"]) >= 1
    assert "innocence" in body
    assert "bridgeLinks" in body

def test_trace_endpoint_withholds_attribution_when_sweep_does_not_hold():
    # Same payer count and label as above, but the "sweep" transfer predates every inbound
    # transfer into TERMINAL (24h before T0) instead of following 30s after the earliest one.
    # detect_sweep looks for the earliest outgoing transfer at/after the earliest inbound
    # (VICTIM0 at T0-60); with none available at or after that point, it correctly reports no
    # sweep (gap/value cannot even be computed). Note this timestamp must stay *before*
    # since_ts (T0, when the suspect's money reaches TERMINAL) as well as before the earliest
    # inbound: this hop's own since_ts is only 60s after the earliest inbound, so any
    # transfer timed to fail detect_sweep's 300s gap threshold from the "after" side would
    # necessarily land after since_ts too -- which would make the tracer's causal filter
    # (timestamp >= since_ts) follow it onward to COLD, making COLD (with no history in this
    # fixture) the terminal hop instead of TERMINAL and defeating the point of this test. Only
    # a "before" placement fails the sweep while still leaving TERMINAL as the terminal hop.
    # The payer/label gate alone would pass; final attribution must still be UNKNOWN because
    # fix #2 requires sweep AND payers, not payers alone.
    class SlowSweepClient(FakeChainClient):
        def get_transfers(self, address, since=None):
            if address == TERMINAL:
                base = super().get_transfers(address, since)
                return [t for t in base if t.to_address != COLD and t.from_address != TERMINAL] + [
                    mk(TERMINAL, COLD, 198, T0.fromtimestamp(T0.timestamp() - 86400, tz=timezone.utc), "tx-sweep-slow"),
                ]
            return super().get_transfers(address, since)

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=SlowSweepClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"]["gatePassed"] is False
    assert body["attribution"]["entityName"] == "UNKNOWN"
    assert body["attribution"]["breakdown"]["sweep_confirmed"] is False
    assert body["attribution"]["breakdown"]["distinct_payers_ok"] is True
