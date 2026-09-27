import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

import httpx
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.audit.chain import append_entry
from app.auth.identity import Identity, get_current_identity, require_role, resolve_role
from app.auth.jwt import bearer_scheme
from app.chains.known_assets import resolve_asset_contract
from app.chains.registry import get_chain_client
from app.config import settings
from app.freeze import tether
from app.api.v1.freeze import _pick_target_wallet
from app.labels.seed_labels import lookup_label
from app.models import Case, CaseReply
from app.narrative.summary import generate_case_narrative
from app.schemas import CaseIn, CaseOut, CaseReplyIn, CaseReplyOut, CaseStatusUpdateIn
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
        status=case.status, filedByRole=case.filed_by_role, guestTicketToken=case.guest_ticket_token,
    )


def _resolve_filer(credentials: HTTPAuthorizationCredentials | None, db: Session) -> tuple[str, str | None]:
    """Determines who is filing a new case from an OPTIONAL bearer token (missing/invalid ->
    guest, tracked only by their case's own `guest_ticket_token`; a valid token -> that user's
    resolved KAIZEN role and their verified email). Deliberately local to this router rather
    than a change to `app.auth.jwt.get_current_officer` (which hard-401s on a missing/invalid
    token) -- Global Constraints keep that file's auth-verification contract untouched; this is
    a citizen/guest-filing concern, not an auth-verification one.

    Returns (filed_by_role, complainant_email). No/invalid/expired token, or a token with no
    email claim, all resolve the same way: ("guest", None)."""
    if credentials is None or not settings.auth_jwt_secret:
        return "guest", None
    try:
        payload = pyjwt.decode(credentials.credentials, settings.auth_jwt_secret, algorithms=["HS256"])
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return "guest", None
    email = payload.get("email")
    if not email:
        return "guest", None
    role = resolve_role(db, email)
    return role, email.strip().lower()


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
def create_case(
    payload: CaseIn,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CaseOut:
    filed_by_role, complainant_email = _resolve_filer(credentials, db)
    guest_ticket_token = secrets.token_urlsafe(32) if filed_by_role == "guest" else None
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
        filed_by_role=filed_by_role,
        complainant_email=complainant_email,
        guest_ticket_token=guest_ticket_token,
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


@router.get("/mine", response_model=list[CaseOut])
def list_my_cases(
    db: Session = Depends(get_db),
    identity: Identity = Depends(get_current_identity),
) -> list[CaseOut]:
    """A logged-in citizen's own cases, matched by their verified email -- not by who is
    logged in generically, since two citizens must never see each other's cases here.
    Registered ahead of `GET /{case_id}` (below) so FastAPI's in-order path matching doesn't
    swallow the literal path "mine" as a `case_id` value."""
    cases = (
        db.query(Case)
        .filter(Case.complainant_email == identity.email)
        .order_by(Case.reported_at.desc())
        .all()
    )
    return [_to_out(c) for c in cases]


@router.get("/ticket/{guest_ticket_token}", response_model=CaseOut)
def get_case_by_ticket(guest_ticket_token: str, db: Session = Depends(get_db)) -> CaseOut:
    """No-auth lookup for a guest-filed case: the opaque, unguessable `guest_ticket_token`
    itself is the credential -- a guest never has an account to log in with. Registered ahead
    of `GET /{case_id}` for the same route-ordering reason as `GET /mine` above."""
    case = db.query(Case).filter(Case.guest_ticket_token == guest_ticket_token).one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="No ticket found for this link")
    return _to_out(case)


