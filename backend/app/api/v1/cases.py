import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.audit.chain import append_entry
from app.chains.known_assets import resolve_asset_contract
from app.chains.registry import get_chain_client
from app.config import settings
from app.freeze import tether
from app.api.v1.freeze import _pick_target_wallet
from app.labels.seed_labels import lookup_label
from app.models import Case
from app.schemas import CaseIn, CaseOut
from app.tracing.tracer import trace

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])

# This task (recoverability triage) reuses freeze.py's own trace-selection function
# (`_pick_target_wallet`) and its Tether-blacklist/golden-hour machinery rather than
# duplicating any of that logic here -- see that file's docstrings for how each piece was
# verified. freeze.py itself stays untouched (read-only, out of this task's file scope).

RecoverabilityState = Literal["at_rest", "at_exchange", "moving", "unknown"]

# Mirrors the exact gate `freeze.py`'s own `check_freeze` endpoint applies before it will run
# a Tether-specific blacklist/balance check -- reusing the same underlying public constants
# (`tether.USDT_TRC20_CONTRACT` / `tether.USDT_ERC20_CONTRACT`) freeze.py itself reuses, not a
# second copy of freeze.py's gating logic. A case whose declared chain/asset isn't Tether
# USDT genuinely has no blacklist concept to check, so this is skipped for it (never
# fabricated as "not blacklisted").
_KNOWN_USDT_CONTRACTS = {tether.USDT_TRC20_CONTRACT, tether.USDT_ERC20_CONTRACT}


class CaseListItemOut(CaseOut):
    """List-view response shape -- extends the shared `CaseOut` (schemas.py) with a
    recoverability signal, following the same "define locally in the router file" convention
    `campaigns.py`'s own `CampaignDetailOut` already uses for a view-specific extension of a
    shared schema, rather than editing schemas.py for a shape only this endpoint returns."""

    recoverabilityState: RecoverabilityState
    recoverabilityDeadlineMinutes: float | None


def _to_out(case: Case) -> CaseOut:
    return CaseOut(
        id=case.id, ncrp=case.ncrp, complainant=case.complainant, location=case.location,
        phone=case.phone, incidentAt=case.incident_at, reportedAt=case.reported_at,
        fraudType=case.fraud_type, amountINR=case.amount_inr, amountCrypto=case.amount_crypto,
        asset=case.asset, chain=case.chain, suspectWallet=case.suspect_wallet,
    )


def _compute_recoverability(case: Case) -> tuple[RecoverabilityState, float | None]:
    """Computes an honest, small recoverability signal for one case, reusing freeze.py's own
    trace-selection (`_pick_target_wallet`) and golden-hour/blacklist machinery instead of
    reinventing any of it.

    State is derived entirely from real signals the trace/freeze data can actually produce:
    - "moving": the trace never reached a genuine resting point for this money -- either it's
      still actively hopping (no terminal hop at all) or we only stopped following it
      artificially (`hop_cap_reached`). We cannot say the money is sitting still.
    - "unknown": the trail itself went cold or unreliable -- a chain-API read failed
      (`api_read_failure`), the money entered a mixer (`entered_mixer`), or crossed a bridge
      we couldn't confirm the other side of (`bridge_crossing_unconfirmed`). Honestly, we
      cannot currently tell whether this money is still recoverable at all.
    - "at_exchange": the trace genuinely stopped at a wallet our own (small, vetted) label
      table (`app.labels.seed_labels`) identifies as belonging to an exchange/service.
    - "at_rest": the trace genuinely stopped (no further outgoing activity) at an
      unlabelled wallet -- the honest common case: money sitting somewhere, not yet
      attributed to a named service.

    `recoverabilityDeadlineMinutes` (the golden-hour-style estimate) is only meaningful when
    money is confirmed sitting still (`at_rest` / `at_exchange`) -- for "moving"/"unknown" there
    is no stable resting point to measure a freeze window against, so it is left `None` rather
    than computed against a wallet the money may have already left.
    """
    try:
        incident_at = (case.incident_at if case.incident_at.tzinfo
                        else case.incident_at.replace(tzinfo=timezone.utc))
        client = get_chain_client(case.chain, case.asset)
        result = trace(client, start_address=case.suspect_wallet,
                        reported_amount=Decimal(str(case.amount_crypto)), start_time=incident_at)
        target, last_moved_at, hop_read_failed = _pick_target_wallet(result.hops, incident_at)
    except Exception:  # noqa: BLE001 -- a per-case computation failure must never break the
        # whole list, and must never be silently reported as a confident state either.
        return "unknown", None

    if hop_read_failed or target.stop_reason in ("api_read_failure", "entered_mixer",
                                                   "bridge_crossing_unconfirmed"):
        return "unknown", None
    if target.stop_reason is None or target.stop_reason == "hop_cap_reached":
        return "moving", None

    # Only remaining stop reasons here are "no_outgoing_activity"/"no_further_transfers" --
    # the money genuinely stopped moving at `target`.
    # Only a VETTED label counts as "at an exchange" -- same gate app/api/v1/risk.py's
    # `label_vetted` check already applies. seed_labels.py's one unvetted placeholder entry
    # must never be presented as a real, named exchange here any more than it can be for
    # attribution itself.
    label = lookup_label(target.wallet_address, target.chain)
    is_exchange = label is not None and label.vetting_status == "vetted"
    state: RecoverabilityState = "at_exchange" if is_exchange else "at_rest"

    # Tether's on-chain blacklist status only exists for USDT (TRC-20/ERC-20) -- the same gate
    # freeze.py's own endpoint applies. Skipped (not fabricated) for every other case; the
    # golden-hour estimate below still runs, just without a blacklist signal to zero it out.
    resolution = resolve_asset_contract(case.chain, case.asset)
    is_blacklisted: bool | None = None
    if case.chain in ("tron", "ethereum") and resolution.kind == "contract" \
            and resolution.contract in _KNOWN_USDT_CONTRACTS:
        http_client = httpx.Client(timeout=settings.http_timeout_seconds)
        try:
            wallet_check = tether.check_tether_wallet(
                case.chain, target.wallet_address, http_client=http_client,
                etherscan_api_key=settings.etherscan_api_key,
            )
            is_blacklisted = wallet_check.is_blacklisted
        except Exception:  # noqa: BLE001 -- a failed blacklist read must not crash the list;
            # falls through with is_blacklisted left None, i.e. "not confirmed either way".
            pass
        finally:
            http_client.close()

    now = datetime.now(timezone.utc)
    minutes_since_last_move = (now - last_moved_at).total_seconds() / 60.0
    deadline_minutes, _urgency_message = tether.compute_golden_hour_urgency(
        minutes_since_last_move, is_blacklisted=is_blacklisted,
    )
    return state, deadline_minutes


