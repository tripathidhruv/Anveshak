import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.identity import Identity, require_role
from app.models import FlaggedWallet, VaspSubscriber, VaspWalletReply, utcnow
from app.schemas import FlaggedWalletOut, VaspSubscriberIn
from app.vasp_feed import demo_receiver, distribution

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Filled in by Task H2 (VASP flagged-wallet feed).
#
# `router` itself carries no prefix -- it exists only to combine two independently-prefixed
# sub-routers (the pull/push feed below, and the SIMULATED demo receiver in
# app/vasp_feed/demo_receiver.py) into the single object `app/main.py` already imports and
# registers as `vasp_feed.router`, without needing a second entry in main.py's router list.
router = APIRouter()

feed_router = APIRouter(prefix="/api/v1/vasp-feed", tags=["vasp-feed"])


class VaspSubscriberOut(BaseModel):
    id: int
    name: str
    webhookUrl: str | None
    active: bool
    email: str | None = None
    # Returned so whoever registers a subscriber can hand them the shareable portal link
    # (`https://.../vasp-portal/{accessToken}`) -- VASP wallet-sharing portal, Feature 2.
    accessToken: str


# --- VASP wallet-sharing portal (Feature 2) ---
# External exchanges never log in -- their own `VaspSubscriber.access_token` embedded in a
# shareable `/vasp-portal/{access_token}` link IS the auth. ANVESHAK officers instead go through
# Feature 1's email+OTP login and hit `GET /replies` below with a Bearer JWT.

class VaspPortalWalletOut(BaseModel):
    # `id` isn't in the spec's named field list (address/chain/riskScore/flaggedAt) but is
    # included anyway -- the reply form needs SOME way to say which wallet a reply is about,
    # and a flagged wallet's numeric id is not case detail, victim PII, or another
    # subscriber's data, so exposing it doesn't violate the "only these fields" intent.
    id: int
    address: str
    chain: str
    riskScore: float
    flaggedAt: datetime


class VaspPortalOut(BaseModel):
    subscriberName: str
    wallets: list[VaspPortalWalletOut]


class VaspWalletReplyIn(BaseModel):
    flaggedWalletId: int
    message: str


class VaspWalletReplyOut(BaseModel):
    id: int
    subscriberId: int
    subscriberName: str
    subscriberEmail: str | None
    flaggedWalletId: int
    flaggedWalletAddress: str
    flaggedWalletChain: str
    message: str
    repliedAt: datetime


def _get_active_subscriber_or_404(access_token: str, db: Session) -> VaspSubscriber:
    """Exact-equality lookup by token -- never a prefix/fuzzy match, so a guessed token that
    happens to share a prefix with a real one is no more likely to succeed, and the 404 below
    is the only response an unknown OR syntactically-valid-but-wrong token ever gets (same
    shape, no extra fields, no timing-revealing branch)."""
    subscriber = db.execute(
        select(VaspSubscriber).where(
            VaspSubscriber.access_token == access_token,
            VaspSubscriber.active == True,  # noqa: E712 (SQLAlchemy needs `== True`)
        )
    ).scalar_one_or_none()
    if subscriber is None:
        raise HTTPException(status_code=404, detail="Not found")
    return subscriber


def _wallets_visible_to(_subscriber: VaspSubscriber, db: Session) -> list[FlaggedWallet]:
    """Which FlaggedWallet rows a given (already-validated-active) subscriber may see.
    Mirrors `distribution.deliver_webhooks`'s own association logic exactly: Task H2's feed
    fans every flagged wallet out to every active subscriber -- there is no per-subscriber
    wallet segmentation in this codebase yet -- so an active subscriber's visible set is
    every FlaggedWallet row, the same set their webhook (if they have one) already receives.
    `_subscriber` is accepted (not just unused) so a future per-subscriber segmentation only
    has to change this one function, not every caller."""
    return list(db.execute(select(FlaggedWallet)).scalars().all())


class FlagWalletIn(BaseModel):
    caseId: str
    address: str
    chain: str
    gatePassed: bool
    # None falls back to the interim rule-based proxy score documented in
    # app/vasp_feed/distribution.py until Task H8's ML risk scorer lands.
    riskScore: float | None = None


class FlagWalletOut(BaseModel):
    flagged: bool
    wallet: FlaggedWalletOut | None = None


class FlaggedWalletListOut(BaseModel):
    items: list[FlaggedWalletOut]
    total: int
    limit: int
    offset: int


