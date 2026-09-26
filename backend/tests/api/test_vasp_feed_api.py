import httpx
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
