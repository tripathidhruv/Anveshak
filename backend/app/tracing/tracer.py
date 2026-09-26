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
    # Per-wallet FIFO fan-out bookkeeping: for each address that has been expanded at least
    # once, how much of EACH of its own causal outgoing transfers (indexed the same as that
    # hop's `outgoing_transfers`) has already been allocated downstream, across every wave
    # (first expansion plus any later merges). This is what lets a later converging arrival
    # re-run the same FIFO allocation for just its own increment without exceeding any single
    # sibling transfer's real on-chain amount.
    allocated_per_address: dict[str, list[Decimal]] = {}

    while queue:
        address, taint, since_ts, hop_index, funding_transfer = queue.popleft()
        if address in visited:
            # A second (or later) causal branch has converged on a wallet we already fully
            # expanded once. Don't re-fetch its outgoing edges again (that would double-count
            # whatever it already forwarded downstream in its first expansion) — but don't
            # silently drop this arrival's taint either, or a hub that consolidates multiple
            # victims'/branches' funds would under-report exactly the value this project's
            # "Consolidation" thesis is built on. Fold the newly-arrived taint into the
            # existing hop for this wallet in place (there is exactly one, since `visited`
            # guarantees a wallet is only ever appended to `result.hops` once).
            existing_hop = next((h for h in result.hops if h.wallet_address == address), None)
            if existing_hop is not None:
                existing_hop.taint += taint
                # Re-run this wallet's own FIFO fan-out, but only for the taint that JUST
                # arrived — its children were already enqueued once, using only the first
                # arrival's (smaller) budget, and that budget never gets a path forward
                # otherwise. Reuse the already-known causal outgoing-transfer list from the
                # first expansion rather than refetching. If any resulting child is itself
                # already visited, it goes right back through this same branch on its next
                # pop, so the re-emission cascades through the whole subgraph on its own.
                per_transfer_allocated = allocated_per_address.get(address)
                if per_transfer_allocated is not None:
                    remaining_budget = taint
                    for i, t in enumerate(existing_hop.outgoing_transfers):
                        capacity = t.amount - per_transfer_allocated[i]
                        next_taint = min(remaining_budget, capacity)
                        remaining_budget -= next_taint
                        per_transfer_allocated[i] += next_taint
                        queue.append((t.to_address, next_taint, t.timestamp,
                                      existing_hop.hop_index + 1, t))
            continue
        visited.add(address)

        if hop_index >= max_hops:
            result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                         [], taint, "hop_cap_reached"))
            continue

        try:
            # Single unscoped fetch per hop: none of the current adapters (tron/evm/bitcoin)
            # support genuine server-side time-window filtering — each one fetches an unscoped
            # page and applies `since` as a client-side post-filter — so scoping this call
            # client-side vs. server-side makes no difference to what's actually fetched over
            # the network. If a future adapter adds real server-side windowing, revisit this.
            transfers = chain_client.get_transfers(address)
        except Exception:
            result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                         [], taint, "api_read_failure"))
            continue

        causal = [t for t in transfers if t.from_address == address and t.timestamp >= since_ts]

        if not causal:
            # Distinguish "never had outgoing activity" from "had outgoing activity, but all of
            # it predates the funding transfer" — both derived from the same fetch above.
            any_outgoing = any(t.from_address == address for t in transfers)
            stop_reason = "no_further_transfers" if any_outgoing else "no_outgoing_activity"
            result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                         [], taint, stop_reason))
            continue

        result.hops.append(TraceHop(hop_index, address, chain_client.chain, funding_transfer,
                                     causal, taint, None))
        # Allocate the wallet's taint budget FIFO across sibling causal transfers (they are
        # already timestamp-ordered) rather than letting each branch independently claim up to
        # the full inherited taint — otherwise summed downstream taint can exceed what the
        # wallet actually held and the victim actually reported.
        remaining_budget = taint
        per_transfer_allocated = []
        for t in causal:
            next_taint = min(remaining_budget, t.amount)
            remaining_budget -= next_taint
            per_transfer_allocated.append(next_taint)
            queue.append((t.to_address, next_taint, t.timestamp, hop_index + 1, t))
        allocated_per_address[address] = per_transfer_allocated

    return result
