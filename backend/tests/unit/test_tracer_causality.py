from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.tracing.tracer import trace

class FakeChainClient:
    chain = "tron"
    def __init__(self, transfers_by_address: dict[str, list[Transfer]]):
        self._by_address = transfers_by_address
    def get_transfers(self, address, since=None):
        transfers = self._by_address.get(address, [])
        if since is not None:
            transfers = [t for t in transfers if t.timestamp >= since]
        return sorted(transfers, key=lambda t: t.timestamp)

def mk(from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

def test_rejects_outgoing_tx_that_predates_the_funding_inflow():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    # scammer wallet has an outgoing tx BEFORE the victim's funds ever arrived — must not be
    # followed, per the correctness-guard checklist ("causal, time-monotonic").
    stale_outgoing = mk("scammer", "unrelated", 999, t0 - timedelta(hours=90))
    real_outgoing = mk("scammer", "hop2", 148.5, t0 + timedelta(seconds=42))
    client = FakeChainClient({"scammer": [stale_outgoing, real_outgoing]})

    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=3)

    followed_addresses = {h.wallet_address for h in result.hops}
    assert "unrelated" not in followed_addresses
    assert "hop2" in followed_addresses

def test_stop_reason_set_when_no_causal_outgoing_transfers():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    client = FakeChainClient({"scammer": []})
    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=3)
    assert result.hops[0].stop_reason == "no_outgoing_activity"

def test_taint_tracked_against_reported_amount_not_total_outflow():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    # wallet's outgoing tx is larger than the victim's reported amount (commingled funds) —
    # taint carried forward must be capped at reported_amount, never the tx's full value.
    big_outgoing = mk("scammer", "hop2", 5000, t0 + timedelta(seconds=10))
    client = FakeChainClient({"scammer": [big_outgoing], "hop2": []})
    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=3)
    hop2 = next(h for h in result.hops if h.wallet_address == "hop2")
    assert hop2.taint <= Decimal("150")

def test_taint_allocated_fifo_across_fanout_siblings():
    # Reviewer's own example: taint=150, three causal outgoing transfers of 100 each, in
    # timestamp order. Each sibling must draw from a SHARED budget, not independently claim
    # up to min(taint, amount) — otherwise summed downstream taint (300) would exceed what
    # the wallet held and the victim reported (150).
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    branch_a = mk("scammer", "branch_a", 100, t0 + timedelta(seconds=1))
    branch_b = mk("scammer", "branch_b", 100, t0 + timedelta(seconds=2))
    branch_c = mk("scammer", "branch_c", 100, t0 + timedelta(seconds=3))
    client = FakeChainClient({
        "scammer": [branch_a, branch_b, branch_c],
        "branch_a": [], "branch_b": [], "branch_c": [],
    })

    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=3)

    taint_by_addr = {h.wallet_address: h.taint for h in result.hops}
    assert taint_by_addr["branch_a"] == Decimal("100")
    assert taint_by_addr["branch_b"] == Decimal("50")
    assert taint_by_addr["branch_c"] == Decimal("0")
    assert taint_by_addr["branch_a"] + taint_by_addr["branch_b"] + taint_by_addr["branch_c"] <= Decimal("150")

def test_stop_reason_hop_cap_reached():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    client = FakeChainClient({"scammer": []})
    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=0)
    assert result.hops[0].stop_reason == "hop_cap_reached"

def test_stop_reason_api_read_failure():
    class RaisingChainClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            raise RuntimeError("chain API unavailable")

    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    result = trace(RaisingChainClient(), start_address="scammer", reported_amount=Decimal("150"),
                    start_time=t0, max_hops=3)
    assert result.hops[0].stop_reason == "api_read_failure"

def test_stop_reason_no_further_transfers_when_outgoing_history_predates_since():
    # Wallet DOES have outgoing history, but all of it is before the funding transfer — this
    # must be distinguished from "no_outgoing_activity" (empty history entirely).
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    stale_only = mk("scammer", "other", 50, t0 - timedelta(hours=1))
    client = FakeChainClient({"scammer": [stale_only]})
    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=3)
    assert result.hops[0].stop_reason == "no_further_transfers"

