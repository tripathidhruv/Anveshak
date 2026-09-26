"""Builds the evidence pack for a case (Task H5): a canonical, content-only
representation of its traced transfers (`Hop` rows) and attribution findings
(`AttributionCandidate` rows), that content's reproducible SHA-256 hash, and the
manifest recorded alongside -- never inside -- that hash (source URLs, per-source raw
response hashes, and fetched-at timestamps; see `manifest.py`'s module docstring for why
that separation matters).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.chains.registry import get_chain_client
from app.evidence.manifest import content_hash
from app.evidence.raw_store import fetch_raw_source
from app.models import AttributionCandidate, Case, Hop


@dataclass(frozen=True)
class EvidencePack:
    case_id: str
    content: dict
    pack_hash: str
    manifest_entries: list[dict]
    # True when at least one source behind this pack could not be re-fetched right now
    # (chain-API read failure) -- the same honest-failure signal traces.py's
    # `dataUnavailable` fields already use elsewhere in this project.
    data_unavailable: bool


def _canonical_hops(hops: list[Hop]) -> list[dict]:
    items = [
        {
            "route_label": h.route_label,
            "hop_index": h.hop_index,
            "wallet_address": h.wallet_address,
            "chain": h.chain,
            "tx_hash": h.tx_hash,
            "amount": str(h.amount),
            # The hop's own recorded on-chain event time -- content, not generation time.
            "at": h.at.isoformat(),
            "stop_reason": h.stop_reason,
        }
        for h in hops
    ]
    return sorted(items, key=lambda i: (i["route_label"], i["hop_index"], i["wallet_address"]))


def _canonical_candidates(candidates: list[AttributionCandidate]) -> list[dict]:
    items = [
        {
            "wallet_address": c.wallet_address,
            "chain": c.chain,
            "gate_passed": c.gate_passed,
            "gate_breakdown": c.gate_breakdown,
            "entity_name": c.entity_name,
            "reasoning": c.reasoning,
            "limitations": c.limitations,
        }
        for c in candidates
    ]
    return sorted(items, key=lambda i: (i["wallet_address"], i["chain"]))


def build_evidence_pack(db: Session, case_id: str) -> EvidencePack | None:
    """Reads the case's already-persisted Hop/AttributionCandidate rows (the same trace
    output `traces.py` writes -- H5 does not touch `traces.py`, it reads what's already
    there), builds the canonical content-only representation, hashes it, and separately
    re-fetches each distinct wallet's raw on-chain data to build this pack's manifest.

    Returns None when the case does not exist.
    """
    case = db.get(Case, case_id)
    if case is None:
        return None

    hops = db.query(Hop).filter(Hop.case_id == case_id).all()
    candidates = db.query(AttributionCandidate).filter(AttributionCandidate.case_id == case_id).all()

    content = {
        "case_id": case.id,
        "chain": case.chain,
        "asset": case.asset,
        "suspect_wallet": case.suspect_wallet,
        "amount_crypto": str(case.amount_crypto),
        "hops": _canonical_hops(hops),
        "attribution_candidates": _canonical_candidates(candidates),
    }
    pack_hash = content_hash(content)

    # Manifest: source URLs / raw response hashes / fetched-at, one entry per distinct
    # wallet this pack's content is drawn from. Re-fetched fresh here so the manifest
    # reflects what the chain actually says right now, not a stale copy of what
    # tracer.py originally saw. `fetched_at` is real wall-clock time and lives ONLY in
    # the manifest entry below -- it is never part of `content` above and never hashed.
    wallets = sorted({(h.wallet_address, h.chain) for h in hops})
    manifest_entries: list[dict] = []
    data_unavailable = False

    if wallets:
        client = get_chain_client(case.chain, case.asset)
        fetched_at = datetime.now(timezone.utc)
        for address, chain in wallets:
            fetch = fetch_raw_source(client, address, chain, fetched_at)
            if fetch.read_failed:
                data_unavailable = True
            manifest_entries.append({
                "source_url": fetch.source_url,
                "wallet_address": fetch.wallet_address,
                "chain": fetch.chain,
                "raw_response_hash": fetch.raw_response_hash,
                "fetched_at": fetch.fetched_at.isoformat(),
                "read_failed": fetch.read_failed,
            })

    return EvidencePack(
        case_id=case.id, content=content, pack_hash=pack_hash,
        manifest_entries=manifest_entries, data_unavailable=data_unavailable,
    )
