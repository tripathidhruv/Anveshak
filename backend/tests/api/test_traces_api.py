from datetime import datetime, timezone
from unittest.mock import patch
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.chains.base import Transfer
from app.labels.seed_labels import VaspLabelSeed
from app.models import AttributionCandidate, DepositIndexEntry, Hop
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


@pytest.fixture(autouse=True)
def _reset_db_override():
    # Task H11: `run_trace` now writes AttributionCandidate/FlaggedWallet/AuditLogEntry rows
    # (previously it wrote nothing at all), so this module's requests must land in THIS
    # module's own engine, not whichever sibling `tests/api/test_*.py` module's override
    # happened to be installed last at collection time (every such module does
    # `app.dependency_overrides[get_db] = <its own override>` at import time, and pytest
    # imports every test module before executing any of them -- see
    # tests/api/test_sanctions_api.py's identical fixture for the fuller explanation this
    # comment is deliberately kept shorter than).
    app.dependency_overrides[get_db] = override_get_db
    yield


SUSPECT = "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB"
TERMINAL = "TExchangeHotWalletCCCCCCCCCCCCCCCCC"
COLD = "TColdStorageDDDDDDDDDDDDDDDDDDDDDDD"
VICTIM0 = "TOtherVictim0EEEEEEEEEEEEEEEEEEEEEE"
VICTIM1 = "TOtherVictim1FFFFFFFFFFFFFFFFFFFFFF"
VICTIM2 = "TOtherVictim2GGGGGGGGGGGGGGGGGGGGGG"
UNRELATED = "TUnrelatedSenderHHHHHHHHHHHHHHHHHHHH"

T0 = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

