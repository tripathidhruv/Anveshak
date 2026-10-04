"""Task A: builds the inverted deposit index (offline, re-runnable script) --
docs/superpowers/specs/2026-09-27-inverted-deposit-index-design.md.

For each `vetted` entry in `app.labels.seed_labels.SEED_LABELS`, fetches that hot wallet's
OWN inbound transfer history via the same, already-existing chain-adapter method every other
feature in this project uses (`get_chain_client(chain, asset=None).get_transfers(...)` --
no new API integration), collects every distinct depositor (`from_address`) that paid
directly into it, and upserts one `DepositIndexEntry` row per distinct (address, hot wallet)
pair -- skipping pairs already indexed, so re-running this script against the SAME hot wallet
is a no-op for previously-seen depositors rather than creating duplicate rows.

The dedupe/upsert key is `(chain, address, hot_wallet_address)`, NOT `(chain, address)`: the
same depositor address can genuinely feed multiple different vetted hot wallets (e.g. it paid
into both Kraken and Coinbase -- a real customer of both). Keying only on `(chain, address)`
would let whichever hot wallet is processed first in `SEED_LABELS` order claim that depositor,
silently dropping the other exchange's real deposit relationship.

Honest scoping (see the design doc's own "what this is NOT" section): this is a real,
re-runnable script in the same vein as `backend/scripts/calibrate.py`, not a continuously
running crawler -- this project has no scheduler/cron/Celery-beat infrastructure. Re-run it
manually or via an external cron entry to keep the index current.

Invocation (matching calibrate.py's own documented convention):

    backend/.venv/Scripts/python.exe scripts/build_deposit_index.py

or, from the repository root:

    backend/.venv/Scripts/python.exe backend/scripts/build_deposit_index.py

Needs real network access (TronGrid/Etherscan, via ANVESHAK_TRONGRID_API_KEY /
ANVESHAK_ETHERSCAN_API_KEY) to fetch real transfer history when run for real.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable

# Allow running this script directly, same as calibrate.py's own sys.path bootstrap.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy.orm import Session  # noqa: E402

from app.chains.base import ChainClient  # noqa: E402
from app.chains.registry import get_chain_client  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.labels.seed_labels import SEED_LABELS, VaspLabelSeed  # noqa: E402
from app.models import DepositIndexEntry  # noqa: E402

# Injectable so tests can supply a FakeChainClient instead of a real TronGrid/Etherscan call
# -- same optional-factory-injection shape as app.tracing.tracer.trace's own
# `get_client_for_chain` parameter. Defaults to the real chain-client registry for actual runs.
ClientFactory = Callable[..., ChainClient]


def _normalize(address: str, chain: str) -> str:
    """Same chain-appropriate case handling as app.index.deposit_index.lookup_indexed_deposit
    and app.bridge.registry.is_bridge_contract: Ethereum addresses lowercase, TRON exact."""
    return address.lower() if chain == "ethereum" else address


def index_hot_wallet(db: Session, label: VaspLabelSeed, chain_client: ChainClient) -> int:
    """Fetches `label`'s hot wallet's own inbound history via `chain_client` and upserts one
    DepositIndexEntry per distinct (depositor address, hot wallet) pair not already indexed.
    Returns how many NEW rows were written (0 on a re-run against the same hot wallet for
    already-indexed depositors).

    Dedupe/upsert key is `(chain, address, hot_wallet_address)` -- deliberately NOT
    `(chain, address)` alone -- so a depositor that genuinely feeds a DIFFERENT vetted hot
    wallet (indexed in a separate call/run) still gets its own row here, instead of being
    skipped because some other exchange already has a row for that address."""
    hot_wallet = _normalize(label.address, label.chain)
    transfers = chain_client.get_transfers(label.address)
    inbound_depositors = sorted({
        _normalize(t.from_address, label.chain)
        for t in transfers
        if _normalize(t.to_address, label.chain) == hot_wallet
    })

    written = 0
    for depositor in inbound_depositors:
        existing = (
            db.query(DepositIndexEntry)
            .filter(
                DepositIndexEntry.chain == label.chain,
                DepositIndexEntry.address == depositor,
                DepositIndexEntry.hot_wallet_address == hot_wallet,
            )
            .first()
        )
        if existing is not None:
            continue
        db.add(DepositIndexEntry(
            address=depositor,
            chain=label.chain,
            hot_wallet_address=hot_wallet,
            entity_name=label.entity_name,
        ))
        written += 1
    db.commit()
    return written


def build_index(db: Session, client_factory: ClientFactory = get_chain_client) -> tuple[int, int]:
    """Runs indexing for every `vetted` SEED_LABELS entry (skips `unvetted` ones -- an
    unverified label is not a trustworthy anchor to backward-crawl from). Returns
    (hot_wallets_processed, new_deposit_addresses_written_this_run). A single hot wallet's
    chain-API failure is logged and skipped rather than aborting the whole run, matching this
    project's existing per-hop resilience convention (app.tracing.tracer.trace's own
    `api_read_failure` handling)."""
    vetted_labels = [label for label in SEED_LABELS if label.vetting_status == "vetted"]
    hot_wallets_processed = 0
    total_written = 0
    for label in vetted_labels:
        try:
            client = client_factory(label.chain, asset=None)
            written = index_hot_wallet(db, label, client)
        except Exception as exc:  # real network/API failure -- skip, don't abort the run
            print(f"  [skipped] {label.entity_name} ({label.chain}:{label.address}): {exc!r}")
            continue
        hot_wallets_processed += 1
        total_written += written
        print(f"  [ok] {label.entity_name} ({label.chain}:{label.address}): "
              f"{written} new deposit address(es) written")
    return hot_wallets_processed, total_written


def main() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        hot_wallets_processed, total_written = build_index(db)
        total_indexed = db.query(DepositIndexEntry).count()
    finally:
        db.close()

    print("=" * 78)
    print("ANVESHAK inverted deposit index build (Task A)")
    print("=" * 78)
    print(f"Vetted hot wallets processed: {hot_wallets_processed}")
    print(f"New deposit addresses written this run: {total_written}")
    print(f"Total DepositIndexEntry rows now in the DB: {total_indexed}")
    print("=" * 78)


if __name__ == "__main__":
    main()
