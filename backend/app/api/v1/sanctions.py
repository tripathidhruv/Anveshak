from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Case, Hop, SanctionsMatch
from app.schemas import SanctionsMatchOut
from app.sanctions.screen import SanctionsHit, load_sdn_list, screen_hops

router = APIRouter(prefix="/api/v1/sanctions", tags=["sanctions"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Filled in by Task H4.
#
# Known integration gap (documented honestly, not silently skipped): Task H4's file scope
# excludes app/api/v1/traces.py, so the brief's "sanctionsMatches field on the trace
# response" cannot be added directly to that endpoint by this task. `screen_case_hops` below
# is the function traces.py's own owning task should call and attach to its response --
# it takes a case_id and a db session and returns exactly the per-hop hits a
# `sanctionsMatches` field would need. Until that wiring lands, this router's own
# `GET /matches/{case_id}` is the only way to see a case's sanctions screening result.


def _hit_to_out(hit: SanctionsHit) -> SanctionsMatchOut:
    return SanctionsMatchOut(
        walletAddress=hit.wallet_address,
        chain=hit.chain,
        listSource=hit.list_source,
        matchedAt=datetime.now(timezone.utc),
        listVersion=hit.list_version,
    )


def screen_case_hops(case_id: str, db: Session) -> list[SanctionsHit]:
    """Screens every hop recorded for `case_id` (not just the terminal/attributed wallet,
    per the task brief) against the OFAC SDN seed list. Returns one hit per matching hop.
    Exposed as a plain function, not just baked into the endpoint below, so `traces.py`'s
    owning task can import and call it once it's ready to add a `sanctionsMatches` field to
    the live trace response (see the module-level integration-gap note above)."""
    hops = db.query(Hop).filter(Hop.case_id == case_id).all()
    pairs = [(h.wallet_address, h.chain) for h in hops]
    sdn_list = load_sdn_list()
    return screen_hops(pairs, sdn_list)


def _persist_hits(hits: list[SanctionsHit], db: Session) -> None:
    """Upserts an audit-log row per unique (wallet_address, chain, list_version) hit. This
    table (SanctionsMatch, scaffolded in Task H0) has no case_id column, so it's a global
    log of every wallet ever found on the list, deduplicated by list_version -- not a
    per-case join table. The per-case view is computed live in `screen_case_hops` above by
    re-screening that case's hops, which is why this endpoint doesn't need to query this
    table back to answer its own request."""
    for hit in hits:
        exists = (
            db.query(SanctionsMatch)
            .filter(
                SanctionsMatch.wallet_address == hit.wallet_address,
                SanctionsMatch.chain == hit.chain,
                SanctionsMatch.list_version == hit.list_version,
            )
            .first()
        )
        if exists is None:
            db.add(
                SanctionsMatch(
                    wallet_address=hit.wallet_address,
                    chain=hit.chain,
                    list_source=hit.list_source,
                    list_version=hit.list_version,
                )
            )
    db.commit()


@router.get("/matches/{case_id}", response_model=list[SanctionsMatchOut])
def get_case_sanctions_matches(case_id: str, db: Session = Depends(get_db)) -> list[SanctionsMatchOut]:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    hits = screen_case_hops(case_id, db)
    _persist_hits(hits, db)
    return [_hit_to_out(hit) for hit in hits]