def mk(from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

class FakeChainClient:
    chain = "tron"

    def get_transfers(self, address, since=None):
        data = {
            # SUSPECT's own full history: the forward hand-off to TERMINAL, plus an inbound
            # transfer from an unrelated address well before the incident (5 days before T0,
            # clearing compute_innocence's `pre_existing` check of `timestamp < incident_at -
            # timedelta(days=1)`). This inbound transfer is what fix #2 must be able to see --
            # `h.outgoing_transfers` across the hops list never contains anything sent TO the
            # suspect wallet, only what the trace followed forward FROM it.
            SUSPECT: [
                mk(SUSPECT, TERMINAL, 148.5, T0, "tx-suspect-to-terminal"),
                mk(UNRELATED, SUSPECT, 10, T0.fromtimestamp(T0.timestamp() - 5 * 86400, tz=timezone.utc),
                   "tx-suspect-pre-incident-inbound"),
            ],
            # Terminal wallet's FULL history (both directions) -- this is what fix #1 and #2
            # must read from `client.get_transfers(TERMINAL)`, not from the single funding
            # transfer. 4 distinct payers (>= Task 7's MIN_DISTINCT_PAYERS=3). One outgoing
            # sweep transfer 30s after THIS TRACE'S OWN funding transfer (SUSPECT -> TERMINAL
            # at T0), preserving ~99% of THAT transfer's specific amount (148.5) -- per Task F3
            # (I9), detect_sweep is anchored to the hop's own funding transfer, not the
            # wallet's globally-earliest-ever inbound (VICTIM0), so the swept amount must
            # correspond to what THIS hop itself received, not to some other victim's amount.
            # Because this sweep transfer happens AT/AFTER since_ts (T0), the tracer's own
            # causal filter also follows it onward to COLD -- TERMINAL is therefore NOT a
            # terminal hop (stop_reason stays None). Per Task F3 (C3), a wallet no longer needs
            # to be a terminal hop to be evaluated for attribution, so TERMINAL is still
            # correctly attributed even though COLD is now the actual terminal hop.
            TERMINAL: [
                mk(VICTIM0, TERMINAL, 200, T0.fromtimestamp(T0.timestamp() - 60, tz=timezone.utc), "tx-victim0"),
                mk(VICTIM1, TERMINAL, 60, T0.fromtimestamp(T0.timestamp() - 40, tz=timezone.utc), "tx-victim1"),
                mk(VICTIM2, TERMINAL, 75, T0.fromtimestamp(T0.timestamp() - 20, tz=timezone.utc), "tx-victim2"),
                mk(SUSPECT, TERMINAL, 148.5, T0, "tx-suspect-to-terminal"),
                mk(TERMINAL, COLD, 147, T0.fromtimestamp(T0.timestamp() + 30, tz=timezone.utc), "tx-sweep"),
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

    # Operator-fingerprinting plan: the raw sweep numbers must be persisted in the breakdown
    # dict too, not just the boolean -- they were already computed here, just discarded before.
    assert body["attribution"]["breakdown"]["sweep_gap_seconds"] == pytest.approx(30.0)
    assert body["attribution"]["breakdown"]["sweep_value_preserved_pct"] == pytest.approx(147.0 / 148.5)
    assert body["attribution"]["breakdown"]["distinct_payer_count"] == 4

    # Fix #3: conservation must compare the reported amount against terminal-hop taint, not
    # sum every hop's own funding transfer (which would double-count the suspect->terminal
    # hand-off). TERMINAL now forwards onward to COLD (per Task F3/C3, sweeping is no longer
    # incompatible with attribution), so COLD is the actual terminal hop, carrying forward
    # 147 of TERMINAL's 148.5 taint (FIFO-capped by the sweep transfer's own amount) -- a
    # genuine, non-zero, unreconciled remainder is the correct, honest answer here.
    assert body["conservation"]["incomingTotal"] == pytest.approx(150.0)
    assert body["conservation"]["outgoingTotal"] == pytest.approx(147.0)
    assert body["conservation"]["remainder"] == pytest.approx(3.0)
    assert body["conservation"]["reconciled"] is False

    # Backward victim enumeration should surface the 3 other payers into the same wallet.
    assert len(body["unreportedVictims"]) == 3

    assert "hops" in body and len(body["hops"]) >= 1
    assert "innocence" in body
    assert "bridgeLinks" in body

    # Fix (innocence transfer set): compute_innocence must be given the suspect wallet's own
    # FULL history (both directions), not just `h.outgoing_transfers` from the hops list --
    # that never contains anything sent TO the suspect wallet. SUSPECT's fixture history now
    # includes an inbound transfer from an unrelated address well before the incident, so
    # "no_pre_incident_history" must NOT fire. Under the old buggy code (outgoing_transfers
    # only), this inbound transfer would be invisible and that check would incorrectly fire.
    innocence_checks = [f["check"] for f in body["innocence"]["factors"]]
    assert "no_pre_incident_history" not in innocence_checks

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

    # Task G4: gate.gate_passed (payers + predecessor + vetted label) is True here even though
    # final_gate_passed is False (no sweep) -- unreported-victim enumeration must still run on
    # this wallet, proving the guard is gate.gate_passed specifically, not final_gate_passed.
    assert len(body["unreportedVictims"]) == 3


# ---------------------------------------------------------------------------
# Task F3 (C2 + C3 + I9 + I1 + I6): candidate selection must be based on taint,
# not on wherever the BFS physically stopped; the sweep check must be reachable
# for a non-terminal hop and anchored to THIS trace's own funding transfer; chain
# API failures during attribution must not 500; unreported-victim enumeration
# must exclude every wallet already in this trace's own path.
# ---------------------------------------------------------------------------

WALLET_A = "TWalletA1111111111111111111111111"
WALLET_B_BAIT = "TWalletBBaitBBBBBBBBBBBBBBBBBBBBBB"
DEPOSIT = "TDepositSweepWalletIIIIIIIIIIIIIIIII"
DOWNSTREAM = "TDownstreamWalletJJJJJJJJJJJJJJJJJJJ"
PAYER1 = "TPayer1KKKKKKKKKKKKKKKKKKKKKKKKKKKK"
PAYER2 = "TPayer2LLLLLLLLLLLLLLLLLLLLLLLLLLLL"
PAYER3 = "TPayer3MMMMMMMMMMMMMMMMMMMMMMMMMMMM"
OLDHIST = "TOldHistorySweepWalletNNNNNNNNNNNNNN"
OLD_UNRELATED = "TOldUnrelatedSenderOOOOOOOOOOOOOOOOO"
OLD_PAYER_X = "TOldPayerXPPPPPPPPPPPPPPPPPPPPPPPPPP"
OLD_PAYER_Y = "TOldPayerYQQQQQQQQQQQQQQQQQQQQQQQQQQ"
CANDIDATE_FAILS = "TCandidateApiFailsRRRRRRRRRRRRRRRRRR"
MIDDLE = "TMiddleHopWalletSSSSSSSSSSSSSSSSSSSS"
FINAL = "TFinalHopWalletTTTTTTTTTTTTTTTTTTTTT"
THIRDPARTY = "TThirdPartyPayerUUUUUUUUUUUUUUUUUUUU"

VETTED_LABEL_ANY = VaspLabelSeed(
    address="irrelevant", chain="tron", entity_name="Fictional Bait Exchange",
    source_url="https://example.test/labels", verified_at=T0, vetting_status="vetted",
)


def test_zero_taint_wallet_is_never_evaluated_or_attributed():
    # Reviewer's own probe: two SEPARATE causal branches straight out of the suspect wallet.
    # The first (to WALLET_A) consumes the entire FIFO taint budget; the second (to
    # WALLET_B_BAIT), though causal and later, is left with taint == 0. WALLET_B_BAIT's own
    # fixture history is deliberately built to pass every other gate (4 distinct payers,
    # vetted label, straight-line predecessor) -- if it were ever evaluated as a candidate it
    # would be attributed. It must not even be looked at.
    class RecordingClient:
        chain = "tron"

        def __init__(self):
            self.calls: list[str] = []

        def get_transfers(self, address, since=None):
            self.calls.append(address)
            data = {
                SUSPECT: [
                    mk(SUSPECT, WALLET_A, 150, T0, "tx-suspect-to-a"),
                    mk(SUSPECT, WALLET_B_BAIT, 5000, T0.fromtimestamp(T0.timestamp() + 1, tz=timezone.utc),
                       "tx-suspect-to-b"),
                ],
                WALLET_A: [],
                # Bait: looks like a perfect collection point, but must never be fetched here
                # for attribution purposes because its taint is 0.
                WALLET_B_BAIT: [
                    mk(SUSPECT, WALLET_B_BAIT, 5000,
                       T0.fromtimestamp(T0.timestamp() + 1, tz=timezone.utc), "tx-suspect-to-b"),
                    mk(PAYER1, WALLET_B_BAIT, 200, T0, "tx-p1-to-b"),
                    mk(PAYER2, WALLET_B_BAIT, 200, T0, "tx-p2-to-b"),
                    mk(PAYER3, WALLET_B_BAIT, 200, T0, "tx-p3-to-b"),
                    mk(WALLET_B_BAIT, "sink", 4950,
                       T0.fromtimestamp(T0.timestamp() + 30, tz=timezone.utc), "tx-b-sweep"),
                ],
            }
            return data.get(address, [])

    client_instance = RecordingClient()
    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=client_instance), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    # WALLET_A had 0 distinct extra payers and no sweep, so it fails the gate -- but it's the
    # only real candidate (taint > 0), so it's what gets reported on.
    assert body["attribution"]["walletAddress"] == WALLET_A
    assert body["attribution"]["gatePassed"] is False
    assert body["attribution"]["entityName"] == "UNKNOWN"
    assert body["attribution"]["entityName"] != "Fictional Bait Exchange"

    # The tracer's own BFS calls get_transfers(WALLET_B_BAIT) exactly once to discover it has
    # no further causal outgoing edges of its own relevance. The attribution loop must NOT
    # call it again to fetch a "full history" for gating -- that would be evaluating a
    # zero-taint wallet as a candidate.
    assert client_instance.calls.count(WALLET_B_BAIT) <= 1


def test_sweeping_non_terminal_wallet_is_evaluated_and_can_pass():
    # DEPOSIT receives the victim's money and forwards nearly all of it onward within 42s --
    # a real exchange sweep. Because it forwards the money, the tracer follows it to
    # DOWNSTREAM and DEPOSIT's own stop_reason stays None (it is NOT a terminal hop). It must
    # still be evaluated as a candidate and pass the full gate.
    class SweepingNonTerminalClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            data = {
                SUSPECT: [mk(SUSPECT, DEPOSIT, 150, T0, "tx-suspect-to-deposit")],
                DEPOSIT: [
                    mk(SUSPECT, DEPOSIT, 150, T0, "tx-suspect-to-deposit"),
                    mk(PAYER1, DEPOSIT, 60, T0.fromtimestamp(T0.timestamp() - 40, tz=timezone.utc), "tx-p1"),
                    mk(PAYER2, DEPOSIT, 75, T0.fromtimestamp(T0.timestamp() - 20, tz=timezone.utc), "tx-p2"),
                    mk(PAYER3, DEPOSIT, 50, T0.fromtimestamp(T0.timestamp() - 10, tz=timezone.utc), "tx-p3"),
                    mk(DEPOSIT, DOWNSTREAM, 148.5, T0.fromtimestamp(T0.timestamp() + 42, tz=timezone.utc),
                       "tx-deposit-sweep"),
                ],
                DOWNSTREAM: [],
            }
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=SweepingNonTerminalClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    assert body["attribution"]["walletAddress"] == DEPOSIT
    assert body["attribution"]["gatePassed"] is True
    assert body["attribution"]["entityName"] == "Fictional Bait Exchange"
    assert body["attribution"]["breakdown"]["sweep_confirmed"] is True

    deposit_hop = next(h for h in body["hops"] if h["addr"] == DEPOSIT)
    assert deposit_hop["stopReason"] is None  # confirms it's NOT a terminal hop


def test_sweep_check_is_anchored_to_this_trace_own_funding_transfer():
    # OLDHIST's full history contains an old, totally unrelated transfer pair (from
    # OLD_UNRELATED, 10 days before the incident) that looks like a textbook sweep if you
    # anchor on the wallet's globally-earliest-ever incoming transfer. But THIS trace's own
    # money (from SUSPECT, at T0) is never forwarded onward at all. The sweep check must be
    # evaluated against the real funding transfer, not the misleading old one.
    class MisleadingHistoryClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            data = {
                SUSPECT: [mk(SUSPECT, OLDHIST, 150, T0, "tx-suspect-to-oldhist")],
                OLDHIST: [
                    mk(OLD_UNRELATED, OLDHIST, 500,
                       T0.fromtimestamp(T0.timestamp() - 10 * 86400, tz=timezone.utc), "tx-old-in"),
                    mk(OLDHIST, "old-sink", 495,
                       T0.fromtimestamp(T0.timestamp() - 10 * 86400 + 30, tz=timezone.utc), "tx-old-out"),
                    mk(OLD_PAYER_X, OLDHIST, 10, T0.fromtimestamp(T0.timestamp() - 5, tz=timezone.utc), "tx-x"),
                    mk(OLD_PAYER_Y, OLDHIST, 10, T0.fromtimestamp(T0.timestamp() - 5, tz=timezone.utc), "tx-y"),
                    mk(SUSPECT, OLDHIST, 150, T0, "tx-suspect-to-oldhist"),
                    # no outgoing at/after T0 -- this trace's own money never moves onward.
                ],
            }
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=MisleadingHistoryClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    assert body["attribution"]["walletAddress"] == OLDHIST
    assert body["attribution"]["breakdown"]["distinct_payers_ok"] is True  # payer gate alone would pass
    assert body["attribution"]["breakdown"]["sweep_confirmed"] is False
    assert body["attribution"]["gatePassed"] is False
    assert body["attribution"]["entityName"] == "UNKNOWN"


def test_candidate_history_refetch_failure_does_not_500():
    # The tracer's own fetch of CANDIDATE_FAILS succeeds (caught internally, per tracer.py's
    # own guard) only insofar as it's called once during the BFS; every call to
    # get_transfers(CANDIDATE_FAILS) actually raises. The attribution loop's OWN refetch of
    # this candidate's full history must be guarded independently -- an unguarded refetch
    # would 500 the whole endpoint.
    class RaisingForCandidateClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            if address == CANDIDATE_FAILS:
                raise RuntimeError("chain API unavailable")
            data = {SUSPECT: [mk(SUSPECT, CANDIDATE_FAILS, 150, T0, "tx-suspect-to-candidate")]}
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=RaisingForCandidateClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"]["walletAddress"] == CANDIDATE_FAILS
    assert body["attribution"]["gatePassed"] is False
    assert body["attribution"]["entityName"] == "UNKNOWN"
    assert body["unreportedVictims"] == []
    # F3-followup: a fetch failure must produce its own honest "couldn't check" reasoning,
    # never the payer-gate's "0 people sent money into this wallet" phrasing -- that would
    # read as a checked fact about the wallet rather than an infrastructure failure to read it.
    assert "could not check" in body["attribution"]["reasoning"].lower()
    assert "0" not in body["attribution"]["reasoning"]
    assert body["attribution"]["breakdown"] == {"data_unavailable": True}


def test_suspect_history_refetch_failure_does_not_500():
    # The tracer's OWN initial fetch of the suspect wallet succeeds (first call); the LATER,
    # separate refetch of the suspect's full history (used for innocence scoring) fails on
    # a subsequent call to the same address. This must be guarded independently of the
    # tracer's own internal guard.
    class RaisingOnSecondSuspectCallClient:
        chain = "tron"

        def __init__(self):
            self._calls = 0

        def get_transfers(self, address, since=None):
            self._calls += 1
            if self._calls == 1:
                return []
            raise RuntimeError("chain API unavailable")

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=RaisingOnSecondSuspectCallClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"]["entityName"] == "UNKNOWN"
    assert body["innocence"]["innocenceScore"] is not None


def test_unreported_victims_excludes_every_wallet_already_in_the_trace_path():
    # 3-hop trace: SUSPECT -> MIDDLE -> FINAL. MIDDLE is an intermediate hop in the criminal's
    # own path, but it's ALSO recorded as a payer into FINAL in the chain client's fixture --
    # it must be excluded from unreportedVictims (it's not a genuine additional victim).
    # THIRDPARTY (+ two more distinct payers, added for Task G4 so this wallet clears the
    # deposit gate's distinct-payer bar and enumeration actually runs) are genuinely separate
    # payers into FINAL and must still be included. Label patched to a vetted one so the
    # remaining gate check (label_vetted) also clears -- this test is about the exclusion
    # logic, not the gate itself, so the fixture must satisfy the gate to reach that logic.
    class MultiHopVictimClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            data = {
                SUSPECT: [mk(SUSPECT, MIDDLE, 150, T0, "tx-suspect-to-middle")],
                MIDDLE: [mk(MIDDLE, FINAL, 148,
                             T0.fromtimestamp(T0.timestamp() + 10, tz=timezone.utc), "tx-middle-to-final")],
                FINAL: [
                    mk(MIDDLE, FINAL, 148,
                       T0.fromtimestamp(T0.timestamp() + 10, tz=timezone.utc), "tx-middle-to-final"),
                    mk(THIRDPARTY, FINAL, 500,
                       T0.fromtimestamp(T0.timestamp() - 86400, tz=timezone.utc), "tx-thirdparty-to-final"),
                    mk(OLD_PAYER_X, FINAL, 20,
                       T0.fromtimestamp(T0.timestamp() - 90000, tz=timezone.utc), "tx-x-to-final"),
                    mk(OLD_PAYER_Y, FINAL, 20,
                       T0.fromtimestamp(T0.timestamp() - 90000, tz=timezone.utc), "tx-y-to-final"),
                ],
            }
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=MultiHopVictimClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    assert body["attribution"]["walletAddress"] == FINAL
    assert body["attribution"]["breakdown"]["distinct_payers_ok"] is True
    payer_addresses = {v["payerAddress"] for v in body["unreportedVictims"]}
    assert payer_addresses == {THIRDPARTY, OLD_PAYER_X, OLD_PAYER_Y}
    assert MIDDLE not in payer_addresses


# ---------------------------------------------------------------------------
# Task F11 (I10 partial + I11): HopOut.role / HopOut.flag must be plain English, not the raw
# internal "suspect"/"intermediate" role literals or stop_reason codes
# ("no_outgoing_activity", "no_further_transfers", "hop_cap_reached", "api_read_failure").
# `stopReason` is a separate schema field and intentionally keeps the raw code.
# ---------------------------------------------------------------------------

RAW_ROLE_CODES = {"suspect", "intermediate"}
RAW_STOP_REASON_CODES = {
    "no_outgoing_activity", "no_further_transfers", "hop_cap_reached", "api_read_failure",
}

# Same pattern as test_deposit_gate.py / test_innocence.py's JARGON_WORDS + assert_no_jargon.
JARGON_WORDS = [
    "hop", "gate", "taint", "sweep", "fifo", "distinct payers", "causal", "stop reason",
    "vetted", "predecessor",
]

def assert_no_jargon(text: str):
    lowered = text.lower()
    for word in JARGON_WORDS:
        assert word not in lowered, f"jargon word '{word}' found in: {text}"

# ---------------------------------------------------------------------------
# Task G3 (I-B): a chain-API read failure must never produce a false confident statement.
# Three named instances (conservation, attribution's empty-candidates default message,
# innocence's history-based factor -- the last one covered end-to-end here and at the unit
# level in test_innocence.py) plus a 4th found while fixing the named three
# (unreported-victims enumeration failure).
# ---------------------------------------------------------------------------

FAIL_WALLET = "TFailWalletVVVVVVVVVVVVVVVVVVVVVVVV"
VICTIM_ENUM_FAILS = "TVictimEnumFailsWWWWWWWWWWWWWWWWWWWW"


def test_conservation_excludes_unread_terminal_hop_and_flags_data_unavailable():
    # SUSPECT's own history reads fine (forwards 150 to FAIL_WALLET), but FAIL_WALLET's own
    # history read fails -- its hop becomes a terminal hop via stop_reason "api_read_failure",
    # carrying the full 150 taint. Under the OLD behavior, that taint was summed into
    # outgoingTotal like any other terminal hop, making conservation report a fully
    # "reconciled" trail (remainder 0) as if the trace had verified the money stopped moving
    # there -- when really it just couldn't check.
    class ConservationFailureClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            if address == FAIL_WALLET:
                raise RuntimeError("chain API unavailable")
            data = {SUSPECT: [mk(SUSPECT, FAIL_WALLET, 150, T0, "tx-suspect-to-fail")]}
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=ConservationFailureClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=None):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    # The unread hop's taint must be excluded from outgoingTotal (never counted as "verified
    # to have stopped here"), and the trace must never claim "reconciled" when a read failure,
    # not a genuinely closed trail, is the real reason the money can't be accounted for.
    assert body["conservation"]["outgoingTotal"] == pytest.approx(0.0)
    assert body["conservation"]["dataUnavailable"] is True
    assert body["conservation"]["reconciled"] is False
    assert body["conservation"]["remainder"] == pytest.approx(150.0)


def test_attribution_default_message_is_honest_when_first_hop_read_fails():
    # The very first read (the suspect wallet's own outgoing transfers, inside tracer.py)
    # fails, so `result.hops` never grows past hop 0 and `candidates` is empty. Under the OLD
    # behavior this hit the hardcoded default "no wallet ever received any of the victim's
    # money" -- confidently wrong, since the truth is simply that we couldn't read anything.
    class SuspectReadFailsClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            raise RuntimeError("chain API unavailable")

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=SuspectReadFailsClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=None):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    assert body["attribution"]["entityName"] == "UNKNOWN"
    assert body["attribution"]["breakdown"] == {"data_unavailable": True}
    reasoning = body["attribution"]["reasoning"].lower()
    assert "never received" not in reasoning
    assert "could not read" in reasoning or "could not check" in reasoning


