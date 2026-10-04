"""The ML risk score: a real LightGBM classifier with real SHAP explainability (Task H8).

*** THIS MODEL IS TRAINED ENTIRELY ON PROCEDURALLY GENERATED SYNTHETIC DATA. ***

ANVESHAK has no real labelled fraud dataset -- this is a stated, deliberate architectural fact
(CLAUDE.md's "label scarcity" thesis), not something this task works around by inventing
fake-real data. `_generate_synthetic_training_data` below builds several hundred synthetic
feature rows whose labels are correlated with the SAME rule-based signals
`app/detectors/sweep.py` / `deposit.py` already compute (sweep latency, value preservation,
distinct payers, the deposit gate outcome) plus injected label noise -- so the model is
learning to approximate a real (if synthetic) pattern built from understood signals, not
fabricating a black-box authority from nothing.

Every caller of `score()` gets back a `SYNTHETIC_DATA_DISCLOSURE` string alongside the score.
Task H8's brief treats omitting this disclosure from ANY API response that includes an ML
score as equally serious as a Critical correctness bug -- `app/api/v1/risk.py` includes it in
every response shape that carries `mlScore`.

*** Blending in real fraud-wallet data was considered and rejected, not overlooked (2026-09-26). ***
Before accepting this model as permanently synthetic-only, this codebase's every real,
independently-verified fraud-adjacent address was counted: exactly THREE exist anywhere in
this repo (`app/sanctions/data/sdn_seed.json`'s OFAC SDN entries -- two Bitcoin addresses
tied to SamSam ransomware operators, one Ethereum address for the Lazarus Group's Ronin
Bridge exploit). Three real examples against ~600 synthetic rows is not a credible sample to
learn from -- blending them in would change the model's actual behavior by essentially
nothing, while letting the disclosure text imply "real data was used" in a way a reader could
reasonably over-trust. That trade (near-zero real signal for a materially weaker, easier-to-
misread disclosure) was judged worse than staying honestly, unambiguously 100% synthetic. If
a real labelled dataset of a size that could actually move a model ever becomes available,
revisit this decision then -- not by adding a token handful of real rows for their own sake.
"""
from dataclasses import dataclass, field
import random

import lightgbm as lgb
import numpy as np
import shap

from app.risk.features import FEATURE_NAMES, NO_SWEEP_GAP_SENTINEL, TraceFeatures
from app.detectors.sweep import SWEEP_MAX_GAP_SECONDS
from app.detectors.deposit import MIN_DISTINCT_PAYERS

SYNTHETIC_DATA_DISCLOSURE = (
    "This machine-learning score was produced by a model trained entirely on procedurally "
    "generated synthetic data, not on any real fraud cases -- ANVESHAK has no real labelled "
    "fraud dataset to train on (see the project's own documented 'label scarcity' constraint). "
    "Treat this number as an experimental second opinion alongside the rule-based score, never "
    "as an independently verified fact."
)

_TRAINING_SEED = 20260926  # fixed for reproducibility -- same commit always trains the same model
_N_SYNTHETIC_ROWS = 600


