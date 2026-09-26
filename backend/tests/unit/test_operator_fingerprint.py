from datetime import datetime, timezone

from app.graph.operator_fingerprint import (
    OperatorFingerprint, SimilarityResult, build_fingerprint, rank_similar_cases,
)
from app.models import AttributionCandidate, Case, Hop


def fp(case_id, hop_count=3, gap=30.0, preserved=0.99, payers=4, hour=14,
       chain="tron", asset="USDT-TRC20"):
    return OperatorFingerprint(
        case_id=case_id, hop_count=hop_count, sweep_gap_seconds=gap,
        sweep_value_preserved_pct=preserved, distinct_payer_count=payers,
        hour_of_day=hour, chain=chain, asset=asset,
    )


def test_identical_fingerprints_score_at_or_above_min_similarity():
    target = fp("case-a")
    same = fp("case-b")
    results = rank_similar_cases(target, [same], min_similarity=0.7)
    assert len(results) == 1
    assert results[0].other_case_id == "case-b"
    assert results[0].score >= 0.7


def test_wildly_different_fingerprint_is_excluded():
    target = fp("case-a", hop_count=2, gap=20.0, preserved=0.99, payers=5, hour=3,
                 chain="tron", asset="USDT-TRC20")
    different = fp("case-b", hop_count=6, gap=250000.0, preserved=0.1, payers=1, hour=16,
                    chain="ethereum", asset="USDT-ERC20")
    results = rank_similar_cases(target, [different], min_similarity=0.7)
    assert results == []


def test_results_ranked_descending_by_score():
    target = fp("case-a")
    close = fp("case-b", gap=32.0)       # very close
    farther_but_still_matching = fp("case-c", gap=90.0, payers=3)  # further, still above bar
    results = rank_similar_cases(target, [farther_but_still_matching, close], min_similarity=0.5)
    assert [r.other_case_id for r in results] == ["case-b", "case-c"]


def test_chain_asset_match_bonus_applied_and_capped_at_one():
    same_chain = fp("case-b", chain="tron", asset="USDT-TRC20")
    diff_chain = fp("case-c", chain="ethereum", asset="USDT-ERC20")
    target = fp("case-a", chain="tron", asset="USDT-TRC20")
    results = rank_similar_cases(target, [same_chain, diff_chain], min_similarity=0.0)
    same_result = next(r for r in results if r.other_case_id == "case-b")
    diff_result = next(r for r in results if r.other_case_id == "case-c")
    assert same_result.score > diff_result.score
    assert same_result.score <= 1.0
    assert diff_result.score <= 1.0


def test_feature_breakdown_present_on_every_result():
    target = fp("case-a")
    other = fp("case-b")
    results = rank_similar_cases(target, [other], min_similarity=0.0)
    assert set(results[0].feature_breakdown.keys()) >= {
        "hop_count", "sweep_gap_seconds", "sweep_value_preserved_pct",
        "distinct_payer_count", "hour_of_day", "chain_asset_match",
    }


def test_self_comparison_is_never_included():
    target = fp("case-a")
    results = rank_similar_cases(target, [target], min_similarity=0.0)
    assert results == []


def _make_case(db, case_id: str, chain: str = "tron", asset: str = "USDT-TRC20") -> Case:
    case = Case(
        id=case_id, ncrp=f"NCRP-{case_id}", complainant="Victim", location="Delhi",
        phone="9999999999", incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        reported_at=datetime(2026, 1, 2, tzinfo=timezone.utc), fraud_type="investment_scam",
        amount_inr=100000.0, amount_crypto=100.0, asset=asset, chain=chain,
        suspect_wallet=f"TSuspect{case_id}",
    )
    db.add(case)
    return case


def _make_hop(db, case_id: str, hop_index: int, wallet_address: str, chain: str = "tron",
              at: datetime = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)) -> Hop:
    hop = Hop(
        case_id=case_id, route_label="routeA", hop_index=hop_index,
        wallet_address=wallet_address, chain=chain, tx_hash=f"tx{case_id}-{hop_index}",
        amount=100.0, at=at, stop_reason=None, flag=None,
    )
    db.add(hop)
    return hop


def _make_candidate(db, case_id: str, wallet_address: str, gate_passed: bool,
                     gate_breakdown: dict, chain: str = "tron") -> AttributionCandidate:
    candidate = AttributionCandidate(
        case_id=case_id, wallet_address=wallet_address, chain=chain, gate_passed=gate_passed,
        gate_breakdown=gate_breakdown,
        entity_name="Meridian Digital Exchange" if gate_passed else None,
        reasoning="test", limitations="test",
    )
    db.add(candidate)
    return candidate


def test_build_fingerprint_returns_none_when_no_gate_passed_candidate(db_session):
    _make_case(db_session, "case-x")
    _make_hop(db_session, "case-x", 0, "TWalletA0000000000000000000000")
    _make_candidate(db_session, "case-x", "TWalletA0000000000000000000000", gate_passed=False,
                     gate_breakdown={})
    db_session.commit()

    assert build_fingerprint(db_session, "case-x") is None


def test_build_fingerprint_extracts_real_persisted_values(db_session):
    _make_case(db_session, "case-x", chain="tron", asset="USDT-TRC20")
    funding_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    _make_hop(db_session, "case-x", 0, "TWalletA0000000000000000000000", at=funding_at)
    _make_hop(db_session, "case-x", 1, "TWalletB0000000000000000000000")
    _make_hop(db_session, "case-x", 2, "TWalletC0000000000000000000000")
    _make_candidate(
        db_session, "case-x", "TWalletA0000000000000000000000", gate_passed=True,
        gate_breakdown={
            "sweep_confirmed": True, "sweep_gap_seconds": 45.0,
            "sweep_value_preserved_pct": 0.97, "distinct_payer_count": 5,
        },
    )
    db_session.commit()

    result = build_fingerprint(db_session, "case-x")

    assert result.hop_count == 3
    assert result.sweep_gap_seconds == 45.0
    assert result.sweep_value_preserved_pct == 0.97
    assert result.distinct_payer_count == 5
    assert result.chain == "tron"
    assert result.asset == "USDT-TRC20"
    assert result.hour_of_day == 9


def test_build_fingerprint_returns_none_when_case_missing(db_session):
    assert build_fingerprint(db_session, "does-not-exist") is None