def test_unreported_victims_enumeration_failure_flags_data_unavailable():
    # The candidate's own history read succeeds well enough to be evaluated (or fails and is
    # reported honestly, per the existing F3-followup fix), but the SEPARATE backward
    # victim-enumeration read of the same wallet fails every time. Under the OLD behavior
    # `unreportedVictims == []` was indistinguishable from "we checked this wallet's payers and
    # genuinely found no other victims" -- the same false-confident-empty-list bug as the 3
    # named instances, just surfacing as a list instead of a message or a number.
    #
    # Task G4: enumeration now only runs when `gate.gate_passed` is True, so this fixture must
    # make VICTIM_ENUM_FAILS's reads succeed enough times to actually reach and pass the gate
    # before the enumeration read fails. VICTIM_ENUM_FAILS is read from THIS wallet address
    # twice before enumeration ever runs: once by the tracer's own BFS (discovering this hop
    # has no further causal outgoing edges) and once by the attribution loop's own gate-eval
    # refetch (counting distinct payers). Only the THIRD read -- the separate call inside
    # `enumerate_unreported_victims` -- must fail; otherwise the gate read failing too would
    # make `gate is None` and this test would no longer be exercising the enumeration-failure
    # path at all.
    class RaisingOnThirdReadForVictimEnumerationClient:
        chain = "tron"

        def __init__(self):
            self._venum_calls = 0

        def get_transfers(self, address, since=None):
            if address == VICTIM_ENUM_FAILS:
                self._venum_calls += 1
                if self._venum_calls > 2:
                    raise RuntimeError("chain API unavailable")
                return [
                    mk(SUSPECT, VICTIM_ENUM_FAILS, 150, T0, "tx-suspect-to-venum"),
                    mk(PAYER1, VICTIM_ENUM_FAILS, 60,
                       T0.fromtimestamp(T0.timestamp() - 40, tz=timezone.utc), "tx-p1-to-venum"),
                    mk(PAYER2, VICTIM_ENUM_FAILS, 75,
                       T0.fromtimestamp(T0.timestamp() - 20, tz=timezone.utc), "tx-p2-to-venum"),
                ]
            data = {SUSPECT: [mk(SUSPECT, VICTIM_ENUM_FAILS, 150, T0, "tx-suspect-to-venum")]}
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client",
               return_value=RaisingOnThirdReadForVictimEnumerationClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    # Confirms the gate itself passed (so enumeration was actually attempted, not skipped by
    # the G4 guard) before asserting on the enumeration-failure signal.
    assert body["attribution"]["breakdown"]["distinct_payers_ok"] is True
    assert body["unreportedVictims"] == []
    assert body["unreportedVictimsDataUnavailable"] is True


