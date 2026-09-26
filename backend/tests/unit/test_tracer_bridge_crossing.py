from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch
from app.chains.base import Transfer
from app.tracing.tracer import trace
from app.bridge.registry import BridgeContract

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

def mk(from_addr, to_addr, amount, ts, chain="tron", asset="USDT-TRC20", tx="tx"):
    return Transfer(tx_hash=tx, chain=chain, from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset=asset, timestamp=ts, fee=Decimal("0"), raw={})

BRIDGE_TRON_SIDE = "TBridgeContractXXXXXXXXXXXXXXXXXXXX"
BRIDGE_ETH_SIDE = "0xbridgecontractyyyyyyyyyyyyyyyyyyyyyyyy"

TEST_BRIDGE = BridgeContract(
    name="Test Bridge", chain="tron", contract_address=BRIDGE_TRON_SIDE,
    source_url="https://example.test", paired_chain="ethereum",
    paired_contract_address=BRIDGE_ETH_SIDE, paired_asset_label="USDT-ERC20",
)

class TronClient:
    chain = "tron"
    def __init__(self, transfers):
        self._transfers = transfers
    def get_transfers(self, address, since=None):
        rows = self._transfers.get(address, [])
        if since is not None:
            rows = [t for t in rows if t.timestamp >= since]
        return sorted(rows, key=lambda t: t.timestamp)

class EthClient:
    chain = "ethereum"
    def __init__(self, transfers):
        self._transfers = transfers
    def get_transfers(self, address, since=None):
        rows = self._transfers.get(address, [])
        if since is not None:
            rows = [t for t in rows if t.timestamp >= since]
        return sorted(rows, key=lambda t: t.timestamp)

def _clients(tron_transfers, eth_transfers):
    tron_client = TronClient(tron_transfers)
    eth_client = EthClient(eth_transfers)
    def get_client_for_chain(chain):
        return {"tron": tron_client, "ethereum": eth_client}[chain]
    return tron_client, get_client_for_chain

def test_confirmed_crossing_continues_trace_onto_the_paired_chain():
    # Distinct tx hashes are required here: find_bridge_links()'s own same-tx_hash guard
    # (meant to stop a transfer from matching itself when the same list is passed on both
    # sides) would otherwise treat these two real, distinct on-chain transfers as
    # self-matches if both were left at mk()'s default tx="tx", and filter the match out.
    # Timing chosen so find_bridge_links()'s own confidence formula clears
    # MIN_BRIDGE_LINK_CONFIDENCE (0.6): a 10-minute gap at this 2%-amount-delta would score
    # only 0.58 (verified directly against find_bridge_links) -- 2 minutes clears it (0.65)
    # while still being a realistic bridge-latency gap.
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0, tx="tx-deposit")
    withdrawal = mk(BRIDGE_ETH_SIDE, "eth_recipient", 98, T0 + timedelta(minutes=2),
                     chain="ethereum", asset="USDT-ERC20", tx="tx-withdrawal")
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    eth_transfers = {BRIDGE_ETH_SIDE: [withdrawal], "eth_recipient": []}
    tron_client, get_client_for_chain = _clients(tron_transfers, eth_transfers)

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=get_client_for_chain)

    chains_seen = {h.chain for h in result.hops}
    assert chains_seen == {"tron", "ethereum"}
    eth_recipient_hop = next(h for h in result.hops if h.wallet_address == "eth_recipient")
    assert eth_recipient_hop.chain == "ethereum"
    # bridge fee-adjusted: withdrawal (98) is less than the deposit taint (100), never
    # re-inflated back to the original 100.
    assert eth_recipient_hop.taint == Decimal("98")
    assert len(result.bridge_links) == 1
    assert result.bridge_links[0].confidence >= 0.6

def test_unconfirmed_crossing_stops_honestly_when_no_withdrawal_found():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    eth_transfers = {BRIDGE_ETH_SIDE: []}  # no matching withdrawal at all
    tron_client, get_client_for_chain = _clients(tron_transfers, eth_transfers)

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=get_client_for_chain)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "bridge_crossing_unconfirmed"
    assert result.bridge_links == []

def test_unconfirmed_crossing_when_paired_chain_read_fails():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    tron_client, _ = _clients(tron_transfers, {})

    def raising_get_client_for_chain(chain):
        if chain == "ethereum":
            raise ConnectionError("simulated read failure")
        return tron_client

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=raising_get_client_for_chain)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "bridge_crossing_unconfirmed"

def test_no_get_client_for_chain_means_bridge_detection_is_never_attempted():
    # Backward compatibility: when the caller doesn't opt in, a wallet that happens to match
    # a bridge address is treated as a perfectly ordinary wallet -- exactly today's behavior.
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    tron_client, _ = _clients(tron_transfers, {})

    result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"), start_time=T0)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "no_outgoing_activity"  # normal stop, not bridge-aware
    assert result.bridge_links == []

def test_confidence_below_threshold_is_treated_as_unconfirmed():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    # A withdrawal timed right at the edge of the 60-minute window with a large amount gap --
    # constructed to score below MIN_BRIDGE_LINK_CONFIDENCE (0.6) on find_bridge_links' own
    # formula, not a hand-picked outcome.
    weak_withdrawal = mk(BRIDGE_ETH_SIDE, "eth_recipient", 80, T0 + timedelta(minutes=55),
                          chain="ethereum", asset="USDT-ERC20")
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    eth_transfers = {BRIDGE_ETH_SIDE: [weak_withdrawal], "eth_recipient": []}
    tron_client, get_client_for_chain = _clients(tron_transfers, eth_transfers)

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=get_client_for_chain)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "bridge_crossing_unconfirmed"
    assert result.bridge_links == []
