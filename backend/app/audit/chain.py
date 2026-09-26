"""Hash-chained audit log (Task H6).

Every significant action in this backend can be recorded as an
`AuditLogEntry` whose `hash` field is derived from its own fields plus the
hash of the entry immediately before it (`prev_hash`), forming a singly
linked hash chain anchored at a fixed genesis value. Because each entry's
hash depends on the previous entry's hash, changing any stored field on any
entry -- including a direct DB edit that bypasses this module entirely --
changes what that entry's hash *should* be, which in turn breaks the
`prev_hash` link recorded by the entry after it.

This module borrows the hash-chain pattern from a rival project cited in
this repo's competitive-review docs (Himanshu-Harsh's audit log), which
built the hashing correctly but never wrote code that actually walked the
chain to confirm no link was broken -- so its tamper-evidence was
theoretical (a hash field nobody ever re-checked), not operational (a
pass/fail you can actually run). `verify_chain()` below is the fix: it
recomputes every entry's expected hash from genesis and returns the exact
entry where the chain first diverges from what append-only history would
produce, if it diverges at all.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import AuditLogEntry

# Fixed anchor for the first entry's `prev_hash`. A sha256 digest is 64 hex
# characters; using an all-zero digest of the same length keeps every
# `prev_hash` value structurally identical (always a 64-char hex string),
# so verification code never needs a "is this the first entry" special case
# when comparing lengths/formats -- only when comparing the value itself.
GENESIS_HASH = "0" * 64


def _compute_hash(actor: str, action: str, object_type: str, object_id: str, prev_hash: str) -> str:
    """Derive an entry's hash from its own fields and the previous entry's hash.

    The pipe-joined field order (`actor|action|object_type|object_id|prev_hash`)
    is fixed by the approved spec this task implements against -- do not
    reorder it, since doing so would silently invalidate every previously
    computed hash in any existing chain.
    """
    payload = f"{actor}|{action}|{object_type}|{object_id}|{prev_hash}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def append_entry(db: Session, *, actor: str, action: str, object_type: str, object_id: str) -> AuditLogEntry:
    """Append one entry to the audit chain and persist it.

    Reads the current last entry's hash (or `GENESIS_HASH` if the chain is
    empty) as this new entry's `prev_hash`, so entries are only ever
    appended -- never inserted out of order -- which is what makes the
    resulting chain walkable and verifiable.
    """
    last_entry = (
        db.query(AuditLogEntry)
        .order_by(AuditLogEntry.id.desc())
        .first()
    )
    prev_hash = last_entry.hash if last_entry is not None else GENESIS_HASH
    entry_hash = _compute_hash(actor, action, object_type, object_id, prev_hash)

    entry = AuditLogEntry(
        actor=actor,
        action=action,
        object_type=object_type,
        object_id=object_id,
        prev_hash=prev_hash,
        hash=entry_hash,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@dataclass
class ChainVerificationResult:
    valid: bool
    broken_at_entry_id: int | None
    checked_entries: int


def verify_chain(db: Session) -> ChainVerificationResult:
    """Walk the entire audit chain from genesis and confirm no link is broken.

    This is the operational tamper-evidence check the rival pattern lacked:
    for every entry, in creation order, it (1) confirms the entry's stored
    `prev_hash` matches the previous entry's stored `hash` (or `GENESIS_HASH`
    for the first entry), and (2) recomputes the entry's expected hash from
    its own fields and compares it against the stored `hash`. Either
    mismatch means the entry -- or an earlier one whose downstream effects
    reach it -- was tampered with after being written, since a legitimately
    appended entry can never fail either check.

    Returns a result identifying the exact entry where the chain first
    breaks, not just a bare pass/fail, so an operator can see precisely
    which record needs investigation.
    """
    entries = db.query(AuditLogEntry).order_by(AuditLogEntry.id.asc()).all()

    expected_prev_hash = GENESIS_HASH
    checked = 0
    for entry in entries:
        checked += 1

        if entry.prev_hash != expected_prev_hash:
            return ChainVerificationResult(valid=False, broken_at_entry_id=entry.id, checked_entries=checked)

        recomputed_hash = _compute_hash(entry.actor, entry.action, entry.object_type, entry.object_id, entry.prev_hash)
        if recomputed_hash != entry.hash:
            return ChainVerificationResult(valid=False, broken_at_entry_id=entry.id, checked_entries=checked)

        expected_prev_hash = entry.hash

    return ChainVerificationResult(valid=True, broken_at_entry_id=None, checked_entries=checked)
