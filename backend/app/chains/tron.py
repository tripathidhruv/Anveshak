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
        for _ in range(MAX_PAGES):
            params = {"limit": 200, "only_confirmed": "true", "order_by": "block_timestamp,asc"}
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
            # NOTE on `since`: we deliberately do NOT early-stop based on `since` here.
            # This request is ordered ascending (order_by=block_timestamp,asc), so page 1
            # is the OLDEST records and the fingerprint cursor only walks forward in that
            # same direction — there is no way to jump straight to the records near `since`.
            # Since `since` is a MINIMUM bound, every page from the one that first crosses
            # it onward contains wanted (newer) records, so stopping early on `since` would
            # mean skipping genuine history rather than skipping to it. The only safe
            # termination signals are "no more fingerprint" / "empty page" / the page cap
            # below.
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
