"""SAHYOG national memory store + demo seed (app/memory/)."""
from datetime import datetime, timedelta, timezone

from app.memory.seed import seed_demo
from app.memory.store import lookup, record_submission, stats
from app.models import MemoryEvent, MemoryWallet

DEMO = "TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm"


def test_unknown_wallet(db_session):
    r = lookup(db_session, "TUnknownWallet000000000000000000")
    assert r.known is False
    assert r.linked_cases == [] and r.provenance == [] and r.syndicate is None
    assert r.submission_count == 0 and r.first_seen is None


def test_seeded_demo_wallet(db_session):
    seed_demo(db_session)
    r = lookup(db_session, DEMO)
    assert r.known is True and r.chain == "tron"
    assert [c.case_id for c in r.linked_cases] == ["KZN-2026-0416", "KZN-2026-0412", "KZN-2026-0406"]
    assert [c.relation for c in r.linked_cases] == ["same_wallet", "same_wallet", "one_hop"]
    assert r.linked_cases[0].city == "Kochi" and r.linked_cases[0].state == "Kerala"
    assert r.linked_cases[0].amount_inr == 860000
    assert r.syndicate.id == "SYN-07" and r.syndicate.case_count == 38 and r.syndicate.hub == "TNh8yW5vC2mQ7fL4xK9pR"
    assert r.first_seen == datetime(2026, 8, 21, 16, 5, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    assert [p.unit for p in r.provenance] == ["Cyber PS Kochi", "Cyber PS Ludhiana", "Cyber PS Patna"]
    assert r.submission_count == 3


def test_seed_is_idempotent(db_session):
    seed_demo(db_session)
    before = (db_session.query(MemoryWallet).count(), db_session.query(MemoryEvent).count())
    seed_demo(db_session)
    assert (db_session.query(MemoryWallet).count(), db_session.query(MemoryEvent).count()) == before


def test_record_submission_appends_and_dedupes_cases(db_session):
    seed_demo(db_session)
    record_submission(db_session, address=DEMO, chain="tron", case_id="KZN-2026-0418", unit="Cyber PS Jaipur",
                      city="Jaipur", state="Rajasthan", amount_inr=1240000)
    record_submission(db_session, address=DEMO, chain="tron", case_id="KZN-2026-0418", unit="Cyber PS Jaipur",
                      city="Jaipur", state="Rajasthan", amount_inr=1240000)
    r = lookup(db_session, DEMO)
    assert r.linked_cases[0].case_id == "KZN-2026-0418"
    assert [c.case_id for c in r.linked_cases].count("KZN-2026-0418") == 1
    assert len(r.provenance) == 5  # append-only: both events kept


def test_record_creates_new_wallet(db_session):
    addr = "TNewSyntheticWallet0000000000000"
    record_submission(db_session, address=addr, chain="tron", case_id="KZN-2026-0500", unit="Cyber PS Pune",
                      city="Pune", state="Maharashtra", amount_inr=1000)
    r = lookup(db_session, addr)
    assert r.known and r.submission_count == 1 and r.syndicate is None


def test_ethereum_lookup_is_case_insensitive(db_session):
    addr = "0x" + "ab" * 20
    record_submission(db_session, address=addr.upper().replace("0X", "0x"), chain="ethereum", case_id="KZN-2026-0501",
                      unit="Cyber PS Pune", city="Pune", state="Maharashtra", amount_inr=1)
    assert lookup(db_session, addr).known is True


def test_stats(db_session):
    assert stats(db_session) == {"wallets": 0, "cases": 0, "events": 0, "states": 0, "syndicates": 0}
    seed_demo(db_session)
    s = stats(db_session)
    assert s["syndicates"] == 4 and s["wallets"] >= 6 and s["cases"] >= 3 and s["states"] >= 3
    assert s["events"] == db_session.query(MemoryEvent).count()
