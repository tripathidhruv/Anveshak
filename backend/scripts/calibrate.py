"""Task H12: a calibration harness for the DETERMINISTIC gated-attribution pipeline.

*** THIS SCRIPT MEASURES PRECISION/RECALL AGAINST PROCEDURALLY GENERATED SYNTHETIC DATA. ***

This is NOT the LightGBM/SHAP ML model (`app/risk/model.py`, Task H8) -- that model already
discloses its own synthetic-trained nature via `SYNTHETIC_DATA_DISCLOSURE` on every response.
This script instead calibrates the DETERMINISTIC rule-based gate the whole project is built
on: ANVESHAK's actual attribution decision is

    final_gate_passed = gate.gate_passed and sweep_signal.is_sweep

exactly as computed in `app/api/v1/traces.py`'s `run_trace()` candidates loop (see that file,
~lines 254-272), from `app/detectors/deposit.py`'s `evaluate_deposit_gate()` combined with
`app/detectors/sweep.py`'s `detect_sweep()`.

Both of those functions operate on plain data -- a `TraceHop`, an int distinct-payer count, a
`VaspLabelSeed | None`, an `expected_predecessor: str | None`, and lists of `Transfer` objects
-- with no `ChainClient`/DB/API dependency. So this script builds synthetic `TraceHop` /
`Transfer` / `VaspLabelSeed` objects directly, with a KNOWN ground-truth label per case, and
calls the real gate/sweep functions on them -- no fake chain client or HTTP mocking needed.

Why this exists (see docs/TASKS.md P3 / the H12 brief): rival SIH teams have been called out
in this project's own competitive-review docs for reporting a hand-picked confidence constant
instead of a real, reproducible number. This script lets ANVESHAK say instead: "run this script,
get a real precision figure computed against a held-out set with known ground truth."

Invocation (from `backend/`, matching this project's existing test/module-invocation
convention -- see `app/risk/model.py`, which is likewise a plain importable module with no
CLI wrapper):

    backend/.venv/Scripts/python.exe scripts/calibrate.py

or, from the repository root:

    backend/.venv/Scripts/python.exe backend/scripts/calibrate.py
"""
from __future__ import annotations

import random
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# Allow running this script directly (`python scripts/calibrate.py` or
# `python backend/scripts/calibrate.py`) without requiring `backend/` to already be on
# sys.path the way pytest's `pythonpath = .` (see backend/pytest.ini) provides for tests.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.chains.base import Transfer  # noqa: E402
from app.detectors.deposit import MIN_DISTINCT_PAYERS, evaluate_deposit_gate  # noqa: E402
from app.detectors.sweep import (  # noqa: E402
    SWEEP_MAX_GAP_SECONDS,
    SWEEP_MAX_VALUE_PRESERVED,
    SWEEP_MIN_VALUE_PRESERVED,
    detect_sweep,
)
from app.labels.seed_labels import VaspLabelSeed  # noqa: E402
from app.tracing.tracer import TraceHop  # noqa: E402

# Fixed for reproducibility -- same convention as app/risk/model.py's `_TRAINING_SEED`, but a
# different value since this is a distinct synthetic set calibrating a different thing (the
# deterministic gate, not the ML model).
CALIBRATION_SEED = 20260926_12
DEFAULT_N_CASES = 300  # enough cases (50 per scenario across 6 scenarios below) to make the
                        # confusion-matrix counts meaningful rather than noise from a handful
                        # of examples, while staying fast enough to run on every invocation
                        # (no chain/DB I/O at all -- pure in-memory dataclass construction).

SYNTHETIC_CALIBRATION_DISCLOSURE = (
    "SYNTHETIC DATA: this precision/recall figure is measured against procedurally generated "
    "synthetic held-out cases with known, constructed ground truth -- not against any real "
    "fraud case. It shows the deterministic gate+sweep logic behaves as designed on cases "
    "built to be clearly true/false positives/negatives; it is not a claim about real-world "
    "accuracy."
)

_SCENARIOS = (
    "true_positive",
    "hop_zero",
    "too_few_payers",
    "wrong_predecessor",
    "unvetted_label",
    "gate_passes_no_sweep",
)


def _mk_transfer(from_address: str, to_address: str, amount: Decimal, timestamp: datetime) -> Transfer:
    return Transfer(
        tx_hash=f"tx-{from_address}-{to_address}-{timestamp.isoformat()}",
        chain="tron", from_address=from_address, to_address=to_address,
        amount=amount, asset="USDT-TRC20", timestamp=timestamp, fee=Decimal("0"), raw={},
    )


