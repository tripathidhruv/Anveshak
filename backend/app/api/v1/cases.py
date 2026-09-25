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
    chain = payload.chain.lower()
    suspect_wallet = payload.suspectWallet
    # Ethereum addresses are hex and case-insensitive once EIP-55 checksumming is
    # ignored, but Etherscan's own transfer records always come back lowercase — so a
    # checksummed (mixed-case) address a user types into the form would never match
    # anything downstream (tracer.py, traces.py, graph/backward.py, etc., all compare
    # addresses case-sensitively). Normalized once here, at the same point `chain` is
    # normalized, so every downstream reader sees canonical lowercase. This is
    # conditional on chain — unlike `chain` itself, which is always lowercased — because
    # TRON (base58) and Bitcoin (bech32/base58) addresses are genuinely case-sensitive;
    # lowercasing those would corrupt them.
    if chain == "ethereum":
        suspect_wallet = suspect_wallet.lower()
    case = Case(
        id=str(uuid.uuid4()), ncrp=payload.ncrp, complainant=payload.complainant,
        location=payload.location, phone=payload.phone, incident_at=payload.incidentAt,
        fraud_type=payload.fraudType, amount_inr=payload.amountINR, amount_crypto=payload.amountCrypto,
        asset=payload.asset,
        # Normalized once here so every downstream reader of `case.chain` (registry.py,
        # tracer, etc.) always sees the canonical lowercase form — don't add more
        # `.lower()` calls elsewhere for this.
        chain=chain,
        suspect_wallet=suspect_wallet,
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
