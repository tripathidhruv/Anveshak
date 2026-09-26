from app.risk.features import TraceFeatures, FEATURE_NAMES
from app.risk.model import get_model, SYNTHETIC_DATA_DISCLOSURE, _generate_synthetic_training_data


def _well_evidenced_features(**overrides) -> TraceFeatures:
    defaults = dict(
        hop_count=3, distinct_payers=6, gate_passed=True, sweep_gap_seconds=30.0,
        value_preserved_pct=0.98, innocence_score=0.1, read_failure_count=0,
        total_read_attempts=4, label_vetted=True,
    )
    defaults.update(overrides)
    return TraceFeatures(**defaults)


def test_synthetic_training_data_generator_produces_labelled_rows():
    X, y = _generate_synthetic_training_data(n_rows=100, seed=1)
    assert X.shape == (100, len(FEATURE_NAMES))
    assert y.shape == (100,)
    assert set(y.tolist()) <= {0, 1}
    # Not degenerate: both classes actually occur.
    assert 0 in y.tolist() and 1 in y.tolist()


def test_model_scores_a_well_evidenced_case_with_real_shap_breakdown():
    model = get_model()
    result = model.score(_well_evidenced_features())

    assert 0.0 <= result.score <= 100.0
    assert set(result.shap_breakdown.keys()) == set(FEATURE_NAMES)
    # Real SHAP values, not stubbed zeros -- at least one feature must carry real weight.
    assert any(abs(v) > 1e-9 for v in result.shap_breakdown.values())
    assert result.disclosure == SYNTHETIC_DATA_DISCLOSURE


def test_sweep_like_gate_passed_case_scores_higher_than_a_clean_case():
    model = get_model()
    fraud_like = _well_evidenced_features()
    clean = _well_evidenced_features(
        gate_passed=False, sweep_gap_seconds=None, value_preserved_pct=None,
        distinct_payers=0, innocence_score=0.9,
    )
    assert model.score(fraud_like).score > model.score(clean).score


def test_disclosure_text_states_synthetic_training_plainly():
    lowered = SYNTHETIC_DATA_DISCLOSURE.lower()
    assert "synthetic" in lowered
    assert "not" in lowered and ("real fraud" in lowered or "real cases" in lowered or "real labelled" in lowered)
