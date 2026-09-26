from datetime import datetime, timezone
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.chains.known_assets import resolve_asset_contract
from app.chains.registry import get_chain_client
from app.config import settings
from app.freeze import tether
from app.models import Case, FreezeCheck
from app.tracing.tracer import TraceHop, trace

router = APIRouter(prefix="/api/v1/freeze", tags=["freeze"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Real endpoint added by this task (H3).


class FreezeCheckDetailOut(BaseModel):
    """This task's own response shape -- richer than schemas.FreezeCheckOut (H0's shared
    scaffold, whose `isBlacklisted`/`unfrozenBalance` are non-nullable). This task's honest
    -failure requirement (never report "not blacklisted" when the check genuinely couldn't
    run) needs those fields to be nullable, so this is defined locally in this router file
    rather than editing schemas.py, which is out of this task's file scope."""

    caseId: str
    walletAddress: str
    chain: str
    isBlacklisted: bool | None
    blacklistCheckError: str | None
    unfrozenBalance: float | None
    balanceCheckError: str | None
    lastMovedAt: datetime | None
    minutesSinceLastMove: float | None
    goldenHourMinutesRemaining: float | None
    urgencyMessage: str
    freezeRequestDraft: str
    dataUnavailable: bool
    dataUnavailableReason: str | None


def _pick_target_wallet(hops: list[TraceHop], incident_at: datetime) -> tuple[TraceHop, datetime, bool]:
    """Picks the wallet this freeze check should run against: the terminal hop (a hop the
    trace actually stopped at) carrying the most taint, since that's where the largest share
    of the victim's money currently sits. Falls back to the last hop reached at all when the
    trace produced no terminal hop yet (still actively moving, or hit the hop cap).

    Returns (target_hop, last_moved_at, hop_read_failed) -- `hop_read_failed` is True when
    the chosen hop's OWN chain-API read failed (traces.py's `api_read_failure` stop reason),
    meaning we can't be fully confident this is genuinely where the money currently rests, not
    just wherever the trace happened to lose visibility."""
    terminal_hops = [h for h in hops if h.stop_reason is not None]
    candidates = terminal_hops if terminal_hops else hops
    target = max(candidates, key=lambda h: h.taint)
    last_moved_at = target.funding_transfer.timestamp if target.funding_transfer else incident_at
    hop_read_failed = target.stop_reason == "api_read_failure"
    return target, last_moved_at, hop_read_failed


def _freeze_request_draft(case: Case, wallet_address: str, chain: str, is_blacklisted: bool | None) -> str:
    """A plain-English, pre-filled freeze request to the wallet's exchange/service -- in the
    same "draft an officer reviews" pattern as this project's existing lawful-action notices.
    Never auto-sent, never presented as legal advice (CLAUDE.md rule 5)."""
    if is_blacklisted:
        status_line = (
            "Tether's own records already show this wallet as blacklisted; this draft is for "
            "following up with the exchange or service about any funds still held there."
        )
    elif is_blacklisted is False:
        status_line = (
            "This wallet is not currently shown as blacklisted by Tether -- requesting an "
            "exchange-side freeze promptly is the main lever left to stop these funds moving "
            "further."
        )
    else:
        status_line = (
            "We could not confirm this wallet's current Tether blacklist status when this "
            "draft was prepared -- treat this as the more urgent case."
        )
    return (
        "DRAFT -- FOR OFFICER REVIEW ONLY. Not sent automatically. Not legal advice; an officer "
        "must review, complete, and approve this before it is sent to anyone.\n\n"
        f"Subject: Urgent request to freeze suspected fraud proceeds -- Case {case.id}\n\n"
        f"To the compliance/fraud team of the exchange or service operating wallet address "
        f"{wallet_address} ({chain}):\n\n"
        "We are investigating a cryptocurrency fraud complaint "
        f"(NCRP reference: {case.ncrp}) in which funds traced from the victim's reported loss "
        f"reached the above wallet address. {status_line} We request that you place an "
        "immediate hold on any balance associated with this address pending a formal legal "
        "request from law enforcement, and preserve all account-opening and transaction "
        "records associated with it.\n\n"
        "[Officer: review and complete with your contact details, case/FIR number, and any "
        "attachments before sending. This draft does not constitute a legal order and is not "
        "legal advice.]"
    )


@router.get("/{case_id}", response_model=FreezeCheckDetailOut)
def check_freeze(case_id: str, db: Session = Depends(get_db)) -> FreezeCheckDetailOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    # This mechanism only exists for USDT (TRC-20/ERC-20) -- Tether's own blacklist function
    # is specific to Tether's deployed contracts, not a generic capability of any asset/chain.
    resolution = resolve_asset_contract(case.chain, case.asset)
    known_usdt_contracts = {tether.USDT_TRC20_CONTRACT, tether.USDT_ERC20_CONTRACT}
    if case.chain not in ("tron", "ethereum") or resolution.kind != "contract" \
            or resolution.contract not in known_usdt_contracts:
        raise HTTPException(
            status_code=400,
            detail=(
                "Freeze check only supports USDT (TRC-20/ERC-20) cases; this case's declared "
                "chain/asset isn't Tether USDT."
            ),
        )

    incident_at = case.incident_at if case.incident_at.tzinfo else case.incident_at.replace(tzinfo=timezone.utc)
    client = get_chain_client(case.chain, case.asset)
    result = trace(client, start_address=case.suspect_wallet,
                    reported_amount=Decimal(str(case.amount_crypto)), start_time=incident_at)
    target, last_moved_at, hop_read_failed = _pick_target_wallet(result.hops, incident_at)

    http_client = httpx.Client(timeout=settings.http_timeout_seconds)
    try:
        wallet_check = tether.check_tether_wallet(
            case.chain, target.wallet_address, http_client=http_client,
            etherscan_api_key=settings.etherscan_api_key,
        )
    finally:
        http_client.close()

    now = datetime.now(timezone.utc)
    minutes_since_last_move = (now - last_moved_at).total_seconds() / 60.0
    golden_hour_minutes_remaining, urgency_message = tether.compute_golden_hour_urgency(
        minutes_since_last_move, is_blacklisted=wallet_check.is_blacklisted,
    )

    reasons: list[str] = []
    if wallet_check.is_blacklisted is None:
        reasons.append(f"Tether blacklist check failed: {wallet_check.is_blacklisted_error}")
    if wallet_check.unfrozen_balance is None:
        reasons.append(f"Balance check failed: {wallet_check.balance_error}")
    if hop_read_failed:
        reasons.append(
            "The trace could not confirm this is genuinely where the money currently sits -- "
            "the chain read for this wallet's own history failed."
        )
    data_unavailable = bool(reasons)
    data_unavailable_reason = " ".join(reasons) if reasons else None

    freeze_request_draft = _freeze_request_draft(
        case, target.wallet_address, target.chain, wallet_check.is_blacklisted,
    )

    # Persist a FreezeCheck row only when both values were genuinely obtained -- the
    # FreezeCheck model's `is_blacklisted`/`unfrozen_balance` columns are non-nullable, and
    # writing a placeholder into them to paper over a read that never actually completed would
    # be exactly the false-confident-empty-result bug this task exists to avoid.
    if wallet_check.is_blacklisted is not None and wallet_check.unfrozen_balance is not None:
        db.add(FreezeCheck(
            wallet_address=target.wallet_address,
            chain=target.chain,
            is_blacklisted=wallet_check.is_blacklisted,
            unfrozen_balance=float(wallet_check.unfrozen_balance),
            golden_hour_minutes_remaining=golden_hour_minutes_remaining,
        ))
        db.commit()

    return FreezeCheckDetailOut(
        caseId=case.id,
        walletAddress=target.wallet_address,
        chain=target.chain,
        isBlacklisted=wallet_check.is_blacklisted,
        blacklistCheckError=wallet_check.is_blacklisted_error,
        unfrozenBalance=float(wallet_check.unfrozen_balance) if wallet_check.unfrozen_balance is not None else None,
        balanceCheckError=wallet_check.balance_error,
        lastMovedAt=last_moved_at,
        minutesSinceLastMove=minutes_since_last_move,
        goldenHourMinutesRemaining=golden_hour_minutes_remaining,
        urgencyMessage=urgency_message,
        freezeRequestDraft=freeze_request_draft,
        dataUnavailable=data_unavailable,
        dataUnavailableReason=data_unavailable_reason,
    )
