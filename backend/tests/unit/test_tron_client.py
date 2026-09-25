import json
from pathlib import Path
import httpx
from app.chains.http_client import AdaptiveHttpClient
from app.chains.tron import TronChainClient

FIXTURE = json.loads((Path(__file__).parent.parent / "contract/fixtures/tron_trc20_sample.json").read_text())

# Same two records as the fixture, but returned out of timestamp order (as
# TronGrid might under pagination/reordering). If TronChainClient ever drops
# its `sorted(...)` call, this proves it by feeding data the identity
# ordering would get wrong.
OUT_OF_ORDER_FIXTURE = list(reversed(FIXTURE))

def make_client(records: list[dict] | None = None) -> TronChainClient:
    data = records if records is not None else FIXTURE

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": data, "success": True})
    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    return TronChainClient(http=http)

def test_parses_trc20_transfers_into_normalized_shape():
    client = make_client()
    transfers = client.get_transfers("TScamWalletBBBBBBBBBBBBBBBBBBBBBBB")
    assert len(transfers) == 2
    assert transfers[0].chain == "tron"
    assert transfers[0].asset == "USDT-TRC20"
    assert transfers[0].amount == 150.0
    assert transfers[0].from_address == "TVictimWalletAAAAAAAAAAAAAAAAAAAAA"
    assert transfers[0].to_address == "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB"

def test_transfers_sorted_ascending_by_timestamp():
    client = make_client()
    transfers = client.get_transfers("TScamWalletBBBBBBBBBBBBBBBBBBBBBBB")
    assert transfers[0].timestamp < transfers[1].timestamp

def test_transfers_sorted_ascending_even_when_api_returns_out_of_order():
    # Regression test: the fixture on its own is already ascending, so a
    # naive list comprehension (no sorted()) would pass the test above by
    # accident. Feeding the API response in descending order makes the
    # sorted() call load-bearing: this fails if it's ever removed.
    client = make_client(OUT_OF_ORDER_FIXTURE)
    transfers = client.get_transfers("TScamWalletBBBBBBBBBBBBBBBBBBBBBBB")
    assert len(transfers) == 2
    assert transfers[0].timestamp < transfers[1].timestamp
    assert transfers[0].tx_hash == FIXTURE[0]["transaction_id"]
    assert transfers[1].tx_hash == FIXTURE[1]["transaction_id"]
