from app.risk.features import TraceFeatures
from app.risk.data_quality import assess_data_quality, MIN_HOPS_FOR_ML, MAX_READ_FAILURE_RATIO_FOR_ML


def _well_evidenced_features(**overrides) -> TraceFeatures:
    defaults = dict(
        hop_count=3, distinct_payers=5, gate_passed=True, sweep_gap_seconds=30.0,
        value_preserved_pct=0.98, innocence_score=0.1, read_failure_count=0,
        total_read_attempts=4, label_vetted=True,
    )
    defaults.update(overrides)
    return TraceFeatures(**defaults)


def test_well_evidenced_trace_passes_the_gate():
    result = assess_data_quality(_well_evidenced_features())
    assert result.sufficient is True
    assert result.reasons == []


def test_gate_disables_ml_when_too_few_hops():
    features = _well_evidenced_features(hop_count=MIN_HOPS_FOR_ML - 1)
    result = assess_data_quality(features)
    assert result.sufficient is False
    assert any("did not follow the money" in r for r in result.reasons)


def test_gate_disables_ml_when_no_vetted_label_match():
    features = _well_evidenced_features(label_vetted=False)
    result = assess_data_quality(features)
    assert result.sufficient is False
    assert any("checked against a real, public source" in r for r in result.reasons)


def test_gate_disables_ml_when_read_failure_heavy():
    features = _well_evidenced_features(read_failure_count=3, total_read_attempts=4)
    assert features.read_failure_ratio > MAX_READ_FAILURE_RATIO_FOR_ML
    result = assess_data_quality(features)
    assert result.sufficient is False
    assert any("could not read" in r for r in result.reasons)


def test_gate_falls_back_correctly_on_a_thin_trace_combining_all_three_signals():
    # The exact "thin-data fixture" the brief calls out: very few hops, no vetted label match,
    # and a read-failure-heavy trace, all at once.
    features = TraceFeatures(
        hop_count=1, distinct_payers=0, gate_passed=False, sweep_gap_seconds=None,
        value_preserved_pct=None, innocence_score=0.0, read_failure_count=1,
        total_read_attempts=1, label_vetted=False,
    )
    result = assess_data_quality(features)
    assert result.sufficient is False
    assert len(result.reasons) == 3


def test_reasons_are_plain_english_not_jargon():
    features = _well_evidenced_features(hop_count=0, label_vetted=False)
    result = assess_data_quality(features)
    lowered = " ".join(result.reasons).lower()
    for jargon in ["taint", "fifo", "hop_index", "gate_passed"]:
        assert jargon not in lowered
