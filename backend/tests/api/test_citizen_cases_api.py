from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base, get_db
from app.models import UserRole
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
    # the run. This file needs its own override to genuinely be the active one at request time,
    # regardless of import order.
    app.dependency_overrides[get_db] = override_get_db
    yield


def _citizen_token(email="tripathidhruv2704@gmail.com") -> str:
    payload = {"user_id": "u2", "tenant_id": "kaizen", "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


BASE_PAYLOAD = {
    "ncrp": "N1", "complainant": "Self-filed", "location": "Delhi", "phone": "9999999999",
    "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
    "amountINR": 50000, "amountCrypto": 50.0, "asset": "USDT-TRC20", "chain": "tron",
    "suspectWallet": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
}


def test_logged_in_citizen_files_a_case_and_sees_it_in_mine():
    created = client.post("/api/v1/cases", json=BASE_PAYLOAD,
                           headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert created.status_code == 201
    assert created.json()["status"] == "new"

    mine = client.get("/api/v1/cases/mine", headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["id"] == created.json()["id"]


def test_guest_files_a_case_and_gets_a_ticket_token():
    created = client.post("/api/v1/cases", json=BASE_PAYLOAD)  # no Authorization header at all
    assert created.status_code == 201
    body = created.json()
    assert body["filedByRole"] == "guest"
    assert body.get("guestTicketToken")

    looked_up = client.get(f"/api/v1/cases/ticket/{body['guestTicketToken']}")
    assert looked_up.status_code == 200
    assert looked_up.json()["id"] == body["id"]


def test_ticket_lookup_404s_for_an_unknown_token():
    response = client.get("/api/v1/cases/ticket/not-a-real-token")
    assert response.status_code == 404


def test_officer_filed_case_via_authenticated_officer_has_no_guest_token():
    db = TestSession()
    if db.query(UserRole).filter(UserRole.email == "dhruv@carvelle.in").one_or_none() is None:
        db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
        db.commit()
    db.close()
    officer_payload = {"user_id": "u1", "tenant_id": "kaizen", "email": "dhruv@carvelle.in",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    token = pyjwt.encode(officer_payload, settings.auth_jwt_secret, algorithm="HS256")
    created = client.post("/api/v1/cases", json=BASE_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    assert created.status_code == 201
    assert created.json()["filedByRole"] == "officer"
    assert created.json().get("guestTicketToken") is None


def test_one_citizen_cannot_see_another_citizens_case_in_mine():
    client.post("/api/v1/cases", json=BASE_PAYLOAD, headers={"Authorization": f"Bearer {_citizen_token('a@example.com')}"})
    mine = client.get("/api/v1/cases/mine", headers={"Authorization": f"Bearer {_citizen_token('b@example.com')}"})
    assert mine.json() == []
