import re

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.memory.seed import seed_demo
from app.models import AuditLogEntry, Case
from tests.unit.test_intake_extract import HINGLISH, SUSPECT

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)
_s = TestSession()
seed_demo(_s)
_s.close()


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def _use_this_db():
    # Same re-assert trick as test_campaigns_api.py: every API test module registers its own
    # override at import time and only the last one imported stays active.
    app.dependency_overrides[get_db] = override_get_db


def _case_body(**over):
    body = {
        "complainant": "Rekha Sharma", "location": "Jaipur, Rajasthan", "suspectWallet": SUSPECT, "chain": "tron",
        "asset": "USDT-TRC20", "amountCrypto": 14850, "amountInr": 1240000,
        "incidentAt": "2026-09-02T19:42:00+05:30", "fraudType": "task_job",
        "txHash": "7f3a9c2e41b8d06f5e1a72c94d3b8e06a5f21c7d9e4b30a8f61c2d75e9a4b318",
        "platform": "Telegram · @saffron_tasks_hr",
    }
    body.update(over)
    return body


def test_parse_hinglish_sample():
    _use_this_db()
    r = client.post("/api/v1/intake/parse", json={"text": HINGLISH})
    assert r.status_code == 200
    body = r.json()
    assert body["language"] == "hinglish" and body["scripts"] == ["latin"]
    assert body["chain"] == "tron"
    assert isinstance(body["elapsedMs"], float) and body["elapsedMs"] > 0
    assert body["typology"]["top"] == "task_job"
    assert body["typology"]["disclaimer"] == "A suggestion only — the officer confirms the category in the FIR."
    fields = {f["id"]: f for f in body["fields"]}
    assert fields["suspectWallet"]["value"] == SUSPECT
    assert fields["amountInr"]["value"] == "₹12,40,000"
    assert fields["incidentAt"]["normalized"] == "2026-09-02T19:42:00+05:30"
    ent = body["entities"][0]
    assert set(ent) == {"id", "type", "text", "start", "end", "confidence", "reason", "normalized", "chain", "warnings"}
    # Masked at ingest: the raw phone digits never come back.
    assert "98XXXX4821" not in r.text and "tasks.pay" not in r.text


def test_parse_masks_unmasked_pii_everywhere():
    _use_this_db()
    r = client.post("/api/v1/intake/parse", json={"text": "Mera number 9876543210 aur UPI rahul.k99@okaxis hai"})
    assert r.status_code == 200
    assert "9876543210" not in r.text and "rahul" not in r.text


def test_parse_noise():
    _use_this_db()
    r = client.post("/api/v1/intake/parse", json={"text": "zzz qqq 123"})
    assert r.status_code == 200
    body = r.json()
    assert body["typology"]["top"] == "other"
    assert body["chain"] is None
    assert body["warnings"]


def test_parse_rejects_empty_and_huge():
    _use_this_db()
    assert client.post("/api/v1/intake/parse", json={"text": ""}).status_code == 422
    assert client.post("/api/v1/intake/parse", json={"text": "a" * 20001}).status_code == 422


def test_create_case_shows_what_nation_already_knew():
    _use_this_db()
    r = client.post("/api/v1/intake/cases", json=_case_body(correctedFields=["amountInr"]))
    assert r.status_code == 201, r.text
    body = r.json()
    assert re.fullmatch(r"ANV-\d{4}-\d{4}", body["caseId"])
    assert int(body["caseId"][-4:]) >= 418
    assert re.fullmatch(r"\d{14}", body["ncrp"])
    mem = body["memory"]
    assert mem["known"] is True
    assert [c["caseId"] for c in mem["linkedCases"]] == ["ANV-2026-0416", "ANV-2026-0412", "ANV-2026-0406"]
    assert mem["syndicate"]["id"] == "SYN-07"
    assert re.fullmatch(r"[0-9a-f]{64}", body["auditHash"])

    db = TestSession()
    try:
        case = db.get(Case, body["caseId"])
        assert case is not None and case.phone == "" and case.status == "new" and case.filed_by_role == "officer"
        actions = [e.action for e in db.query(AuditLogEntry).all()]
        assert "case.create" in actions and "intake.correction" in actions
        corr = db.query(AuditLogEntry).filter(AuditLogEntry.action == "intake.correction").one()
        assert "amountInr" in corr.object_id
    finally:
        db.close()

    # The submission is now part of the memory.
    after = client.get(f"/api/v1/memory/wallets/{SUSPECT}").json()
    assert after["linkedCases"][0]["caseId"] == body["caseId"]
    assert after["linkedCases"][0]["city"] == "Jaipur" and after["linkedCases"][0]["state"] == "Rajasthan"


def test_case_numbers_increase():
    _use_this_db()
    a = client.post("/api/v1/intake/cases", json=_case_body(ncrp="12345678901234")).json()
    b = client.post("/api/v1/intake/cases", json=_case_body()).json()
    assert a["ncrp"] == "12345678901234"
    assert int(b["caseId"][-4:]) == int(a["caseId"][-4:]) + 1


def test_create_case_rejects_invalid_wallet():
    _use_this_db()
    r = client.post("/api/v1/intake/cases", json=_case_body(suspectWallet="TNh8yW5vC2mQ7fL4xK9pR"))
    assert r.status_code == 422
    assert "21 characters" in r.json()["detail"]


def test_create_case_rejects_chain_mismatch():
    _use_this_db()
    r = client.post("/api/v1/intake/cases", json=_case_body(chain="ethereum"))
    assert r.status_code == 422
    assert "TRON" in r.json()["detail"]
