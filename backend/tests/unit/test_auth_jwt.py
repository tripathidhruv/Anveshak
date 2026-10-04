"""Covers app.auth.jwt.get_current_officer: valid token, expired token, wrong secret,
and missing Authorization header. The dependency verifies (never issues) a JWT in the
exact shape E:/API's own app/core/security.py::create_access_token produces --
{"user_id", "tenant_id", "email", "exp"}, HS256, shared-secret. No network call to the
auth service is made or needed; this is pure local signature/claims verification, and no
real endpoint is gated behind it yet in this pass (see the Feature 1 spec)."""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.jwt import OfficerClaims, get_current_officer

TEST_SECRET = "anveshak-test-shared-secret"


def _make_app() -> FastAPI:
    app = FastAPI()

    @app.get("/whoami")
    def whoami(officer: OfficerClaims = Depends(get_current_officer)):
        return {"user_id": officer.user_id, "tenant_id": officer.tenant_id, "email": officer.email}

    return app


@pytest.fixture()
def client():
    with patch("app.auth.jwt.settings.auth_jwt_secret", TEST_SECRET):
        yield TestClient(_make_app())


def _token(secret: str = TEST_SECRET, expires_delta: timedelta = timedelta(minutes=30), **overrides) -> str:
    payload = {
        "user_id": "user-1",
        "tenant_id": "tenant-1",
        "email": "officer@example.com",
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    payload.update(overrides)
    return jwt.encode(payload, secret, algorithm="HS256")


def test_valid_token_is_accepted(client):
    token = _token()
    r = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == "user-1"
    assert body["tenant_id"] == "tenant-1"
    assert body["email"] == "officer@example.com"


def test_expired_token_rejected(client):
    token = _token(expires_delta=timedelta(minutes=-1))
    r = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    # detail is a fixed generic message -- never leaks the raw jwt.ExpiredSignatureError text
    assert r.json()["detail"] == "Invalid or expired token"


def test_wrong_secret_rejected(client):
    token = _token(secret="not-the-shared-secret")
    r = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid or expired token"


def test_missing_auth_header_rejected(client):
    r = client.get("/whoami")
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid or expired token"


def test_malformed_token_rejected(client):
    r = client.get("/whoami", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401


def test_missing_required_claim_rejected(client):
    # No user_id claim at all -- a token that decodes fine but lacks a required field.
    payload = {"tenant_id": "tenant-1", "email": "officer@example.com",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=30)}
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    r = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
