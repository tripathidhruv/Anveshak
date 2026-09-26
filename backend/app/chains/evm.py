from datetime import datetime, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.chains.http_client import AdaptiveHttpClient
from app.chains.known_assets import AssetContractResolution

# Etherscan API V1 (api.etherscan.io/api) was fully deprecated on 15 Aug 2025 and no
# longer responds; all requests must go through V2, which is multichain and requires
# an explicit `chainid` per request. Verified 2026-09-26 via Etherscan's own migration
# notice (info.etherscan.com/etherscan-api-v1-will-be-fully-deprecated-by-15th-august-2025)
# and docs.etherscan.io/v2-migration.
ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
ETHERSCAN_MAINNET_CHAIN_ID = "1"

# Etherscan's own convention for a genuine "no activity" response (confirmed against
# Etherscan's API docs/examples): status "0" paired with this exact message,
# case-insensitively. Any other status != "1" (e.g. "NOTOK", a rate-limit message, an
# invalid-API-key message) is a real failure and must not be treated the same way.
_NO_ACTIVITY_MESSAGE = "no transactions found"

# Native ETH has a fixed 18 decimals, unlike ERC-20 tokens whose decimals vary and are
# read from each record.
_NATIVE_ETH_DECIMALS = 18


class EvmChainClient:
    chain = "ethereum"

    def __init__(self, api_key: str | None = None, http: AdaptiveHttpClient | None = None,
                 asset_filter: AssetContractResolution | None = None):
        self._api_key = api_key
        self._http = http or AdaptiveHttpClient()
        # Resolved via app.chains.known_assets.resolve_asset_contract for the case's own
        # declared asset. Governs how `tokentx` (ERC-20) and `txlist` (native ETH)
        # results are combined -- see AssetContractKind in known_assets.py:
        #   "native"   -- exclude ALL token-contract transfers; this trace is about the
        #                  native coin specifically.
        #   "contract" -- filter token transfers to this exact contract address (defeats
        #                  a spoofed spam token sharing the same symbol) AND exclude
        #                  native-ETH transfers entirely; the declared asset is a token,
        #                  never the native coin.
        #   "unknown"  -- no filter, current permissive merge-both behavior (default,
        #                  also used when no asset_filter is given at all).
        self._asset_filter = asset_filter or AssetContractResolution(kind="unknown")

    def get_transfers(self, address: str, since: datetime | None = None) -> list[Transfer]:
        kind = self._asset_filter.kind
        token_records = self._fetch("tokentx", address)
        native_records = self._fetch("txlist", address)

        if kind == "native":
            # The declared asset is native ETH -- every ERC-20 token transfer (genuine
            # or spam) must be excluded, never merged in alongside native transfers.
            token_transfers: list[Transfer] = []
        else:
            token_transfers = [self._normalize(record) for record in token_records]
            if kind == "contract":
                wanted = self._asset_filter.contract.lower()
                token_transfers = [
                    t for t in token_transfers
                    if str(t.raw.get("contractAddress", "")).lower() == wanted
                ]
            # kind == "unknown": no filter, all parsed token transfers pass through.

        if kind == "contract":
            # The declared asset is a specific ERC-20 token -- native ETH is never the
            # declared asset in that case, so exclude it entirely rather than mixing it
            # into the same transfer list.
            native_transfers: list[Transfer] = []
        else:
            native_transfers = [
                self._normalize_native(record)
                for record in native_records
                # A reverted transaction still appears in txlist with its intended value,
                # but no ETH actually moved — including it would fabricate a transfer.
                if record.get("isError", "0") == "0"
            ]

        transfers = token_transfers + native_transfers
        if since is not None:
            transfers = [t for t in transfers if t.timestamp >= since]
        return sorted(transfers, key=lambda t: t.timestamp)

    def _fetch(self, action: str, address: str) -> list[dict]:
        response = self._http.get(
            ETHERSCAN_BASE,
            params={
                "chainid": ETHERSCAN_MAINNET_CHAIN_ID,
                "module": "account",
                "action": action,
                "address": address,
                "sort": "asc",
                "apikey": self._api_key or "",
            },
        )
        response.raise_for_status()
        body = response.json()
        status = body.get("status")
        if status == "1":
            return body.get("result", [])
        message = str(body.get("message", ""))
        if message.strip().lower() == _NO_ACTIVITY_MESSAGE:
            # Genuinely empty history — not an error.
            return []
        # Any other status != "1" is a real failure (rate limit, bad API key, a
        # deprecated/misconfigured endpoint, etc.) — surface it instead of silently
        # returning an empty result and masking the failure as "no activity."
        raise ValueError(
            f"Etherscan {action} request failed for {address}: "
            f"status={status!r} message={message!r}"
        )

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

    @staticmethod
    def _normalize_native(record: dict) -> Transfer:
        tx_hash = record.get("hash", "<unknown>")
        try:
            gas_used = Decimal(record["gasUsed"])
            gas_price = Decimal(record["gasPrice"])
            fee_wei = gas_used * gas_price
            return Transfer(
                tx_hash=record["hash"],
                chain="ethereum",
                from_address=record["from"],
                to_address=record["to"],
                amount=Decimal(record["value"]) / (Decimal(10) ** _NATIVE_ETH_DECIMALS),
                asset="ETH",
                timestamp=datetime.fromtimestamp(int(record["timeStamp"]), tz=timezone.utc),
                fee=fee_wei / (Decimal(10) ** _NATIVE_ETH_DECIMALS),
                raw=record,
            )
        except (KeyError, TypeError, AttributeError) as exc:
            raise ValueError(
                f"Malformed Etherscan native ETH record (hash={tx_hash}): {exc!r}"
            ) from exc