def _generate_synthetic_training_data(
    n_rows: int = _N_SYNTHETIC_ROWS, seed: int = _TRAINING_SEED,
) -> tuple[np.ndarray, np.ndarray]:
    """Procedurally generates `n_rows` SYNTHETIC (feature vector, label) pairs.

    Each row is built by first deciding, at random, whether this synthetic wallet is a
    "sweep-like" one (fast, near-total-value forwarding -- the real behavioural fingerprint
    `detect_sweep` looks for) and separately whether it clears a payer/gate profile similar to
    `evaluate_deposit_gate`'s bar. The label is then a NOISY function of those same
    already-understood signals (not a fresh, unrelated invention), with ~10% label noise so the
    model has to genuinely learn a soft decision boundary rather than memorize a lookup table.
    """
    rng = random.Random(seed)
    rows: list[list[float]] = []
    labels: list[int] = []

    for _ in range(n_rows):
        hop_count = rng.randint(1, 6)
        is_sweep_like = rng.random() < 0.5
        if is_sweep_like:
            sweep_gap_seconds = rng.uniform(1, SWEEP_MAX_GAP_SECONDS)
            value_preserved_pct = rng.uniform(0.95, 1.02)
        else:
            # Either genuinely no sweep signal at all, or a slow/lossy one.
            if rng.random() < 0.4:
                sweep_gap_seconds = NO_SWEEP_GAP_SENTINEL
                value_preserved_pct = 0.0
            else:
                sweep_gap_seconds = rng.uniform(SWEEP_MAX_GAP_SECONDS * 2, SWEEP_MAX_GAP_SECONDS * 50)
                value_preserved_pct = rng.uniform(0.2, 0.9)

        distinct_payers = rng.randint(0, MIN_DISTINCT_PAYERS * 4)
        # Deposit-gate-passing correlates with having enough distinct payers, but is not a
        # deterministic function of it (a wallet can have plenty of payers and still fail the
        # gate on label/predecessor grounds, and vice versa in rare cases) -- injected noise
        # reflects that real-world imperfection.
        gate_base_prob = 0.85 if distinct_payers >= MIN_DISTINCT_PAYERS else 0.1
        gate_passed = rng.random() < gate_base_prob

        # Innocence score anti-correlates with the fraud-like signals above, again with noise.
        fraud_like_strength = (1.0 if is_sweep_like else 0.0) * 0.5 + (1.0 if gate_passed else 0.0) * 0.5
        innocence_score = max(0.0, min(1.0, rng.uniform(0.0, 1.0) * (1.0 - fraud_like_strength) + rng.uniform(-0.1, 0.1)))

        features = TraceFeatures(
            hop_count=hop_count, distinct_payers=distinct_payers, gate_passed=gate_passed,
            sweep_gap_seconds=sweep_gap_seconds, value_preserved_pct=value_preserved_pct,
            innocence_score=innocence_score, read_failure_count=0, total_read_attempts=1,
            label_vetted=True,
        )

        # The synthetic "ground truth": fraud-like when both the sweep pattern and the deposit
        # gate line up, tempered by innocence and a flat 10% label-flip noise -- mirrors real
        # label noise / ambiguity rather than a hand-coded, noiseless AND of the two signals.
        base_fraud_prob = 0.0
        if is_sweep_like and gate_passed:
            base_fraud_prob = 0.9
        elif is_sweep_like or gate_passed:
            base_fraud_prob = 0.45
        else:
            base_fraud_prob = 0.05
        base_fraud_prob *= (1.0 - 0.5 * innocence_score)
        label = 1 if rng.random() < base_fraud_prob else 0
        if rng.random() < 0.10:  # flat label noise
            label = 1 - label

        rows.append(features.to_vector())
        labels.append(label)

    return np.array(rows, dtype=float), np.array(labels, dtype=int)


@dataclass
class MLScoreResult:
    score: float  # 0..100
    shap_breakdown: dict[str, float] = field(default_factory=dict)
    disclosure: str = SYNTHETIC_DATA_DISCLOSURE


class RiskModel:
    """Lazily-trained singleton wrapping the LightGBM classifier + its SHAP explainer, so
    training (a few hundred synthetic rows -- milliseconds) happens once per process, not once
    per request."""

    def __init__(self) -> None:
        X, y = _generate_synthetic_training_data()
        self._booster = lgb.LGBMClassifier(
            n_estimators=80, max_depth=4, learning_rate=0.1,
            random_state=_TRAINING_SEED, verbosity=-1, min_child_samples=5,
        )
        self._booster.fit(X, y)
        self._explainer = shap.TreeExplainer(self._booster)

    def score(self, features: TraceFeatures) -> MLScoreResult:
        vector = np.array([features.to_vector()])
        # predict_proba's column 1 is P(fraud-like) for this binary classifier.
        proba = float(self._booster.predict_proba(vector)[0, 1])

        shap_values = self._explainer.shap_values(vector)
        # shap.TreeExplainer on a binary LGBMClassifier returns either a single (n, features)
        # array (contribution toward the positive class) or a list of two such arrays
        # ([class_0, class_1]) depending on shap/lightgbm version -- handle both so this
        # doesn't silently break on a dependency bump.
        row = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
        breakdown = {name: round(float(value), 4) for name, value in zip(FEATURE_NAMES, row)}

        return MLScoreResult(score=round(proba * 100.0, 2), shap_breakdown=breakdown)


_MODEL: RiskModel | None = None


def get_model() -> RiskModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = RiskModel()
    return _MODEL