def test_innocence_history_unavailable_when_suspect_refetch_fails():
    # The tracer's OWN initial fetch of the suspect wallet succeeds (empty history, so the
    # trace itself has nothing to follow); the LATER, separate refetch of the suspect's full
    # history (used only for innocence scoring) fails. Under the OLD behavior this silently
    # fed `[]` into compute_innocence, indistinguishable from a genuinely history-less wallet,
    # firing the accusatory "no activity before the incident" factor as if it were a checked
    # fact.
    class RaisingOnSecondSuspectCallClient:
        chain = "tron"

        def __init__(self):
            self._calls = 0

        def get_transfers(self, address, since=None):
            self._calls += 1
            if self._calls == 1:
                return []
            raise RuntimeError("chain API unavailable")

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=RaisingOnSecondSuspectCallClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    checks = [f["check"] for f in body["innocence"]["factors"]]
    assert "no_pre_incident_history" not in checks
    assert "history_unavailable" in checks


# ---------------------------------------------------------------------------
# Task G4 (I-C): unreported-victim enumeration must not run on an unverified fallback wallet.
# ---------------------------------------------------------------------------

FALLBACK_WALLET = "TFallbackWalletXXXXXXXXXXXXXXXXXXXX"
SPURIOUS_PAYER = "TSpuriousPayerYYYYYYYYYYYYYYYYYYYYYY"


