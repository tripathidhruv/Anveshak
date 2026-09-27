"""Task 6: officer-facing GET /api/v1/vasp-feed/flagged-wallets/all.

Route note: the plan/brief assumed the officer endpoint could live at the bare
`/flagged-wallets` path, but that path is already an existing, unauthenticated
VASP "pull API" (`list_flagged_wallets`, paginated `FlaggedWalletListOut` shape)
exercised by `test_vasp_feed_api.py`. Registering a second GET handler on the
exact same path+method would either be permanently unreachable (if added after
the existing one) or silently break every existing pull-API test (if added
before it) -- Starlette matches routes in registration order with no
disambiguation by auth header. So this task's endpoint lives at
`/flagged-wallets/all` instead: same officer-gated, full-detail, system-wide
list the brief asked for, just a non-colliding path.
"""
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.db import Base, get_db
from app.main import app
from app.models import FlaggedWallet, UserRole

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
    # modules (e.g. test_me_api.py, test_sanctions_api.py) -- reassert ownership at request
    # time regardless of module import/collection order.
    app.dependency_overrides[get_db] = override_get_db
    yield


def _token(email: str) -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def test_officer_sees_full_untruncated_address():
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db.add(FlaggedWallet(address="TVeryLongRealisticLookingWalletAddress123", chain="tron",
                          risk_score=0.9, case_ids=["case-1"]))
    db.commit()
    db.close()

    response = client.get("/api/v1/vasp-feed/flagged-wallets/all",
                           headers={"Authorization": f"Bearer {_token('dhruv@carvelle.in')}"})
    assert response.status_code == 200
    assert response.json()[0]["address"] == "TVeryLongRealisticLookingWalletAddress123"


def test_non_officer_cannot_see_flagged_wallets():
    db = TestSession()
    db.add(UserRole(email="citizen-user@example.com", role="citizen"))
    db.commit()
    db.close()

    response = client.get("/api/v1/vasp-feed/flagged-wallets/all",
                           headers={"Authorization": f"Bearer {_token('citizen-user@example.com')}"})
    assert response.status_code == 403


def test_401s_without_a_token():
    response = client.get("/api/v1/vasp-feed/flagged-wallets/all")
    assert response.status_code == 401
