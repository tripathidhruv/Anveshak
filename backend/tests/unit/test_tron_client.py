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

def _make_trc20_record(tx_id: str, ts_ms: int) -> dict:
    return {
        "transaction_id": tx_id,
        "token_info": {"symbol": "USDT", "decimals": 6, "address": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"},
        "block_timestamp": ts_ms,
        "from": "TVictimWalletAAAAAAAAAAAAAAAAAAAAA",
        "to": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
        "value": "150000000",
    }

def test_paginates_across_multiple_pages_using_fingerprint():
    """A response with meta.fingerprint must trigger a follow-up request that
    passes that fingerprint back, and the records from both pages must be
    merged into the final result — not just the first page's."""
    page1 = [_make_trc20_record("page1-a", 1732000000000), _make_trc20_record("page1-b", 1732000010000)]
    page2 = [_make_trc20_record("page2-a", 1732000020000)]
    requests_seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests_seen.append(request)
        fingerprint = request.url.params.get("fingerprint")
        if fingerprint is None:
            # First page: no fingerprint yet, more pages available.
            return httpx.Response(200, json={"data": page1, "success": True, "meta": {"fingerprint": "cursor-2"}})
        assert fingerprint == "cursor-2"
        # Second (final) page: no fingerprint in meta, so this is the last page.
        return httpx.Response(200, json={"data": page2, "success": True, "meta": {}})

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = TronChainClient(http=http)

    transfers = client.get_transfers("TScamWalletBBBBBBBBBBBBBBBBBBBBBBB")

    assert len(requests_seen) == 2
    assert len(transfers) == 3
    assert {t.tx_hash for t in transfers} == {"page1-a", "page1-b", "page2-a"}
    # Merged result must still be sorted ascending by timestamp.
    assert transfers[0].tx_hash == "page1-a"
    assert transfers[-1].tx_hash == "page2-a"

def test_pagination_loop_terminates_when_fingerprint_never_runs_out():
    """Guard against a regression where a mock (or a misbehaving API) always
    signals 'more pages available' — the loop must stop at the page cap
    rather than looping forever."""
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        record = _make_trc20_record(f"tx-{call_count['n']}", 1732000000000 + call_count["n"] * 1000)
        # Always claim there's another page, no matter how many times we're called.
        return httpx.Response(200, json={"data": [record], "success": True, "meta": {"fingerprint": "always-more"}})

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = TronChainClient(http=http)

    transfers = client.get_transfers("TScamWalletBBBBBBBBBBBBBBBBBBBBBBB")

    from app.chains.tron import MAX_PAGES
    assert call_count["n"] == MAX_PAGES
    assert len(transfers) == MAX_PAGES
