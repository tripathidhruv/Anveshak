from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.freeze.tether import TetherWalletCheck
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# StaticPool (not the sqlite in-memory default of SingletonThreadPool) is required here:
# FastAPI's TestClient runs sync path operations in a worker thread pool, so without a
# single shared connection each request could land on a different thread and see a
# separate, schema-less in-memory database ("no such table: cases").
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

def test_create_and_fetch_case():
    payload = {
        "ncrp": "NCRP-1", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
    }
    created = client.post("/api/v1/cases", json=payload)
    assert created.status_code == 201
    case_id = created.json()["id"]

    fetched = client.get(f"/api/v1/cases/{case_id}")
    assert fetched.status_code == 200
    assert fetched.json()["suspectWallet"] == payload["suspectWallet"]

def test_create_case_appends_a_case_create_audit_entry():
    # This is the real `action="case.create"` audit entry -- traces.py's own
    # `trace.run` entry is only a substitute for case-creation time, added by an
    # earlier task that couldn't touch this file (see docs/TASKS.md's follow-up
    # gaps). Goes through the real `/api/v1/audit` endpoint (not a raw DB
    # session against this module's own `TestSession`) because `app`'s
    # `dependency_overrides[get_db]` is a single global shared across every API
    # test module -- whichever module's override was imported last "wins" for
    # every client in the process, so a direct query against this module's own
    # engine can silently miss rows a different module's override actually wrote.
    before = client.get("/api/v1/audit").json()

    payload = {
        "ncrp": "NCRP-AUDIT", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
    }
    created = client.post("/api/v1/cases", json=payload)
    assert created.status_code == 201
    case_id = created.json()["id"]

    after = client.get("/api/v1/audit").json()
    new_entries = after[len(before):]
    case_create_entries = [e for e in new_entries if e["action"] == "case.create" and e["objectId"] == case_id]
    assert len(case_create_entries) == 1
    assert case_create_entries[0]["objectType"] == "case"

def test_get_unknown_case_returns_404():
    response = client.get("/api/v1/cases/does-not-exist")
    assert response.status_code == 404

