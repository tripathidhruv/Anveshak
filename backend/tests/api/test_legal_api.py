import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.legal import notice_fsm
from app.main import app

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False},
                        poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def _isolated_notice_store():
    notice_fsm.reset_store()
    yield
    notice_fsm.reset_store()


def _create_case(case_id="LEGAL-CASE-1"):
    payload = {
        "ncrp": "NCRP-LEGAL-1", "complainant": "Test User", "location": "Delhi",
        "phone": "9999999999", "incidentAt": "2026-01-01T00:00:00Z",
        "fraudType": "investment_scam", "amountINR": 150000, "amountCrypto": 150.0,
        "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
    }
    created = client.post("/api/v1/cases", json=payload)
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_list_citations_marks_them_all_unverified():
    response = client.get("/api/v1/legal/citations")
    assert response.status_code == 200
    citations = response.json()
    assert len(citations) == 4
    assert all(c["unverified"] is True for c in citations)


def test_create_notice_body_includes_visible_disclaimer():
    case_id = _create_case()
    response = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bnss_94"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["state"] == "draft"
    assert "UNVERIFIED" in body["body"]
    assert "DRAFT" in body["body"]


def test_create_notice_unknown_citation_is_400():
    case_id = _create_case()
    response = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "nope"})
    assert response.status_code == 400


def test_create_notice_unknown_case_is_404():
    response = client.post("/api/v1/legal/notices", json={"caseId": "does-not-exist", "citationId": "bnss_94"})
    assert response.status_code == 404


def test_send_unapproved_notice_is_rejected():
    case_id = _create_case()
    created = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bns_223"})
    notice_id = created.json()["id"]
    response = client.post(f"/api/v1/legal/notices/{notice_id}/send")
    assert response.status_code == 409


def test_approve_then_send_succeeds():
    case_id = _create_case()
    created = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bsa_63"})
    notice_id = created.json()["id"]

    approved = client.post(f"/api/v1/legal/notices/{notice_id}/approve", json={"approvedBy": "Officer Rao"})
    assert approved.status_code == 200
    assert approved.json()["state"] == "approved"

    sent = client.post(f"/api/v1/legal/notices/{notice_id}/send")
    assert sent.status_code == 200
    assert sent.json()["state"] == "sent"


def test_sahyog_payload_endpoint_carries_disclaimer_and_notice_state():
    case_id = _create_case()
    created = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bnss_106"})
    notice_id = created.json()["id"]

    response = client.get(f"/api/v1/legal/notices/{notice_id}/sahyog-payload")
    assert response.status_code == 200
    payload = response.json()
    assert payload["_meta"]["data_is_synthetic"] is True
    assert "not verified" in payload["_meta"]["disclaimer"].lower()
    assert payload["case_reference"]["case_id"] == case_id
    assert payload["legal_notice"]["notice_id"] == notice_id
    assert payload["legal_notice"]["state"] == "draft"


def test_sahyog_payload_unknown_notice_is_404():
    response = client.get("/api/v1/legal/notices/does-not-exist/sahyog-payload")
    assert response.status_code == 404
