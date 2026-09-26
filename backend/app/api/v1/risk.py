from datetime import timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import Case
from app.chains.registry import get_chain_client
from app.tracing.tracer import trace
from app.detectors.sweep import detect_sweep
from app.detectors.deposit import evaluate_deposit_gate
from app.detectors.innocence import compute_innocence
from app.labels.seed_labels import lookup_label
from app.risk.features import TraceFeatures
from app.risk.data_quality import assess_data_quality
from app.risk.rules import compute_rule_based_score
from app.risk.model import get_model, SYNTHETIC_DATA_DISCLOSURE

router = APIRouter(prefix="/api/v1/risk", tags=["risk"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Task H8 fills this router in: ML risk scoring (LightGBM + SHAP), gated behind the
# data-quality check in app/risk/data_quality.py. See that module's docstring for why the
# gate matters more than the model's accuracy.


# --- Response shapes owned entirely by this task (this file is this task's exclusive scope,
# so these live here rather than in the shared backend/app/schemas.py Sprint 2/3 tasks share). ---

class RuleBasedScoreOut(BaseModel):
    score: float
    breakdown: dict[str, float]
    reasoning: str


class MlScoreOut(BaseModel):
    score: float
    shapBreakdown: dict[str, float]


class RiskScoreOut(BaseModel):
    caseId: str
    walletAddress: str
    chain: str
    ruleBasedScore: RuleBasedScoreOut
    dataQualitySufficientForMl: bool
    dataQualityReasons: list[str]
    mlScore: MlScoreOut | None
    combinedScore: float
    # Mandatory per Task H8's brief: present on every response from this endpoint, whether or
    # not the ML score actually ran, so an officer reading this JSON is never one field away
    # from missing the fact that any ML contribution here rests on synthetic training data.
    syntheticDataDisclosure: str


def _build_trace_features(case: Case) -> TraceFeatures:
    """Builds this trace's TraceFeatures from the same real detectors traces.py already uses
    (sweep, deposit gate, innocence) -- deliberately NOT importing from traces.py itself (out
    of this task's file scope), but reusing the same detector modules and the same
    chain-API-read-failure honesty pattern (`history_read_failed` / read-failure counting)
    established there and in CLAUDE.md."""
    client = get_chain_client(case.chain, case.asset)
    reported_amount = Decimal(str(case.amount_crypto))
    incident_at = case.incident_at if case.incident_at.tzinfo else case.incident_at.replace(tzinfo=timezone.utc)

    result = trace(client, start_address=case.suspect_wallet, reported_amount=reported_amount,
                    start_time=incident_at)

    hop_count = len(result.hops)
    read_failure_count = sum(1 for h in result.hops if h.stop_reason == "api_read_failure")
    total_read_attempts = max(hop_count, 1)

    candidates = [h for h in result.hops if h.hop_index > 0 and h.taint > Decimal("0")]

    label_vetted = False
    best_distinct_payers = 0
    best_gate_passed = False
    best_sweep_gap: float | None = None
    best_value_preserved: float | None = None
    best_score = -1.0  # picks the strongest candidate (gate passed + sweep) to represent the trace

    for hop in candidates:
        total_read_attempts += 1
        try:
            full_history = client.get_transfers(hop.wallet_address)
        except Exception:
            read_failure_count += 1
            continue

        incoming_to_hop = [t for t in full_history if t.to_address == hop.wallet_address]
        outgoing_from_hop = [t for t in full_history if t.from_address == hop.wallet_address]
        distinct_payers = len({t.from_address for t in incoming_to_hop})

        label = lookup_label(hop.wallet_address, hop.chain)
        if label is not None and label.vetting_status == "vetted":
            label_vetted = True

        sweep_incoming = [hop.funding_transfer] if hop.funding_transfer is not None else []
        sweep_signal = detect_sweep(hop.wallet_address, sweep_incoming, outgoing_from_hop)

        predecessor = None
        if hop.funding_transfer is not None:
            expected = next((h for h in result.hops if h.hop_index == hop.hop_index - 1), None)
            if expected is not None and hop.funding_transfer.from_address == expected.wallet_address:
                predecessor = expected.wallet_address

        gate = evaluate_deposit_gate(hop, distinct_payer_count=distinct_payers, label=label,
                                      expected_predecessor=predecessor)

        # Rank candidates by how strong a signal they carry, so the trace's reported features
        # reflect its most implicated wallet rather than an arbitrary one.
        candidate_score = (2 if (gate.gate_passed and sweep_signal.is_sweep) else
                            1 if gate.gate_passed else 0)
        if candidate_score > best_score:
            best_score = candidate_score
            best_distinct_payers = distinct_payers
            best_gate_passed = gate.gate_passed
            best_sweep_gap = sweep_signal.gap_seconds
            best_value_preserved = sweep_signal.value_preserved_pct

    total_read_attempts += 1  # the suspect wallet's own history read, below
    try:
        suspect_history = client.get_transfers(case.suspect_wallet)
        suspect_history_read_failed = False
    except Exception:
        suspect_history = []
        suspect_history_read_failed = True
        read_failure_count += 1

    innocence = compute_innocence(case.suspect_wallet, suspect_history, incident_at=incident_at,
                                   victim_amount=reported_amount, asset=case.asset,
                                   history_unavailable=suspect_history_read_failed)

    return TraceFeatures(
        hop_count=hop_count, distinct_payers=best_distinct_payers, gate_passed=best_gate_passed,
        sweep_gap_seconds=best_sweep_gap, value_preserved_pct=best_value_preserved,
        innocence_score=innocence.innocence_score, read_failure_count=read_failure_count,
        total_read_attempts=total_read_attempts, label_vetted=label_vetted,
    )


@router.get("/{case_id}/score", response_model=RiskScoreOut)
def get_risk_score(case_id: str, db: Session = Depends(get_db)) -> RiskScoreOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    features = _build_trace_features(case)

    rule_result = compute_rule_based_score(features)
    quality = assess_data_quality(features)

    ml_out: MlScoreOut | None = None
    combined_score = rule_result.score
    if quality.sufficient:
        ml_result = get_model().score(features)
        ml_out = MlScoreOut(score=ml_result.score, shapBreakdown=ml_result.shap_breakdown)
        # Simple, disclosed blend: average of the rule-based and ML scores. Neither score is
        # ever hidden -- both are always returned in full alongside this combined figure.
        combined_score = round((rule_result.score + ml_result.score) / 2.0, 2)

    return RiskScoreOut(
        caseId=case.id, walletAddress=case.suspect_wallet, chain=case.chain,
        ruleBasedScore=RuleBasedScoreOut(score=rule_result.score, breakdown=rule_result.breakdown,
                                          reasoning=rule_result.reasoning),
        dataQualitySufficientForMl=quality.sufficient, dataQualityReasons=quality.reasons,
        mlScore=ml_out, combinedScore=combined_score,
        syntheticDataDisclosure=SYNTHETIC_DATA_DISCLOSURE,
    )
