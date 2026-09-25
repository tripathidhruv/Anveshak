import json
from pathlib import Path
import httpx
from app.chains.http_client import AdaptiveHttpClient
from app.chains.evm import EvmChainClient

FIXTURE = json.loads((Path(__file__).parent.parent / "contract/fixtures/etherscan_tokentx_sample.json").read_text())

# Same two records as the fixture, but returned out of timestamp order (as
# Etherscan might under pagination/reordering). If EvmChainClient ever drops
# its `sorted(...)` call, this proves it by feeding data the identity
# ordering would get wrong.
OUT_OF_ORDER_FIXTURE = {
    "status": "1",
    "message": "OK",
    "result": list(reversed(FIXTURE))
}

def make_client(fixture_data: dict | None = None) -> EvmChainClient:
    data = fixture_data if fixture_data is not None else {
        "status": "1",
        "message": "OK",
        "result": FIXTURE
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=data)
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
    client = make_client(OUT_OF_ORDER_FIXTURE)
    transfers = client.get_transfers("0xscammer000000000000000000000000000002")
    assert len(transfers) == 2
    assert transfers[0].timestamp < transfers[1].timestamp
    assert transfers[0].tx_hash == FIXTURE[0]["hash"]
    assert transfers[1].tx_hash == FIXTURE[1]["hash"]