_STATE_SORT_RANK: dict[RecoverabilityState, int] = {"at_rest": 0, "at_exchange": 0, "moving": 1, "unknown": 2}


def _sort_key(item: CaseListItemOut) -> tuple[int, float]:
    # Cases with a real deadline sort first among themselves, most urgent (least time left)
    # first. "moving" (still traceable, no fixed resting point) comes next; "unknown" (no
    # traceable state) sorts last -- matching this task's brief on what "most recoverable
    # first" means in practice.
    if item.recoverabilityDeadlineMinutes is not None:
        return (0, item.recoverabilityDeadlineMinutes)
    return (_STATE_SORT_RANK[item.recoverabilityState], 0.0)


@router.post("", response_model=CaseOut, status_code=201)
def create_case(payload: CaseIn, db: Session = Depends(get_db)) -> CaseOut:
    chain = payload.chain.lower()
    suspect_wallet = payload.suspectWallet
    # Ethereum addresses are hex and case-insensitive once EIP-55 checksumming is
    # ignored, but Etherscan's own transfer records always come back lowercase — so a
    # checksummed (mixed-case) address a user types into the form would never match
    # anything downstream (tracer.py, traces.py, graph/backward.py, etc., all compare
    # addresses case-sensitively). Normalized once here, at the same point `chain` is
    # normalized, so every downstream reader sees canonical lowercase. This is
    # conditional on chain — unlike `chain` itself, which is always lowercased — because
    # TRON (base58) and Bitcoin (bech32/base58) addresses are genuinely case-sensitive;
    # lowercasing those would corrupt them.
    if chain == "ethereum":
        suspect_wallet = suspect_wallet.lower()
    case = Case(
        id=str(uuid.uuid4()), ncrp=payload.ncrp, complainant=payload.complainant,
        location=payload.location, phone=payload.phone, incident_at=payload.incidentAt,
        fraud_type=payload.fraudType, amount_inr=payload.amountINR, amount_crypto=payload.amountCrypto,
        asset=payload.asset,
        # Normalized once here so every downstream reader of `case.chain` (registry.py,
        # tracer, etc.) always sees the canonical lowercase form — don't add more
        # `.lower()` calls elsewhere for this.
        chain=chain,
        suspect_wallet=suspect_wallet,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    append_entry(db, actor="system", action="case.create", object_type="case", object_id=case.id)
    return _to_out(case)


@router.get("", response_model=list[CaseListItemOut])
def list_cases(db: Session = Depends(get_db)) -> list[CaseListItemOut]:
    """Lists every case with a recoverability signal, sorted so the most actionable cases
    (money still confirmed sitting still, least time left in the practical freeze window)
    come first -- that ranking, not the raw registry, is the actual point of this endpoint.

    Known scaling limitation, documented rather than hidden: this recomputes freeze-check-style
    logic (including live chain-API reads) for EVERY case on EVERY request to this endpoint --
    fine for a hackathon demo's small case count, but this would need caching/background
    pre-computation before it could handle a realistically large case list. Not an oversight.
    """
    cases = db.query(Case).all()
    items: list[CaseListItemOut] = []
    for case in cases:
        state, deadline_minutes = _compute_recoverability(case)
        base = _to_out(case)
        items.append(CaseListItemOut(
            **base.model_dump(),
            recoverabilityState=state,
            recoverabilityDeadlineMinutes=deadline_minutes,
        ))
    items.sort(key=_sort_key)
    return items


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db)) -> CaseOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    return _to_out(case)
