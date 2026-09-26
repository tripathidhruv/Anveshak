"""Operator fingerprinting: behavioral-similarity ranking across cases, computed entirely
from already-persisted Hop/AttributionCandidate rows -- zero new chain-API reads, zero ML
training. Complementary to app.graph.campaigns' hub-wallet clustering (hard, deterministic
evidence): this module answers "do these cases share a HABIT", not "do these cases share a
wallet". Every result is a suggested lead, never proof -- same epistemic status this project
already gives app.bridge.linker.find_bridge_links()'s cross-chain correlations.

See docs/superpowers/specs/2026-09-26-operator-fingerprinting-design.md for the full design
rationale, including why this is unsupervised cosine similarity over real signals rather than
a trained model (no real labelled fraud dataset exists to train one honestly)."""
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import AttributionCandidate, Case, Hop

SIMILARITY_DISCLAIMER = (
    "This is a suggested behavioral link based on operational patterns, not proof of a shared "
    "operator -- an officer must independently verify any connection before acting on it."
)

# Real, adjustable constants -- not magic numbers kept only by convention. Normalization
# ranges reflect this project's own real data ranges (SWEEP_MAX_GAP_SECONDS=300 is the sweep
# detector's own "fast" bound; hop caps at 6 per tracer.py's max_hops default).
_CHAIN_ASSET_MATCH_BONUS = 0.1
NORMALIZATION_RANGES = {
    "hop_count": (1.0, 6.0),
    "sweep_gap_seconds": (0.0, 300.0),
    "sweep_value_preserved_pct": (0.0, 1.02),
    "distinct_payer_count": (0.0, 20.0),
    "hour_of_day": (0.0, 23.0),
}


@dataclass(frozen=True)
class OperatorFingerprint:
    case_id: str
    hop_count: int
    sweep_gap_seconds: float | None
    sweep_value_preserved_pct: float | None
    distinct_payer_count: int
    hour_of_day: int
    chain: str
    asset: str


@dataclass(frozen=True)
class SimilarityResult:
    other_case_id: str
    score: float
    feature_breakdown: dict[str, float]


def build_fingerprint(db: Session, case_id: str) -> OperatorFingerprint | None:
    """Returns None when this case has no gate_passed=True AttributionCandidate row --
    never a fabricated all-zero vector."""
    case = db.get(Case, case_id)
    if case is None:
        return None

    winning = db.execute(
        select(AttributionCandidate)
        .where(AttributionCandidate.case_id == case_id, AttributionCandidate.gate_passed.is_(True))
        .order_by(AttributionCandidate.id.asc())
    ).scalars().first()
    if winning is None:
        return None

    hops = db.execute(
        select(Hop).where(Hop.case_id == case_id)
    ).scalars().all()
    funding_hop = next((h for h in hops if h.wallet_address == winning.wallet_address), None)
    hour_of_day = funding_hop.at.hour if funding_hop is not None else 0

    breakdown = winning.gate_breakdown
    return OperatorFingerprint(
        case_id=case_id,
        hop_count=len(hops),
        sweep_gap_seconds=breakdown.get("sweep_gap_seconds"),
        sweep_value_preserved_pct=breakdown.get("sweep_value_preserved_pct"),
        distinct_payer_count=breakdown.get("distinct_payer_count", 0),
        hour_of_day=hour_of_day,
        chain=case.chain,
        asset=case.asset,
    )


def _normalize(value: float, feature_name: str) -> float:
    lo, hi = NORMALIZATION_RANGES[feature_name]
    if hi == lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def rank_similar_cases(target: OperatorFingerprint, candidates: list[OperatorFingerprint],
                        min_similarity: float = 0.7) -> list[SimilarityResult]:
    """Ranked descending by score, only entries clearing min_similarity."""
    results: list[SimilarityResult] = []
    target_vec = [
        _normalize(target.hop_count, "hop_count"),
        _normalize(target.sweep_gap_seconds or 0.0, "sweep_gap_seconds"),
        _normalize(target.sweep_value_preserved_pct or 0.0, "sweep_value_preserved_pct"),
        _normalize(target.distinct_payer_count, "distinct_payer_count"),
        _normalize(target.hour_of_day, "hour_of_day"),
    ]
    for other in candidates:
        if other.case_id == target.case_id:
            continue
        other_vec = [
            _normalize(other.hop_count, "hop_count"),
            _normalize(other.sweep_gap_seconds or 0.0, "sweep_gap_seconds"),
            _normalize(other.sweep_value_preserved_pct or 0.0, "sweep_value_preserved_pct"),
            _normalize(other.distinct_payer_count, "distinct_payer_count"),
            _normalize(other.hour_of_day, "hour_of_day"),
        ]
        cosine = _cosine_similarity(target_vec, other_vec)
        chain_asset_match = 1.0 if (other.chain == target.chain and other.asset == target.asset) else 0.0
        # Rescale by the maximum attainable raw value (cosine=1.0 plus a full bonus) rather than
        # a bare min(1.0, ...) cap. Two candidates can both reach cosine==1.0 (identical feature
        # vectors) while only one carries the chain/asset bonus -- a plain additive cap collapses
        # both to the same 1.0 ceiling and erases the bonus's effect entirely. Dividing through
        # keeps the bonus meaningful (a matched-chain case still scores strictly higher) while
        # still guaranteeing every score lands at or under 1.0.
        score = min(1.0, (cosine + chain_asset_match * _CHAIN_ASSET_MATCH_BONUS)
                    / (1.0 + _CHAIN_ASSET_MATCH_BONUS))
        if score < min_similarity:
            continue
        results.append(SimilarityResult(
            other_case_id=other.case_id, score=round(score, 4),
            feature_breakdown={
                "hop_count": other.hop_count,
                "sweep_gap_seconds": other.sweep_gap_seconds,
                "sweep_value_preserved_pct": other.sweep_value_preserved_pct,
                "distinct_payer_count": other.distinct_payer_count,
                "hour_of_day": other.hour_of_day,
                "chain_asset_match": chain_asset_match,
            },
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return results
