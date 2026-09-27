from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.vasp_feed import demo_receiver, distribution

# Same StaticPool-backed shared-connection setup as tests/api/test_cases_api.py -- required
# so FastAPI's TestClient (which runs sync path operations, including BackgroundTasks
# callbacks, in a worker thread) always sees the same in-memory schema.
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False},
                        poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_db_override():
    # Task H11: `POST /api/v1/cases/{id}/trace` (tests/api/test_traces_api.py) now calls
    # `auto_flag_wallet` for every gate-passed trace, writing real `FlaggedWallet` rows --
    # previously this module's `flagged_wallets` table could only ever be touched by THIS
    # file's own requests. This module's exact-count assertions (`total == 0`, etc.) need
    # requests made here to land in THIS module's own engine, not whichever sibling
    # `tests/api/test_*.py` module's override happened to be installed last at collection
    # time (every such module sets `app.dependency_overrides[get_db]` at import time, and
    # pytest imports every test module before executing any of them -- see
    # tests/api/test_sanctions_api.py's identical fixture for the fuller explanation).
    app.dependency_overrides[get_db] = override_get_db
    yield


def _flag_payload(case_id="case-1", address="TFlaggedWalletAAAAAAAAAAAAAAAAAAAAA",
                   chain="tron", gate_passed=True, risk_score=None):
    payload = {"caseId": case_id, "address": address, "chain": chain, "gatePassed": gate_passed}
    if risk_score is not None:
        payload["riskScore"] = risk_score
    return payload


def setup_function(_):
    # This demo receiver ledger is an in-process dict (see demo_receiver.py's module
    # docstring), not a DB row -- reset it directly between tests instead of relying on
    # a fresh process per test.
    demo_receiver._held_deposits.clear()


def _mock_webhook_delivery(monkeypatch, handler):
    """Patches `distribution.deliver_webhooks` (as imported into the router module) so its
    WebhookSender is wired to an httpx.MockTransport -- no real network call is ever made,
    per this task's brief."""
    transport = httpx.MockTransport(handler)
    original = distribution.deliver_webhooks  # capture BEFORE patching -- calling the
    # (post-patch) `distribution.deliver_webhooks` name from inside the wrapper would
    # recurse into itself instead of running the real implementation.

    def patched(db, flagged_wallet_id, sender_factory=None):
        return original(
            db, flagged_wallet_id,
            sender_factory=lambda: distribution.WebhookSender(transport=transport),
        )

    monkeypatch.setattr(distribution, "deliver_webhooks", patched)


def test_gate_failed_never_flags_or_schedules_webhook():
    resp = client.post("/api/v1/vasp-feed/flag", json=_flag_payload(gate_passed=False))
    assert resp.status_code == 200
    assert resp.json() == {"flagged": False, "wallet": None}

    listed = client.get("/api/v1/vasp-feed/flagged-wallets")
    assert listed.json()["total"] == 0


def test_flag_triggers_webhook_to_registered_subscriber(monkeypatch):
    received = []

    def handler(request: httpx.Request) -> httpx.Response:
        received.append(request)
        return httpx.Response(200, json={"ok": True})

    _mock_webhook_delivery(monkeypatch, handler)

    sub = client.post("/api/v1/vasp-feed/subscribers",
                       json={"name": "Test VASP", "webhookUrl": "https://vasp.example.test/hook"})
    assert sub.status_code == 201
    subscriber_id = sub.json()["id"]

    resp = client.post("/api/v1/vasp-feed/flag", json=_flag_payload())
    assert resp.status_code == 200
    body = resp.json()
    assert body["flagged"] is True
    assert body["wallet"]["riskScore"] == 1.0  # interim proxy score for a passed gate

    assert len(received) == 1
    assert str(received[0].url) == "https://vasp.example.test/hook"
    assert received[0].headers["x-api-key"]  # api key was attached

    listed = client.get("/api/v1/vasp-feed/flagged-wallets")
    flagged = listed.json()["items"][0]
    assert flagged["broadcastStatus"][str(subscriber_id)] == "delivered"


