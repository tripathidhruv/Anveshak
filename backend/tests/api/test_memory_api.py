from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.memory.seed import seed_demo
from app.models import AuditLogEntry

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)
_s = TestSession()
seed_demo(_s)
_s.close()

DEMO = "TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm"


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def _use_this_db():
    app.dependency_overrides[get_db] = override_get_db


def test_lookup_known_wallet():
    _use_this_db()
    r = client.get(f"/api/v1/memory/wallets/{DEMO}")
    assert r.status_code == 200
    body = r.json()
    assert body["known"] is True and body["chain"] == "tron"
    assert body["firstSeen"] == "2026-08-21T16:05:00+05:30"
    assert body["submissionCount"] == 3
    assert body["linkedCases"][0] == {"caseId": "ANV-2026-0416", "relation": "same_wallet", "city": "Kochi",
                                      "state": "Kerala", "amountInr": 860000.0,
                                      "reportedAt": "2026-09-03T09:18:00+05:30"}
    assert body["syndicate"] == {"id": "SYN-07", "name": "Telegram task-scam ring “Saffron Desk”", "caseCount": 38,
                                 "stateCount": 11, "valueInr": 47000000.0, "confidence": 0.93,
                                 "hub": "TNh8yW5vC2mQ7fL4xK9pR"}
    assert body["provenance"][0] == {"at": "2026-09-03T09:18:00+05:30", "unit": "Cyber PS Kochi", "state": "Kerala",
                                     "event": "submitted", "detail": "Named as the receiving wallet in ANV-2026-0416"}
    assert body["disclaimer"].endswith("A lead to verify, not proof.")


def test_lookup_unknown_wallet():
    _use_this_db()
    r = client.get("/api/v1/memory/wallets/TUnknown0000000000000000000000000")
    assert r.status_code == 200
    body = r.json()
    assert body["known"] is False and body["linkedCases"] == [] and body["provenance"] == []
    assert body["syndicate"] is None and body["firstSeen"] is None and body["submissionCount"] == 0


def test_lookup_is_audited():
    _use_this_db()
    addr = "TAuditMe000000000000000000000000"
    client.get(f"/api/v1/memory/wallets/{addr}")
    db = TestSession()
    try:
        entries = db.query(AuditLogEntry).filter(AuditLogEntry.action == "memory.lookup",
                                                 AuditLogEntry.object_id == addr).all()
        assert len(entries) == 1 and entries[0].object_type == "wallet"
    finally:
        db.close()


def test_stats():
    _use_this_db()
    r = client.get("/api/v1/memory/stats")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"wallets", "cases", "events", "states", "syndicates"}
    assert body["syndicates"] == 4 and body["wallets"] >= 6


def test_no_pii_columns_in_memory_tables():
    from app.models import MemoryEvent, MemorySyndicate, MemoryWallet
    cols = {c.name for t in (MemoryEvent, MemoryWallet, MemorySyndicate) for c in t.__table__.columns}
    assert not cols & {"complainant", "phone", "email", "complainant_email", "name_of_victim"}
