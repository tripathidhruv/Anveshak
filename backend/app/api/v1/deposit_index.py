"""Standalone, officer-facing lookup against the inverted deposit index (Task A,
docs/superpowers/specs/2026-09-27-inverted-deposit-index-design.md).

Until this file, `lookup_indexed_deposit` was only ever called silently, from inside
`app/api/v1/traces.py`'s own hop-evaluation loop, as an accelerant for the live-trace
attribution gate -- there was no way for an officer to ask the index a direct question
("has this address ever been seen paying into a known exchange wallet?") without running a
full trace first. This router exposes that same read side
(`app.index.deposit_index.lookup_indexed_deposit`) as its own endpoint, so the "instant
reverse lookup against a pre-built index" story is a real, visible feature, not just an
internal implementation detail of the trace pipeline.

Gated behind `require_role("officer")` (same officer-only pattern as
`app.api.v1.vasp_feed`'s `GET /replies` and `GET /flagged-wallets/all`): a hit here reveals
that a specific address has a real deposit relationship with a specific named exchange, which
is exactly the kind of investigative-lead data this project restricts to authenticated
officers elsewhere, even though a couple of older Sprint 2/3 routers (sanctions.py, risk.py)
predate that convention and were never retrofitted.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.identity import Identity, require_role
from app.index.deposit_index import lookup_indexed_deposit
from app.models import DepositIndexEntry
from app.schemas import DepositIndexEntryOut

router = APIRouter(prefix="/api/v1/deposit-index", tags=["deposit-index"])


def _to_out(entry: DepositIndexEntry) -> DepositIndexEntryOut:
    return DepositIndexEntryOut(
        address=entry.address,
        chain=entry.chain,
        hotWalletAddress=entry.hot_wallet_address,
        entityName=entry.entity_name,
        indexedAt=entry.indexed_at,
    )


@router.get("/{chain}/{address}", response_model=list[DepositIndexEntryOut])
def get_deposit_index_matches(
    chain: str, address: str,
    identity: Identity = Depends(require_role("officer")),
    db: Session = Depends(get_db),
) -> list[DepositIndexEntryOut]:
    """Returns every vetted hot wallet `address` has been backward-crawled as depositing
    directly into, on `chain`. An empty list is a genuine, honest answer -- "no known deposit
    relationship in the index" -- not an error, so this always 200s rather than 404ing on no
    match (the index not knowing about an address is expected and common, not exceptional)."""
    hits = lookup_indexed_deposit(db, address, chain)
    return [_to_out(hit) for hit in hits]
