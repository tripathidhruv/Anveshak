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
