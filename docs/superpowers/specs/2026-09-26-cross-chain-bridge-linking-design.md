# Real cross-chain bridge-hop linking — design

Status: approved by user 2026-09-26. Supersedes the "deferred, needs a case model that
traces two chains" note in `docs/TASKS.md` P3 — no `Case` schema change turns out to be
needed; see "Why no Case change" below.

## Why this exists

`app/bridge/linker.py`'s `find_bridge_links()` has been correct and tested in isolation
since Task F10 (2026-09-26), but has never fired for a real trace: it's called from
`traces.py` with `all_outgoing` built from a single case's single-chain hop list, so
`side_a_candidates` and `side_b_candidates` are always drawn from the same chain, and the
function's own same-chain exclusion (`if b.chain == a.chain: continue`) makes the result
always `[]`. `app/bridge/registry.py`'s `KNOWN_BRIDGES` seed is dead code today — nothing
calls it — and its one entry is an explicit placeholder address, not real. This is a known,
honestly-documented gap (`docs/TASKS.md` P3, `docs/superpowers/plans/.../2026-09-26...`
Task F10's own commit message).

Real fraud money routinely crosses a bridge mid-trace (TRON USDT → a bridge → Ethereum
USDT is the pairing this project's own asset list already anticipates). Without this,
KAIZEN's trace silently stops the moment money leaves the chain it started tracing on —
exactly the kind of dead-end this project's whole "sweep signature" thesis is supposed to
see through.

## Why no `Case` schema change

`TraceHop` (`app/tracing/tracer.py`) already carries a per-hop `chain: str` field — the
data model already anticipated a trace spanning more than one chain. The actual limitation
is that `trace()` takes one fixed `ChainClient` and stamps every hop with that one client's
`.chain`. Generalizing `trace()` to obtain a client for whichever chain the money is
currently on, and letting the BFS itself discover a bridge crossing mid-trace, needs no
new column on `Case` — `Case.chain`/`Case.asset` keep meaning exactly what they mean today:
the chain and asset the suspect wallet itself was reported on. This also matches how a real
investigation actually works: nobody knows in advance that a bridge will be used; it's
discovered when the trace gets there.

## Scope

- **Chain pair: TRON ↔ Ethereum only**, asset pairing USDT-TRC20 ↔ USDT-ERC20 — matches
  this project's real, already-supported asset list. Bitcoin is excluded entirely (no
  smart-contract bridge surface, same reasoning `known_assets.py` already applies to
  exclude Bitcoin from contract-address filtering).
- Real, WebSearch-verified bridge contract addresses — both implementer and reviewer must
  independently re-verify, same discipline already applied to Tether/TronGrid/Etherscan/
  OFAC facts (this project has been burned twice by guessed API/address facts).
- A demo fixture (fake-chain-client test scenario) exercising a full TRON→bridge→Ethereum
  crossing end-to-end, plus a frontend mock-data case so a judge can see it rendered.
- Out of scope: wrapped-BTC / custodial mint-burn bridges, any bridge pair beyond TRON↔ETH,
  any change to `Case`'s schema.

## Architecture

### 1. Bridge registry (`app/bridge/registry.py`) — rewrite

Replace the placeholder `KNOWN_BRIDGES` with real, verified contract addresses and add
explicit pairing:

```python
@dataclass(frozen=True)
class BridgeContract:
    name: str
    chain: str
    contract_address: str
    source_url: str
    paired_chain: str
    paired_contract_address: str
    paired_asset_label: str   # e.g. "USDT-ERC20" when this side is "USDT-TRC20"
```

New lookup: `is_bridge_contract(address: str, chain: str) -> BridgeContract | None` —
case-appropriate address comparison per chain (TRON base58 case-sensitive, Ethereum
lowercase-normalized, matching the comparison conventions already established in
`cases.py`/`traces.py` for each chain). Used by the tracer to detect a hit; replaces the
never-called `bridges_for_chain()`.

### 2. Tracer (`app/tracing/tracer.py`) — generalize `trace()`

Signature changes from `trace(chain_client, start_address, reported_amount, start_time,
max_hops=6)` to `trace(get_client_for_chain: Callable[[str], ChainClient], start_chain: str,
start_address, reported_amount, start_time, max_hops=6)`. `get_client_for_chain` is a thin
closure the caller provides (in `traces.py`, `lambda chain: get_chain_client(chain,
asset_for_chain(chain))`); the tracer no longer needs to know how a client is constructed,
only that it can ask for one by chain name.

Inside the BFS, when a hop's causal outgoing transfer's `to_address` matches
`is_bridge_contract(to_address, hop.chain)`:

1. Record the current hop normally (existing taint/funding-transfer logic unchanged).
2. Fetch the paired contract's own outgoing transfers on the OTHER chain (via
   `get_client_for_chain(bridge.paired_chain)`), filtered to a time window starting at the
   deposit's own timestamp (reuse the same time-window convention as
   `SWEEP_MAX_GAP_SECONDS`-adjacent code elsewhere, but bridges are slower than a same-wallet
   sweep — use a wider, named constant, e.g. `BRIDGE_CROSSING_WINDOW_MINUTES = 60`, matching
   `find_bridge_links`'s own existing default `time_window_minutes` parameter — don't invent
   a second value that silently disagrees with it).
