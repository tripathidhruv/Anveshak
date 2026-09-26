from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Callable
from app.chains.base import ChainClient, Transfer
from app.bridge.linker import BridgeLinkCandidate, find_bridge_links
from app.bridge.registry import is_bridge_contract, MIN_BRIDGE_LINK_CONFIDENCE

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
    # Confirmed cross-chain links this trace actually crossed (Task: cross-chain bridge
    # linking) -- NOT every candidate find_bridge_links() considered, only ones that cleared
    # MIN_BRIDGE_LINK_CONFIDENCE and were actually followed onto the new chain.
    bridge_links: list[BridgeLinkCandidate] = field(default_factory=list)

    @property
    def terminal_hops(self) -> list[TraceHop]:
        return [h for h in self.hops if h.stop_reason is not None]

def trace(chain_client: ChainClient, start_address: str, reported_amount: Decimal,
          start_time: datetime, max_hops: int = 6,
          get_client_for_chain: Callable[[str], ChainClient] | None = None) -> TraceResult:
    """Causal FIFO trace: only follows an outgoing transfer if it happened at/after the
    transfer that funded the wallet holding it (time-monotonic). Taint is capped at the
    victim's reported amount, never the wallet's total outflow, per the correctness-guard
    checklist in docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md.

    `get_client_for_chain`, when provided, enables cross-chain bridge-crossing detection
    (docs/superpowers/specs/2026-09-26-cross-chain-bridge-linking-design.md): when the BFS
    reaches a known bridge contract address (app.bridge.registry.is_bridge_contract), it
    fetches that contract's paired-chain withdrawal history via this factory, correlates via
    find_bridge_links(), and continues the SAME trace onto the linked withdrawal's
    destination on the new chain -- above MIN_BRIDGE_LINK_CONFIDENCE, never below it. When
    `get_client_for_chain` is None (every existing caller before this feature), bridge
    detection is never attempted at all -- behavior is byte-identical to before this change."""
    result = TraceResult()
    visited: set[str] = set()
    # 6-tuple queue: (address, taint, since_ts, hop_index, funding_transfer, active_client).
    # `active_client` is the ChainClient this address's OWN activity should be fetched with --
    # always `chain_client` itself unless a bridge crossing has moved the trace onto a new
    # chain, in which case it's whatever `get_client_for_chain` returned for that chain.
    queue: deque[tuple[str, Decimal, datetime, int, Transfer | None, ChainClient]] = deque()
    queue.append((start_address, reported_amount, start_time, 0, None, chain_client))
    allocated_per_address: dict[str, list[Decimal]] = {}
    # For each wallet that has been expanded, which client its OWN children should use when
    # re-propagated taint arrives later (revisit branch below). Equal to that wallet's own
    # `active_client` for every normal hop (children stay on the same chain); equal to the
    # PAIRED chain's client only for a confirmed bridge-crossing hop (its one synthetic child
    # genuinely lives on the other chain).
    client_for_children: dict[str, ChainClient] = {}

    while queue:
        address, taint, since_ts, hop_index, funding_transfer, active_client = queue.popleft()
        if address in visited:
            existing_hop = next((h for h in result.hops if h.wallet_address == address), None)
            if existing_hop is not None:
                existing_hop.taint += taint
                per_transfer_allocated = allocated_per_address.get(address)
                child_client = client_for_children.get(address, active_client)
                if per_transfer_allocated is not None:
                    remaining_budget = taint
                    for i, t in enumerate(existing_hop.outgoing_transfers):
                        capacity = t.amount - per_transfer_allocated[i]
                        next_taint = min(remaining_budget, capacity)
                        remaining_budget -= next_taint
                        per_transfer_allocated[i] += next_taint
                        queue.append((t.to_address, next_taint, t.timestamp,
                                      existing_hop.hop_index + 1, t, child_client))
            continue
        visited.add(address)

        if hop_index >= max_hops:
            result.hops.append(TraceHop(hop_index, address, active_client.chain, funding_transfer,
                                         [], taint, "hop_cap_reached"))
            continue

        bridge = is_bridge_contract(address, active_client.chain) if get_client_for_chain else None
        if bridge is not None:
            other_client = None
            withdrawal = None
            link = None
            if funding_transfer is not None:
                try:
                    other_client = get_client_for_chain(bridge.paired_chain)
                    candidate_withdrawals = other_client.get_transfers(
                        bridge.paired_contract_address, since=funding_transfer.timestamp)
                except Exception:
                    other_client = None
                    candidate_withdrawals = []
                if other_client is not None:
                    links = find_bridge_links([funding_transfer], candidate_withdrawals)
                    if links and links[0].confidence >= MIN_BRIDGE_LINK_CONFIDENCE:
                        link = links[0]
                        withdrawal = next(t for t in candidate_withdrawals
                                           if t.tx_hash == link.side_b_tx_hash)

            if link is None or withdrawal is None:
                result.hops.append(TraceHop(hop_index, address, active_client.chain, funding_transfer,
                                             [], taint, "bridge_crossing_unconfirmed"))
                continue

            result.bridge_links.append(link)
            result.hops.append(TraceHop(hop_index, address, active_client.chain, funding_transfer,
                                         [withdrawal], taint, None))
            # Bridge fee-adjusted: the withdrawal is already <= the deposit that funded it
            # (find_bridge_links' own invariant -- "a bridge withdrawal can't exceed the
            # deposit"), so this is never re-inflated back to the pre-crossing taint.
            child_taint = min(taint, withdrawal.amount)
            client_for_children[address] = other_client
            allocated_per_address[address] = [child_taint]
            queue.append((withdrawal.to_address, child_taint, withdrawal.timestamp,
                          hop_index + 1, withdrawal, other_client))
            continue

        try:
            # Deliberately NOT passing `since` here (unlike the bridge-withdrawal lookup
            # above): the `any_outgoing` check just below needs to see transfers that
            # predate `since_ts` too, to distinguish "no_further_transfers" (had outgoing
            # activity, all of it stale) from "no_outgoing_activity" (none at all) -- a
            # server-side `since` filter would hide exactly the transfers that check needs.
            # This matches the pre-existing behavior test_tracer_causality.py locks in.
            transfers = active_client.get_transfers(address)
        except Exception:
            result.hops.append(TraceHop(hop_index, address, active_client.chain, funding_transfer,
                                         [], taint, "api_read_failure"))
            continue

        causal = [t for t in transfers if t.from_address == address and t.timestamp >= since_ts]

        if not causal:
            any_outgoing = any(t.from_address == address for t in transfers)
            stop_reason = "no_further_transfers" if any_outgoing else "no_outgoing_activity"
            result.hops.append(TraceHop(hop_index, address, active_client.chain, funding_transfer,
                                         [], taint, stop_reason))
            continue

        result.hops.append(TraceHop(hop_index, address, active_client.chain, funding_transfer,
                                     causal, taint, None))
        remaining_budget = taint
        per_transfer_allocated = []
        client_for_children[address] = active_client
        for t in causal:
            next_taint = min(remaining_budget, t.amount)
            remaining_budget -= next_taint
            per_transfer_allocated.append(next_taint)
            queue.append((t.to_address, next_taint, t.timestamp, hop_index + 1, t, active_client))
        allocated_per_address[address] = per_transfer_allocated

    return result
