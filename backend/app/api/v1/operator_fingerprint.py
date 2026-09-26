"""GET /api/v1/cases/{case_id}/similar-operators -- behavioral-similarity ranking, see
app.graph.operator_fingerprint's own module docstring for the full rationale."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.graph.operator_fingerprint import (
    SIMILARITY_DISCLAIMER, build_fingerprint, rank_similar_cases,
)
from app.models import Case

router = APIRouter(prefix="/api/v1/cases", tags=["operator-fingerprint"])


class SimilarOperatorResultOut(BaseModel):
    caseId: str
    similarityScore: float
    featureBreakdown: dict


class SimilarOperatorsOut(BaseModel):
    caseId: str
    results: list[SimilarOperatorResultOut]
    disclaimer: str


@router.get("/{case_id}/similar-operators", response_model=SimilarOperatorsOut)
def get_similar_operators(case_id: str, db: Session = Depends(get_db)) -> SimilarOperatorsOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    target = build_fingerprint(db, case_id)
    if target is None:
        return SimilarOperatorsOut(caseId=case_id, results=[], disclaimer=SIMILARITY_DISCLAIMER)

    all_case_ids = db.execute(select(Case.id)).scalars().all()
    candidates = [
        fp for other_id in all_case_ids if other_id != case_id
        for fp in [build_fingerprint(db, other_id)] if fp is not None
    ]

    ranked = rank_similar_cases(target, candidates)
    return SimilarOperatorsOut(
        caseId=case_id,
        results=[
            SimilarOperatorResultOut(caseId=r.other_case_id, similarityScore=r.score,
                                      featureBreakdown=r.feature_breakdown)
            for r in ranked
        ],
        disclaimer=SIMILARITY_DISCLAIMER,
    )
