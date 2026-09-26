from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.models import AttributionCandidate, Case, Hop
from app.chains.registry import get_chain_client
from app.tracing.tracer import trace, TraceHop
from app.tracing.conservation import check_conservation
from app.detectors.sweep import detect_sweep
from app.detectors.deposit import evaluate_deposit_gate
from app.detectors.innocence import compute_innocence
from app.graph.backward import enumerate_unreported_victims
from app.bridge.linker import find_bridge_links
from app.labels.seed_labels import lookup_label
from app.sanctions.screen import screen_hops
from app.vasp_feed import distribution as vasp_distribution
from app.audit.chain import append_entry
from app.schemas import (
    TraceOut, HopOut, ConservationOut, AttributionOut, InnocenceOut,
    InnocenceFactorOut, UnreportedVictimOut, BridgeLinkOut, SanctionsMatchOut,
)

router = APIRouter(prefix="/api/v1/cases", tags=["traces"])

# Plain-English mappings for HopOut.role / HopOut.flag (Task F11, I10/I11): the raw
# `stop_reason` codes and `"suspect"`/`"intermediate"` role literals are internal signals,
# not something a non-technical reader (or a judge with zero crypto background, per
# CLAUDE.md rule 3) should see verbatim. `stopReason` (the separate schema field) keeps the
# raw code for anything downstream that still wants it as a machine-readable signal (see
# test_traces_api.py's `stopReason is None` check) -- only `flag` needs to become
# human-readable. This intentionally does NOT introduce per-hop "this is the exchange" /
# "this hop swept the money" detection to match the frontend mock data's richer flag
# vocabulary (`'EXCHANGE'`, `'SWEPT'`, `'BRIDGE IN'`) -- that is separate, not-yet-built
# per-hop attribution work (see docs/TASKS.md), and forcing a fake match here would be
# inventing data, not translating it.
_ROLE_PLAIN_ENGLISH = {
    "suspect": "Suspect's wallet",
    "intermediate": "Wallet the money passed through",
}

_STOP_REASON_PLAIN_ENGLISH = {
    "no_outgoing_activity": "This wallet never sent this money anywhere else",
    "no_further_transfers": "This wallet has not moved this money any further yet",
    "hop_cap_reached": "We stopped following the money here to keep the search from going too deep",
    "api_read_failure": "We could not check this wallet's history right now",
}


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


def _evaluate_candidate_report(gate, sweep_signal, final_gate_passed):
    """Shared (breakdown, entity_name, reasoning, limitations) computation for ONE evaluated
    candidate hop -- factored out (Task H11) so the exact same logic that used to run only
    for the single hop `run_trace` ultimately reports on can also run for EVERY evaluated
    candidate, to persist a real `AttributionCandidate` row per candidate (see the call site
    below), not just the winning one.

    `entity_name` is returned as `None` when the candidate isn't confirmed as a named
    exchange -- never the literal `"UNKNOWN"` string here. That matches
    `AttributionCandidate.entity_name`'s own nullable convention already used elsewhere in
    this codebase's own tests (e.g. `tests/unit/test_campaign_clustering.py`'s candidate
    fixtures pass `entity_name=None` for a failed gate). The API-facing `"UNKNOWN"` string is
    an `AttributionOut`-only presentation convention, applied at that call site instead.
    """
    if gate is None:
        breakdown = {"data_unavailable": True}
        entity_name = None
        reasoning = (
            "We could not check this wallet's transaction history right now, so we can't "
            "tell whether it belongs to an exchange."
        )
        limitations = (
            "This wallet's data was unavailable when the trace ran. Try running the trace "
            "again, or check this wallet manually."
        )
        return breakdown, entity_name, reasoning, limitations

    breakdown = {**gate.breakdown, "sweep_confirmed": sweep_signal.is_sweep}
    entity_name = gate.entity_name if final_gate_passed else None
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
    return breakdown, entity_name, reasoning, limitations