def test_unreported_victims_empty_when_no_candidate_passes_the_deposit_gate():
    # FALLBACK_WALLET is the only candidate (taint > 0), and it never passes the deposit gate:
    # only 2 distinct payers into it (SUSPECT + SPURIOUS_PAYER), well under
    # MIN_DISTINCT_PAYERS=3. Attribution therefore falls back to `evaluated[-1]` -- this same
    # unverified wallet. SPURIOUS_PAYER is a real inbound payer into it that is NOT already a
    # known wallet in the trace's own hop list, so if unreported-victim enumeration ran
    # unconditionally on this fallback wallet (the pre-fix behavior), SPURIOUS_PAYER would be
    # reported to the officer as a "victim" of this case -- despite the wallet never having
    # been confirmed as any kind of real collection hub. This is exactly the harm G4 exists to
    # prevent.
    class FallbackNoGateClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            data = {
                SUSPECT: [mk(SUSPECT, FALLBACK_WALLET, 150, T0, "tx-suspect-to-fallback")],
                FALLBACK_WALLET: [
                    mk(SUSPECT, FALLBACK_WALLET, 150, T0, "tx-suspect-to-fallback"),
                    mk(SPURIOUS_PAYER, FALLBACK_WALLET, 40,
                       T0.fromtimestamp(T0.timestamp() - 30, tz=timezone.utc), "tx-spurious-payer"),
                ],
            }
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=FallbackNoGateClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    assert body["attribution"]["walletAddress"] == FALLBACK_WALLET
    assert body["attribution"]["breakdown"]["distinct_payers_ok"] is False
    assert body["attribution"]["gatePassed"] is False

    # The real assertion: no spurious victims reported from this unverified fallback wallet.
    assert body["unreportedVictims"] == []
    payer_addresses = {v["payerAddress"] for v in body["unreportedVictims"]}
    assert SPURIOUS_PAYER not in payer_addresses
    assert body["unreportedVictimsDataUnavailable"] is False
    # P1.6 minor fix: `unreportedVictims == []` here means enumeration was never attempted
    # (the deposit gate never passed), not "attempted, found nobody" -- must be disambiguated.
    assert body["unreportedVictimsAttempted"] is False


# ---------------------------------------------------------------------------
# P1.6 minor fix: `TraceOut.unreportedVictims == []` was ambiguous between "gate never
# passed, enumeration never attempted" and "enumerated, genuinely found nobody new". The
# case above proves the "never attempted" side; this proves the "attempted, found nobody
# new" side -- gate.gate_passed is True (a real deposit wallet, 3+ distinct payers, vetted
# label), enumeration genuinely runs, but every one of that wallet's payers turns out to
# already be a wallet this same trace visited (a sibling branch straight out of the
# suspect wallet) -- so `enumerate_unreported_victims` correctly excludes all of them and
# returns [], same empty shape as the never-attempted case, but for a different reason.
# ---------------------------------------------------------------------------

ATTEMPTED_DEPOSIT = "TAttemptedDepositWalletVVVVVVVVVVVV"
ATTEMPTED_PAYER1 = "TAttemptedPayer1XXXXXXXXXXXXXXXXXXXX"
ATTEMPTED_PAYER2 = "TAttemptedPayer2YYYYYYYYYYYYYYYYYYYY"


