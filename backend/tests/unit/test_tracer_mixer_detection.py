from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from app.chains.base import Transfer
from app.tracing.tracer import trace
from app.mixers.registry import MixerContract

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

MIXER_ADDR = "0xmixercontractzzzzzzzzzzzzzzzzzzzzzzzzz"

TEST_MIXER = MixerContract(
    name="Test Mixer", chain="ethereum", contract_address=MIXER_ADDR,
    source_url="https://example.test",
)


def mk(from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain="ethereum", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="ETH", timestamp=ts, fee=Decimal("0"), raw={})


class EthClient:
    chain = "ethereum"

    def __init__(self, transfers, fetch_log=None):
        self._transfers = transfers
        self._fetch_log = fetch_log if fetch_log is not None else []

    def get_transfers(self, address, since=None):
        self._fetch_log.append(address)
        rows = self._transfers.get(address, [])
        if since is not None:
            rows = [t for t in rows if t.timestamp >= since]
        return sorted(rows, key=lambda t: t.timestamp)


def test_hop_into_known_mixer_stops_with_entered_mixer_and_no_fetch():
    deposit = mk("scammer", MIXER_ADDR, 5, T0)
    fetch_log: list[str] = []
    client = EthClient({"scammer": [deposit]}, fetch_log)

    with patch("app.tracing.tracer.is_mixer_contract",
               side_effect=lambda addr, chain: TEST_MIXER if addr == MIXER_ADDR and chain == "ethereum" else None):
        result = trace(client, start_address="scammer", reported_amount=Decimal("5"), start_time=T0)

    mixer_hop = next(h for h in result.hops if h.wallet_address == MIXER_ADDR)
    assert mixer_hop.stop_reason == "entered_mixer"
    assert mixer_hop.outgoing_transfers == []
    assert mixer_hop.taint == Decimal("5")
    # No further hops follow from the mixer address.
    assert not any(h.hop_index > mixer_hop.hop_index for h in result.hops
                   if h.wallet_address != MIXER_ADDR and h.funding_transfer is not None
                   and h.funding_transfer.from_address == MIXER_ADDR)
    # No chain-API call was ever made for the mixer address itself -- the static registry
    # check happens before the fetch.
    assert MIXER_ADDR not in fetch_log


def test_hop_into_known_mixer_needs_no_get_client_for_chain_parameter():
    # Unlike bridge-crossing detection, mixer detection is unconditional -- it must fire
    # even when the caller never opted into cross-chain detection at all.
    deposit = mk("scammer", MIXER_ADDR, 5, T0)
    client = EthClient({"scammer": [deposit]})

    with patch("app.tracing.tracer.is_mixer_contract",
               side_effect=lambda addr, chain: TEST_MIXER if addr == MIXER_ADDR and chain == "ethereum" else None):
        result = trace(client, start_address="scammer", reported_amount=Decimal("5"), start_time=T0,
                        get_client_for_chain=None)

    mixer_hop = next(h for h in result.hops if h.wallet_address == MIXER_ADDR)
    assert mixer_hop.stop_reason == "entered_mixer"


def test_address_not_matching_any_known_mixer_traces_normally():
    deposit = mk("scammer", "ordinary_wallet", 5, T0)
    client = EthClient({"scammer": [deposit], "ordinary_wallet": []})

    result = trace(client, start_address="scammer", reported_amount=Decimal("5"), start_time=T0)

    ordinary_hop = next(h for h in result.hops if h.wallet_address == "ordinary_wallet")
    assert ordinary_hop.stop_reason == "no_outgoing_activity"


def test_mixer_check_takes_precedence_over_bridge_check():
    # An address that is (implausibly) both a known bridge AND a known mixer must be
    # honestly reported as having entered a mixer -- a mixer is a dead end this codebase
    # can never see through, unlike a bridge crossing it can sometimes confirm.
    deposit = mk("scammer", MIXER_ADDR, 5, T0)
    client = EthClient({"scammer": [deposit]})

    def fake_get_client_for_chain(chain):
        return client

    with patch("app.tracing.tracer.is_mixer_contract",
               side_effect=lambda addr, chain: TEST_MIXER if addr == MIXER_ADDR and chain == "ethereum" else None), \
         patch("app.tracing.tracer.is_bridge_contract", return_value=None) as mock_is_bridge:
        result = trace(client, start_address="scammer", reported_amount=Decimal("5"), start_time=T0,
                        get_client_for_chain=fake_get_client_for_chain)

    mixer_hop = next(h for h in result.hops if h.wallet_address == MIXER_ADDR)
    assert mixer_hop.stop_reason == "entered_mixer"
    # is_bridge_contract must never even be consulted for the mixer address itself -- the
    # mixer check short-circuits with `continue` before the bridge check runs.
    assert MIXER_ADDR not in [call.args[0] for call in mock_is_bridge.call_args_list]
