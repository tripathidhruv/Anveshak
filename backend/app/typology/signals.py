"""Derives typology signals from what a case already has stored: its `Hop` rows (written by
`POST /{case_id}/trace`), its `Case` fields, and the national memory tables.

Deliberately conservative: every derivation is a simple, explainable test on stored data, most
are binary (0 or 1), and anything we have no data source for stays 0. A 0 here means "no
evidence found", never "evidence of absence" -- under-claiming a typology costs an officer a
second look, over-claiming one (especially terror financing) can wreck an innocent person.

No data source wired yet, so always 0 from this module: fresh_wallet, round_usd_inbound,
new_payer_wallets, ransomware_list_match, market_exposure, escrow_pattern, mixer_exposure,
many_small_purchases, sanctions_proximity, donation_pattern, osint_mention, structuring,
round_trip. They can still be supplied by hand through `POST /api/v1/typology/assess`.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Case, Hop, MemoryEvent
from app.typology.model import INDICATOR_IDS

# Same bar as the sweep signature in CLAUDE.md: humans don't forward money within a minute
# keeping ~99% of it; scam automation does.
SWEEP_MAX_GAP_SECONDS = 60
SWEEP_MIN_KEPT = 0.99
# A wallet receiving from this many different senders is a collection point, matching the
# "dozens of victims land in one wallet" consolidation idea, at a cautious floor.
CONSOLIDATION_MIN_SENDERS = 5
FAST_CASHOUT_MAX_MINUTES = 60
# Peel chain: each hop shaves off a small slice (1-10%) and passes the rest on. Three in a row
# is the minimum that separates a deliberate pattern from a couple of ordinary fees.
PEEL_MIN_LOSS = 0.01
PEEL_MAX_LOSS = 0.10
PEEL_MIN_RUN = 3
BITCOIN_CHAINS = {"bitcoin", "btc"}


def _aware(at: datetime) -> datetime:
    # SQLite drops tzinfo on read-back; every stored time is UTC, so re-attach it before
    # subtracting (mixing naive and aware datetimes raises).
    return at if at.tzinfo else at.replace(tzinfo=timezone.utc)


def _text(hop: Hop) -> str:
    return f"{hop.flag or ''} {hop.stop_reason or ''}".lower()


def _routes(hops: Iterable[Hop]) -> list[list[Hop]]:
    """Consecutive-hop tests only make sense within one route, in hop order."""
    by_route: dict[str, list[Hop]] = defaultdict(list)
    for h in hops:
        by_route[h.route_label].append(h)
    return [sorted(r, key=lambda h: h.hop_index) for r in by_route.values()]


def _pairs(route: Sequence[Hop]):
    return zip(route, route[1:])


def _kept(prev: Hop, nxt: Hop) -> float | None:
    if prev.amount is None or nxt.amount is None or prev.amount <= 0:
        return None
    return nxt.amount / prev.amount


def sweep_signature(routes: list[list[Hop]]) -> float:
    """1 if any consecutive pair moved on in under 60 s keeping at least 99% (and not more than
    arrived -- a bigger outflow means other money was mixed in, so it is not this sweep)."""
    for route in routes:
        for prev, nxt in _pairs(route):
            kept = _kept(prev, nxt)
            gap = (_aware(nxt.at) - _aware(prev.at)).total_seconds()
            if kept is not None and SWEEP_MIN_KEPT <= kept <= 1.0 and 0 <= gap < SWEEP_MAX_GAP_SECONDS:
                return 1.0
    return 0.0


def consolidation(db: Session, hops: Sequence[Hop]) -> float:
    """1 if a hop is flagged as a hub, or any wallet in this case's flow receives from at least
    5 distinct senders across ALL stored traces -- consolidation is visible only across cases,
    which is exactly why one trace can resolve many of them."""
    if any("hub" in _text(h) for h in hops):
        return 1.0
    wallets = {h.wallet_address for h in hops}
    landing = db.execute(
        select(Hop.case_id, Hop.route_label).where(Hop.wallet_address.in_(wallets), Hop.hop_index > 0)
    ).all()
    keys = set(landing)
    if not keys:
        return 0.0
    case_ids = {k[0] for k in keys}
    related = db.execute(select(Hop).where(Hop.case_id.in_(case_ids))).scalars().all()
    by_route: dict[tuple[str, str], dict[int, str]] = defaultdict(dict)
    for h in related:
        by_route[(h.case_id, h.route_label)][h.hop_index] = h.wallet_address
    senders: dict[str, set[str]] = defaultdict(set)
    for key in keys:
        route = by_route.get(key, {})
        for idx, wallet in route.items():
            prev = route.get(idx - 1)
            if wallet in wallets and prev is not None and prev != wallet:
                senders[wallet].add(prev)
    return 1.0 if any(len(s) >= CONSOLIDATION_MIN_SENDERS for s in senders.values()) else 0.0


def _exchange_hops(hops: Sequence[Hop]) -> list[Hop]:
    return [h for h in hops if "exchange" in _text(h)]


def fast_cashout(hops: Sequence[Hop]) -> float:
    """1 if an exchange-flagged hop is within 60 minutes of the case's first hop."""
    exchange = _exchange_hops(hops)
    if not exchange or not hops:
        return 0.0
    first = min(_aware(h.at) for h in hops)
    fastest = min((_aware(h.at) - first).total_seconds() for h in exchange)
    return 1.0 if fastest <= FAST_CASHOUT_MAX_MINUTES * 60 else 0.0


