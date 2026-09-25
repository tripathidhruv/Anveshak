from app.chains.base import Chain, ChainClient
from app.chains.http_client import AdaptiveHttpClient
from app.chains.tron import TronChainClient
from app.chains.evm import EvmChainClient
from app.chains.bitcoin import BitcoinChainClient
from app.config import settings

_shared_http = AdaptiveHttpClient(min_interval_seconds=settings.http_min_interval_seconds,
                                   timeout=settings.http_timeout_seconds)

def get_chain_client(chain: Chain) -> ChainClient:
    if chain == "tron":
        return TronChainClient(api_key=settings.trongrid_api_key, http=_shared_http)
    if chain == "ethereum":
        return EvmChainClient(api_key=settings.etherscan_api_key, http=_shared_http)
    if chain == "bitcoin":
        return BitcoinChainClient(http=_shared_http)
    raise ValueError(f"unsupported chain: {chain}")