def _vetted_label(address: str) -> VaspLabelSeed:
    return VaspLabelSeed(
        address=address, chain="tron", entity_name=f"Calibration Vetted Exchange {address}",
        source_url="https://example.test/calibration-labels",
        verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc), vetting_status="vetted",
    )


def _unvetted_label(address: str) -> VaspLabelSeed:
    return VaspLabelSeed(
        address=address, chain="tron", entity_name=f"Calibration Unvetted Exchange {address}",
        source_url="https://example.test/calibration-labels",
        verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc), vetting_status="unvetted",
    )


@dataclass(frozen=True)
class SyntheticCase:
    """One synthetic candidate-hop scenario with a KNOWN ground-truth label, plus everything
    needed to run it through the real `evaluate_deposit_gate` / `detect_sweep` calls."""
    case_id: int
    scenario: str
    ground_truth_positive: bool
    hop: TraceHop
    distinct_payer_count: int
    label: VaspLabelSeed | None
    expected_predecessor: str | None
    outgoing_transfers: list[Transfer]


def _build_case(case_id: int, scenario: str, rng: random.Random) -> SyntheticCase:
    wallet = f"wallet_{case_id}"
    predecessor = f"scammer_{case_id}"
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=case_id)
    funding_amount = Decimal(str(rng.uniform(50, 500)))

    # A good sweep: leaves quickly, value preserved -- used by every scenario except the one
    # deliberately testing a slow/lossy outgoing transfer.
    good_gap = rng.uniform(1, SWEEP_MAX_GAP_SECONDS - 1)
    good_preserved_pct = rng.uniform(SWEEP_MIN_VALUE_PRESERVED, SWEEP_MAX_VALUE_PRESERVED)

    if scenario == "hop_zero":
        # hop_index == 0: the wallet we started the trace from can never be the exchange
        # wallet itself, regardless of anything else -- hop 0 has no funding_transfer by
        # construction (see tracer.py).
        hop_index = 0
        funding_transfer = None
        n_payers = rng.randint(MIN_DISTINCT_PAYERS, MIN_DISTINCT_PAYERS + 5)
        incoming = [
            _mk_transfer(f"payer_{case_id}_{i}", wallet, Decimal(str(rng.uniform(10, 100))),
                         t0 - timedelta(minutes=i + 1))
            for i in range(n_payers)
        ]
        label = _vetted_label(wallet)
        out_amount = funding_amount * Decimal(str(good_preserved_pct))
        outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                  t0 + timedelta(seconds=good_gap))]
        return SyntheticCase(case_id, scenario, False, TraceHop(
            hop_index, wallet, "tron", funding_transfer, [], funding_amount, None,
        ), len({t.from_address for t in incoming}), label, predecessor, outgoing)

    hop_index = rng.randint(1, 6)
    funding_transfer = _mk_transfer(predecessor, wallet, funding_amount, t0)

    if scenario == "true_positive":
        n_payers = rng.randint(MIN_DISTINCT_PAYERS, MIN_DISTINCT_PAYERS + 5)
        incoming = [funding_transfer] + [
            _mk_transfer(f"payer_{case_id}_{i}", wallet, Decimal(str(rng.uniform(10, 100))),
                         t0 - timedelta(minutes=i + 1))
            for i in range(n_payers - 1)
        ]
        label = _vetted_label(wallet)
        out_amount = funding_amount * Decimal(str(good_preserved_pct))
        outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                  t0 + timedelta(seconds=good_gap))]
        ground_truth = True

    elif scenario == "too_few_payers":
        n_payers = rng.randint(1, MIN_DISTINCT_PAYERS - 1) if MIN_DISTINCT_PAYERS > 1 else 1
        incoming = [funding_transfer] + [
            _mk_transfer(f"payer_{case_id}_{i}", wallet, Decimal(str(rng.uniform(10, 100))),
                         t0 - timedelta(minutes=i + 1))
            for i in range(max(n_payers - 1, 0))
        ]
        label = _vetted_label(wallet)
        out_amount = funding_amount * Decimal(str(good_preserved_pct))
        outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                  t0 + timedelta(seconds=good_gap))]
        ground_truth = False

    elif scenario == "wrong_predecessor":
        # Himanshu-Harsh's bug pattern: the funding transfer's source is NOT the trace's
        # expected immediate predecessor -- a different, unrelated address funded this wallet.
        n_payers = rng.randint(MIN_DISTINCT_PAYERS, MIN_DISTINCT_PAYERS + 5)
        wrong_funder = f"unrelated_address_{case_id}"
        funding_transfer = _mk_transfer(wrong_funder, wallet, funding_amount, t0)
        incoming = [funding_transfer] + [
            _mk_transfer(f"payer_{case_id}_{i}", wallet, Decimal(str(rng.uniform(10, 100))),
                         t0 - timedelta(minutes=i + 1))
            for i in range(n_payers - 1)
        ]
        label = _vetted_label(wallet)
        out_amount = funding_amount * Decimal(str(good_preserved_pct))
        outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                  t0 + timedelta(seconds=good_gap))]
        ground_truth = False

    elif scenario == "unvetted_label":
        n_payers = rng.randint(MIN_DISTINCT_PAYERS, MIN_DISTINCT_PAYERS + 5)
        incoming = [funding_transfer] + [
            _mk_transfer(f"payer_{case_id}_{i}", wallet, Decimal(str(rng.uniform(10, 100))),
                         t0 - timedelta(minutes=i + 1))
            for i in range(n_payers - 1)
        ]
        # Split between "no label on file" and "labelled but not vetted" -- both are real,
        # distinct failure modes of the same gate check.
        label = None if rng.random() < 0.5 else _unvetted_label(wallet)
        out_amount = funding_amount * Decimal(str(good_preserved_pct))
        outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                  t0 + timedelta(seconds=good_gap))]
        ground_truth = False

    elif scenario == "gate_passes_no_sweep":
        # Gate passes on every check (enough payers, correct predecessor, vetted label) but
        # the outgoing transfer is too slow OR too lossy to count as a sweep -- the specific
        # "enough distinct payers and vetted label but not a sweep" case traces.py's
        # `_evaluate_candidate_report` has a dedicated reasoning message for.
        n_payers = rng.randint(MIN_DISTINCT_PAYERS, MIN_DISTINCT_PAYERS + 5)
        incoming = [funding_transfer] + [
            _mk_transfer(f"payer_{case_id}_{i}", wallet, Decimal(str(rng.uniform(10, 100))),
                         t0 - timedelta(minutes=i + 1))
            for i in range(n_payers - 1)
        ]
        label = _vetted_label(wallet)
        if rng.random() < 0.5:
            # Too slow: gap well past the ceiling.
            bad_gap = SWEEP_MAX_GAP_SECONDS + rng.uniform(60, 10_000)
            out_amount = funding_amount * Decimal(str(good_preserved_pct))
            outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                      t0 + timedelta(seconds=bad_gap))]
        else:
            # Too lossy: value preserved well below the floor (partial spend, not a sweep).
            out_amount = funding_amount * Decimal(str(rng.uniform(0.1, SWEEP_MIN_VALUE_PRESERVED - 0.05)))
            outgoing = [_mk_transfer(wallet, f"downstream_{case_id}", out_amount,
                                      t0 + timedelta(seconds=good_gap))]
        ground_truth = False

    else:  # pragma: no cover -- defensive, _SCENARIOS is the only caller of this function
        raise ValueError(f"unknown scenario: {scenario}")

    distinct_payer_count = len({t.from_address for t in incoming})
    hop = TraceHop(hop_index, wallet, "tron", funding_transfer, [], funding_amount, None)
    return SyntheticCase(case_id, scenario, ground_truth, hop, distinct_payer_count, label,
                         predecessor, outgoing)


