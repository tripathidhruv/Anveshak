import json
from pathlib import Path
from decimal import Decimal
import httpx
from app.chains.http_client import AdaptiveHttpClient
from app.chains.bitcoin import BitcoinChainClient

FIXTURE = json.loads((Path(__file__).parent.parent / "contract/fixtures/esplora_address_txs_sample.json").read_text())

# Same transactions as the fixture, but returned in reverse order (descending block_time).
# If BitcoinChainClient ever drops its `sorted(...)` call, this test proves it by
# feeding data in descending timestamp order — a trivial ascending check would fail.
OUT_OF_ORDER_FIXTURE = list(reversed(FIXTURE))

def make_client(records: list[dict] | None = None) -> BitcoinChainClient:
    data = records if records is not None else FIXTURE

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=data)
    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    return BitcoinChainClient(http=http)

def test_normalizes_utxo_txs_into_transfers():
    """Test that UTXO transactions are correctly normalized into Transfer objects."""
    client = make_client()
    transfers = client.get_transfers("bc1qscammer000000000000000000000000002")
    assert len(transfers) == 3

    # Check that we have both incoming and outgoing transfers
    incoming = [t for t in transfers if t.to_address == "bc1qscammer000000000000000000000000002"]
    outgoing = [t for t in transfers if t.from_address == "bc1qscammer000000000000000000000000002"]

    assert len(incoming) == 1, "Should have 1 incoming transfer"
    assert len(outgoing) == 2, "Should have 2 outgoing transfers"

    # Check incoming transfer (from btc-tx-1)
    assert incoming[0].amount == Decimal(4990000) / Decimal(1e8)
    assert incoming[0].from_address == "bc1qvictim0000000000000000000000000001"

    # Check that all transfers have correct asset
    assert all(t.asset == "BTC" for t in transfers)

def test_transfers_sorted_ascending_by_timestamp():
    """Test that transfers are sorted by timestamp in ascending order."""
    client = make_client()
    transfers = client.get_transfers("bc1qscammer000000000000000000000000002")
    assert len(transfers) >= 2
    assert transfers[0].timestamp < transfers[1].timestamp

def test_transfers_sorted_ascending_even_when_api_returns_out_of_order():
    """Regression test: verify sorted() is load-bearing.

    The fixture on its own has tx-3 out of order (earlier timestamp), but if we
    reverse the fixture to descend, a naive implementation without sorted() would
    return them in the wrong order. This test fails if sorted() is ever removed.
    """
    client = make_client(OUT_OF_ORDER_FIXTURE)
    transfers = client.get_transfers("bc1qscammer000000000000000000000000002")

    # Should have the same number of transfers
    assert len(transfers) == 3

    # Should be sorted ascending by timestamp
    for i in range(len(transfers) - 1):
        assert transfers[i].timestamp < transfers[i + 1].timestamp, \
            f"Transfer {i} ({transfers[i].tx_hash}, ts={transfers[i].timestamp}) " \
            f"should come before {i+1} ({transfers[i+1].tx_hash}, ts={transfers[i+1].timestamp})"

    # The first transfer should be tx-3 (earliest timestamp)
    assert transfers[0].tx_hash == "btc-tx-3-out-of-order"
    # The last should be tx-2
    assert transfers[-1].tx_hash == "btc-tx-2"

def test_skips_change_addresses():
    """Test that self-change outputs (address appears in both inputs and outputs) are skipped."""
    client = make_client()
    transfers = client.get_transfers("bc1qscammer000000000000000000000000002")

    # tx-3 has scammer in both inputs and outputs, but the self-change output
    # (900000 sats back to scammer) should be skipped.
    # Only the output to bc1qmerchant should appear as an outgoing transfer.
    outgoing_from_tx3 = [t for t in transfers if t.tx_hash == "btc-tx-3-out-of-order"
                         and t.from_address == "bc1qscammer000000000000000000000000002"]

    assert len(outgoing_from_tx3) == 1, "Should have exactly 1 outgoing from tx-3 (change skipped)"
    assert outgoing_from_tx3[0].to_address == "bc1qmerchant000000000000000000000000005"
    assert outgoing_from_tx3[0].amount == Decimal(600000) / Decimal(1e8)

def test_multi_input_flag_set_on_multiple_inputs():
    """Test that multi_input flag is set correctly in raw data."""
    client = make_client()
    transfers = client.get_transfers("bc1qscammer000000000000000000000000002")

    # tx-3 has multiple inputs, so the raw data should have multi_input=True
    tx3_transfers = [t for t in transfers if t.tx_hash == "btc-tx-3-out-of-order"]
    assert len(tx3_transfers) > 0
    assert all(t.raw.get("multi_input") is True for t in tx3_transfers), \
        "tx-3 (multi-input tx) should have raw['multi_input'] = True"

    # tx-1 and tx-2 have single inputs, so multi_input should be False
    tx1_transfers = [t for t in transfers if t.tx_hash == "btc-tx-1"]
    tx2_transfers = [t for t in transfers if t.tx_hash == "btc-tx-2"]
    assert all(t.raw.get("multi_input") is False for t in tx1_transfers + tx2_transfers), \
        "Single-input txs should have raw['multi_input'] = False"

