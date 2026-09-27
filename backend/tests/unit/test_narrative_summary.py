"""AI narrative summary (app.narrative.summary): never a real OpenAI call in tests -- the
OpenAI client is always mocked, matching this project's own "no live network calls in tests"
convention (chain clients are always faked in tests too, see e.g. tests/unit/test_evidence_pack.py).
Covers: unconfigured key, no persisted trace data yet, mocked success, mocked API failure."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models import AttributionCandidate, Case, Hop
from app.narrative.summary import NARRATIVE_DISCLOSURE, generate_case_narrative


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


def _make_traced_case(db, case_id="case-1"):
    case = Case(
        id=case_id, ncrp="NCRP-1", complainant="Test User", location="Delhi", phone="9999999999",
        incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc), fraud_type="investment_scam",
        amount_inr=150000, amount_crypto=150.0, asset="USDT-TRC20", chain="tron",
        suspect_wallet="TSuspectAAAAAAAAAAAAAAAAAAAAAAAAAA",
        innocence_score=0.1, innocence_factors=[{"factor": "single_payer", "value": 0.1}],
    )
    db.add(case)
    db.add(Hop(case_id=case_id, route_label="routeA", hop_index=0,
               wallet_address="TSuspectAAAAAAAAAAAAAAAAAAAAAAAAAA", chain="tron",
               tx_hash="tx1", amount=150.0, at=datetime(2026, 1, 1, tzinfo=timezone.utc),
               stop_reason=None, flag=None))
    db.add(AttributionCandidate(
        case_id=case_id, wallet_address="TTerminalBBBBBBBBBBBBBBBBBBBBBBBBB", chain="tron",
        gate_passed=True, gate_breakdown={"distinct_payers_ok": True},
        entity_name="DEMO DATA Exchange", reasoning="test", limitations="test",
    ))
    db.commit()
    return case_id


def _make_untraced_case(db, case_id="case-untraced"):
    case = Case(
        id=case_id, ncrp="NCRP-2", complainant="Test User", location="Delhi", phone="9999999999",
        incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc), fraud_type="investment_scam",
        amount_inr=150000, amount_crypto=150.0, asset="USDT-TRC20", chain="tron",
        suspect_wallet="TSuspectCCCCCCCCCCCCCCCCCCCCCCCCCC",
    )
    db.add(case)
    db.commit()
    return case_id


def test_unavailable_when_openai_api_key_not_configured(db_session):
    case_id = _make_traced_case(db_session)
    with patch("app.narrative.summary.settings.openai_api_key", None):
        narrative, available, reason = generate_case_narrative(db_session, case_id)

    assert narrative is None
    assert available is False
    assert reason == "OpenAI API key not configured"


def test_unavailable_when_case_has_no_persisted_hops(db_session):
    case_id = _make_untraced_case(db_session)
    with patch("app.narrative.summary.settings.openai_api_key", "sk-test-fake-key"):
        narrative, available, reason = generate_case_narrative(db_session, case_id)

    assert narrative is None
    assert available is False
    assert reason == "case has not been traced yet"


def test_mocked_success_returns_narrative_text(db_session):
    case_id = _make_traced_case(db_session)

    fake_response = MagicMock()
    fake_response.choices = [MagicMock(message=MagicMock(content="  A plain-English summary.  "))]
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value = fake_response

    with patch("app.narrative.summary.settings.openai_api_key", "sk-test-fake-key"), \
         patch("openai.OpenAI", return_value=fake_client) as mock_openai_cls:
        narrative, available, reason = generate_case_narrative(db_session, case_id)

    assert available is True
    assert reason is None
    assert narrative == "A plain-English summary."
    mock_openai_cls.assert_called_once_with(api_key="sk-test-fake-key")
    fake_client.chat.completions.create.assert_called_once()
    _, kwargs = fake_client.chat.completions.create.call_args
    assert kwargs["model"]
    assert "messages" in kwargs
    # never sends complainant PII to the third-party API
    prompt_text = kwargs["messages"][0]["content"]
    assert "Test User" not in prompt_text
    assert "9999999999" not in prompt_text


def test_mocked_api_failure_is_caught_and_returns_honest_reason(db_session):
    case_id = _make_traced_case(db_session)

    fake_client = MagicMock()
    fake_client.chat.completions.create.side_effect = RuntimeError("connection reset")

    with patch("app.narrative.summary.settings.openai_api_key", "sk-test-fake-key"), \
         patch("openai.OpenAI", return_value=fake_client):
        narrative, available, reason = generate_case_narrative(db_session, case_id)

    assert narrative is None
    assert available is False
    assert reason is not None
    assert "connection reset" not in reason  # no raw exception text/stack trace leaked
    assert "RuntimeError" in reason


def test_disclosure_text_is_the_exact_spec_string():
    assert NARRATIVE_DISCLOSURE == (
        "This summary was written by an AI language model narrating the structured findings "
        "above into plain English. It makes no independent findings of its own and must never "
        "be treated as verified fact beyond what the structured data it was built from already "
        "states."
    )
