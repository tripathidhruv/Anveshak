from datetime import datetime, timedelta, timezone

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
    # modules (e.g. test_me_api.py): every module in this suite sets
    # `app.dependency_overrides[get_db]` at import time on the same shared `app` instance, so
    # whichever module pytest collects last "wins" for everyone else's tests for the rest of
    # the run. This file seeds fixture rows directly via its own `TestSession` and reads them
    # back through `client`, so it needs its own override to genuinely be the active one at
    # request time, regardless of import order.
    app.dependency_overrides[get_db] = override_get_db
    yield


def _officer_token() -> str:
    payload = {"user_id": "u1", "tenant_id": "anveshak", "email": "dhruv@carvelle.in",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def _citizen_token() -> str:
    payload = {"user_id": "u2", "tenant_id": "anveshak", "email": "tripathidhruv2704@gmail.com",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def _seed_case(case_id="case-1", status="new") -> str:
    db = TestSession()
    case = Case(id=case_id, ncrp="N1", complainant="C", location="L", phone="P",
                incident_at=datetime.now(timezone.utc), fraud_type="scam",
                amount_inr=1000, amount_crypto=10, asset="USDT-TRC20", chain="tron",
                suspect_wallet="Tsuspect", status=status)
    db.add(case)
    db.commit()
    db.close()
    return case_id


def _seed_officer_role():
    db = TestSession()
    if db.query(UserRole).filter(UserRole.email == "dhruv@carvelle.in").one_or_none() is None:
        db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
        db.commit()
    db.close()


def test_officer_can_transition_new_to_in_progress():
    _seed_officer_role()
    case_id = _seed_case(case_id="case-transition-ok", status="new")
    response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "in_progress"},
                             headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_rejects_invalid_transition_new_to_handled_directly():
    _seed_officer_role()
    case_id = _seed_case(case_id="case-transition-invalid", status="new")
    response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "handled"},
                             headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 409


def test_citizen_cannot_transition_status():
    case_id = _seed_case(case_id="case-transition-forbidden", status="new")
    response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "in_progress"},
                             headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert response.status_code == 403


def test_404_for_unknown_case():
    _seed_officer_role()
    response = client.patch("/api/v1/cases/does-not-exist/status", json={"status": "in_progress"},
                             headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 404