def test_incoming_multi_input_emits_single_transfer_with_unmultiplied_amount():
    """Regression test for F9 (I5): a multi-input incoming transaction must produce
    exactly ONE Transfer, carrying the received value ONCE, using the first input
    address (original order, not deduplicated-then-sorted) as the representative
    sender -- per Bitcoin's common-input-ownership convention. The old behavior
    emitted one Transfer per distinct input address, each claiming the full amount,
    which both multiplied the received value by the input count and inflated
    "distinct payer" counts on an ordinary self-consolidation transaction.
    """
    incoming_multi_fixture = [
        {
            "txid": "multi-input-incoming",
            "status": {"confirmed": True, "block_time": 1732000300},
            "vin": [
                {"prevout": {"scriptpubkey_address": "bc1qfrom3333333333333333333333333333333", "value": 4000000000}},
                {"prevout": {"scriptpubkey_address": "bc1qfrom1111111111111111111111111111111", "value": 3000000000}},
                {"prevout": {"scriptpubkey_address": "bc1qfrom2222222222222222222222222222222", "value": 3000000000}},
                {"prevout": {"scriptpubkey_address": "bc1qfrom1111111111111111111111111111111", "value": 500000}}
            ],
            "vout": [
                {"scriptpubkey_address": "bc1qreceiver1111111111111111111111111111", "value": 10000000000}
            ]
        }
    ]
    client = make_client(incoming_multi_fixture)
    transfers = client.get_transfers("bc1qreceiver1111111111111111111111111111")

    # Exactly ONE Transfer for the whole transaction, not one per distinct input address.
    assert len(transfers) == 1
    # The received amount once (100 BTC), not multiplied by the (3 distinct) input count.
    assert transfers[0].amount == Decimal(10000000000) / Decimal(1e8)
    assert transfers[0].amount == Decimal("100")
    # from_address is the FIRST input address in the record's own original order
    # (bc1qfrom3... appears first in `vin`, even though it's not alphabetically first).
    assert transfers[0].from_address == "bc1qfrom3333333333333333333333333333333"
    assert transfers[0].to_address == "bc1qreceiver1111111111111111111111111111"
    assert transfers[0].raw.get("multi_input") is True

def test_incoming_multi_output_same_address_sums_values():
    """Regression test: a tx can pay the receiving address via more than one vout
    entry. The emitted incoming Transfer's amount must be the SUM of every such
    vout's value, not just the first one encountered.

    This fails if `recv_value = sum(...)` in BitcoinChainClient._normalize_tx is
    ever reverted to `next(...)` (or similar single-value logic), since every
    other incoming-branch fixture in this file has exactly one vout entry paying
    the target address and would not catch that regression.
    """
    multi_output_incoming_fixture = [
        {
            "txid": "multi-output-incoming",
            "status": {"confirmed": True, "block_time": 1732000400},
            "vin": [
                {"prevout": {"scriptpubkey_address": "bc1qsender0000000000000000000000000001", "value": 300000}}
            ],
            "vout": [
                {"scriptpubkey_address": "bc1qreceiver2222222222222222222222222222", "value": 100000},
                {"scriptpubkey_address": "bc1qreceiver2222222222222222222222222222", "value": 200000},
            ]
        }
    ]
    client = make_client(multi_output_incoming_fixture)
    transfers = client.get_transfers("bc1qreceiver2222222222222222222222222222")

    assert len(transfers) == 1
    assert transfers[0].amount == Decimal(300000) / Decimal(1e8)
    assert transfers[0].from_address == "bc1qsender0000000000000000000000000001"

def test_output_without_address_is_silently_skipped():
    """Test that a vout entry with no derivable address (e.g. OP_RETURN) is skipped,
    not treated as an error. This is correct behavior: some real Bitcoin outputs
    genuinely have no scriptpubkey_address."""
    no_address_output_fixture = [
        {
            "txid": "tx-output-no-address",
            "status": {"confirmed": True, "block_time": 1732000000},
            "vin": [
                {"prevout": {"scriptpubkey_address": "bc1qsender", "value": 1000000}}
            ],
            "vout": [
                # Missing scriptpubkey_address (e.g. OP_RETURN output)
                {"value": 1000000}
            ]
        }
    ]

    client = make_client(no_address_output_fixture)
    transfers = client.get_transfers("bc1qsender")

    assert transfers == [], "Output with no derivable address should be skipped, not raise"

