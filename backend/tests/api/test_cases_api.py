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
