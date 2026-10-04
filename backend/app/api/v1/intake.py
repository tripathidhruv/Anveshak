"""Smart intake API: complaint text in, structured case fields out; then file the case.

`/parse` is stateless and writes nothing -- the officer reviews and corrects every field before
anything is stored. `/cases` validates the wallet against its chain's checksum (a typo here would
send the whole trace to the wrong wallet), creates the case, and records the wallet in the SAHYOG
national memory. The memory lookup it returns is taken BEFORE this submission is recorded, so the
officer sees what the nation already knew, not their own case echoed back.

Privacy: phone numbers and UPI IDs are masked inside `app.intake.extract`, so no raw PII reaches
this response; the intake case path stores no phone number at all.
"""
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.v1.memory import MemoryLookupOut, audited_lookup
from app.audit.chain import append_entry
from app.intake.classify import classify
from app.intake.extract import detect_language, extract_entities
from app.intake.fields import CITIES, build_fields
from app.intake.validators import validate_address
from app.memory.store import record_submission, to_ist
from app.models import Case, MemoryEvent

router = APIRouter(prefix="/api/v1/intake", tags=["intake"])

IST = timezone(timedelta(hours=5, minutes=30))
ChainId = Literal["tron", "ethereum", "bitcoin"]
_CHAIN_LABEL = {"tron": "TRON", "ethereum": "Ethereum", "bitcoin": "Bitcoin"}


class IntakeParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    source: Literal["text", "ncrp"] = "text"


class IntakeEntityOut(BaseModel):
    id: str
    type: Literal["wallet", "amount", "hash", "handle", "date", "pii"]
    text: str
    start: int
    end: int
    confidence: float
    reason: str
    normalized: str | None
    chain: ChainId | None
    warnings: list[str]


class IntakeFieldOut(BaseModel):
    id: str
    label: str
    value: str
    normalized: str | None
    confidence: float
    reason: str
    sources: list[Literal["text", "screenshot", "ncrp"]]
    entityIds: list[str]


class TypologyClassOut(BaseModel):
    id: str
    name: str
    p: float


class TypologyTriggerOut(BaseModel):
    phrase: str
    weight: float
    classId: str


class TypologyOut(BaseModel):
    top: str
    classes: list[TypologyClassOut]
    triggers: list[TypologyTriggerOut]
    disclaimer: str


class IntakeParseOut(BaseModel):
    language: Literal["hinglish", "hindi", "english"]
    scripts: list[str]
    entities: list[IntakeEntityOut]
    fields: list[IntakeFieldOut]
    typology: TypologyOut
    chain: ChainId | None
    elapsedMs: float
    warnings: list[str]


class IntakeCaseIn(BaseModel):
    complainant: str = Field(min_length=1)
    location: str
    suspectWallet: str = Field(min_length=1)
    chain: ChainId
    asset: str
    amountCrypto: float
    amountInr: float
    incidentAt: datetime
    fraudType: str
    txHash: str | None = None
    platform: str | None = None
    ncrp: str | None = None
    unit: str = "Cyber PS Jaipur"
    state: str | None = None
    correctedFields: list[str] = []


class IntakeCaseOut(BaseModel):
    caseId: str
    ncrp: str
    createdAt: datetime
    memory: MemoryLookupOut
    auditHash: str


@router.post("/parse", response_model=IntakeParseOut)
def parse_complaint(payload: IntakeParseIn) -> IntakeParseOut:
    t0 = time.perf_counter()
    text = payload.text
    language, scripts = detect_language(text)
    entities = extract_entities(text)
    typology = classify(text)
    fields = build_fields(text, entities, typology)
    by_id = {f.id: f for f in fields}
    suspect_id = by_id["suspectWallet"].entityIds[0] if by_id["suspectWallet"].entityIds else None
    chain = next((e.chain for e in entities if e.id == suspect_id), None)

    warnings: list[str] = []
    for e in entities:
        for w in e.warnings:
            if w not in warnings:
                warnings.append(w)
    if not any(e.type == "wallet" for e in entities):
        warnings.append("No wallet address found in the complaint. Ask the complainant for the address the money "
                        "was sent to.")

    elapsed = (time.perf_counter() - t0) * 1000
    return IntakeParseOut(
        language=language,
        scripts=scripts,
        entities=[IntakeEntityOut(id=e.id, type=e.type, text=e.text, start=e.start, end=e.end,
                                  confidence=e.confidence, reason=e.reason, normalized=e.normalized,
                                  chain=e.chain, warnings=e.warnings) for e in entities],
        fields=[IntakeFieldOut(**f.__dict__) for f in fields],
        typology=TypologyOut(
            top=typology.top,
            classes=[TypologyClassOut(id=c.id, name=c.name, p=c.p) for c in typology.classes],
            triggers=[TypologyTriggerOut(phrase=t.phrase, weight=t.weight, classId=t.classId)
                      for t in typology.triggers],
            disclaimer=typology.disclaimer,
        ),
        chain=chain,
        elapsedMs=max(elapsed, 0.001),
        warnings=warnings,
    )


