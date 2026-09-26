"""Campaign clustering: cases whose traces converge on the same verified hub wallet (or
attributed deposit address) get merged into one campaign.

Real-data caveat (documented honestly, not silently worked around): `AttributionCandidate`
rows are defined in `app/models.py` but nothing in `app/api/v1/traces.py` currently persists
them -- `run_trace` computes an `AttributionOut` in memory and returns it without ever writing
an `AttributionCandidate` row to the database. That persistence gap belongs to whichever task
wires `traces.py` up to actually record its attribution result (not this task's file scope --
`traces.py` is explicitly off-limits here). This module queries `AttributionCandidate` as the
source of truth for "verified hub wallet per case" exactly as the brief and the existing model
already assume; until something populates that table, `build_campaigns` will simply see no
rows and return an empty list, which is the honest behavior for data that was never recorded
-- not a bug in this module.

Clustering discipline (mirrors Task G4's "verified attribution only" rule for unreported-victim
enumeration): only `AttributionCandidate` rows with `gate_passed=True` count as a "hub wallet".
A case with no gate-passed candidate has no confirmed hub to cluster on, so it is left out of
every campaign entirely -- we never fall back to an unverified/lower-confidence wallet just to
give every case a campaign, since that would spuriously link cases on unverified data.
"""

from dataclasses import dataclass, field
from decimal import Decimal
import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AttributionCandidate, Case


@dataclass(frozen=True)
class Campaign:
    id: str
    hub_address: str
    chain: str
    case_ids: list[str]
    total_amount_inr: float
    # Derived from Case.location, the only geography field the data model actually has today
    # (there is no dedicated "state" column) -- see the module docstring in api/v1/campaigns.py
    # for why this is reported as "states touched" rather than fabricated from nothing.
    states_touched: list[str] = field(default_factory=list)


class _UnionFind:
    """Standard union-find with path compression + union by rank, over case_id strings."""

    def __init__(self, items: set[str]):
        self._parent = {item: item for item in items}
        self._rank = {item: 0 for item in items}

    def find(self, item: str) -> str:
        root = item
        while self._parent[root] != root:
            root = self._parent[root]
        while self._parent[item] != root:
            self._parent[item], item = root, self._parent[item]
        return root

    def union(self, a: str, b: str) -> None:
        root_a, root_b = self.find(a), self.find(b)
        if root_a == root_b:
            return
        if self._rank[root_a] < self._rank[root_b]:
            root_a, root_b = root_b, root_a
        self._parent[root_b] = root_a
        if self._rank[root_a] == self._rank[root_b]:
            self._rank[root_a] += 1


def _campaign_id(case_ids: list[str]) -> str:
    """Deterministic, recomputable ID: campaigns are not persisted as their own DB rows (per
    the plan's "derive at query time" allowance for this task), so `GET /campaigns/{id}`
    works by recomputing every cluster on each request and matching on this same hash --
    stable as long as the same set of cases shares the same hub, regardless of ordering."""
    digest = hashlib.sha256("|".join(sorted(case_ids)).encode("utf-8")).hexdigest()
    return f"camp_{digest[:12]}"


def build_campaigns(db: Session) -> list[Campaign]:
    verified_candidates = db.execute(
        select(AttributionCandidate).where(AttributionCandidate.gate_passed.is_(True))
    ).scalars().all()

    if not verified_candidates:
        return []

    # hub key = (address, chain): the same address on two different chains is not the same
    # wallet, so chain is part of the identity, not just a display field.
    hub_to_cases: dict[tuple[str, str], set[str]] = {}
    case_to_hubs: dict[str, set[tuple[str, str]]] = {}
    for candidate in verified_candidates:
        hub_key = (candidate.wallet_address, candidate.chain)
        hub_to_cases.setdefault(hub_key, set()).add(candidate.case_id)
        case_to_hubs.setdefault(candidate.case_id, set()).add(hub_key)

    all_case_ids = set(case_to_hubs.keys())
    uf = _UnionFind(all_case_ids)
    for case_ids_sharing_hub in hub_to_cases.values():
        ordered = sorted(case_ids_sharing_hub)
        for other in ordered[1:]:
            uf.union(ordered[0], other)

    clusters: dict[str, set[str]] = {}
    for case_id in all_case_ids:
        clusters.setdefault(uf.find(case_id), set()).add(case_id)

    # Pull the Case rows once for every case involved in any cluster, for amount + location.
    cases_by_id = {
        case.id: case
        for case in db.execute(select(Case).where(Case.id.in_(all_case_ids))).scalars().all()
    }

    campaigns: list[Campaign] = []
    for cluster_case_ids in clusters.values():
        ordered_case_ids = sorted(cluster_case_ids)

        # Pick the hub address most of this cluster's cases actually share -- when a cluster
        # was transitively merged through more than one hub key, that's the most representative
        # single address to show as "the" hub. Ties break alphabetically by (chain, address)
        # for determinism.
        hub_counts: dict[tuple[str, str], int] = {}
        for case_id in cluster_case_ids:
            for hub_key in case_to_hubs.get(case_id, ()):
                if any(cid in cluster_case_ids for cid in hub_to_cases[hub_key]):
                    hub_counts[hub_key] = hub_counts.get(hub_key, 0) + 1
        primary_hub = max(hub_counts.items(), key=lambda kv: (kv[1], kv[0][1], kv[0][0]))[0]

        total_amount_inr = float(sum(
            (Decimal(str(cases_by_id[cid].amount_inr)) for cid in ordered_case_ids if cid in cases_by_id),
            Decimal("0"),
        ))
        states_touched = sorted({
            cases_by_id[cid].location for cid in ordered_case_ids
            if cid in cases_by_id and cases_by_id[cid].location
        })

        campaigns.append(Campaign(
            id=_campaign_id(ordered_case_ids),
            hub_address=primary_hub[0],
            chain=primary_hub[1],
            case_ids=ordered_case_ids,
            total_amount_inr=total_amount_inr,
            states_touched=states_touched,
        ))

    return sorted(campaigns, key=lambda c: c.id)
