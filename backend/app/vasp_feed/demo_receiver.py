"""Demo VASP receiver (Task H2).

This is a SIMULATED exchange, built only to demonstrate the flagged-wallet feed end to end
(a subscriber that registers itself, receives the push webhook, and shows a deposit into a
flagged address getting auto-held). It is NOT a real VASP integration, and every response
below says so explicitly -- per CLAUDE.md rule 1 ("Never substitute a real exchange name --
it is defamatory") and rule 3 (plain English for a non-technical reader).

State: the "incoming deposit screening" ledger below (`_held_deposits`) is an in-process
dict, not a DB-backed model -- it exists purely so this demo route group can show "here is
what an exchange's screening system would do" without needing its own persisted model (this
task's file scope is `app/vasp_feed/` + `app/api/v1/vasp_feed.py` only). The real system of
record for flagged wallets is `FlaggedWallet`, queryable via the pull API
(`GET /api/v1/vasp-feed/flagged-wallets`) regardless of whether the demo receiver is running.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models import VaspSubscriber

router = APIRouter(prefix="/api/v1/demo-vasp", tags=["demo-vasp"])

DEMO_VASP_NAME = "Demo VASP (SIMULATED -- not a real exchange)"
# Not a real credential -- this is a fake demo subscriber's fake API key, used only so the
# webhook payload's X-API-Key header has something to check against in a real integration.
DEMO_VASP_API_KEY = "demo-vasp-simulated-key"

# Keyed by (address, chain). Cleared per-process; tests reset it directly (see
# tests/api/test_vasp_feed_api.py) rather than relying on process restarts.
_held_deposits: dict[tuple[str, str], dict] = {}


class DemoSubscribeIn(BaseModel):
    webhookBaseUrl: str  # e.g. "http://localhost:8000" -- where this server is reachable from


class DemoSubscribeOut(BaseModel):
    subscriberId: int
    name: str
    webhookUrl: str
    simulated: bool = True


class DemoWebhookIn(BaseModel):
    address: str
    chain: str
    riskScore: float
    caseIds: list[str]
    flaggedAt: str
    simulatedDemoData: bool = True


class DemoScreeningOut(BaseModel):
    exchangeName: str
    simulated: bool
    address: str
    chain: str
    held: bool
    reasonCodes: list[str]
    message: str


@router.post("/subscribe", response_model=DemoSubscribeOut)
def demo_subscribe(payload: DemoSubscribeIn, db: Session = Depends(get_db)) -> DemoSubscribeOut:
    """Registers this demo receiver as a `VaspSubscriber` so it starts receiving the same
    push-webhook feed a real exchange integration would. Idempotent: re-subscribing with the
    same base URL reuses the existing subscriber row instead of creating a duplicate."""
    webhook_url = payload.webhookBaseUrl.rstrip("/") + "/api/v1/demo-vasp/webhook"
    existing = db.execute(
        select(VaspSubscriber).where(VaspSubscriber.webhook_url == webhook_url)
    ).scalar_one_or_none()
    if existing is not None:
        subscriber = existing
    else:
        subscriber = VaspSubscriber(name=DEMO_VASP_NAME, webhook_url=webhook_url,
                                     api_key=DEMO_VASP_API_KEY, active=True)
        db.add(subscriber)
        db.commit()
        db.refresh(subscriber)
    return DemoSubscribeOut(subscriberId=subscriber.id, name=subscriber.name,
                             webhookUrl=subscriber.webhook_url)


@router.post("/webhook")
def demo_webhook(payload: DemoWebhookIn) -> dict:
    """Receives the flagged-wallet push webhook and simulates an exchange's screening
    system auto-holding any deposit into that address from here on. SIMULATED."""
    key = (payload.address, payload.chain)
    _held_deposits[key] = {
        "riskScore": payload.riskScore,
        "caseIds": payload.caseIds,
        "flaggedAt": payload.flaggedAt,
        "receivedAt": datetime.now(timezone.utc).isoformat(),
    }
    return {"received": True, "simulated": True}


@router.get("/screening/{chain}/{address}", response_model=DemoScreeningOut)
def demo_screening(chain: str, address: str) -> DemoScreeningOut:
    """Simulates a deposit attempt into `address` arriving at this demo exchange, showing
    whether it would be auto-held because of the flagged-wallet feed, with plain-English
    reason codes. SIMULATED -- does not represent a real deposit or a real exchange's
    actual screening system."""
    held_info = _held_deposits.get((address, chain))
    if held_info is None:
        return DemoScreeningOut(
            exchangeName=DEMO_VASP_NAME, simulated=True, address=address, chain=chain,
            held=False, reasonCodes=[],
            message=("This address is not on our (simulated) flagged-wallet list right now. "
                     "A deposit here would be processed normally."),
        )
    return DemoScreeningOut(
        exchangeName=DEMO_VASP_NAME, simulated=True, address=address, chain=chain,
        held=True,
        reasonCodes=["FLAGGED_WALLET_FEED_MATCH", f"RISK_SCORE_{held_info['riskScore']:.2f}"],
        message=(
            "This deposit was automatically held for manual review because the sending "
            "address appears on the (simulated) KAIZEN flagged-wallet feed, linked to "
            f"{len(held_info['caseIds'])} traced fraud case(s). This is demo data from a "
            "simulated exchange, not a real hold at a real exchange."
        ),
    )
