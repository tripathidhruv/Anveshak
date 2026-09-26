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
    # THIRDPARTY is a genuinely separate payer into FINAL and must still be included.
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
                ],
            }
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=MultiHopVictimClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=None):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    assert body["attribution"]["walletAddress"] == FINAL
    payer_addresses = {v["payerAddress"] for v in body["unreportedVictims"]}
    assert payer_addresses == {THIRDPARTY}
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
    class RaisingForVictimEnumerationClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            if address == VICTIM_ENUM_FAILS:
                raise RuntimeError("chain API unavailable")
            data = {SUSPECT: [mk(SUSPECT, VICTIM_ENUM_FAILS, 150, T0, "tx-suspect-to-venum")]}
            return data.get(address, [])

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", return_value=RaisingForVictimEnumerationClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED_LABEL_ANY):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
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
