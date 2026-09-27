"""VASP flagged-wallet feed: auto-flagging + webhook distribution (Task H2).

Interim risk-scoring note (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md,
Task H2): Task H8's ML risk scorer has not landed yet as of this task. Until it does, this
module uses a simple RULE-BASED PROXY, not a silent shortcut:
`traces.py`'s `attribution.gatePassed == True` already requires enough distinct payers, a
verified predecessor hop, and (via `final_gate_passed`) a confirmed sweep (see
`app/detectors/deposit.py` + `app/detectors/sweep.py`) before it is ever True. So when no real
`risk_score` is supplied, `interim_proxy_risk_score` treats a passed gate as risk 1.0 (always
above `FLAG_RISK_THRESHOLD`) and a failed gate as risk 0.0 (never flagged). This is
deliberately documented here (and in the API response is never labeled as a calibrated ML
score) so nobody mistakes it for Task H8's real scorer. Replace
`interim_proxy_risk_score`'s body with a call into H8's scorer once it exists.

Delivery mechanism note: this backend has no Celery/Redis wired yet (see
backend/requirements.txt -- only fastapi/uvicorn/sqlalchemy/pydantic/httpx/pytest are
listed). Webhook delivery therefore runs via FastAPI's `BackgroundTasks`, not a task queue.
`deliver_webhooks` below is designed to be handed to `BackgroundTasks.add_task` by the router
in `app/api/v1/vasp_feed.py`, using the SAME request-scoped `Session` the endpoint already
has -- FastAPI runs a yield-dependency's teardown (closing that session) after background
tasks complete, so reusing it here is safe and avoids opening a second, differently-configured
session (which would silently point at a different engine in tests).

Integration gap (documented honestly, per this task's brief): this task's file scope does not
include `app/api/v1/traces.py`, so `run_trace` does not yet call `auto_flag_wallet` directly.
Instead, `auto_flag_wallet` is exposed through `POST /api/v1/vasp-feed/flag`, which a future
task can wire `traces.py` into (passing `case_id`, the attributed wallet's `address`/`chain`,
and the trace's already-computed `attribution.gatePassed` / risk score) without touching this
module.
"""
from __future__ import annotations

import time
from typing import Callable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FlaggedWallet, VaspSubscriber

FLAG_RISK_THRESHOLD = 0.5
DEFAULT_RISK_SCORE_WHEN_GATE_PASSED = 1.0
DEFAULT_RISK_SCORE_WHEN_GATE_FAILED = 0.0


def interim_proxy_risk_score(gate_passed: bool) -> float:
    """Rule-based proxy score used until Task H8's ML risk scorer lands. See module
    docstring -- this is intentionally documented as an interim behavior, not real scoring."""
    return DEFAULT_RISK_SCORE_WHEN_GATE_PASSED if gate_passed else DEFAULT_RISK_SCORE_WHEN_GATE_FAILED


def auto_flag_wallet(db: Session, *, case_id: str, address: str, chain: str,
                      gate_passed: bool, risk_score: float | None = None) -> FlaggedWallet | None:
    """Flags `address` into `FlaggedWallet` when the trace's attribution passed its gate AND
    the (real or interim-proxy) risk score clears `FLAG_RISK_THRESHOLD`. Returns None when the
    wallet does not qualify -- callers must treat None as "not flagged", not an error.

    If the wallet is already flagged (e.g. a second case converges on the same hub wallet),
    this merges `case_id` into its existing `case_ids` and raises `risk_score` to the higher
    of the two, rather than creating a duplicate row -- the whole point of this feed is that
    one flagged wallet can resolve many cases at once (CLAUDE.md's "Consolidation" idea)."""
    if risk_score is None:
        risk_score = interim_proxy_risk_score(gate_passed)

    if not gate_passed or risk_score < FLAG_RISK_THRESHOLD:
        return None

    chain = chain.lower()
    existing = db.execute(
        select(FlaggedWallet).where(FlaggedWallet.address == address, FlaggedWallet.chain == chain)
    ).scalar_one_or_none()

    if existing is not None:
        if case_id not in existing.case_ids:
            existing.case_ids = [*existing.case_ids, case_id]
        existing.risk_score = max(existing.risk_score, risk_score)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    flagged = FlaggedWallet(address=address, chain=chain, risk_score=risk_score,
                            case_ids=[case_id], broadcast_status={})
    db.add(flagged)
    db.commit()
    db.refresh(flagged)
    return flagged


class WebhookSender:
    """Thin httpx wrapper for webhook POSTs, with retry/backoff on failure. `transport` is
    injectable so tests never make a real network call -- same pattern already used by
    `app/chains/http_client.py`'s `AdaptiveHttpClient` elsewhere in this codebase."""

    def __init__(self, transport: httpx.BaseTransport | None = None, timeout: float = 5.0,
                 max_attempts: int = 3, backoff_seconds: float = 0.5):
        self._client = httpx.Client(transport=transport, timeout=timeout)
        self._max_attempts = max_attempts
        self._backoff_seconds = backoff_seconds

    def send(self, url: str, payload: dict, headers: dict | None = None) -> bool:
        attempt = 0
        while True:
            attempt += 1
            try:
                response = self._client.post(url, json=payload, headers=headers)
                if response.status_code < 300:
                    return True
            except httpx.HTTPError:
                pass  # network failure -- fall through to retry/backoff below
            if attempt >= self._max_attempts:
                return False
            time.sleep(self._backoff_seconds * attempt)  # linear backoff


def deliver_webhooks(db: Session, flagged_wallet_id: int,
                      sender_factory: Callable[[], WebhookSender] = WebhookSender) -> None:
    """Fans a newly-flagged wallet out to every active `VaspSubscriber`, recording each
    subscriber's delivery outcome back onto `FlaggedWallet.broadcast_status`
    ({subscriber_id: "delivered"|"failed"}). Meant to run as a FastAPI `BackgroundTasks`
    callback (see module docstring for why `db` is safe to reuse here)."""
    flagged = db.get(FlaggedWallet, flagged_wallet_id)
    if flagged is None:
        return

    sender = sender_factory()
    subscribers = db.execute(
        select(VaspSubscriber).where(VaspSubscriber.active == True)  # noqa: E712 (SQLAlchemy needs `== True`)
    ).scalars().all()

    status = dict(flagged.broadcast_status)
    for subscriber in subscribers:
        if not subscriber.webhook_url:
            # Portal-only subscriber (VASP wallet-sharing portal, Feature 2) -- nothing to
            # POST to. They see flagged wallets via their own /vasp-portal/{accessToken}
            # link instead, not the push feed.
            continue
        payload = {
            "address": flagged.address,
            "chain": flagged.chain,
            "riskScore": flagged.risk_score,
            "caseIds": flagged.case_ids,
            "flaggedAt": flagged.flagged_at.isoformat(),
            # Every payload says this feed is a hackathon prototype -- never let a
            # subscriber (real or demo) believe this is a production attribution.
            "simulatedDemoData": True,
        }
        delivered = sender.send(subscriber.webhook_url, payload,
                                 headers={"X-API-Key": subscriber.api_key})
        status[str(subscriber.id)] = "delivered" if delivered else "failed"

    flagged.broadcast_status = status
    db.add(flagged)
    db.commit()