def generate_synthetic_cases(n_cases: int = DEFAULT_N_CASES,
                              seed: int = CALIBRATION_SEED) -> list[SyntheticCase]:
    """Builds `n_cases` synthetic candidate-hop scenarios, cycling evenly through every
    scenario in `_SCENARIOS` (one true-positive shape, five distinct true-negative failure
    modes) so no single scenario dominates the sample. Deterministic for a fixed `seed`."""
    rng = random.Random(seed)
    cases = []
    for i in range(n_cases):
        scenario = _SCENARIOS[i % len(_SCENARIOS)]
        cases.append(_build_case(i, scenario, rng))
    return cases


@dataclass(frozen=True)
class CaseResult:
    """The real gate+sweep outcome for one synthetic case, evaluated via the EXACT same call
    pattern and boolean combination `app/api/v1/traces.py`'s `run_trace()` uses."""
    case_id: int
    scenario: str
    ground_truth_positive: bool
    predicted_positive: bool
    outcome: str  # "TP" | "FP" | "TN" | "FN"
    reason: str


def _evaluate_case(case: SyntheticCase) -> CaseResult:
    gate = evaluate_deposit_gate(
        case.hop, distinct_payer_count=case.distinct_payer_count,
        label=case.label, expected_predecessor=case.expected_predecessor,
    )
    sweep_incoming = [case.hop.funding_transfer] if case.hop.funding_transfer is not None else []
    sweep_signal = detect_sweep(case.hop.wallet_address, sweep_incoming, case.outgoing_transfers)
    # Mirrors traces.py's run_trace() candidates loop exactly: final_gate_passed =
    # gate.gate_passed and sweep_signal.is_sweep.
    predicted_positive = gate.gate_passed and sweep_signal.is_sweep

    if predicted_positive and case.ground_truth_positive:
        outcome = "TP"
    elif predicted_positive and not case.ground_truth_positive:
        outcome = "FP"
    elif not predicted_positive and not case.ground_truth_positive:
        outcome = "TN"
    else:
        outcome = "FN"

    # Reuse the gate's/sweep signal's own already-written explanation fields rather than
    # writing new prose here.
    reason = gate.reasoning
    if gate.gate_passed and not sweep_signal.is_sweep:
        reason += (
            f" [sweep check: gap_seconds={sweep_signal.gap_seconds}, "
            f"value_preserved_pct={sweep_signal.value_preserved_pct}, is_sweep=False]"
        )

    return CaseResult(case.case_id, case.scenario, case.ground_truth_positive,
                       predicted_positive, outcome, reason)


