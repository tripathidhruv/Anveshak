# Cross-Chain Bridge-Hop Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `find_bridge_links()` (correct in isolation since Task F10, never fired for a real trace) actually detect and follow a real TRON→bridge→Ethereum USDT crossing mid-trace, with no `Case` schema change.

**Architecture:** `tracer.py`'s `trace()` gains an optional `get_client_for_chain` factory parameter (backward compatible — `None` means "exactly today's single-chain behavior, byte-for-byte"). When provided and the BFS pops a known bridge-contract address, it fetches that contract's paired-chain withdrawal history, runs the existing `find_bridge_links()`, and — above a confidence bar — continues the same causal FIFO trace onto the linked withdrawal's destination on the new chain.

**Tech Stack:** Python/FastAPI backend (`backend/app/tracing/tracer.py`, `backend/app/bridge/`, `backend/app/api/v1/traces.py`), no new dependencies.

## Global Constraints

- Every subagent dispatch (implementer and reviewer) MUST use `model="sonnet"`, effort medium or high — never opus, no exceptions, this project's standing rule.
- `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/` must stay green throughout — current baseline before this plan: 251 passed (verify the actual current count at the start of Task 1, since other work may have landed since).
- No `Case` schema change (see the approved design spec, `docs/superpowers/specs/2026-09-26-cross-chain-bridge-linking-design.md`, "Why no Case change").
- Only TRON↔Ethereum, only USDT-TRC20↔USDT-ERC20 — Bitcoin excluded entirely.
- Existing `backend/tests/unit/test_tracer_causality.py` suite must pass **completely unmodified** — this is the acceptance bar proving the new optional parameter is truly backward compatible.
- Real bridge contract addresses must be independently verified from a primary source (a block explorer's own "Verified Contract" page, or an official project GitHub repo's own deployment file) — **not** a documentation site's prose, which this exact planning pass already caught fabricating specific-looking addresses on a 404 page. If genuine independent verification isn't achievable with high confidence, fall back to a clearly fictional bridge name on clearly-synthetic addresses (same convention as this project's `"Meridian Digital Exchange"` — see CLAUDE.md rule 1), documented openly, never presented as real.
- File-scope discipline: each task below lists an exact file scope. Do not touch files outside your task's scope, even to fix something you notice — flag it in your report instead.

---

## File Structure

- `backend/app/bridge/registry.py` (rewrite) — bridge contract registry + `is_bridge_contract()` lookup + `MIN_BRIDGE_LINK_CONFIDENCE` constant.
- `backend/app/bridge/linker.py` (untouched) — `find_bridge_links()` stays exactly as-is; this plan only changes who calls it and with what real data.
- `backend/app/tracing/tracer.py` (rewrite `trace()` internals only; `TraceHop`/`TraceResult` gain one field each) — the actual cross-chain BFS mechanism.
- `backend/app/api/v1/traces.py` (modify `run_trace()` + the `candidates` filter + the `HopOut` role mapping) — wiring + a new "Bridge contract" role string.
- `backend/tests/unit/test_bridge_registry.py` (new) — registry unit tests.
- `backend/tests/unit/test_tracer_bridge_crossing.py` (new) — tracer-level unit tests using synthetic `Transfer`/multi-client fixtures.
- `backend/tests/api/test_traces_api.py` (extend) — one full integration test through the real endpoint.
- `frontend/src/api/mock.ts` (verify only, no plan-mandated change expected — see Task 4).

---

## Task 1: Bridge registry — real pairing + lookup

**Files:**
- Modify: `backend/app/bridge/registry.py` (full rewrite)
- Test: `backend/tests/unit/test_bridge_registry.py` (new)

**Interfaces:**
- Produces: `BridgeContract` dataclass with fields `name: str, chain: str, contract_address: str, source_url: str, paired_chain: str, paired_contract_address: str, paired_asset_label: str`. `is_bridge_contract(address: str, chain: str) -> BridgeContract | None`. `MIN_BRIDGE_LINK_CONFIDENCE: float` constant.

- [ ] **Step 1: Research and verify real bridge contract addresses (or fall back honestly)**

Before writing any code, independently verify a real, currently-operating TRON↔Ethereum USDT bridge's contract addresses on BOTH chains, using at least one of: TronScan's own "Verified Contract" page for the TRON-side address, Etherscan's own "Verified Contract" page for the Ethereum-side address, or the bridge project's own official GitHub repo's deployment-addresses file (not its documentation site's prose — a prior research pass for this exact task hit a doc-site fetch that produced specific-looking addresses on what a sibling fetch of a near-identical URL had just called a 404 page; treat any single prose-page claim of a specific address with that same suspicion until cross-confirmed by a primary source). Allbridge Core is a real, documented candidate (`https://core.allbridge.io`) advertising native TRON↔Ethereum USDT bridging — start there, but only use its addresses if you can actually confirm them on-chain via a block explorer, not from the docs site alone.

