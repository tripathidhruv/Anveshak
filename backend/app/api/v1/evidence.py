from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.chains.registry import get_chain_client
from app.evidence.pack import build_evidence_pack
from app.evidence.raw_store import fetch_raw_source
from app.models import Case, EvidenceManifest
from app.schemas import EvidencePackOut

router = APIRouter(prefix="/api/v1/evidence", tags=["evidence"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Real endpoints implemented in Task H5 (this file, plus backend/app/evidence/*).


# `EvidencePackOut` (schemas.py, H0-scaffolded, not modified here) has no matching
# "verify" shape -- Task H5's file scope excludes schemas.py, so the verify response
# model lives here instead.
class EvidenceVerifyOut(BaseModel):
    caseId: str
    valid: bool
    packHashMatches: bool
    sourcesChecked: int
    sourcesReproduced: int
    # True when at least one source could not be re-fetched right now (chain-API read
    # failure) -- `valid` is always False when this is True; verification never claims
    # success on data it couldn't actually re-check.
    dataUnavailable: bool
    details: list[dict]


@router.get("/{case_id}/pack", response_model=EvidencePackOut)
def get_evidence_pack(case_id: str, db: Session = Depends(get_db)) -> EvidencePackOut:
    """Builds this case's evidence pack (canonical, content-only hash over its traced
    transfers and attribution findings) and persists an `EvidenceManifest` row recording
    the hash alongside its manifest (source URLs / raw response hashes / fetched-at) --
    see `app/evidence/pack.py` and `app/evidence/manifest.py` for why the hash itself
    never includes any generation-time value."""
    pack = build_evidence_pack(db, case_id)
    if pack is None:
        raise HTTPException(status_code=404, detail="case not found")

    manifest = EvidenceManifest(case_id=pack.case_id, entries=pack.manifest_entries,
                                 pack_hash=pack.pack_hash)
    db.add(manifest)
    db.commit()
    db.refresh(manifest)

    return EvidencePackOut(
        caseId=pack.case_id, packHash=pack.pack_hash,
        manifestEntries=pack.manifest_entries, createdAt=manifest.created_at,
    )


@router.post("/{case_id}/verify", response_model=EvidenceVerifyOut)
def verify_evidence_pack(case_id: str, db: Session = Depends(get_db)) -> EvidenceVerifyOut:
    """Re-fetches the same on-chain data recorded in this case's most recent evidence
    manifest and confirms the hash reproduces identically -- the actual "click any hash
    to verify" capability this project's pitch promises. This is a genuine correctness
    check, not a re-hash of what's already sitting in the database: each manifest
    entry's wallet is queried again right now, and its freshly recomputed
    `raw_response_hash` is compared against what was recorded when the pack was built.
    """
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    manifest = (
        db.query(EvidenceManifest)
        .filter(EvidenceManifest.case_id == case_id)
        .order_by(EvidenceManifest.created_at.desc())
        .first()
    )
    if manifest is None:
        raise HTTPException(status_code=404,
                             detail="no evidence pack has been generated for this case yet")

    # Step 1: recompute the pack hash from the same DB content (Hop/AttributionCandidate
    # rows) the original pack was built from. This must reproduce identically -- if it
    # doesn't, either the underlying case data changed since the pack was generated, or
    # (the thing this whole task exists to prevent) generation-time metadata leaked into
    # the hashed payload somewhere. Either way, that's a real, reportable mismatch.
    pack = build_evidence_pack(db, case_id)
    pack_hash_matches = pack is not None and pack.pack_hash == manifest.pack_hash

    # Step 2: genuinely re-fetch each recorded source's on-chain data and confirm its
    # content-only hash still reproduces.
    sources_checked = 0
    sources_reproduced = 0
    data_unavailable = False
    details: list[dict] = []

    client = get_chain_client(case.chain, case.asset) if manifest.entries else None
    now = datetime.now(timezone.utc)

    for entry in manifest.entries:
        sources_checked += 1
        source_url = entry.get("source_url")
        wallet_address = entry.get("wallet_address")
        chain = entry.get("chain", case.chain)
        recorded_hash = entry.get("raw_response_hash")

        if client is None or wallet_address is None or recorded_hash is None:
            # `recorded_hash is None` means the ORIGINAL fetch (at pack-build time)
            # already failed -- there is nothing to reproduce against, so this is
            # honestly reported as unavailable, never as a silent pass.
            data_unavailable = True
            details.append({
                "sourceUrl": source_url, "reproduced": False, "reason": "data_unavailable",
            })
            continue

        refetch = fetch_raw_source(client, wallet_address, chain, now)
        if refetch.read_failed:
            data_unavailable = True
            details.append({
                "sourceUrl": source_url, "reproduced": False, "reason": "chain_read_failed",
            })
            continue

        reproduced = refetch.raw_response_hash == recorded_hash
        if reproduced:
            sources_reproduced += 1
        details.append({
            "sourceUrl": source_url, "reproduced": reproduced,
            "reason": None if reproduced else "hash_mismatch",
        })

    valid = pack_hash_matches and not data_unavailable and sources_reproduced == sources_checked

    return EvidenceVerifyOut(
        caseId=case_id, valid=valid, packHashMatches=pack_hash_matches,
        sourcesChecked=sources_checked, sourcesReproduced=sources_reproduced,
        dataUnavailable=data_unavailable, details=details,
    )