_CASE_ID_RE = re.compile(r"^ANV-\d{4}-(\d+)$")


def _next_case_id(db: Session) -> str:
    """ANV-<year>-<NNNN>: one past the highest number used anywhere -- in local cases or in the
    national memory -- so a new case never collides with one another unit already reported."""
    ids = [cid for (cid,) in db.query(Case.id).all()]
    ids += [cid for (cid,) in db.query(MemoryEvent.case_id).filter(MemoryEvent.case_id.isnot(None)).distinct().all()]
    nums = [int(m.group(1)) for cid in ids if (m := _CASE_ID_RE.match(cid))]
    n = max([417, *nums]) + 1
    return f"ANV-{datetime.now(IST).year}-{n:04d}"


def _city_state(location: str, state: str | None) -> tuple[str | None, str | None]:
    parts = [p.strip() for p in location.split(",") if p.strip()]
    city = parts[0] if parts else None
    known = CITIES.get(city.lower()) if city else None
    if known:
        city = known[0]
    return city, state or (parts[1] if len(parts) > 1 else known[1] if known else None)


@router.post("/cases", response_model=IntakeCaseOut, status_code=201)
def create_case_from_intake(payload: IntakeCaseIn, db: Session = Depends(get_db)) -> IntakeCaseOut:
    check = validate_address(payload.suspectWallet)
    wanted = _CHAIN_LABEL[payload.chain]
    if check.chain is not None and check.chain != payload.chain:
        raise HTTPException(status_code=422, detail=(
            f"The scammer's wallet looks like a {_CHAIN_LABEL[check.chain]} address, but the network chosen is "
            f"{wanted}. Check the network or the address."))
    if not check.valid:
        # warnings are the specific, actionable version of `reason` -- show those alone when present
        explain = " ".join(check.warnings) if check.warnings else check.reason
        detail = f"The scammer's wallet is not a valid {wanted} address. {explain}"
        raise HTTPException(status_code=422, detail=detail)

    # Ethereum is stored lowercase, same as cases.py, so downstream comparisons match explorer data.
    wallet = payload.suspectWallet.strip().lower() if payload.chain == "ethereum" else payload.suspectWallet.strip()

    # What the nation knew BEFORE this submission.
    memory = audited_lookup(db, wallet, actor="intake")

    case_id = _next_case_id(db)
    ncrp = payload.ncrp or f"{datetime.now(IST).year}{secrets.randbelow(10**10):010d}"
    case = Case(
        id=case_id, ncrp=ncrp, complainant=payload.complainant, location=payload.location, phone="",
        incident_at=payload.incidentAt, fraud_type=payload.fraudType, amount_inr=payload.amountInr,
        amount_crypto=payload.amountCrypto, asset=payload.asset, chain=payload.chain, suspect_wallet=wallet,
        status="new", filed_by_role="officer",
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    city, state = _city_state(payload.location, payload.state)
    record_submission(db, address=wallet, chain=payload.chain, case_id=case_id, unit=payload.unit, city=city,
                      state=state, amount_inr=payload.amountInr, at=case.reported_at)

    entry = append_entry(db, actor="officer", action="case.create", object_type="case", object_id=case_id)
    if payload.correctedFields:
        entry = append_entry(db, actor="officer", action="intake.correction", object_type="case",
                             object_id=f"{case_id}:{','.join(payload.correctedFields)}")

    return IntakeCaseOut(caseId=case_id, ncrp=ncrp, createdAt=to_ist(case.reported_at), memory=memory,
                         auditHash=entry.hash)
