"""Read side of the inverted deposit index (Task A,
docs/superpowers/specs/2026-09-27-inverted-deposit-index-design.md).

`backend/scripts/build_deposit_index.py` is the WRITE side: it walks each vetted hot
wallet's own inbound history and upserts one `DepositIndexEntry` row per distinct
(depositor address, hot wallet) pair it finds. This module is the READ side a live trace
hits per hop -- a pure DB query, no chain-API call, mirroring `app.bridge.registry.is_bridge_contract`
and `app.mixers.registry.is_mixer_contract`'s general shape (a `(address, chain) -> ...` lookup
with chain-appropriate case handling), but backed by queryable, persistent data instead of a
static in-module list, since the index is built offline, not hardcoded.
"""
from sqlalchemy.orm import Session

from app.models import DepositIndexEntry


def lookup_indexed_deposit(db: Session, address: str, chain: str) -> list[DepositIndexEntry]:
    """Case-appropriate lookup per chain, mirroring is_bridge_contract/is_mixer_contract:
    Ethereum addresses are compared lowercase (Etherscan's own transfer records -- and this
    project's SEED_LABELS entries -- are always lowercase; see app/bridge/registry.py's own
    comment for why), TRON (base58) is compared case-sensitive exact.

    Returns a list (possibly empty), not a single row/None: the SAME depositor address can
    legitimately feed multiple different vetted hot wallets (e.g. it is a customer of both
    Kraken and Coinbase), and every real match is a real deposit relationship -- silently
    collapsing to one would misattribute the depositor to whichever exchange happened to be
    indexed first, which this project's "nothing is a black box" rule (CLAUDE.md rule 4)
    forbids. Callers that want to present a single exchange must make that ambiguity visible
    rather than have it hidden here."""
    query_address = address.lower() if chain == "ethereum" else address
    return (
        db.query(DepositIndexEntry)
        .filter(DepositIndexEntry.chain == chain, DepositIndexEntry.address == query_address)
        .all()
    )
