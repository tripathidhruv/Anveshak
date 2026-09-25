from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from app.chains.base import ChainClient

@dataclass(frozen=True)
class UnreportedVictimCandidate:
    payer_address: str
    chain: str
    total_amount: Decimal
    transfer_count: int
    first_seen_at: datetime

def enumerate_unreported_victims(chain_client: ChainClient, consolidation_wallet: str,
                                  known_victim_addresses: set[str]) -> list[UnreportedVictimCandidate]:
    """Everyone traces forward, following the money out. This traces backward: a wallet that
    took in complaints from N known victims almost certainly took in money from other victims
    who haven't complained yet — they're already visible on the public blockchain, we just
    have to look at the hub's inbound edges instead of its outbound ones."""
    inbound = [t for t in chain_client.get_transfers(consolidation_wallet) if t.to_address == consolidation_wallet]
    others = [t for t in inbound if t.from_address not in known_victim_addresses
              and t.from_address != consolidation_wallet]

    grouped: dict[str, list] = {}
    for t in others:
        grouped.setdefault(t.from_address, []).append(t)

    return [
        UnreportedVictimCandidate(
            payer_address=payer,
            chain=chain_client.chain,
            total_amount=sum((t.amount for t in txs), Decimal("0")),
            transfer_count=len(txs),
            first_seen_at=min(t.timestamp for t in txs),
        )
        for payer, txs in grouped.items()
    ]