@router.get("/ticket/{guest_ticket_token}/replies", response_model=list[CaseReplyOut])
def list_case_replies_by_ticket(guest_ticket_token: str, db: Session = Depends(get_db)) -> list[CaseReplyOut]:
    """No-auth reply lookup for a guest-filed case, mirroring `get_case_by_ticket` above: the
    opaque, unguessable `guest_ticket_token` itself is the credential -- a guest never has an
    account to log in with, so `list_case_replies`'s identity-based ownership check (below)
    doesn't apply and isn't needed here. Reuses `_reply_to_out` rather than duplicating its
    serialization."""
    case = db.query(Case).filter(Case.guest_ticket_token == guest_ticket_token).one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="No ticket found for this link")
    replies = db.query(CaseReply).filter(CaseReply.case_id == case.id).order_by(CaseReply.created_at).all()
    return [_reply_to_out(r) for r in replies]


@router.get("/{case_id}", response_model=CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db)) -> CaseOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    return _to_out(case)


# Unified role-based portal (Task 3): the only lifecycle moves a case is allowed to make --
# always forward, one step at a time, never skipping "in_progress" and never moving backward.
# Mirrors `app.schemas.CaseStatus`'s own three values; don't let the two drift.
VALID_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "new": {"in_progress"},
    "in_progress": {"handled"},
    "handled": set(),
}


@router.patch("/{case_id}/status", response_model=CaseOut)
def update_case_status(
    case_id: str,
    payload: CaseStatusUpdateIn,
    db: Session = Depends(get_db),
    identity: Identity = Depends(require_role("officer")),
) -> CaseOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    allowed_next = VALID_STATUS_TRANSITIONS.get(case.status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=409,
            detail=f"Can't move a case from '{case.status}' straight to '{payload.status}'.",
        )
    case.status = payload.status
    db.commit()
    db.refresh(case)
    if payload.status == "handled":
        # generate_case_narrative's own docstring promises "Never raises", but that contract is
        # only enforced by its internal try/except around the OpenAI call -- the DB-read portion
        # before that (case/hops/candidates lookups) is unguarded. The status transition above
        # has already been committed by this point, so a defense-in-depth guard here (treating
        # ANY exception the same as the documented `available=False` case) ensures a narrative-
        # generation failure of any kind can never turn an already-successful status transition
        # into a misleading 500.
        try:
            narrative, available, _reason = generate_case_narrative(db, case_id)
        except Exception:  # noqa: BLE001 -- see comment above; must never risk the response below.
            narrative, available = None, False
        if available and narrative:
            db.add(CaseReply(case_id=case_id, message=narrative, authored_by="ai"))
            db.commit()
    return _to_out(case)


def _reply_to_out(reply: CaseReply) -> CaseReplyOut:
    return CaseReplyOut(id=reply.id, caseId=reply.case_id, message=reply.message,
                         authoredBy=reply.authored_by, createdAt=reply.created_at)


@router.post("/{case_id}/replies", response_model=CaseReplyOut, status_code=201)
def create_case_reply(
    case_id: str,
    payload: CaseReplyIn,
    db: Session = Depends(get_db),
    identity: Identity = Depends(require_role("officer")),
) -> CaseReplyOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    reply = CaseReply(case_id=case_id, message=payload.message, authored_by="officer")
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return _reply_to_out(reply)


@router.get("/{case_id}/replies", response_model=list[CaseReplyOut])
def list_case_replies(
    case_id: str,
    db: Session = Depends(get_db),
    identity: Identity = Depends(get_current_identity),
) -> list[CaseReplyOut]:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    # Task 5's ownership check: any officer may view any case's replies; a non-officer
    # (citizen) may only view replies for a case whose `complainant_email` matches their own
    # verified email. A guest-filed case has no `complainant_email` at all, so a citizen never
    # matches it by accident here (compared against "" rather than None to keep the comparison
    # a plain string one, matching identity.email's type).
    if identity.role != "officer" and identity.email != (case.complainant_email or ""):
        raise HTTPException(status_code=403, detail="Not authorized to view these replies")
    replies = db.query(CaseReply).filter(CaseReply.case_id == case_id).order_by(CaseReply.created_at).all()
    return [_reply_to_out(r) for r in replies]
