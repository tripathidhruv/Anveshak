import time
from urllib.parse import urlparse
import httpx

class AdaptiveHttpClient:
    """Wraps httpx with a per-host minimum interval (adaptive pacing) and
    Retry-After-honoring retry on 429. One instance per process is fine —
    chain adapters share it via chains/registry.py."""

    def __init__(self, transport: httpx.BaseTransport | None = None,
                 min_interval_seconds: float = 0.34, timeout: float = 10.0, max_retries: int = 3):
        self._client = httpx.Client(transport=transport, timeout=timeout)
        self._min_interval = min_interval_seconds
        self._max_retries = max_retries
        self._last_call_at: dict[str, float] = {}

    def _wait_for_host(self, host: str) -> None:
        last = self._last_call_at.get(host)
        if last is not None:
            elapsed = time.monotonic() - last
            remaining = self._min_interval - elapsed
            if remaining > 0:
                time.sleep(remaining)
        self._last_call_at[host] = time.monotonic()

    def get(self, url: str, params: dict | None = None, headers: dict | None = None) -> httpx.Response:
        host = urlparse(url).netloc
        attempt = 0
        while True:
            self._wait_for_host(host)
            response = self._client.get(url, params=params, headers=headers)
            if response.status_code != 429 or attempt >= self._max_retries:
                return response
            retry_after = float(response.headers.get("Retry-After", "1"))
            time.sleep(max(retry_after, 0.0))
            attempt += 1
