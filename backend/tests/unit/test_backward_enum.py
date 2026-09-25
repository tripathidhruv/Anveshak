from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.graph.backward import enumerate_unreported_victims

def mk(from_addr, to_addr, amount, ts):
    return Transfer(tx_hash="tx", chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

class FakeChainClient:
    chain = "tron"
    def __init__(self, transfers): self._transfers = transfers
    def get_transfers(self, address, since=None): return self._transfers

def test_finds_payers_not_in_known_victim_set():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transfers = [
        mk("known_victim", "hub", 150, t0),
        mk("unreported_1", "hub", 200, t0 + timedelta(minutes=1)),
        mk("unreported_2", "hub", 75, t0 + timedelta(minutes=2)),
        mk("unreported_1", "hub", 50, t0 + timedelta(minutes=3)),  # same payer, 2nd tx
    ]
    client = FakeChainClient(transfers)
    result = enumerate_unreported_victims(client, "hub", known_victim_addresses={"known_victim"})
    assert {c.payer_address for c in result} == {"unreported_1", "unreported_2"}
    unreported_1 = next(c for c in result if c.payer_address == "unreported_1")
    assert unreported_1.total_amount == Decimal("250")
    assert unreported_1.transfer_count == 2

def test_excludes_the_hub_wallet_itself_and_known_victims():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transfers = [
        mk("known_victim", "hub", 150, t0),
        mk("hub", "hub", 999, t0 + timedelta(minutes=1)),  # hub paying itself: self-loop
    ]
    client = FakeChainClient(transfers)
    result = enumerate_unreported_victims(client, "hub", known_victim_addresses={"known_victim"})
    assert result == []

def test_empty_transfers_returns_empty_list():
    client = FakeChainClient([])
    result = enumerate_unreported_victims(client, "hub", known_victim_addresses={"known_victim"})
    assert result == []