def _to_out(fw: FlaggedWallet) -> FlaggedWalletOut:
    return FlaggedWalletOut(address=fw.address, chain=fw.chain, riskScore=fw.risk_score,
                             caseIds=fw.case_ids, flaggedAt=fw.flagged_at,
                             broadcastStatus=fw.broadcast_status)


@feed_router.get("/flagged-wallets", response_model=FlaggedWalletListOut)
def list_flagged_wallets(chain: str | None = None, since: datetime | None = None,
                          limit: int = 50, offset: int = 0,
                          db: Session = Depends(get_db)) -> FlaggedWalletListOut:
    """Pull API for VASPs that prefer polling over the push webhook. Filterable by chain
    and by a `since` timestamp (only wallets flagged at or after it); paginated via
    `limit`/`offset`, ordered newest-first with a stable id tiebreak."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    query = select(FlaggedWallet)
    if chain is not None:
        query = query.where(FlaggedWallet.chain == chain.lower())
    if since is not None:
        query = query.where(FlaggedWallet.flagged_at >= since)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(FlaggedWallet.flagged_at.desc(), FlaggedWallet.id.desc())
             .limit(limit).offset(offset)
    ).scalars().all()

    return FlaggedWalletListOut(items=[_to_out(fw) for fw in rows], total=total,
                                 limit=limit, offset=offset)


@feed_router.get("/flagged-wallets/all", response_model=list[FlaggedWalletOut])
def list_all_flagged_wallets(
    identity: Identity = Depends(require_role("officer")),
    db: Session = Depends(get_db),
) -> list[FlaggedWalletOut]:
    """Officer-facing, system-wide view of every flagged wallet -- full untruncated address,
    chain, risk score, related case IDs, and flagged timestamp. Deliberately a distinct path
    from `GET /flagged-wallets` above: that one is the unauthenticated VASP pull API (paginated,
    `FlaggedWalletListOut` shape) already relied on by existing subscribers/tests, so this
    officer view can't reuse the exact same path+method without either shadowing it or being
    permanently unreachable itself."""
    wallets = db.execute(
        select(FlaggedWallet).order_by(FlaggedWallet.flagged_at.desc())
    ).scalars().all()
    return [_to_out(w) for w in wallets]


def _subscriber_out(subscriber: VaspSubscriber) -> VaspSubscriberOut:
    return VaspSubscriberOut(id=subscriber.id, name=subscriber.name,
                              webhookUrl=subscriber.webhook_url, active=subscriber.active,
                              email=subscriber.email, accessToken=subscriber.access_token)


@feed_router.post("/subscribers", response_model=VaspSubscriberOut, status_code=201)
def create_subscriber(payload: VaspSubscriberIn, db: Session = Depends(get_db)) -> VaspSubscriberOut:
    """Registers a VASP as a subscriber -- either a webhook push subscriber (Task H2, original
    shape) or a portal-only subscriber with no `webhookUrl` at all (VASP wallet-sharing portal,
    Feature 2). `api_key` is generated server-side (never supplied by the caller) and returned
    once here -- a real deployment would show this exactly once and store only a hash, but
    that hardening is out of this task's scope. `access_token` is likewise always generated
    server-side, even for a webhook-only subscriber that doesn't need it yet -- harmless, and
    future-proofs them for the portal without a later backfill migration."""
    subscriber = VaspSubscriber(name=payload.name, webhook_url=payload.webhookUrl,
                                 email=payload.email, api_key=str(uuid.uuid4()),
                                 access_token=secrets.token_urlsafe(32), active=True)
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    return _subscriber_out(subscriber)


@feed_router.get("/subscribers", response_model=list[VaspSubscriberOut])
def list_subscribers(db: Session = Depends(get_db)) -> list[VaspSubscriberOut]:
    subscribers = db.execute(select(VaspSubscriber)).scalars().all()
    return [_subscriber_out(s) for s in subscribers]


@feed_router.get("/portal/{access_token}", response_model=VaspPortalOut)
def get_portal(access_token: str, db: Session = Depends(get_db)) -> VaspPortalOut:
    """Public, no-officer-auth endpoint -- the token itself is the auth. Returns only the
    fields an external exchange needs to act on a flagged wallet, never case details, victim
    PII, complainant info, or any other subscriber's data."""
    subscriber = _get_active_subscriber_or_404(access_token, db)
    wallets = _wallets_visible_to(subscriber, db)
    return VaspPortalOut(
        subscriberName=subscriber.name,
        wallets=[VaspPortalWalletOut(id=w.id, address=w.address, chain=w.chain,
                                      riskScore=w.risk_score, flaggedAt=w.flagged_at)
                 for w in wallets],
    )


