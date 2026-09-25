from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.chains.http_client import AdaptiveHttpClient

ETHERSCAN_BASE = "https://api.etherscan.io/api"

class EvmChainClient:
    chain = "ethereum"

    def __init__(self, api_key: str | None = None, http: AdaptiveHttpClient | None = None):
        self._api_key = api_key
        self._http = http or AdaptiveHttpClient()

    def get_transfers(self, address: str, since: datetime | None = None) -> list[Transfer]:
        response = self._http.get(
            ETHERSCAN_BASE,
            params={
                "module": "account",
                "action": "tokentx",
                "address": address,
                "sort": "asc",
                "apikey": self._api_key or "",
            },
        )
        response.raise_for_status()
        body = response.json()
        records = body.get("result", []) if body.get("status") == "1" else []
        transfers = [self._normalize(record) for record in records]
        if since is not None:
            transfers = [t for t in transfers if t.timestamp >= since]
        return sorted(transfers, key=lambda t: t.timestamp)

    @staticmethod
    def _normalize(record: dict) -> Transfer:
        tx_hash = record.get("hash", "<unknown>")
        try:
            # Etherscan doesn't always echo decimals; USDT-ERC20 (this adapter's
            # primary target asset) is always 6 decimals, same as USDT-TRC20,
            # so that's a safe default even though most other ERC-20 tokens use 18.
            decimals = int(record.get("tokenDecimal", 6))
            symbol = record.get("tokenSymbol", "UNKNOWN")
            return Transfer(
                tx_hash=record["hash"],
                chain="ethereum",
                from_address=record["from"],
                to_address=record["to"],
                amount=Decimal(record["value"]) / (Decimal(10) ** decimals),
                asset=f"{symbol}-ERC20",
                timestamp=datetime.fromtimestamp(int(record["timeStamp"]), tz=timezone.utc),
                fee=Decimal("0"),
                raw=record,
            )
        except (KeyError, TypeError, AttributeError) as exc:
            raise ValueError(
                f"Malformed Etherscan ERC-20 record (hash={tx_hash}): {exc!r}"
            ) from exc
