# backend/tests/test_calibrate.py
"""Tests for the H12 calibration harness (backend/scripts/calibrate.py).

These exercise the harness's own core logic -- not the detectors themselves (those already
have their own dedicated tests in tests/unit/test_deposit_gate.py and tests/unit/test_sweep.py)
-- to make sure the calibration script's confusion-matrix bookkeeping, precision arithmetic,
and reproducibility are all correct.
"""
import sys
from pathlib import Path

# scripts/ is not itself a package under app/ -- add backend/scripts to sys.path the same way
# scripts/calibrate.py adds backend/ to sys.path for its own direct-invocation case.
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from calibrate import (  # noqa: E402
    CALIBRATION_SEED,
    SYNTHETIC_CALIBRATION_DISCLOSURE,
    run_calibration,
)


def test_confusion_matrix_counts_sum_to_total_cases():
    report = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    assert (report.true_positives + report.false_positives
            + report.true_negatives + report.false_negatives) == report.total_cases
    assert report.total_cases == 300


def test_precision_arithmetic_is_correct():
    report = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    # Verify the actual arithmetic, not just that it's in [0, 1] -- a script that always
    # predicts negative would give an undefined/trivially-perfect-looking precision with 0
    # false positives, which is exactly the degenerate case the brief warns against; recomputing
    # from the raw counts catches that.
    expected_precision = report.true_positives / (report.true_positives + report.false_positives)
    assert report.precision == expected_precision
    expected_recall = report.true_positives / (report.true_positives + report.false_negatives)
    assert report.recall == expected_recall
    # And there must be at least some positive predictions and some ground-truth positives,
    # or this whole precision/recall computation would be measuring nothing.
    assert report.true_positives + report.false_positives > 0
    assert report.true_positives + report.false_negatives > 0


def test_reproducible_with_fixed_seed():
    report_a = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    report_b = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    assert report_a.true_positives == report_b.true_positives
    assert report_a.false_positives == report_b.false_positives
    assert report_a.true_negatives == report_b.true_negatives
    assert report_a.false_negatives == report_b.false_negatives
    assert report_a.precision == report_b.precision
    assert report_a.recall == report_b.recall
    # Per-case outcomes too, not just the aggregate counts.
    assert [(r.case_id, r.scenario, r.outcome) for r in report_a.cases] == \
           [(r.case_id, r.scenario, r.outcome) for r in report_b.cases]


def test_precision_meaningfully_above_chance_floor():
    report = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    # Bar chosen deliberately above chance (0.5) and above "barely better than nothing" (0.7):
    # every synthetic case here is constructed to be a CLEAR true positive or a CLEAR true
    # negative for one specific, isolated failure mode (hop 0, too few payers, wrong
    # predecessor, unvetted label, or gate-passes-but-not-a-sweep). The deposit gate and sweep
    # detector each already have their own passing unit tests
    # (tests/unit/test_deposit_gate.py, tests/unit/test_sweep.py) proving their individual
    # logic is correct on cases like these. If those two correct, already-tested functions are
    # simply combined the way traces.py combines them, precision on this harness's
    # unambiguous cases should come out clearly above 0.7 -- a much lower number would mean
    # THIS calibration harness has a construction bug (e.g. a "true positive" case that
    # doesn't actually satisfy every gate check), not that the underlying gate is weak.
    assert report.precision is not None
    assert report.precision > 0.7


def test_synthetic_disclosure_present_and_non_empty():
    report = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    assert report.disclosure == SYNTHETIC_CALIBRATION_DISCLOSURE
    assert "SYNTHETIC" in report.disclosure.upper()


def test_scenarios_cover_every_named_failure_mode():
    report = run_calibration(n_cases=300, seed=CALIBRATION_SEED)
    scenarios_seen = {r.scenario for r in report.cases}
    assert scenarios_seen == {
        "true_positive", "hop_zero", "too_few_payers", "wrong_predecessor",
        "unvetted_label", "gate_passes_no_sweep",
    }