def test_unreported_victims_attempted_true_but_empty_when_every_payer_already_known():
    class AllPayersAlreadyKnownClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            data = {
                # 3 separate causal branches straight out of SUSPECT: the two "payer" wallets
                # are funded directly by SUSPECT too, which makes them hops in THIS trace's own
                # path (and so members of `known_victim_addresses`) even though they are ALSO
                # ATTEMPTED_DEPOSIT's other depositors below.
                SUSPECT: [
                    mk(SUSPECT, ATTEMPTED_PAYER1, 5, T0, "tx-suspect-to-payer1"),
                    mk(SUSPECT, ATTEMPTED_PAYER2, 5, T0, "tx-suspect-to-payer2"),
                    mk(SUSPECT, ATTEMPTED_DEPOSIT, 140, T0, "tx-suspect-to-deposit"),
                ],
                ATTEMPTED_PAYER1: [],
                ATTEMPTED_PAYER2: [],
                ATTEMPTED_DEPOSIT: [
                    mk(SUSPECT, ATTEMPTED_DEPOSIT, 140, T0, "tx-suspect-to-deposit"),
                    mk(ATTEMPTED_PAYER1, ATTEMPTED_DEPOSIT, 30,
                       T0.fromtimestamp(T0.timestamp() - 40, tz=timezone.utc), "tx-p1-to-deposit"),
                    mk(ATTEMPTED_PAYER2, ATTEMPTED_DEPOSIT, 25,
                       T0.fromtimestamp(T0.timestamp() - 20, tz=timezone.utc), "tx-p2-to-deposit"),
                ],
            }
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=AllPayersAlreadyKnownClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    # Confirms the deposit gate itself genuinely passed on ATTEMPTED_DEPOSIT (3 distinct
    # payers: SUSPECT, ATTEMPTED_PAYER1, ATTEMPTED_PAYER2) -- so enumeration really did run,
    # not skip via the G4 guard the way the previous test's fixture does.
    assert body["attribution"]["walletAddress"] == ATTEMPTED_DEPOSIT
    assert body["attribution"]["breakdown"]["distinct_payers_ok"] is True

    # Both payers into ATTEMPTED_DEPOSIT are already wallets this trace visited directly, so
    # enumeration correctly finds zero NEW victims -- same empty list as the never-attempted
    # case, but `unreportedVictimsAttempted` must now read True.
    assert body["unreportedVictims"] == []
    assert body["unreportedVictimsDataUnavailable"] is False
    assert body["unreportedVictimsAttempted"] is True


def test_hop_role_and_flag_are_plain_english_not_raw_codes():
    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    hops = body["hops"]
    assert len(hops) >= 1

    for hop in hops:
        # role/flag must never be the raw internal codes verbatim.
        assert hop["role"] not in RAW_ROLE_CODES
        assert hop["role"], "role must not be empty"
        assert_no_jargon(hop["role"])
        if hop["flag"] is not None:
            assert hop["flag"] not in RAW_STOP_REASON_CODES
            assert_no_jargon(hop["flag"])
        # stopReason is the separate, still-raw machine-readable field -- untouched by this fix.
        if hop["stopReason"] is not None:
            assert hop["stopReason"] in RAW_STOP_REASON_CODES

    # The suspect's own hop (n == 0) gets the plain-English "suspect" role text.
    suspect_hop = next(h for h in hops if h["n"] == 0)
    assert suspect_hop["role"] == "Suspect's wallet"

    # At least one non-suspect hop exists and carries the plain-English "intermediate" role.
    other_hops = [h for h in hops if h["n"] != 0]
    assert other_hops
    assert all(h["role"] == "Wallet the money passed through" for h in other_hops)

    # The terminal hop (COLD, in this fixture) has no further outgoing activity, so its flag
    # must be the plain-English translation of "no_outgoing_activity", not the code itself.
    flagged = [h for h in hops if h["flag"] is not None]
    assert flagged, "expected at least one hop to carry a plain-English stop flag"
    assert all(h["flag"] == "This wallet never sent this money anywhere else" for h in flagged)


# ---------------------------------------------------------------------------
# Hop DB persistence (this task): `run_trace` must actually write `Hop` rows, not just
# compute the in-memory `hops_out` list used for the API response -- `Hop` existed since
# Task H0 scaffolding but nothing ever wrote to it, leaving `screen_case_hops` and
# `app/evidence/pack.py`'s hop query permanently empty for every real case.
# ---------------------------------------------------------------------------

def test_trace_persists_hop_rows_matching_the_response():
    case_id = _make_case()

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    db = TestSession()
    try:
        rows = db.query(Hop).filter(Hop.case_id == case_id).order_by(Hop.hop_index).all()
    finally:
        db.close()

    # At least one row was persisted, and the row count matches the number of hops the same
    # call returned in its own response.
    assert len(rows) > 0
    assert len(rows) == len(body["hops"])

    hops_out_by_index = {h["n"]: h for h in body["hops"]}
    for row in rows:
        out = hops_out_by_index[row.hop_index]
        assert row.wallet_address == out["addr"]
        assert row.chain == out["chain"]
        assert row.hop_index == out["n"]
        assert row.stop_reason == out["stopReason"]
        assert row.flag == out["flag"]
        assert row.route_label == "routeA"
        assert row.amount == pytest.approx(out["amt"])


def test_trace_persists_hop_rows_even_when_there_are_zero_attribution_candidates():
    # This is the specific commit-placement bug this task fixes: the ORIGINAL only
    # `db.commit()` in `run_trace` sits inside the `if candidates:` branch. A suspect wallet
    # with no outgoing activity at all produces zero candidates (`result.hops` is just the
    # single hop-0 suspect entry, which never satisfies `hop.hop_index > 0`), so that branch
    # is never entered -- any `Hop` row added before it would never have been committed.
    class NoOutgoingActivityClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            return []

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=NoOutgoingActivityClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=None):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    # Confirm this response really did hit the zero-candidates path (no wallet past the
    # suspect ever received any of the victim's money), otherwise this test would not be
    # exercising the bug it claims to.
    assert body["attribution"]["breakdown"] == {}

    db = TestSession()
    try:
        rows = db.query(Hop).filter(Hop.case_id == case_id).all()
    finally:
        db.close()

    assert len(rows) > 0
    assert len(rows) == len(body["hops"])
    assert rows[0].wallet_address == SUSPECT
    assert rows[0].tx_hash is None  # hop 0 has no funding_transfer


# ---------------------------------------------------------------------------
# Idempotency fix (whole-branch review, 2026-09-26): calling POST /trace twice for the same,
# unchanged case must not duplicate persisted rows or re-fire side effects. The bug proven by
# the review's executed probe: Hop rows duplicated, AttributionCandidate rows duplicated, a
# duplicate "attribution.result" audit entry, and `deliver_webhooks` fired a second time --
# even though `auto_flag_wallet`'s own FlaggedWallet row correctly merges `case_ids` and does
# NOT duplicate.
# ---------------------------------------------------------------------------

