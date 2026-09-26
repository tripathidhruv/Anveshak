import json
from decimal import Decimal
from pathlib import Path
import httpx
import pytest
from app.chains.http_client import AdaptiveHttpClient
from app.chains.evm import EvmChainClient, ETHERSCAN_BASE, ETHERSCAN_MAINNET_CHAIN_ID
from app.chains.known_assets import AssetContractResolution

TOKENTX_FIXTURE = json.loads(
    (Path(__file__).parent.parent / "contract/fixtures/etherscan_tokentx_sample.json").read_text()
)

# Same two records as the fixture, but returned out of timestamp order (as
# Etherscan might under pagination/reordering). If EvmChainClient ever drops
# its `sorted(...)` call, this proves it by feeding data the identity
# ordering would get wrong.
OUT_OF_ORDER_FIXTURE = {
    "status": "1",
    "message": "OK",
    "result": list(reversed(TOKENTX_FIXTURE)),
}

EMPTY_RESULT = {"status": "1", "message": "OK", "result": []}
NO_ACTIVITY_RESULT = {"status": "0", "message": "No transactions found", "result": []}
REAL_ERROR_RESULT = {"status": "0", "message": "NOTOK", "result": "Max rate limit reached"}

GENUINE_USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
SPAM_CONTRACT = "0xspam00000000000000000000000000000009"

SPAM_TOKEN_TX = {
    "hash": "0xspamtx001",
    "from": "0xattacker00000000000000000000000000009",
    "to": "0xscammer000000000000000000000000000002",
    "value": "999000000",
    "tokenSymbol": "USDT",
    "tokenDecimal": "6",
    "contractAddress": SPAM_CONTRACT,
    "timeStamp": "1732000120",
}

NATIVE_TX = {
    "hash": "0xnative111",
    "from": "0xvictim0000000000000000000000000000001",
    "to": "0xscammer000000000000000000000000000002",
    "value": "2000000000000000000",  # 2 ETH, 18 decimals
    "timeStamp": "1732000050",
    "gasUsed": "21000",
    "gasPrice": "20000000000",  # 20 gwei
    "isError": "0",
}

NATIVE_TX_FAILED = {
    "hash": "0xnativefail",
    "from": "0xvictim0000000000000000000000000000001",
    "to": "0xscammer000000000000000000000000000002",
    "value": "999000000000000000000",
    "timeStamp": "1732000060",
    "gasUsed": "21000",
    "gasPrice": "20000000000",
    "isError": "1",
}


def make_client(
    tokentx_data: dict | None = None,
    txlist_data: dict | None = None,
    capture: list | None = None,
) -> EvmChainClient:
    tokentx_data = tokentx_data if tokentx_data is not None else {
        "status": "1", "message": "OK", "result": TOKENTX_FIXTURE,
    }
    txlist_data = txlist_data if txlist_data is not None else EMPTY_RESULT

    def handler(request: httpx.Request) -> httpx.Response:
        if capture is not None:
            capture.append(request)
        action = request.url.params.get("action")
        if action == "tokentx":
            return httpx.Response(200, json=tokentx_data)
        if action == "txlist":
            return httpx.Response(200, json=txlist_data)
        raise AssertionError(f"unexpected action: {action}")

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    return EvmChainClient(api_key="test-key", http=http)


def test_parses_erc20_transfers_into_normalized_shape():
    client = make_client()
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    assert len(transfers) == 2
    assert transfers[0].chain == "ethereum"
    assert transfers[0].asset == "USDT-ERC20"
    assert transfers[0].amount == 500.0
    assert transfers[0].from_address == "0xvictim0000000000000000000000000000001"
    assert transfers[0].to_address == "0xscammer000000000000000000000000000002"


def test_transfers_sorted_ascending_by_timestamp():
    client = make_client()
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    assert transfers[0].timestamp < transfers[1].timestamp


def test_transfers_sorted_ascending_even_when_api_returns_out_of_order():
    # Regression test: the fixture on its own is already ascending, so a
    # naive list comprehension (no sorted()) would pass the test above by
    # accident. Feeding the API response in descending order makes the
    # sorted() call load-bearing: this fails if it's ever removed.
    client = make_client(tokentx_data=OUT_OF_ORDER_FIXTURE)
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    assert len(transfers) == 2
    assert transfers[0].timestamp < transfers[1].timestamp
    assert transfers[0].tx_hash == TOKENTX_FIXTURE[0]["hash"]
    assert transfers[1].tx_hash == TOKENTX_FIXTURE[1]["hash"]


