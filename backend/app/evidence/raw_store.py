"""Fetches the raw on-chain data backing a case's evidence pack, and computes a
content-only hash of that raw data for the evidence manifest (Task H5).

`fetched_at` (when we happened to query the chain) is real wall-clock time and is
recorded on `RawSourceFetch` for the manifest -- but it is NEVER included in what gets
hashed. Only `canonical_transfers` (properties of the transfers themselves: tx hash,
addresses, amount, asset, the transfer's own on-chain timestamp) feeds `content_hash`.
This is the same discipline `manifest.py`'s module docstring describes in full.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.chains.base import ChainClient, Transfer
from app.evidence.manifest import content_hash


@dataclass(frozen=True)
class RawSourceFetch:
    source_url: str
    wallet_address: str
    chain: str
    transfers: list[Transfer]
    # None when the read failed -- never a hash of a silently-assumed-empty history.
    # Indistinguishable-empty-vs-unread is the same honest-failure class of bug this
    # project's traces.py already guards against (`api_read_failure` / `history_read_failed`).
    raw_response_hash: str | None
    fetched_at: datetime
    read_failed: bool


def source_url_for(chain: str, wallet_address: str) -> str:
    """A plain, descriptive identifier of what was queried. Not a real block-explorer
    deep link (this project's chain adapters query provider APIs, not explorer pages) --
    just an honest, reproducible label of the source, per this project's DEMO DATA /
    no-real-exchange-name rules (nothing here is or implies a real wallet attribution)."""
    return f"chain-api://{chain}/address/{wallet_address}/transfers"


def canonical_transfers(transfers: list[Transfer]) -> list[dict]:
    """Canonical, sorted, CONTENT-ONLY representation of a list of transfers: only
    properties of the on-chain data itself. Never includes wall-clock fetch/generation
    time. Sorted so fetch order (which can vary run to run) never changes the hash."""
    items = [
        {
            "tx_hash": t.tx_hash,
            "chain": t.chain,
            "from_address": t.from_address,
            "to_address": t.to_address,
            "amount": str(t.amount),
            "asset": t.asset,
            # The TRANSFER's own on-chain timestamp -- a property of the transfer, not of
            # when we happened to fetch it. This is content, not generation metadata.
            "timestamp": t.timestamp.isoformat(),
            "fee": str(t.fee),
        }
        for t in transfers
    ]
    return sorted(items, key=lambda i: (i["tx_hash"], i["from_address"], i["to_address"]))


def fetch_raw_source(client: ChainClient, wallet_address: str, chain: str,
                      fetched_at: datetime) -> RawSourceFetch:
    """Queries `client` for `wallet_address`'s transfers and hashes the canonical,
    content-only representation of the result. `fetched_at` is caller-supplied (real
    wall-clock "now") so a single pack-build can share one fetch timestamp across all of
    its sources without each fetch's manifest entry drifting apart in time; it is
    recorded on the return value for the manifest but never hashed.

    A chain-API read failure is reported honestly (`read_failed=True`,
    `raw_response_hash=None`) rather than silently hashing an empty transfer list, which
    would be indistinguishable from a genuinely empty wallet history.
    """
    try:
        transfers = client.get_transfers(wallet_address)
        read_failed = False
    except Exception:
        transfers = []
        read_failed = True

    raw_hash = None if read_failed else content_hash(canonical_transfers(transfers))

    return RawSourceFetch(
        source_url=source_url_for(chain, wallet_address),
        wallet_address=wallet_address,
        chain=chain,
        transfers=transfers,
        raw_response_hash=raw_hash,
        fetched_at=fetched_at,
        read_failed=read_failed,
    )
