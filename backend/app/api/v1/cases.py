import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models import Case
from app.schemas import CaseIn, CaseOut

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])

def _to_out(case: Case) -> CaseOut:
    return CaseOut(
        id=case.id, ncrp=case.ncrp, complainant=case.complainant, location=case.location,
        phone=case.phone, incidentAt=case.incident_at, reportedAt=case.reported_at,
        fraudType=case.fraud_type, amountINR=case.amount_inr, amountCrypto=case.amount_crypto,
        asset=case.asset, chain=case.chain, suspectWallet=case.suspect_wallet,
    )

@router.post("", response_model=CaseOut, status_code=201)
def create_case(payload: CaseIn, db: Session = Depends(get_db)) -> CaseOut:
    case = Case(
        id=str(uuid.uuid4()), ncrp=payload.ncrp, complainant=payload.complainant,
        location=payload.location, phone=payload.phone, incident_at=payload.incidentAt,
        fraud_type=payload.fraudType, amount_inr=payload.amountINR, amount_crypto=payload.amountCrypto,
        asset=payload.asset, chain=payload.chain, suspect_wallet=payload.suspectWallet,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return _to_out(case)

@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db)) -> CaseOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    return _to_out(case)
