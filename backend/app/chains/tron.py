from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.chains.http_client import AdaptiveHttpClient

TRONGRID_BASE = "https://api.trongrid.io"

# TronGrid caps `limit` at 200/page. A generous but bounded page cap avoids an
# unbounded loop against a wallet with years of history while still covering
# any realistic case wallet (10 * 200 = 2000 records).
MAX_PAGES = 10

class TronChainClient:
    chain = "tron"

    def __init__(self, api_key: str | None = None, http: AdaptiveHttpClient | None = None,
                 asset_contract: str | None = None):
        self._api_key = api_key
        self._http = http or AdaptiveHttpClient()
        # When set, filters results to only the token whose contract this is. This is
        # the case's own declared asset resolved through
        # app.chains.known_assets.resolve_asset_contract -- filtering by contract
        # address (not the `symbol` string) is what actually resists a spoofed spam
        # token claiming to be "USDT". None means no filter -- unchanged behavior.
        self._asset_contract = asset_contract

    def get_transfers(self, address: str, since: datetime | None = None) -> list[Transfer]:
        headers = {"TRON-PRO-API-KEY": self._api_key} if self._api_key else None
        records: list[dict] = []
        fingerprint: str | None = None
        # TronGrid's real API (verified via its own docs) supports server-side time-window
        # filtering on this endpoint via `min_timestamp`/`max_timestamp` (epoch milliseconds,
        # aliases `min_block_timestamp`/`max_block_timestamp`) -- Task F7's own researched
        # claim that no such parameter exists was factually wrong. Passing `min_timestamp`
        # here bounds what the server returns in the first place, so the MAX_PAGES cap below
        # is far less likely to truncate before reaching genuinely relevant records for a
        # busy wallet. This does not replace pagination -- a busy wallet can still span many
        # pages even within a time window -- so the existing fingerprint-cursor loop is kept
        # as-is, just with a narrower server-side range to walk.
        min_timestamp = int(since.timestamp() * 1000) if since is not None else None
        for _ in range(MAX_PAGES):
            params = {"limit": 200, "only_confirmed": "true", "order_by": "block_timestamp,asc"}
            if min_timestamp is not None:
                params["min_timestamp"] = min_timestamp
            if fingerprint:
                params["fingerprint"] = fingerprint
            response = self._http.get(
                f"{TRONGRID_BASE}/v1/accounts/{address}/transactions/trc20",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            body = response.json()
            page = body.get("data", [])
            if not page:
                break
            records.extend(page)
            # NOTE on `since`: we deliberately do NOT early-stop pagination based on `since`
            # here, even though `min_timestamp` above already asks the server to only return
            # records at or after `since`. This request is ordered ascending
            # (order_by=block_timestamp,asc), so page 1 is the OLDEST matching record and the
            # fingerprint cursor only walks forward in that same direction -- there is no
            # later page to "jump to," and there is no guarantee the server actually honored
            # `min_timestamp` correctly (hence the client-side `since` backstop filter below
            # too -- trust but verify). The only safe termination signals remain "no more
            # fingerprint" / "empty page" / the page cap below.
            fingerprint = (body.get("meta") or {}).get("fingerprint")
            if not fingerprint:
                break
        transfers = [self._normalize(record) for record in records]
        if self._asset_contract is not None:
            transfers = [
                t for t in transfers
                if t.raw.get("token_info", {}).get("address") == self._asset_contract
            ]
        if since is not None:
            transfers = [t for t in transfers if t.timestamp >= since]
        return sorted(transfers, key=lambda t: t.timestamp)

    @staticmethod
    def _normalize(record: dict) -> Transfer:
        tx_id = record.get("transaction_id", "<unknown>")
        try:
            # TronGrid doesn't always echo decimals; USDT-TRC20 (this adapter's
            # primary target asset) is always 6 decimals, so that's a safe default
            # even though it's not universally true for every TRC-20 token.
            decimals = record["token_info"].get("decimals", 6)
            symbol = record["token_info"].get("symbol", "UNKNOWN")
            return Transfer(
                tx_hash=record["transaction_id"],
                chain="tron",
                from_address=record["from"],
                to_address=record["to"],
                amount=Decimal(record["value"]) / (Decimal(10) ** decimals),
                asset=f"{symbol}-TRC20",
                timestamp=datetime.fromtimestamp(record["block_timestamp"] / 1000, tz=timezone.utc),
                fee=Decimal("0"),
                raw=record,
            )
        except (KeyError, TypeError, AttributeError) as exc:
            raise ValueError(
                f"Malformed TronGrid TRC-20 record (transaction_id={tx_id}): {exc!r}"
            ) from exc