def test_create_case_accepts_chain_case_insensitively():
    for raw_chain in ("TRON", "tron", "Tron"):
        payload = {
            "ncrp": "NCRP-CI", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
            "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
            "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": raw_chain,
            "suspectWallet": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
        }
        created = client.post("/api/v1/cases", json=payload)
        assert created.status_code == 201, created.text
        assert created.json()["chain"] == "tron"

        fetched = client.get(f"/api/v1/cases/{created.json()['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["chain"] == "tron"

def test_ethereum_suspect_wallet_is_lowercased_at_creation():
    # Etherscan's own transfer records are always lowercase; a checksummed
    # (mixed-case) address stored verbatim would never match them downstream.
    payload = {
        "ncrp": "NCRP-ETH-CASE", "complainant": "Test User", "location": "Delhi",
        "phone": "9999999999", "incidentAt": "2026-01-01T00:00:00Z",
        "fraudType": "investment_scam", "amountINR": 150000, "amountCrypto": 150.0,
        "asset": "USDT-ERC20", "chain": "ethereum",
        "suspectWallet": "0xScamMerAAAABBBBccccDDDDeeeeFFFF00001111",
    }
    created = client.post("/api/v1/cases", json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["suspectWallet"] == payload["suspectWallet"].lower()

    fetched = client.get(f"/api/v1/cases/{created.json()['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["suspectWallet"] == payload["suspectWallet"].lower()

def test_tron_suspect_wallet_is_not_lowercased():
    # TRON addresses are base58 and genuinely case-sensitive — lowercasing would
    # corrupt them. This guards against the ethereum-only normalization above ever
    # being accidentally generalized to all chains.
    mixed_case_wallet = "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB"
    payload = {
        "ncrp": "NCRP-TRON-CASE", "complainant": "Test User", "location": "Delhi",
        "phone": "9999999999", "incidentAt": "2026-01-01T00:00:00Z",
        "fraudType": "investment_scam", "amountINR": 150000, "amountCrypto": 150.0,
        "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": mixed_case_wallet,
    }
    created = client.post("/api/v1/cases", json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["suspectWallet"] == mixed_case_wallet

def _make_case_with_wallet(suspect_wallet: str, ncrp: str) -> str:
    payload = {
        "ncrp": ncrp, "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": suspect_wallet,
    }
    created = client.post("/api/v1/cases", json=payload)
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_list_cases_computes_and_ranks_recoverability():
    # This module's dependency_overrides[get_db] may not be the one actually live for this
    # test run (see test_campaigns_api.py's own comment on this — the last-imported test
    # module's override wins globally), so every assertion below only checks the RELATIVE
    # position/values of this test's own case ids, never the full response list, which may
    # also contain rows contributed by whichever other test file's cases share the live
    # engine right now.
    app.dependency_overrides[get_db] = override_get_db

    old_suspect = "TSuspectOldAAAAAAAAAAAAAAAAAAAAAAAA"
    recent_suspect = "TSuspectRecentBBBBBBBBBBBBBBBBBBBBBB"
    moving_suspect = "TMovingChainCCCCCCCCCCCCCCCCCCCCCCCC"
    unknown_suspect = "TUnknownDDDDDDDDDDDDDDDDDDDDDDDDDDDD"
    terminal = "TExchangeHotWalletFFFFFFFFFFFFFFFFFF"

    old_moved_at = datetime.now(timezone.utc) - timedelta(days=30)
    recent_moved_at = datetime.now(timezone.utc) - timedelta(minutes=5)

    old_case_id = _make_case_with_wallet(old_suspect, "NCRP-RECOVER-OLD")
    recent_case_id = _make_case_with_wallet(recent_suspect, "NCRP-RECOVER-RECENT")
    moving_case_id = _make_case_with_wallet(moving_suspect, "NCRP-RECOVER-MOVING")
    unknown_case_id = _make_case_with_wallet(unknown_suspect, "NCRP-RECOVER-UNKNOWN")

    class FakeChainClient:
        chain = "tron"

        def get_transfers(self, address, since=None):
            from app.chains.base import Transfer
            if address == old_suspect:
                return [Transfer(tx_hash="tx-old", chain="tron", from_address=address,
                                  to_address=terminal, amount=Decimal("150"), asset="USDT-TRC20",
                                  timestamp=old_moved_at, fee=Decimal("0"), raw={})]
            if address == recent_suspect:
                return [Transfer(tx_hash="tx-recent", chain="tron", from_address=address,
                                  to_address=terminal, amount=Decimal("150"), asset="USDT-TRC20",
                                  timestamp=recent_moved_at, fee=Decimal("0"), raw={})]
            if address == terminal:
                return []  # terminal never moves onward -> "no_outgoing_activity" -> at_rest
            if address == unknown_suspect:
                raise RuntimeError("simulated chain read failure")
            if address.startswith("TMovingChain"):
                # Always sends onward to a brand-new address -> never terminates -> hop cap
                # is hit -> "moving" (still actively hopping as far as we can tell).
                return [Transfer(tx_hash=f"tx-{address}", chain="tron", from_address=address,
                                  to_address=address + "n", amount=Decimal("150"),
                                  asset="USDT-TRC20", timestamp=old_moved_at, fee=Decimal("0"),
                                  raw={})]
            return []

    check = TetherWalletCheck(is_blacklisted=False, is_blacklisted_error=None,
                               unfrozen_balance=Decimal("150"), balance_error=None)

    with patch("app.api.v1.cases.get_chain_client", return_value=FakeChainClient()), \
         patch("app.freeze.tether.check_tether_wallet", return_value=check):
        response = client.get("/api/v1/cases")

    assert response.status_code == 200
    body = response.json()
    by_id = {row["id"]: row for row in body}

    assert by_id[old_case_id]["recoverabilityState"] == "at_rest"
    assert by_id[recent_case_id]["recoverabilityState"] == "at_rest"
    assert by_id[moving_case_id]["recoverabilityState"] == "moving"
    assert by_id[moving_case_id]["recoverabilityDeadlineMinutes"] is None
    assert by_id[unknown_case_id]["recoverabilityState"] == "unknown"
    assert by_id[unknown_case_id]["recoverabilityDeadlineMinutes"] is None

    old_deadline = by_id[old_case_id]["recoverabilityDeadlineMinutes"]
    recent_deadline = by_id[recent_case_id]["recoverabilityDeadlineMinutes"]
    assert old_deadline is not None and recent_deadline is not None
    # A wallet that moved money 30 days ago has far less of the practical freeze window left
    # than one that moved 5 minutes ago -- the older move must rank as MORE urgent (sorts
    # first), i.e. a smaller "minutes remaining" value.
    assert old_deadline < recent_deadline

    order = [row["id"] for row in body]

    def pos(case_id: str) -> int:
        return order.index(case_id)

    assert pos(old_case_id) < pos(recent_case_id) < pos(moving_case_id) < pos(unknown_case_id)


def test_cors_headers_present_for_dev_origin():
    response = client.options(
        "/api/v1/cases",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
