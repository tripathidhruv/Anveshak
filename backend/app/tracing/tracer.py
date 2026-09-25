from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from app.chains.base import ChainClient, Transfer

@dataclass
class TraceHop:
    hop_index: int
    wallet_address: str
    chain: str
    funding_transfer: Transfer | None   # the inbound transfer that funded this hop (None at hop 0)
    outgoing_transfers: list[Transfer]  # causal outgoing transfers followed from this wallet
    taint: Decimal                      # victim-reported-amount-capped value attributed here
    stop_reason: str | None

@dataclass
class TraceResult:
    hops: list[TraceHop] = field(default_factory=list)

    @property
    def terminal_hops(self) -> list[TraceHop]:
        return [h for h in self.hops if h.stop_reason is not None]

def trace(chain_client: ChainClient, start_address: str, reported_amount: Decimal,
          start_time: datetime, max_hops: int = 6) -> TraceResult:
    """Causal FIFO trace: only follows an outgoing transfer if it happened at/after the
    transfer that funded the wallet holding it (time-monotonic). Taint is capped at the
    victim's reported amount, never the wallet's total outflow, per the correctness-guard
    checklist in docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md."""
    result = TraceResult()
    visited: set[str] = set()
    queue: deque[tuple[str, Decimal, datetime, int, Transfer | None]] = deque()
    queue.append((start_address, reported_amount, start_time, 0, None))

    while queue:
        address, taint, since_ts, hop_index, funding_transfer = queue.popleft()
        if address in visited:
            continue
        visited.add(address)

        if hop_index >= max_hops:
            result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                         [], taint, "hop_cap_reached"))
            continue

        try:
            all_outgoing = [t for t in chain_client.get_transfers(address) if t.from_address == address]
        except Exception:
            result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                         [], taint, "api_read_failure"))
            continue

        causal = [t for t in all_outgoing if t.timestamp >= since_ts]

        if not causal:
            stop_reason = "no_outgoing_activity" if not all_outgoing else "no_further_transfers"
            result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                         [], taint, stop_reason))
            continue

        result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                     causal, taint, None))
        for t in causal:
            next_taint = min(taint, t.amount)
            queue.append((t.to_address, next_taint, t.timestamp, hop_index + 1, t))

    return result
