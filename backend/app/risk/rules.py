"""The rule-based risk score (Task H8) -- always computed, always available, and the sole
score reported when `data_quality.assess_data_quality` disables the ML score. Deliberately
reuses the SAME thresholds the existing detectors already use (imported, not re-guessed) so
this doesn't quietly drift out of sync with `app/detectors/sweep.py` / `deposit.py`.

This is the rule-based signal Task H8's brief refers to when it says the ML model should learn
"to approximate a combination of already-understood signals" -- this module IS that already-
understood combination, made explicit and numeric.
"""
from dataclasses import dataclass, field
from app.risk.features import TraceFeatures
from app.detectors.sweep import (
    SWEEP_MAX_GAP_SECONDS, SWEEP_MIN_VALUE_PRESERVED, SWEEP_MAX_VALUE_PRESERVED,
)
from app.detectors.deposit import MIN_DISTINCT_PAYERS

# Point weights, chosen so the three accusatory signals (sweep, deposit gate, payer count) sum
# to 100 at their strongest, with the innocence score acting as a pure penalty/reduction on top
# -- never something that can push the score negative or above 100 (clamped below).
SWEEP_WEIGHT_FULL = 35.0
SWEEP_WEIGHT_PARTIAL = 15.0  # value preserved in range, but not swept quickly enough
GATE_WEIGHT = 30.0
PAYER_WEIGHT_MAX = 15.0
INNOCENCE_PENALTY_MAX = 20.0
# A distinct-payer count of 2x the deposit gate's own minimum is treated as "maximally
# consolidating" for this component -- consistent with MIN_DISTINCT_PAYERS being the bar for
# "real collection point at all", not the bar for "as consolidating as it gets".
PAYER_COUNT_FOR_MAX_WEIGHT = MIN_DISTINCT_PAYERS * 2


@dataclass(frozen=True)
class RuleScoreResult:
    score: float                    # 0..100
    breakdown: dict[str, float] = field(default_factory=dict)
    reasoning: str = ""


def _sweep_component(features: TraceFeatures) -> tuple[float, str]:
    if features.sweep_gap_seconds is None or features.value_preserved_pct is None:
        return 0.0, "No sweep pattern could be measured for this trace."

    within_value_range = (
        SWEEP_MIN_VALUE_PRESERVED <= features.value_preserved_pct <= SWEEP_MAX_VALUE_PRESERVED
    )
    if within_value_range and features.sweep_gap_seconds <= SWEEP_MAX_GAP_SECONDS:
        return SWEEP_WEIGHT_FULL, (
            "The money that arrived moved onward within minutes, keeping almost all of its "
            "value -- the automated sweep pattern ANVESHAK is built to catch."
        )
    if within_value_range:
        return SWEEP_WEIGHT_PARTIAL, (
            "Almost all of the money's value moved onward, but not quickly enough to count as "
            "an automated sweep on its own."
        )
    return 0.0, "The money that arrived did not move onward the way an automated sweep does."


def _payer_component(features: TraceFeatures) -> tuple[float, str]:
    if features.distinct_payers <= 0:
        return 0.0, ""
    fraction = min(features.distinct_payers / PAYER_COUNT_FOR_MAX_WEIGHT, 1.0)
    weight = round(PAYER_WEIGHT_MAX * fraction, 2)
    payer_word = "person" if features.distinct_payers == 1 else "people"
    return weight, f"{features.distinct_payers} different {payer_word} sent money into this wallet."


def compute_rule_based_score(features: TraceFeatures) -> RuleScoreResult:
    """Combines sweep behaviour, the deposit gate outcome, distinct-payer consolidation, and
    the innocence score (as a reduction) into a single 0-100 risk number, with a plain-English
    explanation of every contributing part -- same 'nothing is a black box' standard as the
    existing rule-based `breakdown` fields elsewhere in this project (CLAUDE.md rule 4)."""
    sweep_score, sweep_note = _sweep_component(features)
    gate_score = GATE_WEIGHT if features.gate_passed else 0.0
    payer_score, payer_note = _payer_component(features)
    innocence_penalty = round(INNOCENCE_PENALTY_MAX * features.innocence_score, 2)

    raw_total = sweep_score + gate_score + payer_score - innocence_penalty
    score = max(0.0, min(100.0, round(raw_total, 2)))

    breakdown = {
        "sweep_pattern": sweep_score,
        "deposit_gate_passed": gate_score,
        "payer_consolidation": payer_score,
        "innocence_reduction": -innocence_penalty,
    }

    notes = [sweep_note]
    if features.gate_passed:
        notes.append(
            "This wallet passed every check we use before treating it as a real collection "
            "point for the money."
        )
    else:
        notes.append(
            "This wallet has not passed every check we use before treating it as a real "
            "collection point for the money."
        )
    if payer_note:
        notes.append(payer_note)
    if features.innocence_score > 0:
        notes.append(
            f"Some evidence also points the other way (an innocence score of "
            f"{features.innocence_score:.2f} out of 1.00), which lowers this score."
        )

    reasoning = " ".join(n for n in notes if n)
    return RuleScoreResult(score=score, breakdown=breakdown, reasoning=reasoning)
