from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
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