@router.post("/{case_id}/trace", response_model=TraceOut)
def run_trace(case_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> TraceOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    # Task H11: record that a trace was run for this case. This is the closest available
    # substitute, from WITHIN this task's file scope (traces.py ONLY -- case creation itself
    # lives in app/api/v1/cases.py, out of scope here), for H6's brief's own named
    # "case creation" audit call site; `action="trace.run"` matches the exact example already
    # used in tests/test_audit_chain.py's own `append_entry` usage. A real
    # `action="case.create"` entry at case-creation time is a small follow-up for whoever
    # next touches cases.py, not something this task can add without violating its file scope.
    append_entry(db, actor="system", action="trace.run", object_type="case", object_id=case.id)

    client = get_chain_client(case.chain, case.asset)
    reported_amount = Decimal(str(case.amount_crypto))
    incident_at = case.incident_at if case.incident_at.tzinfo else case.incident_at.replace(tzinfo=timezone.utc)

    result = trace(client, start_address=case.suspect_wallet, reported_amount=reported_amount,
                    start_time=incident_at)

    hops_out = [
        HopOut(n=h.hop_index, addr=h.wallet_address,
               role=_ROLE_PLAIN_ENGLISH["suspect" if h.hop_index == 0 else "intermediate"],
               amt=float(h.taint), at=(h.funding_transfer.timestamp if h.funding_transfer else incident_at),
               flag=_STOP_REASON_PLAIN_ENGLISH.get(h.stop_reason), chain=h.chain, stopReason=h.stop_reason)
        for h in result.hops
    ]

    # First-time `Hop` DB persistence (this task): one row per `result.hops` entry, mirroring
    # `hops_out` above (same order, same length, same fields) rather than recomputing anything.
    # This closes a real, already-documented gap: `app/api/v1/sanctions.py`'s
    # `screen_case_hops(case_id, db)` and `app/evidence/pack.py`'s evidence-pack builder both
    # already query `Hop` filtered by `case_id`, but until now nothing ever wrote a `Hop` row,
    # so both always saw an empty result for every real case.
    #
    # `route_label` is always the literal "routeA": this backend only ever traces one chain /
    # one route per case (see `bridge_links` below and its own comment for the same
    # one-chain-per-case architectural fact) -- there is no second route to choose between.
    for h, out in zip(result.hops, hops_out):
        db.add(Hop(
            case_id=case.id, route_label="routeA", hop_index=h.hop_index,
            wallet_address=h.wallet_address, chain=h.chain,
            tx_hash=(h.funding_transfer.tx_hash if h.funding_transfer else None),
            amount=float(h.taint), at=out.at,
            stop_reason=h.stop_reason, flag=out.flag,
        ))
    # Commit unconditionally here, regardless of whether any attribution candidates are found
    # below -- the existing `db.commit()` further down (originally the only commit in this
    # function) sits INSIDE the `if candidates:` branch, so a trace that produces zero
    # candidates (e.g. the suspect wallet has no outgoing activity at all) would otherwise
    # never commit these new `Hop` rows. That gap is exactly the bug this persistence exists
    # to avoid re-introducing.
    db.commit()

    terminal_hops = result.terminal_hops
    # Correction #3: compare the victim's reported amount against terminal-hop taint, not
    # against a sum of every hop's own funding transfer (that would double-count hand-offs,
    # since one hop's funding transfer is also the previous hop's outgoing transfer). Taint
    # is already FIFO-capped at the reported amount (see tracer.py), so this honestly
    # reflects value that reached a stopping point versus value the trace lost track of.
    #
    # Task G3 (I-B, instance 1): a terminal hop whose OWN stop_reason is "api_read_failure"
    # never actually reached a verified stopping point -- its chain-API read simply failed
    # (see tracer.py), so its taint is not "value the trace watched settle here", it's value
    # whose destination is unknown. Counting it into outgoing_total would let the
    # conservation check report "reconciled" (or a too-small remainder) as if the trace fully
    # accounted for that money, when it actually couldn't verify anything past that hop. Same
    # shape as the candidate-loop's `history_read_failed` flag: exclude the unread taint and
    # thread a bool through to `check_conservation` so `reconciled` is never falsely True.
    unread_terminal_hops = [h for h in terminal_hops if h.stop_reason == "api_read_failure"]
    outgoing_total = sum((h.taint for h in terminal_hops if h.stop_reason != "api_read_failure"),
                         Decimal("0"))
    conservation = check_conservation(incoming_total=reported_amount, outgoing_total=outgoing_total,
                                       fees=Decimal("0"), data_unavailable=bool(unread_terminal_hops))

    # Task G3 (I-B, instance 2): the default "no wallet ever received any of the victim's
    # money" message below is only honest when `candidates` is empty BECAUSE the money
    # genuinely never moved -- not when it's empty because a chain-API read failed somewhere
    # in `result.hops` (e.g. the very first hop, fetching the suspect wallet's own outgoing
    # transfers in tracer.py, before this candidate loop even runs) and we simply couldn't see
    # whether it moved. Check for that read-failure signal before asserting the confident
    # version.
    any_hop_read_failed = any(h.stop_reason == "api_read_failure" for h in result.hops)
    if any_hop_read_failed:
        attribution_out = AttributionOut(
            walletAddress=case.suspect_wallet, chain=case.chain, gatePassed=False, entityName="UNKNOWN",
            breakdown={"data_unavailable": True},
            reasoning=(
                "We could not read this wallet's transaction history right now, so we don't know "
                "whether the victim's money moved further than what we could see."
            ),
            limitations=(
                "Some of this trace's data was unavailable when it ran. Try running the trace "
                "again, or check this wallet manually."
            ),
        )
    else:
        attribution_out = AttributionOut(
            walletAddress=case.suspect_wallet, chain=case.chain, gatePassed=False, entityName="UNKNOWN",
            breakdown={},
            reasoning="No wallet in this trace ever received any of the victim's traced money, so there is nothing yet to check against an exchange.",
            limitations="No wallet holding the victim's money was found to evaluate.",
        )
    unreported_victims_out: list[UnreportedVictimOut] = []
    unreported_victims_data_unavailable = False

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

        # Task H11 (item 1 -- the change that unblocks campaigns/H1, evidence packs, legal
        # notices, etc.): persist a real `AttributionCandidate` row for EVERY evaluated
        # candidate hop, not just the one ultimately reported on below. `AttributionCandidate`
        # was defined in models.py but never written anywhere until this task -- see
        # app/graph/campaigns.py's own module docstring, which documents exactly this gap and
        # the fact that `build_campaigns` silently returns `[]` until something populates this
        # table for real traces.
        for c_hop, c_gate, c_sweep_signal, c_final_gate_passed in evaluated:
            c_breakdown, c_entity_name, c_reasoning, c_limitations = _evaluate_candidate_report(
                c_gate, c_sweep_signal, c_final_gate_passed)
            db.add(AttributionCandidate(
                case_id=case.id, wallet_address=c_hop.wallet_address, chain=c_hop.chain,
                gate_passed=c_final_gate_passed, gate_breakdown=c_breakdown,
                entity_name=c_entity_name, reasoning=c_reasoning, limitations=c_limitations,
            ))
        db.commit()

        # Prefer the earliest (closest-to-suspect) candidate that passes every check -- the most
        # directly implicated wallet in the causal chain. If none pass, report on the LAST
        # candidate (closest to wherever the traceable money currently sits) so the failure
        # reasoning still points at the most useful next place to look.
        passed = next((e for e in evaluated if e[3]), None)
        hop, gate, sweep_signal, final_gate_passed = passed if passed is not None else evaluated[-1]

        breakdown, entity_name, reasoning, limitations = _evaluate_candidate_report(
            gate, sweep_signal, final_gate_passed)

        attribution_out = AttributionOut(
            walletAddress=hop.wallet_address, chain=hop.chain, gatePassed=final_gate_passed,
            # AttributionOut's `entityName` is a plain non-nullable string field (pre-existing
            # API contract) -- "UNKNOWN" is this presentation layer's own convention for "not
            # confirmed", translated here from `_evaluate_candidate_report`'s `None`.
            entityName=entity_name or "UNKNOWN",
            breakdown=breakdown, reasoning=reasoning, limitations=limitations,
        )

        # Task H11 (item 3): auto-flag the wallet this trace actually settled its attribution
        # on into the VASP feed (Task H2) whenever the full gate passed. Deliberately keeps
        # H2's documented interim rule-based proxy score (`risk_score=None` below -- see
        # app/vasp_feed/distribution.py's module docstring) rather than wiring in H8's real
        # LightGBM+SHAP scorer here: building that scorer's `TraceFeatures` (app/risk/features.py)
        # means re-running most of this same candidate-history-fetch/sweep/gate logic a SECOND
        # time per request (see app/api/v1/risk.py's own `_build_trace_features`, which
        # re-derives it independently rather than reusing traces.py's already-computed result,
        # since that file predates this task and traces.py wasn't touchable when it was written).
        # Duplicating that cost and complexity into the hot trace path -- the single most
        # heavily-tested endpoint in this backend -- is not a safe, low-risk change to make in
        # this task. `GET /api/v1/risk/{case_id}/score` remains the place to get the real ML
        # score; a future task can thread that score into this call site's `risk_score=`
        # parameter once it's worth the extra chain reads on every trace.
        if final_gate_passed:
            flagged = vasp_distribution.auto_flag_wallet(
                db, case_id=case.id, address=hop.wallet_address, chain=hop.chain,
                gate_passed=final_gate_passed,
            )
            if flagged is not None:
                background_tasks.add_task(vasp_distribution.deliver_webhooks, db, flagged.id)

        # Task H11 (item 4): audit-log the attribution result actually reported to the caller.
        append_entry(db, actor="system", action="attribution.result",
                     object_type="attribution_candidate", object_id=attribution_out.walletAddress)

        # Sub-fix I6 (absorbed): exclude EVERY wallet already in this trace's own hop list from
        # "unreported victims", not just the suspect wallet -- an intermediate hop in the causal
        # path (e.g. a hub the money passed through) is part of the criminal's own flow, not a
        # genuine additional victim.
        # Task G3 (I-B, 4th instance found while fixing the 3 named ones): `victims = []`
        # after this except is indistinguishable downstream from "we checked this wallet's
        # payers and genuinely found no other victims" -- the same false-confident-empty-list
        # bug as instances 1-3, just surfacing here as a list instead of a message or a bool.
        # Thread the same shape of signal through to the API response instead of silently
        # returning an empty list either way.
        # Task G4 (I-C): `hop` here may be the `evaluated[-1]` fallback -- an arbitrary
        # last-candidate wallet picked only so attribution has *something* to report on when no
        # candidate passed the full gate. With no vetted labels seeded (true for every live
        # trace today), enumerating that unverified wallet's depositors and reporting them as
        # "victims" of this case would implicate unrelated third parties on nothing more than
        # having sent money through a wallet the traced funds merely happened to pass through.
        # Only enumerate when the wallet has actually passed the deposit gate as a genuine
        # collection point. Deliberately `gate.gate_passed`, not `final_gate_passed`:
        # `final_gate_passed` also requires `sweep_signal.is_sweep`, which is a correctness
        # signal for naming the wallet as an EXCHANGE specifically -- enough distinct payers
        # (plus predecessor + vetted label) is already the right bar for "this is a real hub
        # worth checking other depositors of," even when we're not confident enough to name it
        # as an exchange. When the guard fails, `unreported_victims_out` simply stays the empty
        # list it's already initialized to above -- no new code path needed for the negative case.
        if gate is not None and gate.gate_passed:
            try:
                victims = enumerate_unreported_victims(
                    client, hop.wallet_address,
                    known_victim_addresses={h.wallet_address for h in result.hops})
            except Exception:
                victims = []
                unreported_victims_data_unavailable = True
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
    #
    # Task G3 (I-B, instance 3): `suspect_history = []` on failure is indistinguishable from a
    # wallet that genuinely has zero history, and compute_innocence's `no_pre_incident_history`
    # factor would then fire as an accusatory "checked fact" ("no activity before the
    # incident") that was never actually checked. Thread the same `*_read_failed`-shaped bool
    # through so compute_innocence can skip that factor and report an honest "couldn't check"
    # one instead.
    suspect_history_read_failed = False
    try:
        suspect_history = client.get_transfers(case.suspect_wallet)
    except Exception:
        suspect_history = []
        suspect_history_read_failed = True
    innocence = compute_innocence(case.suspect_wallet, suspect_history,
                                   incident_at=incident_at, victim_amount=reported_amount,
                                   asset=case.asset, history_unavailable=suspect_history_read_failed)
    innocence_out = InnocenceOut(
        innocenceScore=innocence.innocence_score,
        factors=[InnocenceFactorOut(check=f.check, description=f.description,
                                     supportsInnocence=f.supports_innocence, weight=f.weight)
                 for f in innocence.factors],
    )

    # Task H11 (item 2): screen every hop in this trace against the OFAC SDN seed list (Task
    # H4). Calls `screen_hops` -- the pure, DB-independent function -- directly on this
    # request's own freshly-computed `result.hops`, rather than `app/api/v1/sanctions.py`'s
    # `screen_case_hops(case_id, db)` helper, which re-derives its hop list by querying the
    # `Hop` DB table for `case_id`. `Hop` rows ARE now persisted (see the block above, added by
    # the Hop-persistence follow-up task), so `screen_case_hops` would work today -- this call
    # site simply hasn't been switched over to it, since screening the hops already sitting in
    # memory for this request is equally correct and avoids a redundant DB round-trip.
    sanctions_hits = screen_hops([(h.wallet_address, h.chain) for h in result.hops])
    now = datetime.now(timezone.utc)
    sanctions_matches_out = [
        SanctionsMatchOut(walletAddress=hit.wallet_address, chain=hit.chain,
                           listSource=hit.list_source, matchedAt=now, listVersion=hit.list_version)
        for hit in sanctions_hits
    ]

    all_outgoing = [t for h in result.hops for t in h.outgoing_transfers]
    # Bridge-hop linking (Task 10) is correct in isolation, but a single case only ever traces
    # ONE chain in this architecture (Case.chain is one value; run_trace only ever constructs one
    # ChainClient), so all_outgoing can never actually contain two different chains' transfers.
    # This call is therefore currently always [], which is honest given the data available -- a
    # real fix needs a case model that traces two chains and correlates between them (see
    # docs/TASKS.md P3), not a change to this call site.
    bridge_links = find_bridge_links(all_outgoing, all_outgoing)
    bridge_links_out = [
        BridgeLinkOut(sideATxHash=b.side_a_tx_hash, sideAChain=b.side_a_chain,
                       sideBTxHash=b.side_b_tx_hash, sideBChain=b.side_b_chain, confidence=b.confidence)
        for b in bridge_links if b.side_a_chain != b.side_b_chain
    ]

    return TraceOut(hops=hops_out, conservation=ConservationOut(
        incomingTotal=float(conservation.incoming_total), outgoingTotal=float(conservation.outgoing_total),
        fees=float(conservation.fees), remainder=float(conservation.remainder), reconciled=conservation.reconciled,
        dataUnavailable=conservation.data_unavailable,
    ), attribution=attribution_out, innocence=innocence_out,
       unreportedVictims=unreported_victims_out,
       unreportedVictimsDataUnavailable=unreported_victims_data_unavailable,
       bridgeLinks=bridge_links_out,
       sanctionsMatches=sanctions_matches_out)