def test_failed_delivery_is_recorded_and_retried(monkeypatch):
    # Other tests in this module register their own (still-active) subscribers against
    # this same shared in-memory DB -- so this handler may see calls for more than one
    # subscriber URL. Count per-URL rather than assuming this is the only subscriber.
    attempts_by_url: dict[str, int] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        attempts_by_url[str(request.url)] = attempts_by_url.get(str(request.url), 0) + 1
        return httpx.Response(500, json={"error": "down"})

    _mock_webhook_delivery(monkeypatch, handler)
    monkeypatch.setattr("time.sleep", lambda *_a, **_k: None)  # no real waiting in tests

    client.post("/api/v1/vasp-feed/subscribers",
                json={"name": "Flaky VASP", "webhookUrl": "https://flaky.example.test/hook"})
    resp = client.post("/api/v1/vasp-feed/flag",
                        json=_flag_payload(case_id="case-flaky", address="TFlakyWalletAAAAAAAAAAAAAAAAAAAAAA"))
    assert resp.json()["flagged"] is True

    # WebhookSender's default max_attempts is 3 -- a permanently-failing endpoint should be
    # retried that many times before being recorded as failed.
    assert attempts_by_url["https://flaky.example.test/hook"] == 3
    listed = client.get("/api/v1/vasp-feed/flagged-wallets")
    flagged = next(w for w in listed.json()["items"] if w["address"] == "TFlakyWalletAAAAAAAAAAAAAAAAAAAAAA")
    assert set(flagged["broadcastStatus"].values()) == {"failed"}


def test_second_case_on_same_wallet_merges_instead_of_duplicating(monkeypatch):
    _mock_webhook_delivery(monkeypatch, lambda r: httpx.Response(200, json={}))
    address = "TSharedHubBBBBBBBBBBBBBBBBBBBBBBBB"
    client.post("/api/v1/vasp-feed/flag", json=_flag_payload(case_id="case-A", address=address))
    client.post("/api/v1/vasp-feed/flag", json=_flag_payload(case_id="case-B", address=address))

    listed = client.get("/api/v1/vasp-feed/flagged-wallets", params={"chain": "tron"})
    matching = [w for w in listed.json()["items"] if w["address"] == address]
    assert len(matching) == 1
    assert sorted(matching[0]["caseIds"]) == ["case-A", "case-B"]


def test_pull_api_paginates_and_filters_by_chain(monkeypatch):
    # This test file's other tests share the same in-memory DB across the whole module
    # (same pattern as tests/api/test_cases_api.py), so a plain "tron"/"ethereum" chain
    # filter would also match rows other tests inserted. Use chain tags unique to this
    # test so its counts are exact and order-independent.
    _mock_webhook_delivery(monkeypatch, lambda r: httpx.Response(200, json={}))
    client.post("/api/v1/vasp-feed/flag", json=_flag_payload(
        case_id="c-tron-1", address="TPage1AAAAAAAAAAAAAAAAAAAAAAAAAAAA", chain="tron-pagination-test"))
    client.post("/api/v1/vasp-feed/flag", json=_flag_payload(
        case_id="c-tron-2", address="TPage2AAAAAAAAAAAAAAAAAAAAAAAAAAAA", chain="tron-pagination-test"))
    client.post("/api/v1/vasp-feed/flag", json=_flag_payload(
        case_id="c-eth-1", address="0xpage3aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", chain="ethereum-pagination-test"))

    tron_only = client.get("/api/v1/vasp-feed/flagged-wallets", params={"chain": "tron-pagination-test"})
    assert tron_only.json()["total"] == 2
    assert all(item["chain"] == "tron-pagination-test" for item in tron_only.json()["items"])

    first_page = client.get("/api/v1/vasp-feed/flagged-wallets",
                             params={"chain": "tron-pagination-test", "limit": 1, "offset": 0})
    second_page = client.get("/api/v1/vasp-feed/flagged-wallets",
                              params={"chain": "tron-pagination-test", "limit": 1, "offset": 1})
    assert len(first_page.json()["items"]) == 1
    assert len(second_page.json()["items"]) == 1
    assert first_page.json()["items"][0]["address"] != second_page.json()["items"][0]["address"]

    eth_only = client.get("/api/v1/vasp-feed/flagged-wallets", params={"chain": "ethereum-pagination-test"})
    assert eth_only.json()["total"] == 1


