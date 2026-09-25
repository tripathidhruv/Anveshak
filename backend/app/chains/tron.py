from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.chains.http_client import AdaptiveHttpClient

TRONGRID_BASE = "https://api.trongrid.io"

class TronChainClient:
    chain = "tron"

    def __init__(self, api_key: str | None = None, http: AdaptiveHttpClient | None = None):
        self._api_key = api_key
        self._http = http or AdaptiveHttpClient()

    def get_transfers(self, address: str, since: datetime | None = None) -> list[Transfer]:
        headers = {"TRON-PRO-API-KEY": self._api_key} if self._api_key else None
        response = self._http.get(
            f"{TRONGRID_BASE}/v1/accounts/{address}/transactions/trc20",
            params={"limit": 200, "only_confirmed": "true", "order_by": "block_timestamp,asc"},
            headers=headers,
        )
        response.raise_for_status()
        records = response.json().get("data", [])
        transfers = [self._normalize(record) for record in records]
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