3. This fetch can fail like any other chain-API read — wrap it in the same `try/except`
   pattern used everywhere else in this codebase, and on failure, stop this hop with a new,
   honest `stop_reason="bridge_crossing_unconfirmed"` (never a fabricated crossing, never a
   silent dead end presented as "no further transfers").
4. Call `find_bridge_links([deposit_transfer], candidate_withdrawals)` (the existing,
   untouched function). If it returns no link, or the top link's `confidence` is below a
   new named constant `MIN_BRIDGE_LINK_CONFIDENCE` (pick a real, justified value — not 0.5
   by convention-only; document why in a comment, e.g. by relating it to the function's own
   confidence formula), stop this hop the same way: `stop_reason="bridge_crossing_unconfirmed"`.
5. If a link clears the bar: enqueue a new hop on `bridge.paired_chain`, starting at the
   linked withdrawal's `to_address`, with taint = the withdrawal's own `amount` (already
   ≤ the deposit's taint — a real bridge fee, never re-inflated back to the original
   taint), `since_ts` = the withdrawal's timestamp (preserves the existing causal
   FIFO/time-monotonic invariant across the chain boundary), `hop_index` continuing the
   same shared counter (no extra budget from crossing).
6. Record the confirmed `BridgeLinkCandidate` on the `TraceResult` (add a
   `bridge_links: list[BridgeLinkCandidate]` field to the dataclass) so `traces.py` can
   report it without recomputing anything.

`max_hops` remains one shared budget across both chains — a bridge crossing does not grant
extra depth.

### 3. `traces.py` wiring

- Swap the single `get_chain_client(case.chain, case.asset)` call for the closure described
  above; `asset_for_chain(chain)` resolves via the bridge registry's own
  `paired_asset_label` when `chain != case.chain`, and `case.asset` when it's the starting
  chain — never a guess.
- Replace the current `all_outgoing = [...]; find_bridge_links(all_outgoing, all_outgoing)`
  dead-in-practice call with `result.bridge_links` read straight off the new `TraceResult`
  field — no re-derivation.
- Candidate-hop filtering (`candidates = [...]`) gains one more exclusion:
  `is_bridge_contract(hop.wallet_address, hop.chain) is None` — a bridge contract itself
  must never be evaluated as a deposit-gate candidate (it will have many distinct payers by
  its very nature as a bridge, and could otherwise look like a fake exchange collection
  wallet — this is a real correctness guard, not a hypothetical).
- No other downstream logic (attribution, `Hop`/`AttributionCandidate` persistence,
  sanctions screening, VASP auto-flag, evidence packs) needs to change — all of it already
  operates per-hop and already carries `hop.chain` through correctly.

### 4. Demo fixture + tests

- One new fake-chain-client integration test (same pattern as the existing
  `WellEvidencedClient`), covering a full TRON→bridge→Ethereum crossing through the real
  `POST /{case_id}/trace` endpoint: asserts hops span both chains in order, `bridgeLinks` is
  non-empty with a real confidence figure, taint carries through fee-adjusted (strictly less
  than the pre-crossing hop's taint), and the post-crossing Ethereum wallet is still
  correctly evaluated for attribution/sanctions/evidence.
- Unit tests: `is_bridge_contract()` (both chains, case-sensitivity per chain), the
  confidence-threshold cutoff (just above / just below), the unconfirmed-crossing honest
  stop path (both "no candidates found" and "read failed"), and the bridge-contract
  candidate-exclusion guard.
- One frontend mock-data case (`frontend/src/api/mock.ts` or wherever the demo fixtures
  live) with a cross-chain hop, so the existing graph view renders it — check what the
  cytoscape wrapper needs to distinguish a hop whose `chain` differs from its predecessor's
  (this has never occurred in any existing mock data) and add a small visual cue (e.g. a
  distinct edge style) if the component doesn't already handle a chain change gracefully.

## Error handling / honesty

- A failed second-chain read is `stop_reason="bridge_crossing_unconfirmed"`, never presented
  as "this wallet never moved the money further" (`no_outgoing_activity`) — those are
  different facts and must stay distinguishable, same principle as every other
  read-failure-honesty fix already shipped (G3's four instances).
- A low-confidence link is likewise `bridge_crossing_unconfirmed`, not silently treated as a
  dead end nor silently treated as confirmed — the confidence figure itself is always
  available in `result.bridge_links` for anything that already crossed the bar, so nothing
  about a rejected low-confidence candidate needs to be surfaced further (it was never
  confirmed, so it was never acted on).
- Per CLAUDE.md rule 1: the bridge contract addresses used for real on-chain matching must
  be real and independently verified — this is the same category of fact as the OFAC SDN
  list or the real USDT contract address already used elsewhere in this codebase for
  legitimate detection purposes, not a violation of the "no real exchange names" rule (that
  rule is about *implicating* a real entity in synthetic case data, not about using a real,
  public, verifiable contract address to detect a real, documented mechanism).

## Testing/acceptance

- Full existing backend suite stays green (current baseline: 251 passed).
- New tests per "Demo fixture + tests" above, all passing.
- `docs/TASKS.md` P3's cross-chain bridge-linking line updated from "deferred" to done,
  with the same rigor of description used for every other completed Sprint 2/3 task.
