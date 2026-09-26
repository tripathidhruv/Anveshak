# backend/tests/unit/test_innocence.py
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.detectors.innocence import compute_innocence

def mk(ts, from_addr, to_addr, amount):
    return Transfer(tx_hash="tx", chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

def test_high_innocence_for_long_history_p2p_merchant():
    # A wallet with 180+ days of history and 20+ distinct counterparties, with no other
    # signal present, is meant to be strong standalone evidence of innocence -- so
    # long_history_many_counterparties carries enough weight (0.55) to clear the ">0.5 =
    # high innocence" bar by itself. See task-8-report.md for the writeup.
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    long_history = [mk(incident - timedelta(days=400 - i), f"payer{i}", "merchant", 20) for i in range(50)]
    result = compute_innocence("merchant", long_history, incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20")
    assert result.innocence_score > 0.5
    assert any(
        f.check == "long_history_many_counterparties" and f.supports_innocence
        for f in result.factors
    )

def test_low_innocence_for_fresh_wallet_with_one_counterparty():
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    single = [mk(incident, "victim", "burner", 150)]
    result = compute_innocence("burner", single, incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20")
    assert result.innocence_score < 0.3

def test_counter_flow_back_to_payer_raises_innocence():
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transfers = [
        mk(incident, "victim", "wallet", 150),
        mk(incident + timedelta(minutes=5), "wallet", "victim", 150),  # trade, money came back
    ]
    result = compute_innocence("wallet", transfers, incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20")
    assert any(f.check == "counter_flow_to_payer" and f.supports_innocence for f in result.factors)

def test_negligible_fraction_of_throughput_supports_innocence():
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    big_flow = [mk(incident - timedelta(days=i), f"p{i}", "hub", 10000) for i in range(30)]
    small_victim_tx = [mk(incident, "victim", "hub", 150)]
    result = compute_innocence("hub", big_flow + small_victim_tx, incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20")
    assert any(f.check == "negligible_fraction_of_throughput" and f.supports_innocence for f in result.factors)

def test_negligible_fraction_of_throughput_sentence_includes_asset_unit():
    # F11: {victim_amount} used to print as a bare, unit-less Decimal ("The victim's 150 is
    # less than 5%..."), meaningless to a non-technical reader. The sentence must now name
    # the asset so the number has a unit.
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    big_flow = [mk(incident - timedelta(days=i), f"p{i}", "hub", 10000) for i in range(30)]
    small_victim_tx = [mk(incident, "victim", "hub", 150)]
    result = compute_innocence("hub", big_flow + small_victim_tx, incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20")
    factor = next(f for f in result.factors if f.check == "negligible_fraction_of_throughput")
    assert "USDT-TRC20" in factor.description

# Plain-English requirement: every InnocenceFactor.description must read like something a
# 12-year-old could follow, with no leftover engineering jargon (this is the task's explicit
# deliverable). This gets its own regression guard -- a future edit could otherwise
# reintroduce jargon while every score/check/supports_innocence assertion above stays green.
JARGON_WORDS = [
    "counterparties", "counterparty", "commingled", "throughput", "p2p", "gate", "hop",
    "vetted", "inflow", "distinct payers", "predecessor",
]

def assert_no_jargon(text: str):
    lowered = text.lower()
    for word in JARGON_WORDS:
        assert word not in lowered, f"jargon word '{word}' found in: {text}"

# ---------------------------------------------------------------------------
# Task G3 (I-B, instance 3): a chain-API read failure for the suspect wallet's history must
# not be indistinguishable from "we checked and this wallet genuinely has no prior history" --
# the former must skip the accusatory `no_pre_incident_history` factor (it was never actually
# checked) and report an honest `history_unavailable` factor instead.
# ---------------------------------------------------------------------------

def test_history_unavailable_skips_accusatory_factor_and_reports_honest_one():
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    # An empty transfer list is exactly what the caller passes when the chain-API read
    # failed (see traces.py) -- under the OLD behavior this would make
    # `no_pre_incident_history` fire as if "no activity before the incident" were a
    # confirmed, checked fact, when it was never actually checked.
    result = compute_innocence("burner", [], incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20", history_unavailable=True)
    checks = [f.check for f in result.factors]
    assert "no_pre_incident_history" not in checks
    assert "history_unavailable" in checks
    factor = next(f for f in result.factors if f.check == "history_unavailable")
    assert factor.supports_innocence is False
    assert_no_jargon(factor.description)

def test_history_unavailable_false_by_default_preserves_existing_behavior():
    # Every existing caller/test passes real (possibly genuinely empty) history without the
    # new keyword -- the default must keep producing the old, checked-fact factor.
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    result = compute_innocence("burner", [], incident_at=incident, victim_amount=Decimal("150"),
                                asset="USDT-TRC20")
    checks = [f.check for f in result.factors]
    assert "no_pre_incident_history" in checks
    assert "history_unavailable" not in checks

def test_descriptions_are_plain_english_across_all_scenarios():
    incident = datetime(2026, 1, 1, tzinfo=timezone.utc)
    scenarios = []

    # triggers long_history_many_counterparties (True) -- and, since all activity is >1 day
    # before the incident, no_pre_incident_history does NOT fire here.
    long_history = [mk(incident - timedelta(days=400 - i), f"payer{i}", "merchant", 20) for i in range(50)]
    scenarios.append(compute_innocence("merchant", long_history, incident_at=incident, victim_amount=Decimal("150"),
                                        asset="USDT-TRC20"))

    # triggers no_pre_incident_history (False) -- single fresh transfer, no prior activity.
    single = [mk(incident, "victim", "burner", 150)]
    scenarios.append(compute_innocence("burner", single, incident_at=incident, victim_amount=Decimal("150"),
                                        asset="USDT-TRC20"))

    # triggers counter_flow_to_payer (True).
    counter_flow = [
        mk(incident, "victim", "wallet", 150),
        mk(incident + timedelta(minutes=5), "wallet", "victim", 150),
    ]
    scenarios.append(compute_innocence("wallet", counter_flow, incident_at=incident, victim_amount=Decimal("150"),
                                        asset="USDT-TRC20"))

    # triggers negligible_fraction_of_throughput (True).
    big_flow = [mk(incident - timedelta(days=i), f"p{i}", "hub", 10000) for i in range(30)]
    small_victim_tx = [mk(incident, "victim", "hub", 150)]
    scenarios.append(compute_innocence("hub", big_flow + small_victim_tx, incident_at=incident,
                                        victim_amount=Decimal("150"), asset="USDT-TRC20"))

    all_factors = [f for result in scenarios for f in result.factors]
    assert len(all_factors) >= 4, "expected every scenario to produce at least one factor"
    for factor in all_factors:
        assert factor.description, "description must not be empty"
        assert_no_jargon(factor.description)
