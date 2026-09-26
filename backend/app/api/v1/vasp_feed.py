import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import FlaggedWallet, VaspSubscriber
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
    webhookUrl: str
    active: bool


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


@feed_router.post("/subscribers", response_model=VaspSubscriberOut, status_code=201)
def create_subscriber(payload: VaspSubscriberIn, db: Session = Depends(get_db)) -> VaspSubscriberOut:
    """Registers a VASP as a webhook subscriber. `api_key` is generated server-side (never
    supplied by the caller) and returned once here -- a real deployment would show this
    exactly once and store only a hash, but that hardening is out of this task's scope."""
    subscriber = VaspSubscriber(name=payload.name, webhook_url=payload.webhookUrl,
                                 api_key=str(uuid.uuid4()), active=True)
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    return VaspSubscriberOut(id=subscriber.id, name=subscriber.name,
                              webhookUrl=subscriber.webhook_url, active=subscriber.active)


@feed_router.get("/subscribers", response_model=list[VaspSubscriberOut])
def list_subscribers(db: Session = Depends(get_db)) -> list[VaspSubscriberOut]:
    subscribers = db.execute(select(VaspSubscriber)).scalars().all()
    return [VaspSubscriberOut(id=s.id, name=s.name, webhookUrl=s.webhook_url, active=s.active)
            for s in subscribers]


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
