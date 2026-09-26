"""Task H5: raw on-chain data must be canonicalized (sorted, content-only) before being
hashed into a manifest entry's raw_response_hash -- fetch order or a re-fetch's own
wall-clock time must never affect the hash."""
from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.evidence.raw_store import canonical_transfers, fetch_raw_source


def mk(tx, frm, to, amount, ts):
    return Transfer(tx_hash=tx, chain="tron", from_address=frm, to_address=to,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts,
                     fee=Decimal("0"), raw={"note": "raw payload placeholder"})


T0 = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)


def test_canonical_transfers_is_order_independent():
    t1 = mk("tx1", "A", "B", 10, T0)
    t2 = mk("tx2", "B", "C", 5, T0)
    assert canonical_transfers([t1, t2]) == canonical_transfers([t2, t1])


class FakeClient:
    chain = "tron"

    def __init__(self, transfers=None, raises=False):
        self._transfers = transfers or []
        self._raises = raises

    def get_transfers(self, address, since=None):
        if self._raises:
            raise RuntimeError("chain API unavailable")
        return self._transfers


def test_fetch_raw_source_hash_is_stable_across_different_fetched_at_times():
    transfers = [mk("tx1", "A", "B", 10, T0)]
    client = FakeClient(transfers)

    fetch_now = fetch_raw_source(client, "A", "tron", datetime(2026, 1, 1, tzinfo=timezone.utc))
    fetch_later = fetch_raw_source(client, "A", "tron", datetime(2026, 9, 26, tzinfo=timezone.utc))

    # Same underlying on-chain data, fetched at two different wall-clock moments -- the
    # raw_response_hash (the reproducible part) must match even though `fetched_at`
    # (recorded separately, in the manifest) differs.
    assert fetch_now.raw_response_hash == fetch_later.raw_response_hash
    assert fetch_now.fetched_at != fetch_later.fetched_at


def test_fetch_raw_source_reports_read_failure_honestly():
    client = FakeClient(raises=True)
    fetch = fetch_raw_source(client, "A", "tron", T0)
    assert fetch.read_failed is True
    # A failed read must never silently produce a confident hash of "no transfers" --
    # that would be indistinguishable from a genuinely empty wallet history. This is the
    # same honest-failure discipline traces.py already established.
    assert fetch.raw_response_hash is None
    assert fetch.transfers == []
