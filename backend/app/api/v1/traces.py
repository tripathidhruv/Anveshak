from datetime import timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models import Case
from app.chains.registry import get_chain_client
from app.tracing.tracer import trace, TraceHop
from app.tracing.conservation import check_conservation
from app.detectors.sweep import detect_sweep
from app.detectors.deposit import evaluate_deposit_gate
from app.detectors.innocence import compute_innocence
from app.graph.backward import enumerate_unreported_victims
from app.bridge.linker import find_bridge_links
from app.labels.seed_labels import lookup_label
from app.schemas import (
    TraceOut, HopOut, ConservationOut, AttributionOut, InnocenceOut,
    InnocenceFactorOut, UnreportedVictimOut, BridgeLinkOut,
)

router = APIRouter(prefix="/api/v1/cases", tags=["traces"])


def _verified_predecessor(hops: list[TraceHop], terminal: TraceHop) -> str | None:
    """Cross-checks the terminal hop's recorded funding transfer against the trace's own
    hop list, rather than trusting the funding transfer's own field in isolation -- this is
    what actually catches a funding edge that isn't genuinely the immediate predecessor in
    this trace's path (docs/.../backend-v2-competitive-design.md's correctness-guard
    checklist, 'Himanshu-Harsh's bug'). Re-deriving the expected value from the same field
    being checked would make this comparison a tautology."""
    if terminal.funding_transfer is None:
        return None
    candidate = terminal.funding_transfer.from_address
    parent_exists = any(h.hop_index == terminal.hop_index - 1 and h.wallet_address == candidate
                         for h in hops)
    return candidate if parent_exists else None

