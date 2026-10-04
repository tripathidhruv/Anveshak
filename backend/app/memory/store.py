"""Read/append operations on the national memory.

Append-only by design: `record_submission` only ever adds a wallet (once) and an event (always),
so the event list for a wallet is a complete provenance trail -- who reported it, when, from where.
Lookups deduplicate per case for the "linked cases" view, but the provenance list keeps every row.

Times are stored in UTC and returned in IST, the timezone every officer reads.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.models import MemoryEvent, MemorySyndicate, MemoryWallet

IST = timezone(timedelta(hours=5, minutes=30))
DISCLAIMER = "Links come from earlier submissions and shared downstream wallets. A lead to verify, not proof."


@dataclass
class LinkedCase:
    case_id: str
    relation: str
    city: str
    state: str
    amount_inr: float
    reported_at: datetime


@dataclass
class SyndicateInfo:
    id: str
    name: str
    case_count: int
    state_count: int
    value_inr: float
    confidence: float
    hub: str


@dataclass
class Provenance:
    at: datetime
    unit: str
    state: str
    event: str
    detail: str


@dataclass
class MemoryLookup:
    address: str
    chain: str | None
    known: bool
    first_seen: datetime | None
    submission_count: int
    linked_cases: list[LinkedCase] = field(default_factory=list)
    syndicate: SyndicateInfo | None = None
    provenance: list[Provenance] = field(default_factory=list)
    disclaimer: str = DISCLAIMER


def canonical(address: str) -> str:
    """Ethereum addresses are case-insensitive (case only carries the EIP-55 checksum), so they
    are keyed lowercase. TRON and Bitcoin Base58 are case-sensitive and kept as typed."""
    address = address.strip()
    return address.lower() if address[:2].lower() == "0x" else address


def to_ist(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:  # SQLite drops tzinfo; everything is written as UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def _to_utc(dt: datetime) -> datetime:
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def lookup(db: Session, address: str) -> MemoryLookup:
    key = canonical(address)
    wallet = db.query(MemoryWallet).filter(MemoryWallet.address == key).one_or_none()
    if wallet is None:
        return MemoryLookup(address=address, chain=None, known=False, first_seen=None, submission_count=0)

    events = (db.query(MemoryEvent).filter(MemoryEvent.address == key)
              .order_by(MemoryEvent.at.desc(), MemoryEvent.id.desc()).all())
    linked: list[LinkedCase] = []
    seen: set[str] = set()
    for e in events:
        if not e.case_id or e.case_id in seen:
            continue
        seen.add(e.case_id)
        linked.append(LinkedCase(e.case_id, e.relation, e.city or "", e.state or "", e.amount_inr or 0.0,
                                 to_ist(e.at)))

    syndicate = None
    if wallet.syndicate_id:
        s = db.get(MemorySyndicate, wallet.syndicate_id)
        if s is not None:
            syndicate = SyndicateInfo(s.id, s.name, s.case_count, s.state_count, s.value_inr, s.confidence, s.hub)

    return MemoryLookup(
        address=wallet.address,
        chain=wallet.chain,
        known=True,
        first_seen=to_ist(wallet.first_seen),
        submission_count=len(seen),
        linked_cases=linked,
        syndicate=syndicate,
        provenance=[Provenance(to_ist(e.at), e.unit, e.state or "", e.event, e.detail) for e in events],
    )


def record_submission(
    db: Session, *, address: str, chain: str, case_id: str, unit: str, city: str | None, state: str | None,
    amount_inr: float | None, at: datetime | None = None, relation: str = "same_wallet", event: str = "submitted",
    detail: str | None = None, syndicate_id: str | None = None,
) -> MemoryEvent:
    key = canonical(address)
    at_utc = _to_utc(at or datetime.now(timezone.utc))
    wallet = db.query(MemoryWallet).filter(MemoryWallet.address == key).one_or_none()
    if wallet is None:
        wallet = MemoryWallet(address=key, chain=chain, first_seen=at_utc, syndicate_id=syndicate_id)
        db.add(wallet)
    elif _to_utc(wallet.first_seen) > at_utc:
        wallet.first_seen = at_utc
    if detail is None:
        detail = (f"Named as the receiving wallet in {case_id}" if relation == "same_wallet"
                  else f"One hop from the wallet in {case_id}" if relation == "one_hop"
                  else f"Shares a downstream hub with {case_id}")
    ev = MemoryEvent(address=key, case_id=case_id, relation=relation, unit=unit, city=city, state=state,
                     amount_inr=amount_inr, event=event, detail=detail, at=at_utc)
    db.add(ev)
    db.commit()
    return ev


def stats(db: Session) -> dict[str, int]:
    return {
        "wallets": db.query(func.count(MemoryWallet.id)).scalar() or 0,
        "cases": db.query(func.count(distinct(MemoryEvent.case_id))).filter(MemoryEvent.case_id.isnot(None)).scalar() or 0,
        "events": db.query(func.count(MemoryEvent.id)).scalar() or 0,
        "states": db.query(func.count(distinct(MemoryEvent.state))).filter(MemoryEvent.state.isnot(None)).scalar() or 0,
        "syndicates": db.query(func.count(MemorySyndicate.id)).scalar() or 0,
    }
