from dataclasses import dataclass, field
from app.tracing.tracer import TraceHop
from app.labels.seed_labels import VaspLabelSeed

MIN_DISTINCT_PAYERS = 3

@dataclass
class DepositGateResult:
    gate_passed: bool
    entity_name: str  # "UNKNOWN" unless every gate clears
    breakdown: dict = field(default_factory=dict)
    reasoning: str = ""
    limitations: str = ""

def _plain_failure_reasons(hop: TraceHop, distinct_payer_count: int, label: VaspLabelSeed | None,
                            expected_predecessor: str | None, breakdown: dict) -> list[str]:
    """Turn each failed check into one plain-English sentence a non-technical reader can
    follow — no jargon like 'funding edge' or 'immediate predecessor'."""
    reasons: list[str] = []

    if breakdown["hop_0"]:
        reasons.append(
            "This is the very first wallet in the trace, the one we started from, so it can "
            "never be counted as the deposit address itself."
        )

    if not breakdown["distinct_payers_ok"]:
        payer_word = "person" if distinct_payer_count == 1 else "people"
        reasons.append(
            f"Only {distinct_payer_count} different {payer_word} sent money into this wallet. "
            f"We need at least {MIN_DISTINCT_PAYERS} different senders before we treat a wallet "
            "as a real collection point, so this one does not qualify yet."
        )

    if not breakdown["immediate_predecessor_match"]:
        if hop.funding_transfer is None or expected_predecessor is None:
            reasons.append(
                "We don't have a clear record of exactly which wallet sent money straight into "
                "this one, so we can't draw a straight line back to the wallet we're tracing."
            )
        else:
            reasons.append(
                "The money that arrived here did not come straight from the wallet we're "
                "tracing. It came from a different address instead, so this wallet might not be "
                "part of the same chain of transfers."
            )

    if not breakdown["label_vetted"]:
        if label is None:
            reasons.append(
                "We don't have any name on file for this wallet address, so we don't know which "
                "exchange, if any, it belongs to."
            )
        else:
            reasons.append(
                f"We do have a name on file for this wallet ({label.entity_name}), but nobody has "
                "checked it against a real, public source yet, so we won't use it to name an "
                "exchange."
            )

    return reasons

def evaluate_deposit_gate(hop: TraceHop, distinct_payer_count: int,
                           label: VaspLabelSeed | None, expected_predecessor: str | None = None) -> DepositGateResult:
    """Every gate from docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md's
    correctness-guard checklist, in one place. A wallet is a deposit address only if ALL of:
    not hop 0, N+ distinct payers swept in, the funding edge is the immediate predecessor in
    THIS trace's path (not merely 'has an inbound edge' -- Himanshu-Harsh's bug), and the
    wallet carries a *vetted* label. Any gate failing means UNKNOWN, never a plausible guess."""
    breakdown = {
        "hop_0": hop.hop_index == 0,
        "distinct_payers_ok": distinct_payer_count >= MIN_DISTINCT_PAYERS,
        "immediate_predecessor_match": (
            hop.funding_transfer is not None
            and expected_predecessor is not None
            and hop.funding_transfer.from_address == expected_predecessor
        ),
        "label_vetted": label is not None and label.vetting_status == "vetted",
    }
    gate_passed = (
        not breakdown["hop_0"]
        and breakdown["distinct_payers_ok"]
        and breakdown["immediate_predecessor_match"]
        and breakdown["label_vetted"]
    )
    if not gate_passed:
        reasons = _plain_failure_reasons(hop, distinct_payer_count, label, expected_predecessor, breakdown)
        reasoning = (
            "We could not confirm this wallet is a real exchange deposit address. "
            + " ".join(reasons)
        )
        return DepositGateResult(
            gate_passed=False, entity_name="UNKNOWN", breakdown=breakdown,
            reasoning=reasoning,
            limitations=(
                "We are not sure enough to name an exchange here, so we show 'UNKNOWN' instead "
                "of guessing. This is a starting point for an investigation, not final proof — "
                "an officer still needs to check it before acting on it."
            ),
        )
    payer_word = "person" if distinct_payer_count == 1 else "people"
    return DepositGateResult(
        gate_passed=True, entity_name=label.entity_name, breakdown=breakdown,
        reasoning=(
            f"This wallet passed every check we use before naming an exchange. "
            f"{distinct_payer_count} different {payer_word} sent money into this wallet, which "
            "is what a real collection point looks like. The money that arrived here came "
            "straight from the wallet we're tracing, not through a detour. And the name we're "
            f"showing for this wallet comes from a source we checked ourselves: {label.source_url}."
        ),
        limitations=(
            "This is a strong signal, not a court-proven fact. A human officer should still "
            "confirm it before relying on it in a case."
        ),
    )
