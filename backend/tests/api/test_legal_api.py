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


@pytest.fixture(autouse=True)
def _reset_db_override():
    # Same fix as tests/api/test_traces_api.py's own identically-named fixture: every
    # tests/api/test_*.py module does `app.dependency_overrides[get_db] = <its own override>`
    # at import time, and pytest imports every test module before executing any of them, so
    # whichever module's override happened to be installed LAST at collection time is what's
    # actually active unless each module re-asserts its own override before its tests run. This
    # task's own new tests (_set_innocence below) instantiate a `TestSession()` directly against
    # THIS module's `engine` -- without this fixture that could silently be a different, empty
    # in-memory database than the one the `client.post(...)` calls in this module actually hit.
    app.dependency_overrides[get_db] = override_get_db
    yield


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


# ---------------------------------------------------------------------------
# Innocence gate (this task): create_notice must refuse to draft when the case's persisted
# innocence_score is at or above INNOCENCE_GATE_THRESHOLD, but must NOT block a case that was
# never traced (innocence_score is None) or one with an ordinary, low innocence score.
# ---------------------------------------------------------------------------

def _set_innocence(case_id, score, factors=None):
    from app.models import Case
    db = TestSession()
    try:
        case = db.get(Case, case_id)
        case.innocence_score = score
        case.innocence_factors = factors or []
        db.commit()
    finally:
        db.close()


def test_create_notice_refuses_when_innocence_score_is_above_threshold():
    case_id = _create_case("LEGAL-CASE-HIGH-INNOCENCE")
    _set_innocence(case_id, 0.75, factors=[
        {"check": "known_infrastructure_contract",
         "description": "This address is not a personal wallet at all -- it's a known bridge contract.",
         "supportsInnocence": True, "weight": 1.0},
    ])

    response = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bnss_94"})
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "0.75" in detail
    assert "known bridge contract" in detail


def test_create_notice_drafts_fine_for_a_normal_case_with_low_innocence_score():
    case_id = _create_case("LEGAL-CASE-LOW-INNOCENCE")
    _set_innocence(case_id, 0.2, factors=[])

    response = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bnss_94"})
    assert response.status_code == 201, response.text


def test_create_notice_not_blocked_when_case_was_never_traced():
    # A case with no persisted innocence score yet (innocence_score is None, the Case default)
    # must NOT be blocked by the gate -- only a real, known-high score blocks drafting.
    case_id = _create_case("LEGAL-CASE-NEVER-TRACED")
    response = client.post("/api/v1/legal/notices", json={"caseId": case_id, "citationId": "bnss_94"})
    assert response.status_code == 201, response.text
