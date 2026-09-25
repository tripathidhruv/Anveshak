from datetime import timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models import Case
from app.chains.registry import get_chain_client
from app.tracing.tracer import trace
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

@router.post("/{case_id}/trace", response_model=TraceOut)
def run_trace(case_id: str, db: Session = Depends(get_db)) -> TraceOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    client = get_chain_client(case.chain)
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
        reasoning="The trace never reached a wallet where the money stopped moving, so there is nothing yet to check against an exchange.",
        limitations="No stopping point was found to evaluate.",
    )
    unreported_victims_out: list[UnreportedVictimOut] = []
    if terminal_hops:
        terminal = terminal_hops[-1]
        label = lookup_label(terminal.wallet_address, terminal.chain)
        predecessor = terminal.funding_transfer.from_address if terminal.funding_transfer else None

        # Corrections #1 and #2: one full-history fetch of the terminal wallet, reused for
        # both the payer count and the sweep check. A single funding transfer can never
        # show a real collection-point pattern.
        full_history = client.get_transfers(terminal.wallet_address)
        incoming_to_terminal = [t for t in full_history if t.to_address == terminal.wallet_address]
        outgoing_from_terminal = [t for t in full_history if t.from_address == terminal.wallet_address]
        distinct_payers = len({t.from_address for t in incoming_to_terminal})

        sweep_signal = detect_sweep(terminal.wallet_address, incoming_to_terminal, outgoing_from_terminal)

        gate = evaluate_deposit_gate(terminal, distinct_payer_count=distinct_payers, label=label,
                                      expected_predecessor=predecessor)
        final_gate_passed = gate.gate_passed and sweep_signal.is_sweep
        breakdown = {**gate.breakdown, "sweep_confirmed": sweep_signal.is_sweep}

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
            walletAddress=terminal.wallet_address, chain=terminal.chain, gatePassed=final_gate_passed,
            entityName=gate.entity_name if final_gate_passed else "UNKNOWN",
            breakdown=breakdown, reasoning=reasoning, limitations=limitations,
        )

        victims = enumerate_unreported_victims(client, terminal.wallet_address,
                                                known_victim_addresses={case.suspect_wallet})
        unreported_victims_out = [
            UnreportedVictimOut(payerAddress=v.payer_address, chain=v.chain, totalAmount=float(v.total_amount),
                                 transferCount=v.transfer_count, firstSeenAt=v.first_seen_at)
            for v in victims
        ]

    innocence = compute_innocence(case.suspect_wallet, [t for h in result.hops for t in h.outgoing_transfers],
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
