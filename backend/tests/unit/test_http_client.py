import time
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

def test_throttles_consecutive_calls_to_same_host():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    client = AdaptiveHttpClient(transport=transport, min_interval_seconds=0.05)
    start = time.monotonic()
    client.get("https://example.test/a")
    client.get("https://example.test/b")
    elapsed = time.monotonic() - start
    # 10ms tolerance: Windows' default timer/sleep granularity (~15.6ms) means
    # time.sleep(0.05) can return a couple ms early; this isn't a throttle bug.
    assert elapsed >= 0.05 - 0.01