def test_since_filter_excludes_wallets_flagged_before_the_cutoff(monkeypatch):
    _mock_webhook_delivery(monkeypatch, lambda r: httpx.Response(200, json={}))
    client.post("/api/v1/vasp-feed/flag",
                json=_flag_payload(case_id="c-since", address="TSinceAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))

    far_future = "2999-01-01T00:00:00Z"
    listed = client.get("/api/v1/vasp-feed/flagged-wallets", params={"since": far_future})
    assert listed.json()["total"] == 0


class _TestClientSender:
    """A `WebhookSender`-shaped adapter (only the `.send()` method distribution.py calls)
    backed by FastAPI's own `TestClient` instead of a real httpx.Client -- `TestClient`
    only supports the synchronous `handle_request` interface via its internal transport,
    while httpx's `ASGITransport` is async-only and cannot be used from a sync
    `httpx.Client`. This still never touches a real socket, per this task's brief."""

    def __init__(self, test_client: TestClient):
        self._client = test_client

    def send(self, url: str, payload: dict, headers: dict | None = None) -> bool:
        response = self._client.post(url, json=payload, headers=headers)
        return response.status_code < 300


def test_demo_receiver_holds_deposit_after_receiving_the_real_webhook(monkeypatch):
    """End-to-end: register the demo receiver as a real subscriber (its webhook_url points
    back at this same running app), flag a wallet, and confirm the demo receiver's
    screening view shows the deposit auto-held after the real webhook round-trip."""
    original = distribution.deliver_webhooks  # see _mock_webhook_delivery's comment above

    def patched(db, flagged_wallet_id, sender_factory=None):
        return original(
            db, flagged_wallet_id,
            sender_factory=lambda: _TestClientSender(client),
        )

    monkeypatch.setattr(distribution, "deliver_webhooks", patched)

    address = "TDemoHeldAAAAAAAAAAAAAAAAAAAAAAAAAA"

    subscribed = client.post("/api/v1/demo-vasp/subscribe",
                              json={"webhookBaseUrl": "http://testserver"})
    assert subscribed.status_code == 200
    assert subscribed.json()["simulated"] is True

    not_yet = client.get(f"/api/v1/demo-vasp/screening/tron/{address}")
    assert not_yet.status_code == 200
    assert not_yet.json()["held"] is False
    assert not_yet.json()["simulated"] is True

    flagged = client.post("/api/v1/vasp-feed/flag", json=_flag_payload(address=address))
    assert flagged.json()["flagged"] is True

    held = client.get(f"/api/v1/demo-vasp/screening/tron/{address}")
    assert held.status_code == 200
    body = held.json()
    assert body["held"] is True
    assert body["simulated"] is True
    assert "FLAGGED_WALLET_FEED_MATCH" in body["reasonCodes"]
    assert "SIMULATED" in body["exchangeName"].upper()


# --- VASP wallet-sharing portal (Feature 2) ---

TEST_JWT_SECRET = "kaizen-test-shared-secret-vasp-portal"


def _officer_token(secret: str = TEST_JWT_SECRET, expires_delta: timedelta = timedelta(minutes=30)) -> str:
    payload = {
        "user_id": "officer-1",
        "tenant_id": "kaizen",
        "email": "officer@example.com",
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _create_portal_subscriber(name="Portal VASP", email="portal@example.test"):
    resp = client.post("/api/v1/vasp-feed/subscribers", json={"name": name, "email": email})
    assert resp.status_code == 201
    return resp.json()


def _flag_a_wallet(monkeypatch, address, chain="tron", case_id="case-portal"):
    _mock_webhook_delivery(monkeypatch, lambda r: httpx.Response(200, json={}))
    resp = client.post("/api/v1/vasp-feed/flag", json=_flag_payload(case_id=case_id, address=address, chain=chain))
    assert resp.json()["flagged"] is True


def test_create_subscriber_without_webhook_gets_email_and_access_token():
    sub = _create_portal_subscriber()
    assert sub["webhookUrl"] is None
    assert sub["email"] == "portal@example.test"
    assert sub["accessToken"]
    assert len(sub["accessToken"]) > 20


def test_portal_returns_only_safe_fields_for_a_valid_token(monkeypatch):
    sub = _create_portal_subscriber(name="Portal VASP Safe Fields")
    address = "TPortalSafeAAAAAAAAAAAAAAAAAAAAAAA"
    _flag_a_wallet(monkeypatch, address, case_id="case-portal-safe")

    resp = client.get(f"/api/v1/vasp-feed/portal/{sub['accessToken']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["subscriberName"] == "Portal VASP Safe Fields"
    wallet = next(w for w in body["wallets"] if w["address"] == address)
    assert set(wallet.keys()) == {"id", "address", "chain", "riskScore", "flaggedAt"}
    assert wallet["chain"] == "tron"
    assert wallet["riskScore"] == 1.0


def test_portal_unknown_token_is_404():
    resp = client.get("/api/v1/vasp-feed/portal/not-a-real-token-at-all")
    assert resp.status_code == 404


def test_portal_inactive_subscriber_token_is_404():
    sub = _create_portal_subscriber(name="Deactivated VASP", email="deactivated@example.test")
    # No API to deactivate a subscriber exists yet -- flip it directly via a fresh session
    # bound to the SAME in-memory engine this module's override uses.
    with TestSession() as session:
        from app.models import VaspSubscriber
        row = session.get(VaspSubscriber, sub["id"])
        row.active = False
        session.add(row)
        session.commit()

    resp = client.get(f"/api/v1/vasp-feed/portal/{sub['accessToken']}")
    assert resp.status_code == 404


def test_portal_reply_is_accepted_and_visible_only_via_internal_replies_endpoint(monkeypatch):
    sub = _create_portal_subscriber(name="Replying VASP", email="replying@example.test")
    address = "TPortalReplyAAAAAAAAAAAAAAAAAAAAAA"
    _flag_a_wallet(monkeypatch, address, case_id="case-portal-reply")

    portal = client.get(f"/api/v1/vasp-feed/portal/{sub['accessToken']}")
    wallet_id = next(w["id"] for w in portal.json()["wallets"] if w["address"] == address)

    reply = client.post(f"/api/v1/vasp-feed/portal/{sub['accessToken']}/reply",
                         json={"flaggedWalletId": wallet_id, "message": "Funds frozen, LEA can file a request."})
    assert reply.status_code == 201
    assert reply.json()["subscriberName"] == "Replying VASP"

    # Never visible via a 401/anonymous read of the internal endpoint...
    anon = client.get("/api/v1/vasp-feed/replies")
    assert anon.status_code == 401

    # ...only visible to a logged-in officer. `/replies` is now gated on the resolved KAIZEN
    # role (`require_role("officer")`), not just a valid JWT (Task 6), so the officer's email
    # must have an `officer` UserRole row -- otherwise `resolve_role` would auto-create it as
    # the "citizen" default and this would 403.
    with TestSession() as session:
        from app.models import UserRole
        if session.query(UserRole).filter_by(email="officer@example.com").one_or_none() is None:
            session.add(UserRole(email="officer@example.com", role="officer"))
            session.commit()

    with patch("app.auth.jwt.settings.auth_jwt_secret", TEST_JWT_SECRET):
        token = _officer_token()
        seen = client.get("/api/v1/vasp-feed/replies", headers={"Authorization": f"Bearer {token}"})
    assert seen.status_code == 200
    matching = [r for r in seen.json() if r["flaggedWalletId"] == wallet_id]
    assert len(matching) == 1
    assert matching[0]["message"] == "Funds frozen, LEA can file a request."
    assert matching[0]["subscriberEmail"] == "replying@example.test"


def test_portal_reply_rejected_for_a_wallet_outside_the_tokens_scope(monkeypatch):
    """Every active subscriber currently sees every flagged wallet (Task H2 has no
    per-subscriber segmentation -- see `_wallets_visible_to`'s own docstring), so scope in
    THIS codebase means "some flagged wallet exists at all". A non-existent wallet id is
    exactly the out-of-scope case this reply endpoint must reject with a 404, not a 403."""
    sub = _create_portal_subscriber(name="Scoped VASP", email="scoped@example.test")
    resp = client.post(f"/api/v1/vasp-feed/portal/{sub['accessToken']}/reply",
                        json={"flaggedWalletId": 999999, "message": "should not be accepted"})
    assert resp.status_code == 404


def test_portal_reply_rejected_for_unknown_token():
    resp = client.post("/api/v1/vasp-feed/portal/not-a-real-token/reply",
                        json={"flaggedWalletId": 1, "message": "x"})
    assert resp.status_code == 404


def test_replies_endpoint_requires_a_valid_officer_jwt():
    # No header at all.
    assert client.get("/api/v1/vasp-feed/replies").status_code == 401
    # Garbage bearer token.
    assert client.get("/api/v1/vasp-feed/replies",
                       headers={"Authorization": "Bearer not-a-real-jwt"}).status_code == 401


def test_webhook_subscriber_still_works_unchanged_alongside_portal_fields(monkeypatch):
    """Existing webhook-only subscribers (Task H2) must not break now that email/accessToken
    exist -- webhookUrl is still required to actually receive pushes, and delivery still
    reaches them exactly as before."""
    received = []

    def handler(request: httpx.Request) -> httpx.Response:
        received.append(request)
        return httpx.Response(200, json={"ok": True})

    _mock_webhook_delivery(monkeypatch, handler)
    sub = client.post("/api/v1/vasp-feed/subscribers",
                       json={"name": "Still Webhook VASP", "webhookUrl": "https://still-webhook.example.test/hook"})
    assert sub.status_code == 201
    assert sub.json()["accessToken"]

    resp = client.post("/api/v1/vasp-feed/flag",
                        json=_flag_payload(case_id="case-still-webhook",
                                            address="TStillWebhookAAAAAAAAAAAAAAAAAAAAA"))
    assert resp.json()["flagged"] is True
    assert any(str(r.url) == "https://still-webhook.example.test/hook" for r in received)


def test_portal_only_subscriber_does_not_break_webhook_delivery_to_others(monkeypatch):
    """A portal-only subscriber (no webhookUrl) must be silently skipped by
    `distribution.deliver_webhooks`, not crash delivery to every other active subscriber."""
    received = []

    def handler(request: httpx.Request) -> httpx.Response:
        received.append(request)
        return httpx.Response(200, json={"ok": True})

    _mock_webhook_delivery(monkeypatch, handler)
    _create_portal_subscriber(name="No Webhook VASP", email="nowebhook@example.test")
    client.post("/api/v1/vasp-feed/subscribers",
                json={"name": "Real Webhook VASP", "webhookUrl": "https://real-webhook.example.test/hook"})

    resp = client.post("/api/v1/vasp-feed/flag",
                        json=_flag_payload(case_id="case-mixed-subs",
                                            address="TMixedSubsAAAAAAAAAAAAAAAAAAAAAAAAA"))
    assert resp.json()["flagged"] is True
    assert any(str(r.url) == "https://real-webhook.example.test/hook" for r in received)
