# backend/tests/unit/test_verified_predecessor.py
from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.tracing.tracer import TraceHop
from app.api.v1.traces import _verified_predecessor

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def mk_hop(hop_index, wallet, funding_from=None, ts=T0):
    funding = None
    if funding_from is not None:
        funding = Transfer(tx_hash="tx", chain="tron", from_address=funding_from, to_address=wallet,
                            amount=Decimal("100"), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})
    return TraceHop(hop_index, wallet, "tron", funding, [], Decimal("100"), None)


def test_verified_predecessor_matches_genuine_immediate_predecessor():
    # A normal, valid 2-hop trace: hop 0 is the suspect wallet, hop 1 is funded directly by
    # hop 0's own address. This mirrors the pre-fix behavior for any hop the tracer genuinely
    # produced -- the check should resolve to the same address as before.
    hop0 = mk_hop(0, "suspect_wallet")
    hop1 = mk_hop(1, "terminal_wallet", funding_from="suspect_wallet")
    hops = [hop0, hop1]

    assert _verified_predecessor(hops, hop1) == "suspect_wallet"


def test_verified_predecessor_returns_none_when_funding_transfer_has_no_matching_hop():
    # Data-integrity break: the terminal hop's recorded funding transfer claims to come from
    # "some_unrelated_address", but no hop in the trace's own hop list at hop_index - 1 has
    # that wallet address. Under the old (tautological) code, `expected_predecessor` was
    # derived straight from this same funding_transfer field, so this could never be caught.
    # This is the regression test that proves the guard can now actually fail.
    hop0 = mk_hop(0, "suspect_wallet")
    hop1 = mk_hop(1, "terminal_wallet", funding_from="some_unrelated_address")
    hops = [hop0, hop1]

    assert _verified_predecessor(hops, hop1) is None
