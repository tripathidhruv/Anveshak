import json
from pathlib import Path
import httpx
from app.chains.http_client import AdaptiveHttpClient
from app.chains.tron import TronChainClient

FIXTURE = json.loads((Path(__file__).parent.parent / "contract/fixtures/tron_trc20_sample.json").read_text())

def make_client() -> TronChainClient:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": FIXTURE, "success": True})
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