def test_malformed_record_raises_informative_error():
    """Test that a genuinely malformed record (missing a required field) raises
    an informative ValueError naming the offending txid."""
    malformed_fixture = [
        {
            "txid": "bad-tx-2",
            "status": {"confirmed": True},
            # Missing block_time
            "vin": [{"prevout": {"scriptpubkey_address": "bc1qsender", "value": 1000000}}],
            "vout": [{"scriptpubkey_address": "bc1qrecipient", "value": 1000000}]
        }
    ]

    client = make_client(malformed_fixture)

    try:
        client.get_transfers("bc1qsender")
        assert False, "Should have raised ValueError for malformed record"
    except ValueError as e:
        error_msg = str(e)
        assert "bad-tx-2" in error_msg, f"Error should mention tx id, got: {error_msg}"
        assert "Malformed" in error_msg, f"Error should say 'Malformed', got: {error_msg}"

def _make_confirmed_tx(txid: str, block_time: int, from_addr: str, to_addr: str, value: int) -> dict:
    return {
        "txid": txid,
        "status": {"confirmed": True, "block_time": block_time},
        "vin": [{"prevout": {"scriptpubkey_address": from_addr, "value": value + 1000}}],
        "vout": [{"scriptpubkey_address": to_addr, "value": value}],
    }

def test_paginates_across_multiple_pages_via_last_seen_txid():
    """A first page that is exactly a full page (25 confirmed txs) must trigger a
    follow-up request to /txs/chain/:last_seen_txid using the oldest confirmed
    txid on that page, and the two pages' transfers must be merged."""
    address = "bc1qscammer000000000000000000000000002"
    page1 = [
        _make_confirmed_tx(f"page1-tx-{i}", 1732100000 - i, "bc1qvictim0000000000000000000000000001", address, 1000 * (i + 1))
        for i in range(25)
    ]
    page2 = [_make_confirmed_tx("page2-tx-0", 1732000000, "bc1qvictim0000000000000000000000000009", address, 5000)]
    requests_seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests_seen.append(request)
        if "/txs/chain/" in request.url.path:
            assert request.url.path.endswith("page1-tx-24")
            return httpx.Response(200, json=page2)
        return httpx.Response(200, json=page1)

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = BitcoinChainClient(http=http)

    transfers = client.get_transfers(address)

    assert len(requests_seen) == 2
    incoming = [t for t in transfers if t.to_address == address]
    assert len(incoming) == 26
    assert {t.tx_hash for t in incoming} == {f"page1-tx-{i}" for i in range(25)} | {"page2-tx-0"}
    # Merged result must still be sorted ascending by timestamp.
    assert transfers[0].tx_hash == "page2-tx-0"
    assert transfers[-1].tx_hash == "page1-tx-0"

def test_pagination_stops_when_page_is_not_full():
    """A page with fewer than CONFIRMED_PAGE_SIZE confirmed txs means we've
    reached the oldest history — no further /chain requests should follow."""
    address = "bc1qscammer000000000000000000000000002"
    page1 = [
        _make_confirmed_tx(f"page1-tx-{i}", 1732100000 - i, "bc1qvictim0000000000000000000000000001", address, 1000 * (i + 1))
        for i in range(25)
    ]
    page2 = [_make_confirmed_tx("page2-tx-0", 1732000000, "bc1qvictim0000000000000000000000000009", address, 5000)]
    # Only 1 confirmed tx on page2: not a full page, so a hypothetical page3 must never be requested.
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if "/txs/chain/" in request.url.path:
            return httpx.Response(200, json=page2)
        return httpx.Response(200, json=page1)

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = BitcoinChainClient(http=http)

    client.get_transfers(address)

    assert call_count["n"] == 2

def test_pagination_loop_terminates_when_every_page_is_full():
    """Guard against a regression where a mock (or a misbehaving API) always
    returns a full page of confirmed transactions — the loop must stop at the
    page cap rather than looping forever."""
    address = "bc1qscammer000000000000000000000000002"
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        page = [
            _make_confirmed_tx(
                f"call{call_count['n']}-tx-{i}",
                1732100000 - call_count["n"] * 100 - i,
                "bc1qvictim0000000000000000000000000001",
                address,
                1000 * (i + 1),
            )
            for i in range(25)
        ]
        return httpx.Response(200, json=page)

    http = AdaptiveHttpClient(transport=httpx.MockTransport(handler), min_interval_seconds=0.0)
    client = BitcoinChainClient(http=http)

    client.get_transfers(address)

    from app.chains.bitcoin import MAX_PAGES
    assert call_count["n"] == MAX_PAGES

def test_unconfirmed_tx_produces_no_transfers():
    """Test that an unconfirmed transaction is excluded from results (not a crash,
    not included), even when other fields (e.g. block_time) are absent as they
    would be for a still-pending tx."""
    unconfirmed_fixture = [
        {
            "txid": "tx-unconfirmed",
            "status": {"confirmed": False},
            "vin": [
                {"prevout": {"scriptpubkey_address": "bc1qsender", "value": 1000000}}
            ],
            "vout": [
                {"scriptpubkey_address": "bc1qrecipient", "value": 900000}
            ]
        }
    ]

    client = make_client(unconfirmed_fixture)
    transfers = client.get_transfers("bc1qsender")

    assert transfers == [], "Unconfirmed transactions should produce no Transfer objects"
