from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.legal import notice_fsm
from app.legal.citations import CITATIONS, UnknownCitationError, list_citations, render_notice
from app.legal.sahyog_payload import build_sahyog_payload
from app.models import AttributionCandidate, Case

router = APIRouter(prefix="/api/v1/legal", tags=["legal"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Filled in by Task H7: legal notice templates + draft->approve->send workflow + SAHYOG payload.


class NoticeCreateIn(BaseModel):
    caseId: str
    citationId: str
    exchangeName: str | None = None
    exchangeJurisdiction: str | None = None


class NoticeApproveIn(BaseModel):
    approvedBy: str


class NoticeRejectIn(BaseModel):
    reason: str | None = None


class NoticeOut(BaseModel):
    id: str
    caseId: str
    citationId: str
    body: str
    state: str
    createdAt: datetime
    approvedBy: str | None = None
    approvedAt: datetime | None = None
    rejectedReason: str | None = None
    sentAt: datetime | None = None


def _to_out(n: notice_fsm.LegalNotice) -> NoticeOut:
    return NoticeOut(
        id=n.id, caseId=n.case_id, citationId=n.citation_id, body=n.body, state=n.state.value,
        createdAt=n.created_at, approvedBy=n.approved_by, approvedAt=n.approved_at,
        rejectedReason=n.rejected_reason, sentAt=n.sent_at,
    )


@router.get("/citations")
def get_citations():
    return [
        {
            "id": c.id, "statute": c.statute, "section": c.section, "title": c.title,
            "unverified": c.unverified,
        }
        for c in list_citations()
    ]


def _confirmed_attribution(db: Session, case_id: str) -> AttributionCandidate | None:
    return (
        db.query(AttributionCandidate)
        .filter(AttributionCandidate.case_id == case_id, AttributionCandidate.gate_passed.is_(True))
        .first()
    )


@router.post("/notices", response_model=NoticeOut, status_code=201)
def create_notice(payload: NoticeCreateIn, db: Session = Depends(get_db)) -> NoticeOut:
    if payload.citationId not in CITATIONS:
        raise HTTPException(status_code=400, detail=f"unknown citation id '{payload.citationId}'")
    case = db.get(Case, payload.caseId)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    attribution = _confirmed_attribution(db, case.id)
    context = {
        "case_id": case.id,
        "ncrp": case.ncrp,
        "location": case.location,
        "incident_date": case.incident_at.date().isoformat() if case.incident_at else "unknown",
        "deposit_address": attribution.wallet_address if attribution else "(no confirmed attribution yet)",
        "exchange_name": payload.exchangeName or (attribution.entity_name if attribution and attribution.entity_name else "(exchange not yet identified)"),
        "exchange_jurisdiction": payload.exchangeJurisdiction or "",
    }
    body = render_notice(payload.citationId, context)
    notice = notice_fsm.create_notice(case_id=case.id, citation_id=payload.citationId, body=body)
    return _to_out(notice)


@router.get("/notices/{notice_id}", response_model=NoticeOut)
def get_notice(notice_id: str) -> NoticeOut:
    try:
        notice = notice_fsm.get_notice(notice_id)
    except notice_fsm.NoticeNotFoundError:
        raise HTTPException(status_code=404, detail="notice not found")
    return _to_out(notice)


@router.get("/cases/{case_id}/notices", response_model=list[NoticeOut])
def list_notices_for_case(case_id: str) -> list[NoticeOut]:
    return [_to_out(n) for n in notice_fsm.list_notices_for_case(case_id)]


@router.post("/notices/{notice_id}/approve", response_model=NoticeOut)
def approve_notice(notice_id: str, payload: NoticeApproveIn) -> NoticeOut:
    try:
        notice = notice_fsm.approve(notice_id, payload.approvedBy)
    except notice_fsm.NoticeNotFoundError:
        raise HTTPException(status_code=404, detail="notice not found")
    except notice_fsm.InvalidNoticeTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _to_out(notice)


@router.post("/notices/{notice_id}/reject", response_model=NoticeOut)
def reject_notice(notice_id: str, payload: NoticeRejectIn) -> NoticeOut:
    try:
        notice = notice_fsm.reject(notice_id, payload.reason)
    except notice_fsm.NoticeNotFoundError:
        raise HTTPException(status_code=404, detail="notice not found")
    except notice_fsm.InvalidNoticeTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _to_out(notice)


@router.post("/notices/{notice_id}/send", response_model=NoticeOut)
def send_notice(notice_id: str) -> NoticeOut:
    """Never sends anything for real (no outbound integration exists yet) -- this just
    marks the notice's terminal state, and only succeeds if the notice was already
    approved. That's the invariant this whole module exists to enforce."""
    try:
        notice = notice_fsm.send(notice_id)
    except notice_fsm.NoticeNotFoundError:
        raise HTTPException(status_code=404, detail="notice not found")
    except notice_fsm.InvalidNoticeTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return _to_out(notice)


@router.get("/notices/{notice_id}/sahyog-payload")
def get_sahyog_payload(notice_id: str, db: Session = Depends(get_db)) -> dict:
    try:
        notice = notice_fsm.get_notice(notice_id)
    except notice_fsm.NoticeNotFoundError:
        raise HTTPException(status_code=404, detail="notice not found")
    case = db.get(Case, notice.case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case for this notice no longer exists")
    attribution = _confirmed_attribution(db, case.id)
    return build_sahyog_payload(case, attribution, notice)
