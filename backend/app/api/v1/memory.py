"""SAHYOG national memory API.

Every lookup is written to the hash-chained audit log: the memory is a national resource, and
who looked at which wallet, and when, must itself be accountable. Response models live here
(not schemas.py) next to the only routes that return them, mirrored field for field by
`web/src/api/types.ts`.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.audit.chain import append_entry
from app.memory.store import MemoryLookup, lookup, stats

router = APIRouter(prefix="/api/v1/memory", tags=["memory"])

ChainId = Literal["tron", "ethereum", "bitcoin"]


class MemoryLinkedCaseOut(BaseModel):
    caseId: str
    relation: Literal["same_wallet", "one_hop", "shared_hub"]
    city: str
    state: str
    amountInr: float
    reportedAt: datetime


class MemorySyndicateOut(BaseModel):
    id: str
    name: str
    caseCount: int
    stateCount: int
    valueInr: float
    confidence: float
    hub: str


class MemoryProvenanceOut(BaseModel):
    at: datetime
    unit: str
    state: str
    event: str
    detail: str


class MemoryLookupOut(BaseModel):
    address: str
    chain: ChainId | None
    known: bool
    firstSeen: datetime | None
    submissionCount: int
    linkedCases: list[MemoryLinkedCaseOut]
    syndicate: MemorySyndicateOut | None
    provenance: list[MemoryProvenanceOut]
    disclaimer: str


class MemoryStatsOut(BaseModel):
    wallets: int
    cases: int
    events: int
    states: int
    syndicates: int


def to_lookup_out(r: MemoryLookup) -> MemoryLookupOut:
    s = r.syndicate
    return MemoryLookupOut(
        address=r.address,
        chain=r.chain,
        known=r.known,
        firstSeen=r.first_seen,
        submissionCount=r.submission_count,
        linkedCases=[MemoryLinkedCaseOut(caseId=c.case_id, relation=c.relation, city=c.city, state=c.state,
                                         amountInr=c.amount_inr, reportedAt=c.reported_at) for c in r.linked_cases],
        syndicate=MemorySyndicateOut(id=s.id, name=s.name, caseCount=s.case_count, stateCount=s.state_count,
                                     valueInr=s.value_inr, confidence=s.confidence, hub=s.hub) if s else None,
        provenance=[MemoryProvenanceOut(at=p.at, unit=p.unit, state=p.state, event=p.event, detail=p.detail)
                    for p in r.provenance],
        disclaimer=r.disclaimer,
    )


def audited_lookup(db: Session, address: str, actor: str = "officer") -> MemoryLookupOut:
    result = to_lookup_out(lookup(db, address))
    append_entry(db, actor=actor, action="memory.lookup", object_type="wallet", object_id=address)
    return result


@router.get("/wallets/{address}", response_model=MemoryLookupOut)
def get_wallet(address: str, db: Session = Depends(get_db)) -> MemoryLookupOut:
    return audited_lookup(db, address)


@router.get("/stats", response_model=MemoryStatsOut)
def get_stats(db: Session = Depends(get_db)) -> MemoryStatsOut:
    return MemoryStatsOut(**stats(db))