def test_run_trace_twice_is_idempotent_for_hops_candidates_and_webhooks():
    # Reuses the exact gate-passing fixture from
    # test_trace_endpoint_confirms_attribution_when_payers_and_sweep_both_hold so this also
    # exercises the auto-flag / webhook-scheduling path (only reachable when the gate passes).
    case_id = _make_case()

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL), \
         patch("app.api.v1.traces.vasp_distribution.deliver_webhooks") as mock_deliver:
        first = client.post(f"/api/v1/cases/{case_id}/trace")
        assert first.status_code == 200
        assert first.json()["attribution"]["gatePassed"] is True
        assert mock_deliver.call_count == 1

        db = TestSession()
        try:
            hop_count_after_first = db.query(Hop).filter(Hop.case_id == case_id).count()
            candidate_count_after_first = db.query(AttributionCandidate).filter(
                AttributionCandidate.case_id == case_id).count()
        finally:
            db.close()
        assert hop_count_after_first > 0
        assert candidate_count_after_first > 0

        # Second, identical call for the same unchanged case.
        second = client.post(f"/api/v1/cases/{case_id}/trace")
        assert second.status_code == 200
        assert second.json()["attribution"]["gatePassed"] is True

        db = TestSession()
        try:
            hop_count_after_second = db.query(Hop).filter(Hop.case_id == case_id).count()
            candidate_count_after_second = db.query(AttributionCandidate).filter(
                AttributionCandidate.case_id == case_id).count()
        finally:
            db.close()

        # Row counts must not double.
        assert hop_count_after_second == hop_count_after_first
        assert candidate_count_after_second == candidate_count_after_first
        # deliver_webhooks must not be invoked a second time for this unchanged attribution --
        # the wallet's gate-passed status (and FlaggedWallet.case_ids membership) hasn't changed
        # since the first run.
        assert mock_deliver.call_count == 1


# ---------------------------------------------------------------------------
# Task 3 (cross-chain bridge linking): wiring `get_client_for_chain` into the live trace path --
# a real TRON deposit into the (real, verified) Allbridge Core bridge contract, confirmed by a
# matching Ethereum-side withdrawal, must continue the SAME trace onto the Ethereum recipient,
# tag the bridge contract's own hop with the "Bridge contract" role, and never evaluate the
# bridge contract itself as an attribution candidate.
# ---------------------------------------------------------------------------

def test_trace_crosses_a_confirmed_bridge_onto_the_paired_chain():
    from app.bridge.registry import KNOWN_BRIDGES
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")

    deposit = mk(SUSPECT, tron_bridge.contract_address, 150.0, T0, tx="tx-deposit-to-bridge")
    withdrawal_ts = T0.fromtimestamp(T0.timestamp() + 600, tz=timezone.utc)
    withdrawal = Transfer(
        tx_hash="tx-bridge-withdrawal", chain="ethereum",
        from_address=tron_bridge.paired_contract_address, to_address="0xethrecipient00000000000000000000000001",
        amount=Decimal("147.5"), asset="USDT-ERC20", timestamp=withdrawal_ts, fee=Decimal("0"), raw={},
    )

    class TronSideClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            data = {SUSPECT: [deposit], tron_bridge.contract_address: []}
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    class EthSideClient:
        chain = "ethereum"
        def get_transfers(self, address, since=None):
            data = {tron_bridge.paired_contract_address: [withdrawal], "0xethrecipient00000000000000000000000001": []}
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    def fake_get_chain_client(chain, asset=None):
        return {"tron": TronSideClient(), "ethereum": EthSideClient()}[chain]

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", side_effect=fake_get_chain_client):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    chains_in_trail = {h["chain"] for h in body["hops"]}
    assert chains_in_trail == {"tron", "ethereum"}

    bridge_hop = next(h for h in body["hops"] if h["addr"] == tron_bridge.contract_address)
    assert bridge_hop["role"] == "Bridge contract"

    assert len(body["bridgeLinks"]) == 1
    assert body["bridgeLinks"][0]["sideAChain"] == "tron"
    assert body["bridgeLinks"][0]["sideBChain"] == "ethereum"
    assert body["bridgeLinks"][0]["confidence"] >= 0.6

    # Every bridge link is a heuristic timing/amount correlation, never a confirmed match --
    # each one must carry a non-trivial disclaimer saying so (mirrors the mandatory
    # `disclaimer` field on SimilarOperatorsOut / SIMILARITY_DISCLAIMER for operator-fingerprint
    # results). Checked by keyword, not exact string, so wording tweaks don't make this brittle.
    for link in body["bridgeLinks"]:
        disclaimer = link.get("disclaimer", "")
        assert len(disclaimer.strip()) > 20
        lowered = disclaimer.lower()
        assert "not" in lowered
        assert "verify" in lowered

    eth_hop = next(h for h in body["hops"] if h["addr"] == "0xethrecipient00000000000000000000000001")
    assert eth_hop["amt"] == pytest.approx(147.5)  # fee-adjusted, not re-inflated to 150


def test_bridge_contract_itself_is_never_evaluated_as_an_attribution_candidate():
    from app.bridge.registry import KNOWN_BRIDGES
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")

    deposit = mk(SUSPECT, tron_bridge.contract_address, 150.0, T0, tx="tx-deposit-to-bridge")

    class TronSideClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            # Give the bridge contract itself plenty of distinct payers -- exactly the shape
            # that could otherwise look like a fake deposit wallet if not explicitly excluded.
            data = {
                SUSPECT: [deposit],
                tron_bridge.contract_address: [
                    mk(f"payer{i}", tron_bridge.contract_address, 10, T0, tx=f"tx-payer-{i}")
                    for i in range(5)
                ] + [deposit],
            }
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    class EthSideClient:
        chain = "ethereum"
        def get_transfers(self, address, since=None):
            return []  # no matching withdrawal -- crossing stays unconfirmed

    def fake_get_chain_client(chain, asset=None):
        return {"tron": TronSideClient(), "ethereum": EthSideClient()}[chain]

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", side_effect=fake_get_chain_client):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    # The bridge contract must never be named as the exchange/attribution wallet, no matter
    # how many distinct payers it has -- it's a bridge, not a collection wallet.
    assert body["attribution"]["walletAddress"] != tron_bridge.contract_address


