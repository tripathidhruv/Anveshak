from datetime import datetime, timezone

from app.graph.campaigns import build_campaigns
from app.models import AttributionCandidate, Case


def _make_case(db, case_id: str, location: str = "Delhi", amount_inr: float = 100000.0) -> Case:
    case = Case(
        id=case_id, ncrp=f"NCRP-{case_id}", complainant="Victim", location=location,
        phone="9999999999", incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        reported_at=datetime(2026, 1, 2, tzinfo=timezone.utc), fraud_type="investment_scam",
        amount_inr=amount_inr, amount_crypto=100.0, asset="USDT-TRC20", chain="tron",
        suspect_wallet=f"TSuspect{case_id}",
    )
    db.add(case)
    return case


def _make_candidate(db, case_id: str, wallet_address: str, chain: str = "tron",
                     gate_passed: bool = True) -> AttributionCandidate:
    candidate = AttributionCandidate(
        case_id=case_id, wallet_address=wallet_address, chain=chain, gate_passed=gate_passed,
        gate_breakdown={}, entity_name="Meridian Digital Exchange" if gate_passed else None,
        reasoning="test", limitations="test",
    )
    db.add(candidate)
    return candidate


def test_two_cases_converging_on_same_hub_cluster_together(db_session):
    _make_case(db_session, "case-1", location="Delhi", amount_inr=100000.0)
    _make_case(db_session, "case-2", location="Mumbai", amount_inr=200000.0)
    _make_candidate(db_session, "case-1", "THubWalletShared111111111111111")
    _make_candidate(db_session, "case-2", "THubWalletShared111111111111111")
    db_session.commit()

    campaigns = build_campaigns(db_session)

    assert len(campaigns) == 1
    campaign = campaigns[0]
    assert set(campaign.case_ids) == {"case-1", "case-2"}
    assert campaign.hub_address == "THubWalletShared111111111111111"
    assert campaign.chain == "tron"
    assert campaign.total_amount_inr == 300000.0
    assert campaign.states_touched == ["Delhi", "Mumbai"]


def test_two_cases_with_no_overlap_stay_separate(db_session):
    _make_case(db_session, "case-1")
    _make_case(db_session, "case-2")
    _make_candidate(db_session, "case-1", "THubWalletA00000000000000000000")
    _make_candidate(db_session, "case-2", "THubWalletB00000000000000000000")
    db_session.commit()

    campaigns = build_campaigns(db_session)

    assert len(campaigns) == 2
    all_case_ids = {cid for c in campaigns for cid in c.case_ids}
    assert all_case_ids == {"case-1", "case-2"}
    for campaign in campaigns:
        assert len(campaign.case_ids) == 1


def test_case_with_failed_gate_does_not_spuriously_cluster(db_session):
    _make_case(db_session, "case-1")
    _make_case(db_session, "case-2")
    # case-1 has a confirmed hub; case-2's only candidate never passed the deposit gate, so it
    # has no verified hub at all -- it must not be forced into case-1's campaign, nor invented
    # a lower-confidence campaign of its own.
    _make_candidate(db_session, "case-1", "THubWalletA00000000000000000000", gate_passed=True)
    _make_candidate(db_session, "case-2", "TUnverifiedFallbackWallet0000000", gate_passed=False)
    db_session.commit()

    campaigns = build_campaigns(db_session)

    assert len(campaigns) == 1
    assert campaigns[0].case_ids == ["case-1"]
    all_case_ids = {cid for c in campaigns for cid in c.case_ids}
    assert "case-2" not in all_case_ids


def test_no_verified_candidates_returns_no_campaigns(db_session):
    _make_case(db_session, "case-1")
    _make_candidate(db_session, "case-1", "TUnverifiedFallbackWallet0000000", gate_passed=False)
    db_session.commit()

    campaigns = build_campaigns(db_session)

    assert campaigns == []


def test_campaign_id_is_stable_across_recomputation(db_session):
    _make_case(db_session, "case-1")
    _make_case(db_session, "case-2")
    _make_candidate(db_session, "case-1", "THubWalletShared111111111111111")
    _make_candidate(db_session, "case-2", "THubWalletShared111111111111111")
    db_session.commit()

    first = build_campaigns(db_session)
    second = build_campaigns(db_session)

    assert first[0].id == second[0].id
