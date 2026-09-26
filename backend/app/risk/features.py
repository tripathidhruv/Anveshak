"""Shared feature shape for KAIZEN's risk scoring (Task H8).

`TraceFeatures` is the single, plain data contract both `rules.py` (the always-available
rule-based score) and `model.py` (the gated ML score) are built from. It intentionally reuses
the SAME signals the existing detectors (`app/detectors/sweep.py`, `deposit.py`,
`innocence.py`) already compute -- sweep latency/value-preservation, distinct payers, deposit
gate outcome, a vetted label match, and the innocence score -- rather than inventing new,
unrelated ones. This is what lets the ML model (Task H8 brief) "learn to approximate a
combination of already-understood signals" instead of fabricating a black-box authority from
nothing.
"""
from dataclasses import dataclass

# Ordered feature names used consistently across rules.py, model.py (training + inference) and
# any SHAP breakdown -- this exact order/name list IS the model's schema.
FEATURE_NAMES = [
    "hop_count",
    "distinct_payers",
    "gate_passed",
    "sweep_gap_seconds",
    "value_preserved_pct",
    "innocence_score",
]

# Sentinel used in place of a real sweep_gap_seconds when no candidate hop had a sweep signal
# to measure at all (as opposed to a real, large gap) -- keeps the feature numeric/finite for
# the model while still reading as "no sweep observed" rather than "an extremely fast sweep".
NO_SWEEP_GAP_SENTINEL = 999_999.0


@dataclass(frozen=True)
class TraceFeatures:
    """One trace's worth of already-computed, human-auditable signals, ready to feed either
    the rule-based scorer or the ML model. Every field here traces back to a real detector
    output or a real read of the chain data -- nothing here is itself synthetic; only the ML
    model's *training data* (see model.py) is synthetic."""

    hop_count: int
    distinct_payers: int
    gate_passed: bool
    sweep_gap_seconds: float | None       # None == no sweep signal could be computed at all
    value_preserved_pct: float | None     # None == no sweep signal could be computed at all
    innocence_score: float                # 0..1, from compute_innocence
    read_failure_count: int               # chain-API reads that failed while building this trace
    total_read_attempts: int              # total chain-API reads attempted while building this trace
    label_vetted: bool                    # any wallet along the path matched a *vetted* label

    @property
    def read_failure_ratio(self) -> float:
        if self.total_read_attempts <= 0:
            # No reads were even attempted -- can't compute a ratio, but this trace is
            # trivially thin anyway (hop_count / label_vetted gates will already catch it).
            return 0.0
        return self.read_failure_count / self.total_read_attempts

    def to_vector(self) -> list[float]:
        """Numeric feature vector in FEATURE_NAMES order, for the ML model."""
        return [
            float(self.hop_count),
            float(self.distinct_payers),
            1.0 if self.gate_passed else 0.0,
            float(self.sweep_gap_seconds) if self.sweep_gap_seconds is not None else NO_SWEEP_GAP_SENTINEL,
            float(self.value_preserved_pct) if self.value_preserved_pct is not None else 0.0,
            float(self.innocence_score),
        ]