def peel_chain(routes: list[list[Hop]]) -> float:
    """1 if at least 3 consecutive hops each lose between 1% and 10% of the value."""
    for route in routes:
        run = 0
        for prev, nxt in _pairs(route):
            kept = _kept(prev, nxt)
            if kept is not None and PEEL_MIN_LOSS <= 1.0 - kept <= PEEL_MAX_LOSS:
                run += 1
                if run >= PEEL_MIN_RUN:
                    return 1.0
            else:
                run = 0
    return 0.0


def victim_complaints_value(linked_cases: int) -> float:
    """0 links -> 0, 1 -> 0.5, 2 -> 0.75, 3 or more -> 1.0. One other complaint is a real but
    weak corroboration; three independent ones is as strong as this signal gets."""
    if linked_cases <= 0:
        return 0.0
    if linked_cases == 1:
        return 0.5
    if linked_cases == 2:
        return 0.75
    return 1.0


def linked_case_count(db: Session, case: Case) -> int:
    """Other cases naming the same suspect wallet, from both the case table and the national
    memory (deduplicated by case id, this case excluded)."""
    ids = set(db.execute(
        select(Case.id).where(Case.suspect_wallet == case.suspect_wallet, Case.id != case.id)
    ).scalars())
    ids |= {
        cid for cid in db.execute(
            select(MemoryEvent.case_id).where(MemoryEvent.address == case.suspect_wallet)
        ).scalars()
        if cid and cid != case.id
    }
    return len(ids)


def derive_signals(db: Session, case: Case, hops: Sequence[Hop]) -> dict[str, float]:
    """Every indicator id mapped to a value in [0, 1]; ids without a data source are 0."""
    signals = {i: 0.0 for i in INDICATOR_IDS}
    routes = _routes(hops)
    asset = (case.asset or "").upper()
    texts = [_text(h) for h in hops]

    signals["sweep_signature"] = sweep_signature(routes)
    signals["consolidation"] = consolidation(db, hops)
    signals["fast_cashout"] = fast_cashout(hops)
    signals["btc_payments"] = 1.0 if (case.chain or "").lower() in BITCOIN_CHAINS else 0.0
    signals["bridge_hop"] = 1.0 if any("bridge" in t for t in texts) else 0.0
    signals["mixer_entry"] = 1.0 if any("mixer" in t for t in texts) else 0.0
    signals["peel_chain"] = peel_chain(routes)
    signals["cross_border_stablecoin"] = 1.0 if "USDT" in asset and _exchange_hops(hops) else 0.0
    signals["victim_complaints"] = victim_complaints_value(linked_case_count(db, case))
    return signals
