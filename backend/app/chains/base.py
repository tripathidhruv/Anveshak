from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol, Literal

Chain = Literal["tron", "ethereum", "bitcoin"]

@dataclass(frozen=True)
class Transfer:
    tx_hash: str
    chain: Chain
    from_address: str
    to_address: str
    amount: Decimal          # human units (e.g. 1500.5 USDT, 0.021 BTC)
    asset: str                # "USDT-TRC20" | "USDT-ERC20" | "ETH" | "BTC"
    timestamp: datetime       # UTC, tz-aware
    fee: Decimal
    raw: dict                 # original API record, for reproducibility

class ChainClient(Protocol):
    chain: Chain
    def get_transfers(self, address: str, since: datetime | None = None) -> list[Transfer]: ...
