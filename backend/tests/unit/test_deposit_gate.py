# backend/tests/unit/test_deposit_gate.py
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.tracing.tracer import TraceHop
from app.labels.seed_labels import VaspLabelSeed
from app.detectors.deposit import evaluate_deposit_gate

def mk_hop(hop_index, wallet, funding_from=None, ts=None):
    ts = ts or datetime(2026, 1, 1, tzinfo=timezone.utc)
    funding = None
    if funding_from is not None:
        funding = Transfer(tx_hash="tx", chain="tron", from_address=funding_from, to_address=wallet,
                            amount=Decimal("100"), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})
    return TraceHop(hop_index, wallet, "tron", funding, [], Decimal("100"), None)

VETTED_LABEL = VaspLabelSeed(
    address="exchange_hot_wallet", chain="tron", entity_name="Real Vetted Exchange Co",
    source_url="https://example.test/labels", verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
    vetting_status="vetted",
)

def test_never_gates_hop_zero():
    hop0 = mk_hop(0, "victim_wallet", funding_from=None)
    result = evaluate_deposit_gate(hop0, distinct_payer_count=5, label=VETTED_LABEL)
    assert result.gate_passed is False
    assert "hop_0" in result.breakdown

def test_rejects_when_inbound_edge_is_not_the_immediate_predecessor():
    # Himanshu-Harsh's bug: "has any inbound edge" was treated as "received directly from the
    # wallet under trace." Here the funding transfer's source is NOT the path's immediate
    # predecessor (some other, unrelated address funded it) -- must not pass.
    hop = mk_hop(3, "exchange_hot_wallet", funding_from="some_unrelated_address")
    result = evaluate_deposit_gate(hop, distinct_payer_count=5, label=VETTED_LABEL,
                                    expected_predecessor="scammer_wallet")
    assert result.gate_passed is False
    assert result.breakdown["immediate_predecessor_match"] is False

def test_passes_when_all_gates_clear():
    hop = mk_hop(3, "exchange_hot_wallet", funding_from="scammer_wallet")
    result = evaluate_deposit_gate(hop, distinct_payer_count=5, label=VETTED_LABEL,
                                    expected_predecessor="scammer_wallet")
    assert result.gate_passed is True
    assert result.entity_name == "Real Vetted Exchange Co"

def test_unresolved_never_defaults_to_a_real_exchange_name():
    hop = mk_hop(3, "unknown_wallet", funding_from="scammer_wallet")
    result = evaluate_deposit_gate(hop, distinct_payer_count=1, label=None,
                                    expected_predecessor="scammer_wallet")
    assert result.gate_passed is False
    assert result.entity_name == "UNKNOWN"

def test_unvetted_label_does_not_pass_the_gate():
    unvetted = VaspLabelSeed(address="exchange_hot_wallet", chain="tron", entity_name="Some Exchange",
                              source_url="https://example.test", verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
                              vetting_status="unvetted")
    hop = mk_hop(3, "exchange_hot_wallet", funding_from="scammer_wallet")
    result = evaluate_deposit_gate(hop, distinct_payer_count=5, label=unvetted,
                                    expected_predecessor="scammer_wallet")
    assert result.gate_passed is False
    assert result.entity_name == "UNKNOWN"

# Plain-English requirement: reasoning/limitations must read like something a
# non-technical officer can follow, with no leftover engineering jargon. This is
# the task's explicit deliverable, so it gets its own regression guard -- a future
# edit could otherwise reintroduce jargon while every gate_passed/entity_name/
# breakdown assertion above stays green.
JARGON_WORDS = ["vetted", "predecessor", "gate", "edge", "hop", "immediate", "distinct payers",
                "deposit address"]

def assert_no_jargon(text: str):
    lowered = text.lower()
    for word in JARGON_WORDS:
        assert word not in lowered, f"jargon word '{word}' found in: {text}"

def test_reasoning_and_limitations_are_plain_english_across_all_scenarios():
    scenarios = []

    hop0 = mk_hop(0, "victim_wallet", funding_from=None)
    scenarios.append(evaluate_deposit_gate(hop0, distinct_payer_count=5, label=VETTED_LABEL))

    wrong_predecessor_hop = mk_hop(3, "exchange_hot_wallet", funding_from="some_unrelated_address")
    scenarios.append(evaluate_deposit_gate(wrong_predecessor_hop, distinct_payer_count=5, label=VETTED_LABEL,
                                            expected_predecessor="scammer_wallet"))

    missing_predecessor_hop = mk_hop(3, "exchange_hot_wallet", funding_from=None)
    scenarios.append(evaluate_deposit_gate(missing_predecessor_hop, distinct_payer_count=5, label=VETTED_LABEL,
                                            expected_predecessor="scammer_wallet"))

    no_label_hop = mk_hop(3, "unknown_wallet", funding_from="scammer_wallet")
    scenarios.append(evaluate_deposit_gate(no_label_hop, distinct_payer_count=1, label=None,
                                            expected_predecessor="scammer_wallet"))

    unvetted = VaspLabelSeed(address="exchange_hot_wallet", chain="tron", entity_name="Some Exchange",
                              source_url="https://example.test", verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
                              vetting_status="unvetted")
    unvetted_label_hop = mk_hop(3, "exchange_hot_wallet", funding_from="scammer_wallet")
    scenarios.append(evaluate_deposit_gate(unvetted_label_hop, distinct_payer_count=5, label=unvetted,
                                            expected_predecessor="scammer_wallet"))

    success_hop = mk_hop(3, "exchange_hot_wallet", funding_from="scammer_wallet")
    scenarios.append(evaluate_deposit_gate(success_hop, distinct_payer_count=5, label=VETTED_LABEL,
                                            expected_predecessor="scammer_wallet"))

    assert len(scenarios) == 6
    for result in scenarios:
        assert result.reasoning, "reasoning must not be empty"
        assert result.limitations, "limitations must not be empty"
        assert_no_jargon(result.reasoning)
        assert_no_jargon(result.limitations)
