from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.audit.chain import verify_chain
from app.models import AuditLogEntry
from app.schemas import AuditLogEntryOut, AuditVerifyOut

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Filled in by Task H6: hash-chained audit log + operational verify_chain().
#
# `append_entry()` is now called from real request handlers: `cases.py`
# (`action="case.create"`, at case-creation time) and `traces.py`
# (`action="trace.run"` and `action="attribution.result"`, added by Task H11).
# The audit module itself (`app/audit/chain.py`) is complete and tested
# end-to-end via its own functions in `tests/test_audit_chain.py`.


def _to_out(entry: AuditLogEntry) -> AuditLogEntryOut:
    return AuditLogEntryOut(
        actor=entry.actor,
        action=entry.action,
        objectType=entry.object_type,
        objectId=entry.object_id,
        hash=entry.hash,
        createdAt=entry.created_at,
    )


@router.get("", response_model=list[AuditLogEntryOut])
def list_audit_entries(db: Session = Depends(get_db)) -> list[AuditLogEntryOut]:
    entries = db.query(AuditLogEntry).order_by(AuditLogEntry.id.asc()).all()
    return [_to_out(entry) for entry in entries]


@router.get("/verify", response_model=AuditVerifyOut)
def verify_audit_chain(db: Session = Depends(get_db)) -> AuditVerifyOut:
    """Walk the full audit chain from genesis and report whether it's intact.

    Returns exactly where the chain broke (`brokenAtEntryId`), if it did --
    this is the operational tamper-evidence check the borrowed rival pattern
    never actually performed (see `app/audit/chain.py` module docstring).
    """
    result = verify_chain(db)
    return AuditVerifyOut(
        valid=result.valid,
        brokenAtEntryId=result.broken_at_entry_id,
        checkedEntries=result.checked_entries,
    )
