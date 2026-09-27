from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base, get_db
from app.models import Case, UserRole
from app.config import settings
import jwt as pyjwt

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
def _reset_db_override():
    # Same shared-`app.dependency_overrides` fragility documented in the sibling API test
    # modules (e.g. test_case_status_api.py) -- every module in this suite sets
    # `app.dependency_overrides[get_db]` at import time on the same shared `app` instance, so
    # whichever module pytest collects last "wins" for everyone else's tests for the rest of
    # the run. This file seeds fixture rows directly via its own `TestSession` and reads them
    # back through `client`, so it needs its own override to genuinely be the active one at
    # request time, regardless of import order.
    app.dependency_overrides[get_db] = override_get_db
    yield


def _officer_token() -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": "dhruv@carvelle.in",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def _seed_officer_role():
    db = TestSession()
    if db.query(UserRole).filter(UserRole.email == "dhruv@carvelle.in").one_or_none() is None:
        db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
        db.commit()
    db.close()


def _seed_case(case_id: str, status="new") -> str:
    db = TestSession()
    case = Case(id=case_id, ncrp="N1", complainant="C", location="L", phone="P",
                incident_at=datetime.now(timezone.utc), fraud_type="scam",
                amount_inr=1000, amount_crypto=10, asset="USDT-TRC20", chain="tron",
                suspect_wallet="Tsuspect", status=status)
    db.add(case)
    db.commit()
    db.close()
    return case_id


def test_officer_posts_a_manual_reply():
    _seed_officer_role()
    case_id = _seed_case("case-reply-manual")
    response = client.post(f"/api/v1/cases/{case_id}/replies", json={"message": "We are on it."},
                            headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 201
    assert response.json()["authoredBy"] == "officer"
    assert response.json()["caseId"] == case_id
    listed = client.get(f"/api/v1/cases/{case_id}/replies",
                         headers={"Authorization": f"Bearer {_officer_token()}"})
    assert len(listed.json()) == 1


def test_handling_a_case_adds_an_ai_reply_when_narrative_available():
    _seed_officer_role()
    case_id = _seed_case("case-reply-ai-available", status="in_progress")
    with patch("app.api.v1.cases.generate_case_narrative",
               return_value=("The money moved to a wallet linked to Exchange X.", True, None)):
        response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "handled"},
                                 headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    replies = client.get(f"/api/v1/cases/{case_id}/replies",
                          headers={"Authorization": f"Bearer {_officer_token()}"}).json()
    assert any(r["authoredBy"] == "ai" and "Exchange X" in r["message"] for r in replies)


def test_handling_a_case_adds_no_ai_reply_when_narrative_unavailable():
    _seed_officer_role()
    case_id = _seed_case("case-reply-ai-unavailable", status="in_progress")
    with patch("app.api.v1.cases.generate_case_narrative",
               return_value=(None, False, "OpenAI key not configured")):
        response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "handled"},
                                 headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    replies = client.get(f"/api/v1/cases/{case_id}/replies",
                          headers={"Authorization": f"Bearer {_officer_token()}"}).json()
    assert not any(r["authoredBy"] == "ai" for r in replies)


def test_replies_listed_in_created_order():
    _seed_officer_role()
    case_id = _seed_case("case-reply-order")
    client.post(f"/api/v1/cases/{case_id}/replies", json={"message": "first"},
                headers={"Authorization": f"Bearer {_officer_token()}"})
    client.post(f"/api/v1/cases/{case_id}/replies", json={"message": "second"},
                headers={"Authorization": f"Bearer {_officer_token()}"})
    listed = client.get(f"/api/v1/cases/{case_id}/replies",
                         headers={"Authorization": f"Bearer {_officer_token()}"}).json()
    assert [r["message"] for r in listed] == ["first", "second"]


def test_404_for_unknown_case_on_replies():
    _seed_officer_role()
    response = client.post("/api/v1/cases/does-not-exist/replies", json={"message": "hi"},
                            headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 404
    response = client.get("/api/v1/cases/does-not-exist/replies",
                           headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 404
