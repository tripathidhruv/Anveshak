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
# NOTE (deferred integration, see task-H6-report.md): no other endpoint in this
# backend calls `append_entry()` yet. This task's brief originally asked for
# 2-3 real call sites (case creation, attribution result, etc.), but 7 sibling
# agents were simultaneously editing `cases.py`, `traces.py`, and other
# routers for tasks H1-H5/H7-H8 in this same pass, so wiring call sites there
# was deliberately left out of this task's file scope to avoid collisions.
# The audit module itself (`app/audit/chain.py`) is complete and tested
# end-to-end via its own functions; it's just not yet invoked from request
# handlers elsewhere. Wiring real call sites is follow-up work.


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
