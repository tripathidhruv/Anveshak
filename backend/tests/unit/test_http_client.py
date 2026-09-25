import httpx
import pytest
from app.chains.http_client import AdaptiveHttpClient

def test_honors_retry_after_header():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "0"}, json={})
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    client = AdaptiveHttpClient(transport=transport, min_interval_seconds=0.0)
    resp = client.get("https://example.test/api", params={"a": 1})
    assert resp.status_code == 200
    assert calls["n"] == 2

def test_throttles_consecutive_calls_to_same_host(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    client = AdaptiveHttpClient(transport=transport, min_interval_seconds=0.05)

    # Deterministic clock, no real sleeping: _wait_for_host() calls
    # time.monotonic() once for the first host visit (recording last-call
    # time) and twice for the second (elapsed check, then recording again).
    # We feed it 0.0, then 0.01 twice, i.e. "10ms have passed" when the
    # second call checks in, so it must request a sleep of 0.05 - 0.01 =
    # 0.04s to fill out the minimum interval. Mocking both time.monotonic
    # and time.sleep means the assertion depends on the throttling math
    # alone, not on wall-clock timing or OS timer/scheduler jitter.
    clock = iter([0.0, 0.01, 0.01])
    monkeypatch.setattr("app.chains.http_client.time.monotonic", lambda: next(clock))
    sleep_calls = []
    monkeypatch.setattr("app.chains.http_client.time.sleep", sleep_calls.append)

    client.get("https://example.test/a")
    client.get("https://example.test/b")

    assert sleep_calls == [pytest.approx(0.04)]
