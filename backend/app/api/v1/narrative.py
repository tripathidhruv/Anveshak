"""GET /api/v1/cases/{case_id}/narrative -- AI-narrated plain-English summary of a case's
already-computed findings, see app.narrative.summary's own module docstring for the full
rationale and the one non-negotiable boundary (this endpoint decides nothing; it only narrates)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Case
from app.narrative.summary import NARRATIVE_DISCLOSURE, generate_case_narrative

router = APIRouter(prefix="/api/v1/cases", tags=["narrative"])


class CaseNarrativeOut(BaseModel):
    caseId: str
    narrative: str | None
    available: bool
    reason: str | None
    disclosure: str


@router.get("/{case_id}/narrative", response_model=CaseNarrativeOut)
def get_case_narrative(case_id: str, db: Session = Depends(get_db)) -> CaseNarrativeOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    narrative, available, reason = generate_case_narrative(db, case_id)
    return CaseNarrativeOut(
        caseId=case_id,
        narrative=narrative,
        available=available,
        reason=reason,
        disclosure=NARRATIVE_DISCLOSURE,
    )