If you cannot achieve high-confidence verification within a reasonable effort, use a clearly fictional bridge name (e.g. `"Northbridge Protocol (synthetic, for demo purposes)"`) on clearly-synthetic placeholder addresses, exactly matching this project's existing `"Meridian Digital Exchange"` convention (CLAUDE.md rule 1: never substitute a real exchange/protocol name on fake data). State plainly in your final report which path you took and why — this determines whether the feature detects a real on-chain bridge in live mode, or is a structurally-correct-but-synthetic-address feature (both are acceptable outcomes; silently presenting a guessed address as verified is not).

- [ ] **Step 2: Write the registry**

```python
"""Known bridge contracts for cross-chain fund-flow correlation (real, on-chain addresses
where independently verified -- see this module's own verification note below for which
path was taken). Paired with `app/bridge/linker.py`'s find_bridge_links(), which is the
correlation heuristic itself; this module only says WHERE to look for the other side."""
from dataclasses import dataclass

@dataclass(frozen=True)
class BridgeContract:
    name: str
    chain: str                    # "tron" | "ethereum"
    contract_address: str
    source_url: str
    paired_chain: str              # the chain on the OTHER side of this bridge
    paired_contract_address: str   # that side's own contract address
    paired_asset_label: str        # canonical asset label on the paired chain (known_assets.py
                                    # vocabulary, e.g. "USDT-ERC20") -- passed straight to
                                    # get_chain_client(paired_chain, paired_asset_label)

# <<< IMPLEMENTER: replace with the real, verified addresses from Step 1, or the clearly
# fictional fallback -- see this module's own docstring/comment for which path was taken
# and why. Every entry needs BOTH directions listed explicitly (one entry with chain="tron",
# one with chain="ethereum", each pointing at the other via paired_*) so a lookup from
# either side works without inferring the reverse mapping. >>>
KNOWN_BRIDGES: list[BridgeContract] = [
    # fill in per Step 1's outcome
]

# A confidence bar for treating a find_bridge_links() result as a confirmed crossing to
# continue the trace onto, not just a candidate to note. find_bridge_links's own confidence
# is (time_confidence + amount_confidence) / 2, each already in [0, 1] -- 0.6 means the pair
# is, on average, meaningfully closer to "clearly matching" than "borderline" on both
# dimensions, while still tolerant of realistic bridge latency/fee variance. This is a real,
# adjustable threshold, not a magic number kept only by convention -- revisit if real bridge
# data shows this bar is too strict or too loose.
MIN_BRIDGE_LINK_CONFIDENCE = 0.6

def is_bridge_contract(address: str, chain: str) -> BridgeContract | None:
    """Case-appropriate lookup per chain: TRON (base58) is case-sensitive exact match;
    Ethereum addresses are compared lowercase (Etherscan's own transfer records always come
    back lowercase, matching the normalization already applied at case-creation time in
    app/api/v1/cases.py -- see that file's own comment for why)."""
    for bridge in KNOWN_BRIDGES:
        if bridge.chain != chain:
            continue
        if chain == "ethereum":
            if bridge.contract_address.lower() == address.lower():
                return bridge
        else:
            if bridge.contract_address == address:
                return bridge
    return None
```

Delete the old `bridges_for_chain()` function entirely — it was never called anywhere (confirmed by grep before writing this plan) and is superseded by `is_bridge_contract()`.

