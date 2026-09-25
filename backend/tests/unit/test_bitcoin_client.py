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

def test_incoming_with_multi_input_deduplicates_input_addresses():
    """Test that incoming transfers from multi-input tx de-duplicate input addresses."""
    # Create a fixture with an incoming multi-input tx to our test address
    incoming_multi_fixture = [
        {
            "txid": "multi-input-incoming",
            "status": {"confirmed": True, "block_time": 1732000300},
            "vin": [
                {"prevout": {"scriptpubkey_address": "bc1qfrom1111111111111111111111111111111", "value": 1000000}},
                {"prevout": {"scriptpubkey_address": "bc1qfrom2222222222222222222222222222222", "value": 1000000}},
                {"prevout": {"scriptpubkey_address": "bc1qfrom1111111111111111111111111111111", "value": 500000}}
            ],
            "vout": [
                {"scriptpubkey_address": "bc1qreceiver1111111111111111111111111111", "value": 2450000}
            ]
        }
    ]
    client = make_client(incoming_multi_fixture)
    transfers = client.get_transfers("bc1qreceiver1111111111111111111111111111")

    # Should have 2 transfers (one per unique input address, duplicates removed)
    assert len(transfers) == 2
    input_addresses = {t.from_address for t in transfers}
    assert input_addresses == {"bc1qfrom1111111111111111111111111111111", "bc1qfrom2222222222222222222222222222222"}

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