def test_genuine_empty_result_returns_empty_list():
    client = make_client(tokentx_data=NO_ACTIVITY_RESULT, txlist_data=NO_ACTIVITY_RESULT)
    transfers = client.get_transfers("0xnobody00000000000000000000000000000000")
    assert transfers == []


def test_real_api_error_raises_instead_of_returning_empty():
    # A rate limit / bad key / other real failure also comes back as HTTP 200 with
    # status "0", but a message other than the genuine "no transactions" one. This
    # must NOT be silently swallowed as "wallet has no history."
    client = make_client(tokentx_data=REAL_ERROR_RESULT, txlist_data=NO_ACTIVITY_RESULT)
    with pytest.raises(ValueError, match="NOTOK"):
        client.get_transfers("0xscammer000000000000000000000000000002")


def test_real_api_error_on_native_eth_call_also_raises():
    client = make_client(tokentx_data=NO_ACTIVITY_RESULT, txlist_data=REAL_ERROR_RESULT)
    with pytest.raises(ValueError, match="NOTOK"):
        client.get_transfers("0xscammer000000000000000000000000000002")


def test_requests_use_v2_endpoint_with_mainnet_chainid():
    captured: list = []
    client = make_client(capture=captured)
    client.get_transfers("0xscammer000000000000000000000000000002")
    assert len(captured) == 2
    for request in captured:
        assert str(request.url).startswith(ETHERSCAN_BASE)
        assert request.url.params.get("chainid") == ETHERSCAN_MAINNET_CHAIN_ID


def test_native_eth_transfer_normalized_with_real_fee():
    client = make_client(txlist_data={"status": "1", "message": "OK", "result": [NATIVE_TX]})
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    native = [t for t in transfers if t.asset == "ETH"]
    assert len(native) == 1
    transfer = native[0]
    assert transfer.chain == "ethereum"
    assert transfer.tx_hash == "0xnative111"
    assert transfer.amount == 2
    # 21000 gas * 20 gwei = 420,000,000,000,000 wei = 0.00042 ETH
    assert transfer.fee == Decimal("0.00042")
    assert transfer.fee > 0


def test_native_and_token_transfers_merge_sorted_by_timestamp():
    client = make_client(txlist_data={"status": "1", "message": "OK", "result": [NATIVE_TX]})
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    # 2 ERC-20 transfers from the fixture + 1 native ETH transfer.
    assert len(transfers) == 3
    timestamps = [t.timestamp for t in transfers]
    assert timestamps == sorted(timestamps)


def test_failed_native_transaction_is_excluded():
    client = make_client(
        txlist_data={"status": "1", "message": "OK", "result": [NATIVE_TX, NATIVE_TX_FAILED]}
    )
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    hashes = {t.tx_hash for t in transfers}
    assert "0xnative111" in hashes
    assert "0xnativefail" not in hashes


def test_asset_contract_filter_drops_spoofed_symbol_wrong_contract():
    """A spam token transfer sharing the same "USDT" symbol string as the fixture's
    genuine transfers but a different `contractAddress` must be dropped when
    `asset_contract` is set to the real contract; the two genuine transfers survive."""
    tokentx_data = {
        "status": "1",
        "message": "OK",
        "result": TOKENTX_FIXTURE + [SPAM_TOKEN_TX],
    }
    http = AdaptiveHttpClient(
        transport=httpx.MockTransport(
            lambda request: (
                httpx.Response(200, json=tokentx_data)
                if request.url.params.get("action") == "tokentx"
                else httpx.Response(200, json=EMPTY_RESULT)
            )
        ),
        min_interval_seconds=0.0,
    )
    client = EvmChainClient(
        api_key="test-key",
        http=http,
        asset_filter=AssetContractResolution(kind="contract", contract=GENUINE_USDT_CONTRACT),
    )

    transfers = client.get_transfers("0xscammer000000000000000000000000000002")

    assert len(transfers) == 2
    assert {t.tx_hash for t in transfers} == {"0xaaa111", "0xbbb222"}


