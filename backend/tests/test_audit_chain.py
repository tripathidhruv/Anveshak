"""Tests for the hash-chained audit log (Task H6).

Covers the gap this task exists to close: the rival pattern this hash-chain
design borrows from (Himanshu-Harsh's project, per docs/superpowers competitive
review) built `append_entry`-style hashing correctly but never actually walked
the chain to confirm it wasn't broken -- tamper-evidence was theoretical, not
operational. These tests prove `verify_chain()` is a real, working chain-walk:
it must pass on a genuine chain and must correctly *locate* a tampered entry,
not just report a bare "invalid".
"""
from app.audit.chain import append_entry, verify_chain, GENESIS_HASH
from app.models import AuditLogEntry


def test_first_entry_chains_from_genesis(db_session):
    entry = append_entry(
        db_session, actor="officer1", action="case.create",
        object_type="case", object_id="case-1",
    )
    assert entry.prev_hash == GENESIS_HASH
    assert entry.hash != GENESIS_HASH
    assert len(entry.hash) == 64  # sha256 hex digest


def test_second_entry_chains_from_first(db_session):
    e1 = append_entry(db_session, actor="officer1", action="case.create", object_type="case", object_id="case-1")
    e2 = append_entry(db_session, actor="officer1", action="trace.run", object_type="case", object_id="case-1")
    assert e2.prev_hash == e1.hash
    assert e2.hash != e1.hash


def test_genuine_chain_of_five_plus_entries_verifies_ok(db_session):
    for i in range(6):
        append_entry(
            db_session, actor=f"officer{i}", action="case.create",
            object_type="case", object_id=f"case-{i}",
        )
    result = verify_chain(db_session)
    assert result.valid is True
    assert result.broken_at_entry_id is None
    assert result.checked_entries == 6


def test_empty_chain_is_valid(db_session):
    result = verify_chain(db_session)
    assert result.valid is True
    assert result.broken_at_entry_id is None
    assert result.checked_entries == 0


def test_tampering_with_hash_field_is_detected_at_right_entry(db_session):
    for i in range(5):
        append_entry(db_session, actor="officer1", action="case.create", object_type="case", object_id=f"case-{i}")

    entries = db_session.query(AuditLogEntry).order_by(AuditLogEntry.id).all()
    tampered_id = entries[2].id  # simulate a direct DB edit on the 3rd entry
    entries[2].hash = "0" * 64
    db_session.add(entries[2])
    db_session.commit()

    result = verify_chain(db_session)
    assert result.valid is False
    assert result.broken_at_entry_id == tampered_id
    # It should still have walked (and counted) entries up through the break.
    assert result.checked_entries >= 3


def test_tampering_with_a_preceding_field_is_detected(db_session):
    for i in range(5):
        append_entry(db_session, actor="officer1", action="case.create", object_type="case", object_id=f"case-{i}")

    entries = db_session.query(AuditLogEntry).order_by(AuditLogEntry.id).all()
    tampered_id = entries[1].id
    # Mutate `actor` without recomputing `hash` -- simulates a raw DB edit that
    # doesn't bother re-deriving the hash, which is the realistic tamper case.
    entries[1].actor = "attacker"
    db_session.add(entries[1])
    db_session.commit()

    result = verify_chain(db_session)
    assert result.valid is False
    assert result.broken_at_entry_id == tampered_id


def test_tampering_breaks_downstream_prev_hash_links_too(db_session):
    # Tampering entry N also invalidates entry N+1's prev_hash linkage (since
    # N's stored hash no longer matches what N+1 recorded as prev_hash), but
    # verify_chain must report the *first* break, not a later cascading one.
    for i in range(5):
        append_entry(db_session, actor="officer1", action="case.create", object_type="case", object_id=f"case-{i}")

    entries = db_session.query(AuditLogEntry).order_by(AuditLogEntry.id).all()
    tampered_id = entries[1].id
    entries[1].hash = "f" * 64
    db_session.add(entries[1])
    db_session.commit()

    result = verify_chain(db_session)
    assert result.valid is False
    assert result.broken_at_entry_id == tampered_id