- [ ] **Step 3: Write registry tests**

```python
from app.bridge.registry import is_bridge_contract, KNOWN_BRIDGES, MIN_BRIDGE_LINK_CONFIDENCE

def test_known_bridges_list_is_not_empty():
    assert len(KNOWN_BRIDGES) >= 2  # at least one TRON entry, one Ethereum entry

def test_every_bridge_entry_has_a_reverse_pairing():
    # Every entry's (paired_chain, paired_contract_address) must match some OTHER entry's
    # own (chain, contract_address) -- the pairing must be genuinely bidirectional, not a
    # one-way pointer to an address nothing else declares.
    by_chain_and_address = {(b.chain, b.contract_address) for b in KNOWN_BRIDGES}
    for b in KNOWN_BRIDGES:
        assert (b.paired_chain, b.paired_contract_address) in by_chain_and_address

def test_is_bridge_contract_finds_tron_side_exact_case():
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")
    assert is_bridge_contract(tron_bridge.contract_address, "tron") == tron_bridge

def test_is_bridge_contract_tron_is_case_sensitive():
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")
    assert is_bridge_contract(tron_bridge.contract_address.lower(), "tron") is None

def test_is_bridge_contract_finds_ethereum_side_lowercase_normalized():
    eth_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "ethereum")
    assert is_bridge_contract(eth_bridge.contract_address.upper(), "ethereum") == eth_bridge

def test_is_bridge_contract_returns_none_for_unknown_address():
    assert is_bridge_contract("not-a-bridge-address", "tron") is None

def test_is_bridge_contract_respects_chain_even_if_address_reused():
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")
    assert is_bridge_contract(tron_bridge.contract_address, "ethereum") is None

def test_min_bridge_link_confidence_is_a_real_fraction():
    assert 0.0 < MIN_BRIDGE_LINK_CONFIDENCE < 1.0
```

- [ ] **Step 4: Run tests, verify pass**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/unit/test_bridge_registry.py -v` from `backend/`.
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/bridge/registry.py backend/tests/unit/test_bridge_registry.py
git commit -m "feat(backend): real bridge contract registry with explicit chain pairing"
```

---

## Task 2: Tracer — cross-chain BFS mechanism