@router.post("/{case_id}/trace", response_model=TraceOut)
def run_trace(case_id: str, db: Session = Depends(get_db)) -> TraceOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    client = get_chain_client(case.chain, case.asset)
    reported_amount = Decimal(str(case.amount_crypto))
    incident_at = case.incident_at if case.incident_at.tzinfo else case.incident_at.replace(tzinfo=timezone.utc)

    result = trace(client, start_address=case.suspect_wallet, reported_amount=reported_amount,
                    start_time=incident_at)

    hops_out = [
        HopOut(n=h.hop_index, addr=h.wallet_address, role="suspect" if h.hop_index == 0 else "intermediate",
               amt=float(h.taint), at=(h.funding_transfer.timestamp if h.funding_transfer else incident_at),
               flag=h.stop_reason, chain=h.chain, stopReason=h.stop_reason)
        for h in result.hops
    ]

    terminal_hops = result.terminal_hops
    # Correction #3: compare the victim's reported amount against terminal-hop taint, not
    # against a sum of every hop's own funding transfer (that would double-count hand-offs,
    # since one hop's funding transfer is also the previous hop's outgoing transfer). Taint
    # is already FIFO-capped at the reported amount (see tracer.py), so this honestly
    # reflects value that reached a stopping point versus value the trace lost track of.
    outgoing_total = sum((h.taint for h in terminal_hops), Decimal("0"))
    conservation = check_conservation(incoming_total=reported_amount, outgoing_total=outgoing_total,
                                       fees=Decimal("0"))

    attribution_out = AttributionOut(
        walletAddress=case.suspect_wallet, chain=case.chain, gatePassed=False, entityName="UNKNOWN",
        breakdown={},
        reasoning="No wallet in this trace ever received any of the victim's traced money, so there is nothing yet to check against an exchange.",
        limitations="No wallet holding the victim's money was found to evaluate.",
    )
    unreported_victims_out: list[UnreportedVictimOut] = []

    # Attribution candidates: any hop past the suspect wallet that actually received some of
    # the victim's traced money (taint > 0) -- not just wherever the BFS physically stopped.
    # A hop with taint == 0 never qualifies: nothing the victim sent ever reached it, so naming
    # an exchange there is never correct regardless of anything else about that wallet (fixes
    # C2). Candidacy also does NOT require stop_reason to be set -- a wallet that swept the
    # money onward (and so was followed further by the tracer) must still be evaluated, since a
    # real deposit wallet sweeping a victim's own deposit is exactly what a wallet only stops
    # the trace by NOT doing (fixes C3).
    candidates = [h for h in result.hops if h.hop_index > 0 and h.taint > Decimal("0")]

    if candidates:
        evaluated = []
        for hop in candidates:
            label = lookup_label(hop.wallet_address, hop.chain)
            predecessor = _verified_predecessor(result.hops, hop)

            # Sub-fix 1/2 continued (I1, absorbed): a chain-API failure here must not 500 the
            # whole endpoint -- fall back to an empty history for this one candidate rather than
            # crashing the request. Matches tracer.py's own `except Exception` pattern for the
            # same class of failure.
            #
            # F3-followup: a fetch failure must NOT be silently treated as "we checked and found
            # zero payers" -- evaluate_deposit_gate has no way to distinguish a genuine
            # distinct_payer_count of 0 from "we couldn't read this wallet's history at all", and
            # reporting the former when the latter is true would tell an officer something false
            # about the wallet (nothing-is-a-black-box honesty concern). So when the fetch fails,
            # skip gate/sweep evaluation for this candidate entirely and record that fact instead.
            history_read_failed = False
            try:
                full_history = client.get_transfers(hop.wallet_address)
            except Exception:
                full_history = []
                history_read_failed = True

            if history_read_failed:
                evaluated.append((hop, None, None, False))
                continue

            incoming_to_hop = [t for t in full_history if t.to_address == hop.wallet_address]
            outgoing_from_hop = [t for t in full_history if t.from_address == hop.wallet_address]
            distinct_payers = len({t.from_address for t in incoming_to_hop})

            # Sub-fix 3 (I9): anchor the sweep check on THIS hop's own funding transfer, not the
            # wallet's globally-earliest-ever transfer -- we only care whether the money THIS
            # trace followed into this wallet moved on quickly, not some unrelated, possibly much
            # older, transfer to the same address.
            sweep_incoming = [hop.funding_transfer] if hop.funding_transfer is not None else []
            sweep_signal = detect_sweep(hop.wallet_address, sweep_incoming, outgoing_from_hop)

            gate = evaluate_deposit_gate(hop, distinct_payer_count=distinct_payers, label=label,
                                          expected_predecessor=predecessor)
            final_gate_passed = gate.gate_passed and sweep_signal.is_sweep
            evaluated.append((hop, gate, sweep_signal, final_gate_passed))

        # Prefer the earliest (closest-to-suspect) candidate that passes every check -- the most
        # directly implicated wallet in the causal chain. If none pass, report on the LAST
        # candidate (closest to wherever the traceable money currently sits) so the failure
        # reasoning still points at the most useful next place to look.
        passed = next((e for e in evaluated if e[3]), None)
        hop, gate, sweep_signal, final_gate_passed = passed if passed is not None else evaluated[-1]

        if gate is None:
            # F3-followup: this candidate's history couldn't be read at all -- there is nothing
            # to report from a gate/sweep check that never ran, so say that plainly instead of
            # letting an absent gate be mistaken for a passed or failed one.
            breakdown = {"data_unavailable": True}
            entity_name = "UNKNOWN"
            reasoning = (
                "We could not check this wallet's transaction history right now, so we can't "
                "tell whether it belongs to an exchange."
            )
            limitations = (
                "This wallet's data was unavailable when the trace ran. Try running the trace "
                "again, or check this wallet manually."
            )
        else:
            breakdown = {**gate.breakdown, "sweep_confirmed": sweep_signal.is_sweep}
            entity_name = gate.entity_name if final_gate_passed else "UNKNOWN"
            if final_gate_passed:
                reasoning, limitations = gate.reasoning, gate.limitations
            elif gate.gate_passed and not sweep_signal.is_sweep:
                reasoning = (
                    "Enough different people sent money into this wallet, and the name we have on "
                    "file for it checks out. But the money that arrived here was not moved onward "
                    "quickly the way a real exchange collection wallet normally does, so we are not "
                    "confident enough yet to name the exchange."
                )
                limitations = (
                    "We are not sure enough to name an exchange here, so we show 'UNKNOWN' instead "
                    "of guessing. This is a starting point for an investigation, not final proof — "
                    "an officer still needs to check it before acting on it."
                )
            else:
                reasoning, limitations = gate.reasoning, gate.limitations

        attribution_out = AttributionOut(
            walletAddress=hop.wallet_address, chain=hop.chain, gatePassed=final_gate_passed,
            entityName=entity_name,
            breakdown=breakdown, reasoning=reasoning, limitations=limitations,
        )

        # Sub-fix I6 (absorbed): exclude EVERY wallet already in this trace's own hop list from
        # "unreported victims", not just the suspect wallet -- an intermediate hop in the causal
        # path (e.g. a hub the money passed through) is part of the criminal's own flow, not a
        # genuine additional victim.
        try:
            victims = enumerate_unreported_victims(client, hop.wallet_address,
                                                    known_victim_addresses={h.wallet_address for h in result.hops})
        except Exception:
            victims = []
        unreported_victims_out = [
            UnreportedVictimOut(payerAddress=v.payer_address, chain=v.chain, totalAmount=float(v.total_amount),
                                 transferCount=v.transfer_count, firstSeenAt=v.first_seen_at)
            for v in victims
        ]

    # The suspect wallet's own full transfer history (both directions), not just the
    # forward-followed outgoing transfers the trace happened to walk -- compute_innocence
    # needs incoming transfers too (t.to_address == wallet_address) to evaluate factors like
    # counter-flow-to-payer and pre-existing history, and `outgoing_transfers` from the hops
    # list never contains anything sent TO the suspect wallet. Sub-fix 4 (I1, absorbed): guard
    # this refetch the same way -- a chain-API failure here must not 500 the whole endpoint.
    try:
        suspect_history = client.get_transfers(case.suspect_wallet)
    except Exception:
        suspect_history = []
    innocence = compute_innocence(case.suspect_wallet, suspect_history,
                                   incident_at=incident_at, victim_amount=reported_amount)
    innocence_out = InnocenceOut(
        innocenceScore=innocence.innocence_score,
        factors=[InnocenceFactorOut(check=f.check, description=f.description,
                                     supportsInnocence=f.supports_innocence, weight=f.weight)
                 for f in innocence.factors],
    )

    all_outgoing = [t for h in result.hops for t in h.outgoing_transfers]
    bridge_links = find_bridge_links(all_outgoing, all_outgoing)
    bridge_links_out = [
        BridgeLinkOut(sideATxHash=b.side_a_tx_hash, sideAChain=b.side_a_chain,
                       sideBTxHash=b.side_b_tx_hash, sideBChain=b.side_b_chain, confidence=b.confidence)
        for b in bridge_links if b.side_a_chain != b.side_b_chain
    ]

    return TraceOut(hops=hops_out, conservation=ConservationOut(
        incomingTotal=float(conservation.incoming_total), outgoingTotal=float(conservation.outgoing_total),
        fees=float(conservation.fees), remainder=float(conservation.remainder), reconciled=conservation.reconciled,
    ), attribution=attribution_out, innocence=innocence_out,
       unreportedVictims=unreported_victims_out, bridgeLinks=bridge_links_out)