@feed_router.post("/portal/{access_token}/reply", response_model=VaspWalletReplyOut, status_code=201)
def create_portal_reply(access_token: str, payload: VaspWalletReplyIn,
                         db: Session = Depends(get_db)) -> VaspWalletReplyOut:
    """Public, no-officer-auth endpoint. Validates the wallet is actually in THIS token's own
    visible set (reusing `_wallets_visible_to`, the exact same check `get_portal` uses) before
    accepting the reply -- a token holder must not be able to reply about a wallet outside
    their own scope, even by guessing an id. A wallet outside scope is a 404, matching
    `get_portal`'s own non-distinguishing-error principle (never a 403, which would confirm
    the wallet id exists at all)."""
    subscriber = _get_active_subscriber_or_404(access_token, db)
    visible_ids = {w.id for w in _wallets_visible_to(subscriber, db)}
    if payload.flaggedWalletId not in visible_ids:
        raise HTTPException(status_code=404, detail="Not found")

    wallet = db.get(FlaggedWallet, payload.flaggedWalletId)
    reply = VaspWalletReply(subscriber_id=subscriber.id, flagged_wallet_id=wallet.id,
                             message=payload.message, replied_at=utcnow())
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return VaspWalletReplyOut(
        id=reply.id, subscriberId=subscriber.id, subscriberName=subscriber.name,
        subscriberEmail=subscriber.email, flaggedWalletId=wallet.id,
        flaggedWalletAddress=wallet.address, flaggedWalletChain=wallet.chain,
        message=reply.message, repliedAt=reply.replied_at,
    )


@feed_router.get("/replies", response_model=list[VaspWalletReplyOut])
def list_replies(identity: Identity = Depends(require_role("officer")),
                  db: Session = Depends(get_db)) -> list[VaspWalletReplyOut]:
    """ANVESHAK-officers-only endpoint -- every reply across every subscriber, for officers to
    review. Gated on the resolved ANVESHAK role (`require_role`), not just a valid JWT, now that
    non-officer roles (citizen/exchange) can also hold one -- see `app/auth/identity.py`."""
    rows = db.execute(
        select(VaspWalletReply).order_by(VaspWalletReply.replied_at.desc())
    ).scalars().all()

    out: list[VaspWalletReplyOut] = []
    for reply in rows:
        subscriber = db.get(VaspSubscriber, reply.subscriber_id)
        wallet = db.get(FlaggedWallet, reply.flagged_wallet_id)
        out.append(VaspWalletReplyOut(
            id=reply.id, subscriberId=reply.subscriber_id,
            subscriberName=subscriber.name if subscriber else "",
            subscriberEmail=subscriber.email if subscriber else None,
            flaggedWalletId=reply.flagged_wallet_id,
            flaggedWalletAddress=wallet.address if wallet else "",
            flaggedWalletChain=wallet.chain if wallet else "",
            message=reply.message, repliedAt=reply.replied_at,
        ))
    return out


@feed_router.post("/flag", response_model=FlagWalletOut)
def flag_wallet(payload: FlagWalletIn, background_tasks: BackgroundTasks,
                 db: Session = Depends(get_db)) -> FlagWalletOut:
    """Auto-flagging entry point (Task H2's documented integration gap: this task's file
    scope does not include `app/api/v1/traces.py`, so `run_trace` does not call this yet --
    a future task wires it in by POSTing here with the trace's own `case_id`, attributed
    wallet `address`/`chain`, and `attribution.gatePassed` once it has computed them, so it
    never needs to touch this module).

    Flags the wallet (or merges this case into an already-flagged wallet -- see
    `distribution.auto_flag_wallet`) and, if newly-qualifying, schedules webhook delivery to
    every active subscriber as a background task using the SAME request-scoped `db` session
    (see distribution.py's module docstring for why that is safe)."""
    flagged = distribution.auto_flag_wallet(
        db, case_id=payload.caseId, address=payload.address, chain=payload.chain,
        gate_passed=payload.gatePassed, risk_score=payload.riskScore,
    )
    if flagged is None:
        return FlagWalletOut(flagged=False, wallet=None)

    background_tasks.add_task(distribution.deliver_webhooks, db, flagged.id)
    return FlagWalletOut(flagged=True, wallet=_to_out(flagged))


router.include_router(feed_router)
router.include_router(demo_receiver.router)