**Files:**
- Modify: `backend/app/tracing/tracer.py` (full rewrite of `trace()`'s internals; `TraceHop`/`TraceResult` gain one field each)
- Test: `backend/tests/unit/test_tracer_bridge_crossing.py` (new)

**Interfaces:**
- Consumes: `app.bridge.registry.is_bridge_contract(address, chain) -> BridgeContract | None`, `MIN_BRIDGE_LINK_CONFIDENCE: float` (Task 1). `app.bridge.linker.find_bridge_links(side_a, side_b, amount_tolerance_pct=0.03, time_window_minutes=60) -> list[BridgeLinkCandidate]` (existing, untouched).
- Produces: `trace(chain_client: ChainClient, start_address: str, reported_amount: Decimal, start_time: datetime, max_hops: int = 6, get_client_for_chain: Callable[[str], ChainClient] | None = None) -> TraceResult`. `TraceResult.bridge_links: list[BridgeLinkCandidate]` (new field, empty list default). `TraceHop.stop_reason` gains one new possible value: `"bridge_crossing_unconfirmed"`.

**Do NOT change:** the public signature's existing 4 positional/keyword parameters (`chain_client, start_address, reported_amount, start_time`) or `max_hops`'s position/default — every existing caller (traces.py, risk.py, every existing test) must keep working with zero changes when `get_client_for_chain` is omitted.

- [ ] **Step 1: Write the failing tests first**

```python
# backend/tests/unit/test_tracer_bridge_crossing.py
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch
from app.chains.base import Transfer
from app.tracing.tracer import trace
from app.bridge.registry import BridgeContract

T0 = datetime(2026, 1, 1, tzinfo=timezone.utc)

def mk(from_addr, to_addr, amount, ts, chain="tron", asset="USDT-TRC20", tx="tx"):
    return Transfer(tx_hash=tx, chain=chain, from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset=asset, timestamp=ts, fee=Decimal("0"), raw={})

BRIDGE_TRON_SIDE = "TBridgeContractXXXXXXXXXXXXXXXXXXXX"
BRIDGE_ETH_SIDE = "0xbridgecontractyyyyyyyyyyyyyyyyyyyyyyyy"

TEST_BRIDGE = BridgeContract(
    name="Test Bridge", chain="tron", contract_address=BRIDGE_TRON_SIDE,
    source_url="https://example.test", paired_chain="ethereum",
    paired_contract_address=BRIDGE_ETH_SIDE, paired_asset_label="USDT-ERC20",
)

class TronClient:
    chain = "tron"
    def __init__(self, transfers):
        self._transfers = transfers
    def get_transfers(self, address, since=None):
        rows = self._transfers.get(address, [])
        if since is not None:
            rows = [t for t in rows if t.timestamp >= since]
        return sorted(rows, key=lambda t: t.timestamp)

class EthClient:
    chain = "ethereum"
    def __init__(self, transfers):
        self._transfers = transfers
    def get_transfers(self, address, since=None):
        rows = self._transfers.get(address, [])
        if since is not None:
            rows = [t for t in rows if t.timestamp >= since]
        return sorted(rows, key=lambda t: t.timestamp)

def _clients(tron_transfers, eth_transfers):
    tron_client = TronClient(tron_transfers)
    eth_client = EthClient(eth_transfers)
    def get_client_for_chain(chain):
        return {"tron": tron_client, "ethereum": eth_client}[chain]
    return tron_client, get_client_for_chain

def test_confirmed_crossing_continues_trace_onto_the_paired_chain():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    withdrawal = mk(BRIDGE_ETH_SIDE, "eth_recipient", 98, T0 + timedelta(minutes=10),
                     chain="ethereum", asset="USDT-ERC20")
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    eth_transfers = {BRIDGE_ETH_SIDE: [withdrawal], "eth_recipient": []}
    tron_client, get_client_for_chain = _clients(tron_transfers, eth_transfers)

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=get_client_for_chain)

    chains_seen = {h.chain for h in result.hops}
    assert chains_seen == {"tron", "ethereum"}
    eth_recipient_hop = next(h for h in result.hops if h.wallet_address == "eth_recipient")
    assert eth_recipient_hop.chain == "ethereum"
    # bridge fee-adjusted: withdrawal (98) is less than the deposit taint (100), never
    # re-inflated back to the original 100.
    assert eth_recipient_hop.taint == Decimal("98")
    assert len(result.bridge_links) == 1
    assert result.bridge_links[0].confidence >= 0.6

def test_unconfirmed_crossing_stops_honestly_when_no_withdrawal_found():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    eth_transfers = {BRIDGE_ETH_SIDE: []}  # no matching withdrawal at all
    tron_client, get_client_for_chain = _clients(tron_transfers, eth_transfers)

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=get_client_for_chain)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "bridge_crossing_unconfirmed"
    assert result.bridge_links == []

def test_unconfirmed_crossing_when_paired_chain_read_fails():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    tron_client, _ = _clients(tron_transfers, {})

    def raising_get_client_for_chain(chain):
        if chain == "ethereum":
            raise ConnectionError("simulated read failure")
        return tron_client

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=raising_get_client_for_chain)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "bridge_crossing_unconfirmed"

def test_no_get_client_for_chain_means_bridge_detection_is_never_attempted():
    # Backward compatibility: when the caller doesn't opt in, a wallet that happens to match
    # a bridge address is treated as a perfectly ordinary wallet -- exactly today's behavior.
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    tron_client, _ = _clients(tron_transfers, {})

    result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"), start_time=T0)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "no_outgoing_activity"  # normal stop, not bridge-aware
    assert result.bridge_links == []

def test_confidence_below_threshold_is_treated_as_unconfirmed():
    deposit = mk("scammer", BRIDGE_TRON_SIDE, 100, T0)
    # A withdrawal timed right at the edge of the 60-minute window with a large amount gap --
    # constructed to score below MIN_BRIDGE_LINK_CONFIDENCE (0.6) on find_bridge_links' own
    # formula, not a hand-picked outcome.
    weak_withdrawal = mk(BRIDGE_ETH_SIDE, "eth_recipient", 80, T0 + timedelta(minutes=55),
                          chain="ethereum", asset="USDT-ERC20")
    tron_transfers = {"scammer": [deposit], BRIDGE_TRON_SIDE: []}
    eth_transfers = {BRIDGE_ETH_SIDE: [weak_withdrawal], "eth_recipient": []}
    tron_client, get_client_for_chain = _clients(tron_transfers, eth_transfers)

    with patch("app.tracing.tracer.is_bridge_contract",
               side_effect=lambda addr, chain: TEST_BRIDGE if addr == BRIDGE_TRON_SIDE and chain == "tron" else None):
        result = trace(tron_client, start_address="scammer", reported_amount=Decimal("100"),
                        start_time=T0, get_client_for_chain=get_client_for_chain)

    bridge_hop = next(h for h in result.hops if h.wallet_address == BRIDGE_TRON_SIDE)
    assert bridge_hop.stop_reason == "bridge_crossing_unconfirmed"
    assert result.bridge_links == []
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/unit/test_tracer_bridge_crossing.py -v` from `backend/`.
Expected: FAIL — `trace() got an unexpected keyword argument 'get_client_for_chain'`.

- [ ] **Step 3: Rewrite `tracer.py`**

```python
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
            transfers = active_client.get_transfers(address, since=since_ts)
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
```

Note: `active_client.get_transfers(address, since=since_ts)` now passes `since` where the old
code never did — every adapter (`tron.py`/`evm.py`/`bitcoin.py`) already accepts and honors a
real server-side `since` parameter (Task G5); the old comment claiming otherwise was stale and
is removed here. The `causal` list's own client-side `t.timestamp >= since_ts` filter stays as
a defense-in-depth check, now redundant-but-correct rather than load-bearing.

- [ ] **Step 4: Run the new tests, verify they pass**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/unit/test_tracer_bridge_crossing.py -v` from `backend/`.
Expected: all PASS.

- [ ] **Step 5: Run the existing tracer test suite UNMODIFIED, verify it still passes**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/unit/test_tracer_causality.py -v` from `backend/`.
Expected: all PASS, with zero edits made to that test file — this is the real proof the new parameter is backward compatible.

- [ ] **Step 6: Run the full backend suite**

Run: `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/`.
Expected: all PASS, same total count as before plus this task's new tests.

- [ ] **Step 7: Commit**

```bash
git add backend/app/tracing/tracer.py backend/tests/unit/test_tracer_bridge_crossing.py
git commit -m "feat(backend): tracer detects and follows a confirmed cross-chain bridge crossing"
```

---

## Task 3: Wire into `traces.py`

**Files:**
- Modify: `backend/app/api/v1/traces.py`
- Test: `backend/tests/api/test_traces_api.py` (extend)

**Interfaces:**
- Consumes: `trace(chain_client, start_address, reported_amount, start_time, max_hops=6, get_client_for_chain=None)` (Task 2). `is_bridge_contract(address, chain) -> BridgeContract | None` (Task 1). `app.chains.known_assets` module's existing `DISPLAY_LABEL_TO_ASSET_LABEL` is NOT modified — a bridge's `paired_asset_label` is already the canonical label `resolve_asset_contract` falls back to using directly when it's not a display label it recognizes (confirmed: `known_assets.py`'s own fallback is `DISPLAY_LABEL_TO_ASSET_LABEL.get(display_label, display_label)`).

