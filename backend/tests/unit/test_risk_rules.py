from app.risk.features import TraceFeatures
from app.risk.rules import compute_rule_based_score


def test_full_sweep_gate_and_payers_scores_high_with_low_innocence():
    features = TraceFeatures(
        hop_count=3, distinct_payers=6, gate_passed=True, sweep_gap_seconds=30.0,
        value_preserved_pct=0.98, innocence_score=0.0, read_failure_count=0,
        total_read_attempts=3, label_vetted=True,
    )
    result = compute_rule_based_score(features)
    assert result.score >= 80.0
    assert result.breakdown["sweep_pattern"] > 0
    assert result.breakdown["deposit_gate_passed"] > 0
    assert result.breakdown["payer_consolidation"] > 0


def test_no_sweep_no_gate_scores_near_zero():
    features = TraceFeatures(
        hop_count=1, distinct_payers=0, gate_passed=False, sweep_gap_seconds=None,
        value_preserved_pct=None, innocence_score=0.0, read_failure_count=0,
        total_read_attempts=1, label_vetted=False,
    )
    result = compute_rule_based_score(features)
    assert result.score == 0.0


def test_high_innocence_score_reduces_the_risk_score():
    base = dict(
        hop_count=3, distinct_payers=6, gate_passed=True, sweep_gap_seconds=30.0,
        value_preserved_pct=0.98, read_failure_count=0, total_read_attempts=3, label_vetted=True,
    )
    low_innocence = compute_rule_based_score(TraceFeatures(innocence_score=0.0, **base))
    high_innocence = compute_rule_based_score(TraceFeatures(innocence_score=0.9, **base))
    assert high_innocence.score < low_innocence.score
    assert high_innocence.breakdown["innocence_reduction"] < 0


def test_score_is_always_clamped_to_0_100():
    features = TraceFeatures(
        hop_count=6, distinct_payers=100, gate_passed=True, sweep_gap_seconds=1.0,
        value_preserved_pct=1.0, innocence_score=1.0, read_failure_count=0,
        total_read_attempts=1, label_vetted=True,
    )
    result = compute_rule_based_score(features)
    assert 0.0 <= result.score <= 100.0


def test_reasoning_is_plain_english_not_jargon():
    features = TraceFeatures(
        hop_count=3, distinct_payers=6, gate_passed=True, sweep_gap_seconds=30.0,
        value_preserved_pct=0.98, innocence_score=0.2, read_failure_count=0,
        total_read_attempts=3, label_vetted=True,
    )
    result = compute_rule_based_score(features)
    lowered = result.reasoning.lower()
    for jargon in ["taint", "fifo", "hop_index"]:
        assert jargon not in lowered