@dataclass(frozen=True)
class CalibrationReport:
    """The full calibration result, returned as a real Python object (not just printed
    stdout) so callers -- including `tests/test_calibrate.py` -- can assert on the actual
    numbers."""
    total_cases: int
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    precision: float | None
    recall: float | None
    disclosure: str = SYNTHETIC_CALIBRATION_DISCLOSURE
    cases: list[CaseResult] = field(default_factory=list)


def run_calibration(n_cases: int = DEFAULT_N_CASES, seed: int = CALIBRATION_SEED) -> CalibrationReport:
    cases = generate_synthetic_cases(n_cases, seed)
    results = [_evaluate_case(c) for c in cases]

    tp = sum(1 for r in results if r.outcome == "TP")
    fp = sum(1 for r in results if r.outcome == "FP")
    tn = sum(1 for r in results if r.outcome == "TN")
    fn = sum(1 for r in results if r.outcome == "FN")

    precision = tp / (tp + fp) if (tp + fp) > 0 else None
    recall = tp / (tp + fn) if (tp + fn) > 0 else None

    return CalibrationReport(
        total_cases=len(results), true_positives=tp, false_positives=fp,
        true_negatives=tn, false_negatives=fn, precision=precision, recall=recall,
        cases=results,
    )


def print_report(report: CalibrationReport) -> None:
    print("=" * 78)
    print("ANVESHAK gated-attribution pipeline calibration (Task H12)")
    print(f"({SYNTHETIC_CALIBRATION_DISCLOSURE})")
    print("=" * 78)
    print(f"Total synthetic cases: {report.total_cases}")
    print(f"Confusion matrix -- TP={report.true_positives} FP={report.false_positives} "
          f"TN={report.true_negatives} FN={report.false_negatives}")
    precision_str = f"{report.precision:.4f}" if report.precision is not None else "undefined (no positive predictions)"
    recall_str = f"{report.recall:.4f}" if report.recall is not None else "undefined (no ground-truth positives)"
    print(f"Precision = {precision_str}  -- {SYNTHETIC_CALIBRATION_DISCLOSURE}")
    print(f"Recall    = {recall_str}  -- {SYNTHETIC_CALIBRATION_DISCLOSURE}")
    print("-" * 78)
    print("Per-case breakdown:")
    for r in report.cases:
        print(f"  [{r.outcome}] case={r.case_id:>3} scenario={r.scenario:<22} "
              f"ground_truth={r.ground_truth_positive!s:<5} predicted={r.predicted_positive!s:<5} "
              f"reason: {r.reason}")
    print("-" * 78)
    print(f"Precision = {precision_str} on N={report.total_cases} SYNTHETIC held-out cases "
          f"with known ground truth -- {SYNTHETIC_CALIBRATION_DISCLOSURE}")
    print("=" * 78)


def main() -> CalibrationReport:
    report = run_calibration()
    print_report(report)
    return report


if __name__ == "__main__":
    main()
