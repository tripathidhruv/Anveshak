from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Case, Hop
from app.typology.model import TypologyResult, score_typology, validate_signals
from app.typology.signals import derive_signals

router = APIRouter(prefix="/api/v1/typology", tags=["typology"])

# On-chain typology: which kind of crime a money flow looks like, as a glass-box weighted sum
# (see app/typology/model.py for why). Two entry points share one scorer: `/assess` takes
# hand-supplied signals (what-if, or signals from sources not wired into the backend yet), and
# `/cases/{id}` derives them from the case's stored trace so nothing is typed in by hand.
# Response shapes live here, not in app/schemas.py, matching risk.py's per-router ownership.


class AssessIn(BaseModel):
    signals: dict[str, float] = Field(default_factory=dict)

    @field_validator("signals")
    @classmethod
    def _known_and_in_range(cls, v: dict[str, float]) -> dict[str, float]:
        # Same rules as the scorer itself, surfaced as a 422 instead of a 500.
        return validate_signals(v)


class IndicatorOut(BaseModel):
    id: str
    plain: str
    tech: str
    weight: float
    value: float
    contribution: float


class TypologyClassOut(BaseModel):
    id: str
    name: str
    score: float
    band: str
    indicators: list[IndicatorOut]


class TypologyOut(BaseModel):
    primary: str
    classes: list[TypologyClassOut]
    disclaimer: str
    signalsUsed: int


def _to_out(result: TypologyResult) -> TypologyOut:
    return TypologyOut(
        primary=result.primary,
        classes=[
            TypologyClassOut(
                id=c.id, name=c.name, score=c.score, band=c.band,
                indicators=[IndicatorOut(id=i.id, plain=i.plain, tech=i.tech, weight=i.weight,
                                         value=i.value, contribution=i.contribution)
                            for i in c.indicators],
            )
            for c in result.classes
        ],
        disclaimer=result.disclaimer,
        signalsUsed=result.signals_used,
    )


@router.post("/assess", response_model=TypologyOut)
def assess(body: AssessIn) -> TypologyOut:
    return _to_out(score_typology(body.signals))


@router.get("/cases/{case_id}", response_model=TypologyOut)
def assess_case(case_id: str, db: Session = Depends(get_db)) -> TypologyOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    hops = db.query(Hop).filter(Hop.case_id == case_id).all()
    if not hops:
        # 409, not 200-with-zeros: an untraced case would otherwise read as "no typology
        # indicated", which is a claim about the money we have not earned yet.
        raise HTTPException(status_code=409, detail="Run the trace first — no hops stored for this case.")
    return _to_out(score_typology(derive_signals(db, case, hops)))
