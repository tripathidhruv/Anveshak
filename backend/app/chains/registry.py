from app.chains.base import Chain, ChainClient
from app.chains.http_client import AdaptiveHttpClient
from app.chains.known_assets import resolve_asset_contract
from app.chains.tron import TronChainClient
from app.chains.evm import EvmChainClient
from app.chains.bitcoin import BitcoinChainClient
from app.config import settings

_shared_http = AdaptiveHttpClient(min_interval_seconds=settings.http_min_interval_seconds,
                                   timeout=settings.http_timeout_seconds)

def get_chain_client(chain: Chain, asset: str | None = None) -> ChainClient:
    """`asset` is the case's own declared asset display label (`case.asset`, e.g.
    `"USDT (TRC-20)"`) -- resolved through known_assets.resolve_asset_contract and
    passed to the adapter so it filters fetched transfers to that token's real
    contract, not just its spoofable symbol string. Bitcoin has no contract-token
    attack surface, so its client takes no such parameter."""
    if chain == "tron":
        contract = resolve_asset_contract(chain, asset)
        return TronChainClient(api_key=settings.trongrid_api_key, http=_shared_http,
                                asset_contract=contract)
    if chain == "ethereum":
        contract = resolve_asset_contract(chain, asset)
        return EvmChainClient(api_key=settings.etherscan_api_key, http=_shared_http,
                               asset_contract=contract)
    if chain == "bitcoin":
        return BitcoinChainClient(http=_shared_http)
    raise ValueError(f"unsupported chain: {chain}")
