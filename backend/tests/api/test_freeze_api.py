from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.chains.base import Transfer
from app.db import Base, get_db
from app.freeze.tether import TetherWalletCheck
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

SUSPECT = "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB"
TERMINAL = "TExchangeHotWalletCCCCCCCCCCCCCCCCC"

T0 = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)


def mk(from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})


class FakeChainClient:
    chain = "tron"

    def __init__(self, moved_at):
        self._moved_at = moved_at

    def get_transfers(self, address, since=None):
        if address == SUSPECT:
            return [mk(SUSPECT, TERMINAL, 150.0, self._moved_at, "tx-suspect-to-terminal")]
        if address == TERMINAL:
            return []  # terminal: never moved onward -> stop_reason == "no_outgoing_activity"
        return []


def _make_case(chain="tron", asset="USDT-TRC20", incident_at="2026-01-01T00:00:00Z"):
    payload = {
        "ncrp": "NCRP-FREEZE-1", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": incident_at, "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": asset, "chain": chain,
        "suspectWallet": SUSPECT,
    }
    return client.post("/api/v1/cases", json=payload).json()["id"]


def test_freeze_check_rejects_non_usdt_case():
    case_id = _make_case(chain="bitcoin", asset="BTC")
    response = client.get(f"/api/v1/freeze/{case_id}")
    assert response.status_code == 400


def test_freeze_check_404_for_unknown_case():
    response = client.get("/api/v1/freeze/does-not-exist")
    assert response.status_code == 404


def test_freeze_check_blacklisted_wallet_reports_true_and_zero_urgent_window():
    case_id = _make_case()
    check = TetherWalletCheck(is_blacklisted=True, is_blacklisted_error=None,
                               unfrozen_balance=Decimal("0"), balance_error=None)

    with patch("app.api.v1.freeze.get_chain_client", return_value=FakeChainClient(T0)), \
         patch("app.freeze.tether.check_tether_wallet", return_value=check):
        response = client.get(f"/api/v1/freeze/{case_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["isBlacklisted"] is True
    assert body["unfrozenBalance"] == 0.0
    assert body["goldenHourMinutesRemaining"] == 0.0
    assert body["dataUnavailable"] is False
    assert "DRAFT" in body["freezeRequestDraft"]
    assert body["walletAddress"] == TERMINAL


def test_freeze_check_recent_move_is_more_urgent_than_old_move():
    case_id_recent = _make_case()
    recent_moved_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    check = TetherWalletCheck(is_blacklisted=False, is_blacklisted_error=None,
                               unfrozen_balance=Decimal("150"), balance_error=None)

    with patch("app.api.v1.freeze.get_chain_client", return_value=FakeChainClient(recent_moved_at)), \
         patch("app.freeze.tether.check_tether_wallet", return_value=check):
        recent_response = client.get(f"/api/v1/freeze/{case_id_recent}")

    case_id_old = _make_case()
    old_moved_at = datetime.now(timezone.utc) - timedelta(days=30)

    with patch("app.api.v1.freeze.get_chain_client", return_value=FakeChainClient(old_moved_at)), \
         patch("app.freeze.tether.check_tether_wallet", return_value=check):
        old_response = client.get(f"/api/v1/freeze/{case_id_old}")

    assert recent_response.status_code == 200 and old_response.status_code == 200
    recent_remaining = recent_response.json()["goldenHourMinutesRemaining"]
    old_remaining = old_response.json()["goldenHourMinutesRemaining"]
    assert recent_remaining > old_remaining
    assert old_remaining == 0.0


def test_freeze_check_honest_failure_never_reports_false_when_check_could_not_run():
    case_id = _make_case()
    check = TetherWalletCheck(is_blacklisted=None, is_blacklisted_error="trongrid timed out",
                               unfrozen_balance=None, balance_error="trongrid timed out")

    with patch("app.api.v1.freeze.get_chain_client", return_value=FakeChainClient(T0)), \
         patch("app.freeze.tether.check_tether_wallet", return_value=check):
        response = client.get(f"/api/v1/freeze/{case_id}")

    assert response.status_code == 200
    body = response.json()
    # The critical honest-failure assertion: a failed check must be None, never a
    # confident-looking False.
    assert body["isBlacklisted"] is None
    assert body["unfrozenBalance"] is None
    assert body["dataUnavailable"] is True
    assert "trongrid timed out" in body["dataUnavailableReason"]