def test_converging_paths_accumulate_taint_instead_of_dropping():
    # Two separate causal branches from the suspect wallet (a split payment) each carry 75 of
    # the victim's 150 onward, then BOTH branches independently forward their 75 to the same
    # hub wallet at different timestamps. The hub is a genuine consolidation point (project's
    # own "Consolidation" thesis) — its recorded taint must be the sum of both arrivals (150),
    # not just whichever arrival was processed first.
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    branch_a_send = mk("scammer", "branch_a", 75, t0 + timedelta(seconds=1))
    branch_b_send = mk("scammer", "branch_b", 75, t0 + timedelta(seconds=2))
    branch_a_to_hub = mk("branch_a", "hub", 75, t0 + timedelta(seconds=10))
    branch_b_to_hub = mk("branch_b", "hub", 75, t0 + timedelta(seconds=20))
    client = FakeChainClient({
        "scammer": [branch_a_send, branch_b_send],
        "branch_a": [branch_a_to_hub],
        "branch_b": [branch_b_to_hub],
        "hub": [],
    })

    result = trace(client, start_address="scammer", reported_amount=Decimal("150"), start_time=t0, max_hops=4)

    hub_hops = [h for h in result.hops if h.wallet_address == "hub"]
    # Exactly one recorded hop for the converged wallet — not a duplicate, not dropped.
    assert len(hub_hops) == 1
    hub_hop = hub_hops[0]
    assert hub_hop.taint == Decimal("150")
    assert hub_hop.stop_reason == "no_outgoing_activity"

    # Conservation-style check at the tracer level: since the hub is a genuine terminal point
    # and both branches fully accounted for the reported amount, summing every terminal hop's
    # taint must equal reported_amount exactly — not be short by whichever branch would have
    # been dropped on merge under the old (buggy) behaviour.
    total_terminal_taint = sum((h.taint for h in result.terminal_hops), Decimal("0"))
    assert total_terminal_taint == Decimal("150")

def test_revisited_wallet_taint_propagates_to_already_queued_children():
    # "hub" is visited TWICE: first via branch_a with only 20 taint (not enough, alone, to
    # reach "descendant" through hub's own 100-unit outgoing transfer to it -- FIFO would cap
    # descendant's share at 20). Later, branch_b's causal transfer converges on the SAME hub
    # wallet with an additional 80 taint. Combined (100), hub should be able to re-run its own
    # FIFO fan-out for the newly-arrived 80 and forward it on to "descendant", which otherwise
    # would stay stuck at whatever the first (smaller) wave alone could allocate.
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    scammer_to_a = mk("scammer", "branch_a", 20, t0 + timedelta(seconds=1))
    scammer_to_b = mk("scammer", "branch_b", 80, t0 + timedelta(seconds=2))
    a_to_hub = mk("branch_a", "hub", 20, t0 + timedelta(seconds=10))
    b_to_hub = mk("branch_b", "hub", 80, t0 + timedelta(seconds=20))
    hub_to_descendant = mk("hub", "descendant", 100, t0 + timedelta(seconds=30))
    client = FakeChainClient({
        "scammer": [scammer_to_a, scammer_to_b],
        "branch_a": [a_to_hub],
        "branch_b": [b_to_hub],
        "hub": [hub_to_descendant],
        "descendant": [],
    })

    result = trace(client, start_address="scammer", reported_amount=Decimal("100"), start_time=t0, max_hops=5)

    hub_hops = [h for h in result.hops if h.wallet_address == "hub"]
    assert len(hub_hops) == 1
    assert hub_hops[0].taint == Decimal("100")

    descendant_hops = [h for h in result.hops if h.wallet_address == "descendant"]
    assert len(descendant_hops) == 1
    descendant_hop = descendant_hops[0]
    assert descendant_hop.taint == Decimal("100")

    candidates = [h for h in result.hops if h.hop_index > 0 and h.taint > Decimal("0")]
    assert descendant_hop in candidates

def test_revisited_wallet_taint_cascades_through_chain_of_visited_descendants():
    # Same shape as above but 3 levels deep past the hub: hub -> mid -> leaf, and mid/leaf are
    # ALSO reached (with zero-taint scraps) via the first, smaller wave, so both must be
    # re-expanded for the second wave's increment, not just hub itself -- the re-emission has
    # to cascade rather than stop one hop past the merge point.
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    scammer_to_a = mk("scammer", "branch_a", 5, t0 + timedelta(seconds=1))
    scammer_to_b = mk("scammer", "branch_b", 95, t0 + timedelta(seconds=2))
    a_to_hub = mk("branch_a", "hub", 5, t0 + timedelta(seconds=10))
    b_to_hub = mk("branch_b", "hub", 95, t0 + timedelta(seconds=20))
    hub_to_mid = mk("hub", "mid", 100, t0 + timedelta(seconds=30))
    mid_to_leaf = mk("mid", "leaf", 100, t0 + timedelta(seconds=40))
    client = FakeChainClient({
        "scammer": [scammer_to_a, scammer_to_b],
        "branch_a": [a_to_hub],
        "branch_b": [b_to_hub],
        "hub": [hub_to_mid],
        "mid": [mid_to_leaf],
        "leaf": [],
    })

    result = trace(client, start_address="scammer", reported_amount=Decimal("100"), start_time=t0, max_hops=6)

    taint_by_addr = {h.wallet_address: h.taint for h in result.hops if h.wallet_address in ("hub", "mid", "leaf")}
    assert taint_by_addr["hub"] == Decimal("100")
    assert taint_by_addr["mid"] == Decimal("100")
    assert taint_by_addr["leaf"] == Decimal("100")
    assert len([h for h in result.hops if h.wallet_address == "leaf"]) == 1
