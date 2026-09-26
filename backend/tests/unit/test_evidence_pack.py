"""Task H5: the evidence pack's own top-level hash must reproduce identically across
calls that happen at different wall-clock times, as long as the underlying Case/Hop/
AttributionCandidate DB content is unchanged -- and must change when that content
genuinely changes."""
from datetime import datetime, timezone
from unittest.mock import patch
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.models import Case, Hop, AttributionCandidate
from app.evidence.pack import build_evidence_pack


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def _make_case(db, case_id="case-1"):
    case = Case(
        id=case_id, ncrp="NCRP-1", complainant="Test User", location="Delhi", phone="9999999999",
        incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc), fraud_type="investment_scam",
        amount_inr=150000, amount_crypto=150.0, asset="USDT-TRC20", chain="tron",
        suspect_wallet="TSuspectAAAAAAAAAAAAAAAAAAAAAAAAAA",
    )
    db.add(case)
    db.add(Hop(case_id=case_id, route_label="routeA", hop_index=0,
               wallet_address="TSuspectAAAAAAAAAAAAAAAAAAAAAAAAAA", chain="tron",
               tx_hash="tx1", amount=150.0, at=datetime(2026, 1, 1, tzinfo=timezone.utc),
               stop_reason=None, flag=None))
    db.add(AttributionCandidate(
        case_id=case_id, wallet_address="TTerminalBBBBBBBBBBBBBBBBBBBBBBBBB", chain="tron",
        gate_passed=True, gate_breakdown={"distinct_payers_ok": True}, entity_name="DEMO DATA Exchange",
        reasoning="test", limitations="test",
    ))
    db.commit()
    return case_id


class NoOpClient:
    chain = "tron"

    def get_transfers(self, address, since=None):
        return []


def test_pack_hash_is_identical_across_calls_at_different_wall_clock_times(db_session):
    case_id = _make_case(db_session)

    with patch("app.evidence.pack.get_chain_client", return_value=NoOpClient()), \
         patch("app.evidence.pack.datetime") as mock_dt:
        mock_dt.now.side_effect = [
            datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
            datetime(2026, 9, 26, 18, 0, 0, tzinfo=timezone.utc),
        ]
        pack_first = build_evidence_pack(db_session, case_id)
        pack_second = build_evidence_pack(db_session, case_id)

    assert pack_first.pack_hash == pack_second.pack_hash
    # The manifest's own fetched_at metadata is allowed (expected) to differ -- only the
    # hash itself must stay stable.
    assert pack_first.manifest_entries[0]["fetched_at"] != pack_second.manifest_entries[0]["fetched_at"]


def test_pack_hash_changes_when_underlying_content_changes(db_session):
    case_id = _make_case(db_session)
    with patch("app.evidence.pack.get_chain_client", return_value=NoOpClient()):
        pack_before = build_evidence_pack(db_session, case_id)

    hop = db_session.query(Hop).filter(Hop.case_id == case_id).first()
    hop.amount = 999.0
    db_session.commit()

    with patch("app.evidence.pack.get_chain_client", return_value=NoOpClient()):
        pack_after = build_evidence_pack(db_session, case_id)

    assert pack_before.pack_hash != pack_after.pack_hash


def test_build_evidence_pack_returns_none_for_missing_case(db_session):
    with patch("app.evidence.pack.get_chain_client", return_value=NoOpClient()):
        assert build_evidence_pack(db_session, "does-not-exist") is None