- [ ] **Step 1: Write the failing integration test**

Add to `backend/tests/api/test_traces_api.py` (reuse this file's own existing `SUSPECT`/`T0`/`mk`/`_make_case`/`VETTED_LABEL` helpers already defined near the top):

```python
def test_trace_crosses_a_confirmed_bridge_onto_the_paired_chain():
    from app.bridge.registry import KNOWN_BRIDGES
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")

    deposit = mk(SUSPECT, tron_bridge.contract_address, 150.0, T0, tx="tx-deposit-to-bridge")
    withdrawal_ts = T0.fromtimestamp(T0.timestamp() + 600, tz=timezone.utc)
    withdrawal = Transfer(
        tx_hash="tx-bridge-withdrawal", chain="ethereum",
        from_address=tron_bridge.paired_contract_address, to_address="0xethrecipient00000000000000000000000001",
        amount=Decimal("147.5"), asset="USDT-ERC20", timestamp=withdrawal_ts, fee=Decimal("0"), raw={},
    )

    class TronSideClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            data = {SUSPECT: [deposit], tron_bridge.contract_address: []}
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    class EthSideClient:
        chain = "ethereum"
        def get_transfers(self, address, since=None):
            data = {tron_bridge.paired_contract_address: [withdrawal], "0xethrecipient00000000000000000000000001": []}
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    def fake_get_chain_client(chain, asset=None):
        return {"tron": TronSideClient(), "ethereum": EthSideClient()}[chain]

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", side_effect=fake_get_chain_client):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()

    chains_in_trail = {h["chain"] for h in body["hops"]}
    assert chains_in_trail == {"tron", "ethereum"}

    bridge_hop = next(h for h in body["hops"] if h["addr"] == tron_bridge.contract_address)
    assert bridge_hop["role"] == "Bridge contract"

    assert len(body["bridgeLinks"]) == 1
    assert body["bridgeLinks"][0]["sideAChain"] == "tron"
    assert body["bridgeLinks"][0]["sideBChain"] == "ethereum"
    assert body["bridgeLinks"][0]["confidence"] >= 0.6

    eth_hop = next(h for h in body["hops"] if h["addr"] == "0xethrecipient00000000000000000000000001")
    assert eth_hop["amt"] == pytest.approx(147.5)  # fee-adjusted, not re-inflated to 150

def test_bridge_contract_itself_is_never_evaluated_as_an_attribution_candidate():
    from app.bridge.registry import KNOWN_BRIDGES
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")

    deposit = mk(SUSPECT, tron_bridge.contract_address, 150.0, T0, tx="tx-deposit-to-bridge")

    class TronSideClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            # Give the bridge contract itself plenty of distinct payers -- exactly the shape
            # that could otherwise look like a fake deposit wallet if not explicitly excluded.
            data = {
                SUSPECT: [deposit],
                tron_bridge.contract_address: [
                    mk(f"payer{i}", tron_bridge.contract_address, 10, T0, tx=f"tx-payer-{i}")
                    for i in range(5)
                ] + [deposit],
            }
            rows = data.get(address, [])
            return [t for t in rows if since is None or t.timestamp >= since]

    class EthSideClient:
        chain = "ethereum"
        def get_transfers(self, address, since=None):
            return []  # no matching withdrawal -- crossing stays unconfirmed

    def fake_get_chain_client(chain, asset=None):
        return {"tron": TronSideClient(), "ethereum": EthSideClient()}[chain]

    case_id = _make_case()
    with patch("app.api.v1.traces.get_chain_client", side_effect=fake_get_chain_client):
        response = client.post(f"/api/v1/cases/{case_id}/trace")

    assert response.status_code == 200
    body = response.json()
    # The bridge contract must never be named as the exchange/attribution wallet, no matter
    # how many distinct payers it has -- it's a bridge, not a collection wallet.
    assert body["attribution"]["walletAddress"] != tron_bridge.contract_address
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/api/test_traces_api.py -k bridge -v` from `backend/`.
Expected: FAIL (role mapping / candidate exclusion / client factory don't exist yet).

- [ ] **Step 3: Modify `traces.py`**

Add the "Bridge contract" role mapping (near the existing `_ROLE_PLAIN_ENGLISH`/`_STOP_REASON_PLAIN_ENGLISH` dicts):

```python
_STOP_REASON_PLAIN_ENGLISH = {
    "no_outgoing_activity": "This wallet never sent this money anywhere else",
    "no_further_transfers": "This wallet has not moved this money any further yet",
    "hop_cap_reached": "We stopped following the money here to keep the search from going too deep",
    "api_read_failure": "We could not check this wallet's history right now",
    "bridge_crossing_unconfirmed": (
        "This wallet sent the money into a cross-chain bridge, but we could not confirm "
        "exactly which withdrawal on the other blockchain it turned into"
    ),
}
```

Change the `hops_out` list comprehension's `role=` computation from the current
`_ROLE_PLAIN_ENGLISH["suspect" if h.hop_index == 0 else "intermediate"]` to also recognize a
bridge-contract hop:

```python
from app.bridge.registry import is_bridge_contract

def _hop_role(h) -> str:
    if h.hop_index == 0:
        return _ROLE_PLAIN_ENGLISH["suspect"]
    if is_bridge_contract(h.wallet_address, h.chain) is not None:
        return "Bridge contract"
    return _ROLE_PLAIN_ENGLISH["intermediate"]

hops_out = [
    HopOut(n=h.hop_index, addr=h.wallet_address, role=_hop_role(h),
           amt=float(h.taint), at=(h.funding_transfer.timestamp if h.funding_transfer else incident_at),
           flag=_STOP_REASON_PLAIN_ENGLISH.get(h.stop_reason), chain=h.chain, stopReason=h.stop_reason)
    for h in result.hops
]
```

Add the client-factory closure and pass it into `trace()` (replacing the current single
`get_chain_client(case.chain, case.asset)` call):

```python
def _client_for_chain(chain: str, case_chain: str, case_asset: str):
    if chain == case_chain:
        return get_chain_client(chain, case_asset)
    bridge_asset = None
    for candidate_chain in ("tron", "ethereum"):
        if candidate_chain == chain:
            # Find any known bridge pairing that names this chain as its paired side, to
            # recover the right canonical asset label -- there's exactly one such pairing in
            # this project's current TRON<->Ethereum-only scope.
            from app.bridge.registry import KNOWN_BRIDGES
            match = next((b for b in KNOWN_BRIDGES if b.paired_chain == chain), None)
            bridge_asset = match.paired_asset_label if match is not None else None
    return get_chain_client(chain, bridge_asset)
```

Replace:
```python
client = get_chain_client(case.chain, case.asset)
```
with:
```python
client = get_chain_client(case.chain, case.asset)
def get_client_for_chain(chain: str):
    return _client_for_chain(chain, case.chain, case.asset)
```

Update the `trace(...)` call site to pass the new parameter:
```python
result = trace(client, start_address=case.suspect_wallet, reported_amount=reported_amount,
                start_time=incident_at, get_client_for_chain=get_client_for_chain)
```

Add the candidate-exclusion guard to the existing `candidates` filter:
```python
candidates = [h for h in result.hops if h.hop_index > 0 and h.taint > Decimal("0")
              and is_bridge_contract(h.wallet_address, h.chain) is None]
```

Replace the dead-in-practice bridge-links block:
```python
all_outgoing = [t for h in result.hops for t in h.outgoing_transfers]
bridge_links = find_bridge_links(all_outgoing, all_outgoing)
bridge_links_out = [
    BridgeLinkOut(...) for b in bridge_links if b.side_a_chain != b.side_b_chain
]
```
with:
```python
bridge_links_out = [
    BridgeLinkOut(sideATxHash=b.side_a_tx_hash, sideAChain=b.side_a_chain,
                   sideBTxHash=b.side_b_tx_hash, sideBChain=b.side_b_chain, confidence=b.confidence)
    for b in result.bridge_links
]
```
(the `find_bridge_links` import in this file becomes unused and should be removed; `app.graph.backward`'s
unrelated imports are untouched).

- [ ] **Step 4: Run the new tests, verify they pass**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/api/test_traces_api.py -k bridge -v` from `backend/`.
Expected: all PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/`.
Expected: all PASS, zero regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/traces.py backend/tests/api/test_traces_api.py
git commit -m "feat(backend): wire cross-chain bridge crossing into the live trace path"
```

---

## Task 4: Frontend demo fixture — verify + wire a cross-chain mock case

**Files:**
- Modify: `frontend/src/api/mock.ts` (verify existing bridge node data still renders; extend if the graph layout needs an explicit `chain` per node for a genuinely two-chain path)
- Read only: `frontend/src/components/graph/FundFlowGraph.tsx`, `frontend/src/components/graph/graphLayout.ts`, `frontend/src/components/graph/GraphLegend.tsx` (already support `kind: 'bridge'` → diamond/violet node — confirmed by reading these files during this plan's own research)

**Interfaces:**
- Consumes: nothing from Tasks 1-3 (this task is mock-data-only, `VITE_USE_MOCK` path — the live-mode graph endpoint, `getGraph()`, is a separate, larger, pre-existing gap that is explicitly OUT OF SCOPE here, see the note below).
- No backend dependency — this task can run in parallel with Tasks 1-3.

**Important scope note:** while researching this plan, `httpApiPartial.getGraph` was found to not exist at all (`api/index.ts` falls through to `notImplemented('getGraph')` in live mode) — so today, a real (non-mock) trace's Evidence graph tab is entirely unimplemented, regardless of bridges. This is a real, pre-existing, separate gap (part of the already-documented "routeA/routeB N-ary redesign" backlog item), NOT something this task should fix — building a live-mode `getGraph()` from `Route.trail` is a materially larger, separate frontend task. This task only confirms the DEMO (mock-mode) path — the one judges actually see, per CLAUDE.md's "Keep the DEMO DATA chip visible" — correctly shows a cross-chain bridge crossing, since `mock.ts`'s existing `buildGraph()` already constructs a `kind: 'bridge'` node.

- [ ] **Step 1: Read the current mock bridge node data**

Read `frontend/src/api/mock.ts` lines 130-210 (the `buildGraph()` function and its `bridge` node/edges) in full before making any change.

- [ ] **Step 2: Confirm current rendering with a manual dev-server check**

Run the frontend dev server (`npm run dev` from `frontend/`, or via this session's `preview_start` tool) with `VITE_USE_MOCK=true`, navigate to the Evidence page's graph tab for the demo case, and confirm: the bridge node renders as a violet diamond (per `GraphLegend`'s existing entry), and `graphLayout.ts`'s `crossesBridge` check (line 118, confirmed present) does whatever it currently does with that fact (read that logic and note what it does — e.g. does it affect layout, coloring, a warning banner?).

- [ ] **Step 3: If the existing mock data already renders correctly, no code change is needed — just document it**

If Step 2 confirms correct rendering, do NOT modify `mock.ts` — add a comment directly above the existing `bridge` node construction (around `mock.ts:166`) stating this was verified to correctly exercise the real cross-chain bridge-linking feature's frontend-visible shape (node kind `'bridge'`, violet diamond, per the backend's new `"Bridge contract"` role string this plan's Task 3 introduces) as of this plan.

If Step 2 reveals a genuine rendering bug (not a hypothetical — only act if something is actually visibly wrong), fix it minimally and add a regression test. Do not add scope beyond what Step 2 actually finds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/mock.ts
git commit -m "docs(frontend): confirm mock bridge-crossing node renders correctly against the new backend feature"
```

(If Step 3 made no code change, this commit may be comment-only — that's fine and expected.)

---

## Self-Review Notes (completed during plan authoring)

1. **Spec coverage:** Architecture (Task 2), Bridge registry (Task 1), traces.py wiring (Task 3), Demo fixture (Task 4), Error handling/honesty (Tasks 2+3's stop reasons and role strings), Testing/acceptance (every task's own test steps + Task 3's full-suite gate). All spec sections have a task.
2. **Placeholder scan:** Task 1's Step 1 intentionally defers the exact bridge address to real-time research (matching this project's own established, already-used pattern for OFAC/Tether/Etherscan/TronGrid facts) — this is not a plan-writing placeholder, it's a documented, one-time research step with a concrete honest fallback if verification fails, same as prior tasks in this exact project.
3. **Type consistency:** `TraceResult.bridge_links: list[BridgeLinkCandidate]` (Task 2) matches `BridgeLinkCandidate` from the existing, untouched `app.bridge.linker` module. `is_bridge_contract(address: str, chain: str) -> BridgeContract | None` signature is identical across Tasks 1, 2, and 3. `trace()`'s new parameter name `get_client_for_chain` is identical everywhere it's referenced.
