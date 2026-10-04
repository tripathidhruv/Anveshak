from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Case, Hop
from app.typology.model import DISCLAIMER
from tests.unit.test_typology_model import DEMO_SIGNALS

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

T0 = datetime(2026, 9, 2, 14, 12, tzinfo=timezone.utc)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def _use_this_db():
    # Same re-assert trick as test_intake_api.py: only the last module's import-time override
    # survives, so each test re-registers this module's database.
    app.dependency_overrides[get_db] = override_get_db


def _seed_case(case_id, with_hops=True):
    db = TestSession()
    db.add(Case(id=case_id, ncrp="N", complainant="Synthetic", location="Jaipur", phone="x",
                incident_at=T0, fraud_type="task_job", amount_inr=1.0, amount_crypto=1000.0,
                asset="USDT-TRC20", chain="tron", suspect_wallet=f"TSuspect{case_id}"))
    if with_hops:
        rows = [("W0", 1000, 0, None, None), ("W1", 995, 30, None, "HUB"),
                ("W2", 990, 600, "bridge_crossing_unconfirmed", "Meridian Digital Exchange")]
        for i, (w, amt, secs, stop, flag) in enumerate(rows):
            db.add(Hop(case_id=case_id, route_label="routeA", hop_index=i, wallet_address=w, chain="tron",
                       amount=amt, at=T0 + timedelta(seconds=secs), stop_reason=stop, flag=flag))
    db.commit()
    db.close()


def test_assess_demo_fixture():
    _use_this_db()
    r = client.post("/api/v1/typology/assess", json={"signals": DEMO_SIGNALS})
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"primary", "classes", "disclaimer", "signalsUsed"}
    assert body["primary"] == "scam"
    assert body["signalsUsed"] == 15
    assert body["disclaimer"] == DISCLAIMER
    assert [(c["id"], c["score"], c["band"]) for c in body["classes"]] == [
        ("scam", 0.965, "strong"), ("laundering", 0.65, "present"), ("ransomware", 0.12, "not_indicated"),
        ("darknet", 0.095, "not_indicated"), ("terror_financing", 0.095, "not_indicated"),
    ]
    ind = body["classes"][0]["indicators"][0]
    assert set(ind) == {"id", "plain", "tech", "weight", "value", "contribution"}
    assert ind["id"] == "sweep_signature" and ind["contribution"] == 0.3


def test_assess_missing_ids_default_zero():
    _use_this_db()
    r = client.post("/api/v1/typology/assess", json={"signals": {"ransomware_list_match": 1}})
    assert r.status_code == 200
    assert r.json()["primary"] == "ransomware" and r.json()["signalsUsed"] == 1


def test_assess_rejects_unknown_id_and_out_of_range():
    _use_this_db()
    assert client.post("/api/v1/typology/assess", json={"signals": {"nope": 0.5}}).status_code == 422
    assert client.post("/api/v1/typology/assess", json={"signals": {"bridge_hop": 1.5}}).status_code == 422
    assert client.post("/api/v1/typology/assess", json={"signals": {"bridge_hop": -0.1}}).status_code == 422


def test_case_typology_from_stored_hops():
    _use_this_db()
    _seed_case("TYP-1")
    r = client.get("/api/v1/typology/cases/TYP-1")
    assert r.status_code == 200
    body = r.json()
    used = {i["id"]: i["value"] for c in body["classes"] for i in c["indicators"]}
    assert used["sweep_signature"] == 1.0
    assert used["consolidation"] == 1.0
    assert used["fast_cashout"] == 1.0
    assert used["bridge_hop"] == 1.0
    assert used["fresh_wallet"] == 0.0  # no data source wired yet
    assert body["primary"] in {"scam", "laundering"}
    assert body["disclaimer"] == DISCLAIMER


def test_case_not_found():
    _use_this_db()
    r = client.get("/api/v1/typology/cases/NOPE")
    assert r.status_code == 404 and r.json()["detail"] == "case not found"


def test_case_without_hops_is_409():
    _use_this_db()
    _seed_case("TYP-EMPTY", with_hops=False)
    r = client.get("/api/v1/typology/cases/TYP-EMPTY")
    assert r.status_code == 409
    assert r.json()["detail"] == "Run the trace first — no hops stored for this case."