# ---------------------------------------------------------------------------
# Mixer-entry detection (docs/superpowers/specs/2026-09-26-mixer-entry-detection-design.md):
# a real trace whose money enters a known (real, verified) Tornado Cash contract must stop
# there honestly with the plain-English "entered_mixer" reason, and that mixer contract must
# never be reported as the attribution wallet.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Innocence-score persistence (this task): a real trace must write the innocence score/factors
# onto the case row, not just return them in the response -- a LATER, separate request
# (app/api/v1/legal.py's create_notice) has no other way to see a case's innocence score.
# ---------------------------------------------------------------------------

def test_trace_persists_innocence_score_onto_the_case_row():
    from app.models import Case

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    db = TestSession()
    try:
        case = db.get(Case, case_id)
    finally:
        db.close()

    assert case.innocence_score == pytest.approx(body["innocence"]["innocenceScore"])
    assert case.innocence_factors is not None
    persisted_checks = {f["check"] for f in case.innocence_factors}
    response_checks = {f["check"] for f in body["innocence"]["factors"]}
    assert persisted_checks == response_checks


def test_run_trace_twice_overwrites_the_case_innocence_fields_without_error():
    # Repeat trace runs must just overwrite the case's own single innocence score/factors --
    # no delete step is needed the way there is for Hop/AttributionCandidate (list-shaped
    # tables), but a second run must not error out or leave stale data mismatched with the
    # freshest response.
    from app.models import Case

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL):
        first = client.post(f"/api/v1/cases/{case_id}/trace")
        second = client.post(f"/api/v1/cases/{case_id}/trace")

    assert first.status_code == 200
    assert second.status_code == 200

    db = TestSession()
    try:
        case = db.get(Case, case_id)
    finally:
        db.close()

    assert case.innocence_score == pytest.approx(second.json()["innocence"]["innocenceScore"])


def test_trace_stops_honestly_when_money_enters_a_known_mixer():
    from app.mixers.registry import KNOWN_MIXERS
    mixer = KNOWN_MIXERS[0]
    eth_suspect = "0xsuspectwallet00000000000000000000000001"

    deposit = Transfer(
        tx_hash="tx-deposit-to-mixer", chain="ethereum",
        from_address=eth_suspect, to_address=mixer.contract_address,
        amount=Decimal("0.1"), asset="ETH", timestamp=T0, fee=Decimal("0"), raw={},
    )

    class EthSuspectClient:
        chain = "ethereum"
        def get_transfers(self, address, since=None):
            data = {eth_suspect: [deposit], mixer.contract_address: []}
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    payload = {
        "ncrp": "NCRP-3", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 15000, "amountCrypto": 0.1, "asset": "ETH", "chain": "ethereum",
        "suspectWallet": eth_suspect,
    }
    case_id = client.post("/api/v1/cases", json=payload).json()["id"]

    with patch("app.api.v1.traces.get_chain_client", return_value=EthSuspectClient()):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    mixer_hop = next(h for h in body["hops"] if h["addr"].lower() == mixer.contract_address.lower())
    assert mixer_hop["stopReason"] == "entered_mixer"
    assert mixer_hop["flag"] == (
        "This wallet sent the money into a cryptocurrency mixing service, which is "
        "specifically designed to hide where money goes next — we cannot trace beyond "
        "this point"
    )

    # The mixer contract must never be reported as the attribution/exchange wallet, no
    # matter how many distinct depositors it has by design.
    assert body["attribution"]["walletAddress"].lower() != mixer.contract_address.lower()


# ---------------------------------------------------------------------------
# Task 7 / Task B (docs/superpowers/specs/2026-09-27-inverted-deposit-index-design.md):
# wire lookup_indexed_deposit into the live candidate-evaluation loop. An index hit must
# satisfy the label-vetting half of evaluate_deposit_gate on its own (TERMINAL has no live
# vetted label in these two tests -- lookup_label is patched to return None, standing in for
# an unvetted/absent live label), but must NOT bypass the independent sweep-signal check --
# final_gate_passed stays `gate.gate_passed and sweep_signal.is_sweep` exactly as before.
# ---------------------------------------------------------------------------

def test_indexed_deposit_hit_satisfies_gate_when_sweep_also_holds():
    case_id = _make_case()
    db = TestSession()
    try:
        db.add(DepositIndexEntry(
            address=TERMINAL, chain="tron",
            hot_wallet_address="TVettedHotWalletPositiveCase00000001",
            entity_name="Indexed Real Exchange",
        ))
        db.commit()
    finally:
        db.close()

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeChainClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=None):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"]["gatePassed"] is True
    assert body["attribution"]["entityName"] == "Indexed Real Exchange"
    assert body["attribution"]["breakdown"]["index_hit"] is True
    assert body["attribution"]["breakdown"]["sweep_confirmed"] is True


def test_indexed_deposit_hit_alone_does_not_bypass_the_sweep_check():
    # Same indexed hit as above, but the sweep transfer predates the earliest inbound transfer
    # (same fixture shape as test_trace_endpoint_withholds_attribution_when_sweep_does_not_hold
    # above), so detect_sweep correctly reports no sweep. The label-vetting half of the gate is
    # fully satisfied via the index, but the gate must still fail overall.
    class SlowSweepClient(FakeChainClient):
        def get_transfers(self, address, since=None):
            if address == TERMINAL:
                base = super().get_transfers(address, since)
                return [t for t in base if t.to_address != COLD and t.from_address != TERMINAL] + [
                    mk(TERMINAL, COLD, 198, T0.fromtimestamp(T0.timestamp() - 86400, tz=timezone.utc), "tx-sweep-slow"),
                ]
            return super().get_transfers(address, since)

    case_id = _make_case()
    db = TestSession()
    try:
        db.add(DepositIndexEntry(
            address=TERMINAL, chain="tron",
            hot_wallet_address="TVettedHotWalletNegativeCase0000001",
            entity_name="Indexed Real Exchange",
        ))
        db.commit()
    finally:
        db.close()

    with patch("app.api.v1.traces.get_chain_client", return_value=SlowSweepClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=None):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"]["gatePassed"] is False
    assert body["attribution"]["entityName"] == "UNKNOWN"
    assert body["attribution"]["breakdown"]["index_hit"] is True
    assert body["attribution"]["breakdown"]["sweep_confirmed"] is False