def test_asset_contract_filter_ignores_case_and_also_drops_native_eth():
    """Etherscan may return `contractAddress` in either case -- the comparison must be
    case-insensitive. A case whose declared asset is a specific ERC-20 contract must
    ALSO drop native ETH (`txlist`) records entirely -- native ETH is never the
    declared ERC-20 asset, so it must not be mixed into this trace's transfers either
    (Task G1, the mirror direction of the native-ETH-excludes-tokens fix)."""
    tokentx_data = {
        "status": "1",
        "message": "OK",
        "result": TOKENTX_FIXTURE + [SPAM_TOKEN_TX],
    }
    txlist_data = {"status": "1", "message": "OK", "result": [NATIVE_TX]}

    def handler(request: httpx.Request) -> httpx.Response:
        action = request.url.params.get("action")
        if action == "tokentx":
            return httpx.Response(200, json=tokentx_data)
        return httpx.Response(200, json=txlist_data)

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = EvmChainClient(
        api_key="test-key",
        http=http,
        asset_filter=AssetContractResolution(
            kind="contract", contract=GENUINE_USDT_CONTRACT.upper()
        ),
    )

    transfers = client.get_transfers("0xscammer000000000000000000000000000002")

    hashes = {t.tx_hash for t in transfers}
    assert hashes == {"0xaaa111", "0xbbb222"}
    assert "0xnative111" not in hashes


def test_no_asset_contract_filter_keeps_unfiltered_behavior():
    """When no `asset_filter` is provided at all (unchanged default), the spam transfer
    is not filtered out -- a regression guard for existing unfiltered callers."""
    tokentx_data = {
        "status": "1",
        "message": "OK",
        "result": TOKENTX_FIXTURE + [SPAM_TOKEN_TX],
    }
    client = make_client(tokentx_data=tokentx_data)

    transfers = client.get_transfers("0xscammer000000000000000000000000000002")

    hashes = {t.tx_hash for t in transfers}
    assert hashes == {"0xaaa111", "0xbbb222", "0xspamtx001"}


def test_unknown_asset_kind_explicitly_keeps_permissive_unfiltered_behavior():
    """An asset label that didn't map to anything known (`kind="unknown"`, e.g. an
    unrecognized display label) must still get the current permissive merge-both
    behavior -- documented as a known gap, not silently tightened."""
    tokentx_data = {
        "status": "1",
        "message": "OK",
        "result": TOKENTX_FIXTURE + [SPAM_TOKEN_TX],
    }
    txlist_data = {"status": "1", "message": "OK", "result": [NATIVE_TX]}

    def handler(request: httpx.Request) -> httpx.Response:
        action = request.url.params.get("action")
        if action == "tokentx":
            return httpx.Response(200, json=tokentx_data)
        return httpx.Response(200, json=txlist_data)

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = EvmChainClient(
        api_key="test-key", http=http, asset_filter=AssetContractResolution(kind="unknown")
    )

    transfers = client.get_transfers("0xscammer000000000000000000000000000002")

    hashes = {t.tx_hash for t in transfers}
    assert hashes == {"0xaaa111", "0xbbb222", "0xspamtx001", "0xnative111"}


def test_native_eth_case_excludes_spam_token_from_stealing_fifo_taint_budget():
    """The Critical-finding probe from the second whole-branch review: a case whose
    declared asset is native ETH must never let a spam ERC-20 transfer merge into the
    same transfer list as the real ETH payment. A fake token transfer arriving 5s after
    a real 1 ETH victim payment must not be present at all in this adapter's output --
    if it were, the tracer's FIFO taint-budget math (app/tracing/tracer.py) would
    compare `Transfer.amount`s across two incompatible denominations and could let the
    spam record consume the real recipient's taint, leaving them at taint=0."""
    real_eth_payment = {
        "hash": "0xrealvictimpayment",
        "from": "0xvictim0000000000000000000000000000001",
        "to": "0xscammer000000000000000000000000000002",
        "value": "1000000000000000000",  # 1 ETH, 18 decimals
        "timeStamp": "1732000000",
        "gasUsed": "21000",
        "gasPrice": "20000000000",
        "isError": "0",
    }
    spam_token_arriving_after = {
        **SPAM_TOKEN_TX,
        "timeStamp": "1732000005",  # 5s after the real payment
    }
    tokentx_data = {"status": "1", "message": "OK", "result": [spam_token_arriving_after]}
    txlist_data = {"status": "1", "message": "OK", "result": [real_eth_payment]}

    def handler(request: httpx.Request) -> httpx.Response:
        action = request.url.params.get("action")
        if action == "tokentx":
            return httpx.Response(200, json=tokentx_data)
        return httpx.Response(200, json=txlist_data)

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = EvmChainClient(
        api_key="test-key", http=http, asset_filter=AssetContractResolution(kind="native")
    )

    transfers = client.get_transfers("0xscammer000000000000000000000000000002")

    assert len(transfers) == 1
    assert transfers[0].tx_hash == "0xrealvictimpayment"
    assert transfers[0].asset == "ETH"
    assert transfers[0].amount == 1
    hashes = {t.tx_hash for t in transfers}
    assert "0xspamtx001" not in hashes
