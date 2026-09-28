"""Standalone inverted-deposit-index lookup endpoint (Task A follow-up):
GET /api/v1/deposit-index/{chain}/{address}.

Covers a real match, the honest empty/no-match case, and chain-appropriate case handling
(ethereum lowercase vs TRON case-sensitive) -- mirroring the same cases
tests/unit/test_deposit_index.py already covers for `lookup_indexed_deposit` itself, but
exercised through the real HTTP endpoint (auth included) rather than the bare function.
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
from app.models import DepositIndexEntry, UserRole

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
    # modules (e.g. test_flagged_wallets_api.py, test_sanctions_api.py) -- reassert ownership
    # at request time regardless of module import/collection order.
    app.dependency_overrides[get_db] = override_get_db
    yield


def _token(email: str) -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def _officer_headers(email: str = "dhruv@carvelle.in") -> dict:
    db = TestSession()
    db.add(UserRole(email=email, role="officer"))
    db.commit()
    db.close()
    return {"Authorization": f"Bearer {_token(email)}"}


def _seed_entry(address: str, chain: str = "ethereum",
                 hot_wallet_address: str = "0x28c6c06298d514db089934071355e5743bf21d60",
                 entity_name: str = "Binance 14") -> None:
    db = TestSession()
    db.add(DepositIndexEntry(address=address, chain=chain, hot_wallet_address=hot_wallet_address,
                              entity_name=entity_name,
                              indexed_at=datetime(2026, 9, 27, tzinfo=timezone.utc)))
    db.commit()
    db.close()


def test_real_match_returns_hot_wallet_and_entity_name():
    _seed_entry("0xdepositor1")
    headers = _officer_headers()

    response = client.get("/api/v1/deposit-index/ethereum/0xdepositor1", headers=headers)
    assert response.status_code == 200
    matches = response.json()
    assert len(matches) == 1
    assert matches[0]["entityName"] == "Binance 14"
    assert matches[0]["hotWalletAddress"] == "0x28c6c06298d514db089934071355e5743bf21d60"
    assert matches[0]["address"] == "0xdepositor1"
    assert matches[0]["chain"] == "ethereum"


def test_no_match_returns_empty_list_not_404():
    headers = _officer_headers("officer-empty@example.com")

    response = client.get("/api/v1/deposit-index/ethereum/0xneverindexed", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


def test_ethereum_lookup_is_case_insensitive():
    # Distinct address from test_real_match_* above -- the module-level engine/StaticPool is
    # shared across every test function in this file (no per-test rollback), so reusing
    # "0xdepositor1" here would hit that other test's already-committed row and trip the
    # (chain, address, hot_wallet_address) unique constraint.
    _seed_entry("0xdepositor2")
    headers = _officer_headers("officer-case@example.com")

    response = client.get("/api/v1/deposit-index/ethereum/0XDEPOSITOR2", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_tron_lookup_is_case_sensitive():
    _seed_entry("TDepositorAddress1111111111111111", chain="tron",
                hot_wallet_address="THotWallet00000000000000000000000",
                entity_name="Some Exchange")
    headers = _officer_headers("officer-tron@example.com")

    exact = client.get(
        "/api/v1/deposit-index/tron/TDepositorAddress1111111111111111", headers=headers,
    )
    assert exact.status_code == 200
    assert len(exact.json()) == 1

    wrong_case = client.get(
        "/api/v1/deposit-index/tron/tdepositoraddress1111111111111111", headers=headers,
    )
    assert wrong_case.status_code == 200
    assert wrong_case.json() == []


def test_401s_without_a_token():
    response = client.get("/api/v1/deposit-index/ethereum/0xdepositor1")
    assert response.status_code == 401


def test_403s_for_non_officer():
    db = TestSession()
    db.add(UserRole(email="citizen-user@example.com", role="citizen"))
    db.commit()
    db.close()

    response = client.get(
        "/api/v1/deposit-index/ethereum/0xdepositor1",
        headers={"Authorization": f"Bearer {_token('citizen-user@example.com')}"},
    )
    assert response.status_code == 403
