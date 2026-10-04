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
from datetime import datetime, timedelta, timezone

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
    # modules (e.g. test_sanctions_api.py, test_traces_api.py): every module in this suite
    # sets `app.dependency_overrides[get_db]` at import time on the same shared `app`
    # instance, so whichever module pytest collects last "wins" for everyone else's tests
    # for the rest of the run. This file seeds fixture rows directly via its own
    # `TestSession` and reads them back through `client`, so it needs its own override to
    # genuinely be the active one at request time, regardless of import order.
    app.dependency_overrides[get_db] = override_get_db
    yield

def _token(email: str) -> str:
    payload = {"user_id": "u1", "tenant_id": "anveshak", "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def test_me_returns_seeded_officer_role():
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db.commit()
    db.close()
    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {_token('dhruv@carvelle.in')}"})
    assert response.status_code == 200
    assert response.json() == {"email": "dhruv@carvelle.in", "role": "officer"}

def test_me_defaults_new_email_to_citizen():
    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {_token('new-person@example.com')}"})
    assert response.status_code == 200
    assert response.json()["role"] == "citizen"

def test_me_401s_without_a_token():
    response = client.get("/api/v1/me")
    assert response.status_code == 401
