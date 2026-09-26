# Plan: fix second whole-branch review findings (Critical + all 5 Important)

Source: the fix plan's own mandatory closing step — a second whole-branch review
(`docs/superpowers/plans/2026-09-26-backend-whole-branch-review-fixes.md`'s Task F11 handoff),
range `78da8aa..06f0093`, opus + an executed probe script. Full findings logged in
`docs/TASKS.md` P1.6 and `docs/PROGRESS.md`'s "second whole-branch review" entry. User chose
scope: fix C-A (Critical) + all 5 Important (I-A through I-E). The 6 Minor findings stay
documented, not fixed, in this pass.

**Global constraints (apply to every task below, same standing rules as the first fix pass):**
- `Decimal` for all money math; never introduce a `float` money field.
- Every new/changed human-readable string a non-technical reader sees must be plain English
  (no "gate", "hop", "taint", "sweep", "FIFO", "distinct payers", "candidate") — the standing
  rule from Tasks 7/8/11/12/F11.
- A chain-API read failure is never reported as a checked fact ("0 payers", "reconciled",
  "no history") — this exact principle from Task F3 must now be applied consistently
  everywhere a refetch can fail, per I-B below. If you find a 4th place with the same bug
  class while fixing the 3 named in I-B, fix it too rather than leaving it for a 3rd review
  round.
- All data stays synthetic — no real exchange names, no real wallet addresses in seed data,
  tests, or fixtures.
- Every task must run the full backend suite (`cd backend && .venv/Scripts/pytest tests/ -v`)
  before committing, and any frontend-touching task must run `cd frontend && npx tsc -b` clean.
- Do not silently expand scope beyond what each task states.

**Task order:** G1 (Critical) first. G2, G3, G4 all touch `backend/app/api/v1/traces.py`'s
attribution block and/or `backend/app/tracing/tracer.py` — land them in this order since G3
and G4 both read code G2 doesn't touch but G2's taint-propagation change could shift which
hops even exist as candidates. G5 (adapter-only) and G6 (frontend-only) are independent of
the above and of each other — either can run last.

---

## Task G1: Ethereum traces must not mix native ETH with ERC-20 tokens (C-A)

**Files:** `backend/app/chains/known_assets.py`, `backend/app/chains/evm.py`, any call site that
constructs the EVM adapter with `asset_contract` (locate via `resolve_asset_contract` usage,
likely `backend/app/chains/registry.py` or wherever `get_chain_client` builds the adapter).

**Problem:** `resolve_asset_contract("ethereum", "ETH")` returns `None` — correct in isolation
("no contract to filter on for a native asset") — but `evm.py`'s `get_transfers` treats
`asset_contract is None` as "apply no filter," so when the case's own declared asset IS native
ETH, every ERC-20 token transfer (`tokentx` results) still merges in unfiltered alongside the
native `txlist` results. The tracer's FIFO taint-budget math (`tracer.py`) then compares a
`Transfer.amount` that might be ETH-denominated against one that's an arbitrary spam token's
own decimal system, silently. Probe (from the review): a fake token transfer arriving 5s after
a real 1 ETH victim payment took the FIFO budget, leaving the real ETH recipient at `taint=0`
— the same bug class as the original C2, now on a path C2's own fix (Task F3) never touched.

**Root cause:** `asset_contract: str | None` conflates two genuinely different meanings —
"unknown/unmapped asset, don't filter" (the safe default for an asset this module doesn't
recognize) and "this case's asset is native ETH, exclude every ERC-20 transfer" (the correct
behavior once the asset IS known and IS native). One `None` value cannot mean both.

**Fix:**
1. In `known_assets.py`, replace the single `resolve_asset_contract` return type with something
   that distinguishes the three real cases explicitly — e.g. a small result type/enum (or a
   `(kind, contract)` tuple) with values `"native"` (exclude all token transfers — this asset
   has no contract, and the trace is specifically about the native coin), `"contract"` (filter
   token transfers to this exact contract address, and — critically — also exclude native
   `txlist` records, since native ETH is never the declared ERC-20 asset either), or `"unknown"`
   (asset label didn't map to anything this module knows — apply no filter, current permissive
   behavior, documented as a known gap for an asset this system doesn't yet recognize).
2. Update `DISPLAY_LABEL_TO_ASSET_LABEL`/`KNOWN_ASSET_CONTRACTS` so `"ETH"` resolves to the new
   `"native"` kind explicitly (not just "absent from the dict").
3. In `evm.py`'s `get_transfers`, branch on the new result: `"native"` → return only
   `native_records` (drop `token_records` entirely); `"contract"` → filter `token_records` to
   the matching contract (existing logic) AND drop `native_records` entirely (a case whose
   declared asset is a specific ERC-20 token should never see native ETH transfers mixed in
   either — same bug, opposite direction); `"unknown"` → current permissive merge-both behavior.
4. Update whatever call site constructs the adapter to use the new resolver signature.
5. New tests: (a) a case declared as native ETH with a spam ERC-20 transfer arriving between
   the victim's payment and the real recipient's forward transfer — assert the real recipient's
   taint is NOT stolen by the spam token; (b) the mirror case — a case declared as the real
   USDT-ERC20 asset with a native ETH transfer mixed into the same wallet's history — assert
   the native transfer doesn't participate in FIFO allocation either; (c) an unknown/unmapped
   asset label still gets the permissive (no-filter) behavior, unchanged.

---

## Task G2: revisited-wallet taint must propagate to already-queued children (I-A)

**File:** `backend/app/tracing/tracer.py` (the `visited`/`existing_hop.taint += taint` block,
approximately the `while queue:` loop's revisit branch).

**Problem:** When a wallet is revisited (a second causal transfer arrives at an
already-expanded wallet), the code folds the new taint into `existing_hop.taint` as a scalar
and stops — it does not re-run that wallet's own FIFO fan-out over its outgoing transfers for
the newly-arrived taint amount. The wallet's children were already enqueued using only the
FIRST arrival's smaller taint budget. The additional taint that arrived later has no path
forward to any downstream wallet at all — it's stuck at the parent. A downstream wallet that
should have received a larger share (or any share) of the true total can end up excluded from
attribution entirely (`taint == 0`), reproducing the same "wallet holding real money gets
excluded" failure mode as C2/C-A, this time from taint accounting rather than asset mixing.

**Fix:** When merging taint into an already-visited hop, don't just add to the scalar — also
re-run the FIFO fan-out allocation for the NEWLY ARRIVED taint amount only (the visited
wallet's existing causal outgoing-transfer list is already known/cached from its first
expansion; don't refetch) and enqueue the resulting `(child_address, additional_taint,
timestamp, hop_index+1, transfer)` tuples exactly as the first-expansion code path already
does. This means a wallet can be "expanded" more than once over its lifetime in the queue —
each time with a different taint amount — which is correct: it's the same FIFO-fan-out logic
already used for a first expansion, just re-invoked for an increment. If a child from this
second wave is itself already visited, the exact same merge-and-re-emit logic applies there
too — this naturally cascades through the whole subgraph without needing a separate
graph-wide re-computation pass.

Watch for: (a) don't double-produce hops — the existing hop record for a revisited wallet gets
its `taint` field incremented once (as today), and the RE-EMITTED children go through the same
"is this address in `visited`" check as any other queue entry, so this doesn't need special
dedup logic beyond what already exists; (b) preserve the existing hop-cap and stop-reason
logic — a re-emitted child still needs to check `hop_index` against the cap and re-derive its
own `stop_reason` normally, it is not exempt from any existing rule just because it arrived via
a merge rather than a first visit.

**Test:** construct a converging-path fixture where a wallet is visited once with a small
taint amount (not enough to attribute its own children), expand it, then have a second
converging causal transfer arrive at the SAME wallet with additional taint that — combined —
is enough to reach a downstream wallet that previously got `taint == 0` under the old (drop)
behavior. Assert the downstream wallet now has nonzero taint and is a valid attribution
candidate.

---

## Task G3: a chain-API read failure must never produce a false confident statement (I-B)

**File:** `backend/app/api/v1/traces.py` (three separate spots — locate via the existing
`except Exception:` blocks already added by Task F3/G1's predecessor work).

**Problem, 3 instances of the same bug class Task F3 already fixed once for the attribution
candidate loop, but didn't apply everywhere a refetch can silently fail:**
1. **Conservation.** `outgoing_total = sum(h.taint for h in terminal_hops)` includes a hop's
   taint even when that hop's own `stop_reason` is `"api_read_failure"` — the conservation
   check then reports `reconciled` (or a specific remainder number) as if the trace fully
   accounted for where the money went, when actually the trace simply couldn't verify past
   that point. An officer reading "reconciled" should not be told that when a read failure is
   the real reason the trail stops there.
2. **Attribution's empty-candidates default message.** The hardcoded default reasoning ("No
   wallet in this trace ever received any of the victim's traced money, so there is nothing yet
   to check against an exchange") fires whenever `candidates` is empty — but `candidates` can be
   empty because the very first hop (fetching the suspect wallet's own outgoing transfers, in
   `tracer.py`, before `traces.py` even runs its own loop) hit an `api_read_failure`, not because
   the money genuinely never moved. Check whether `result.hops` contains a read-failure stop
   reason at the relevant point before asserting the confident "never received any money"
   message; if so, use an honest "we couldn't read this wallet's history, so we don't know
   whether the money moved further" message instead.
3. **Innocence's accusatory factor.** `suspect_history = []` after a caught `except Exception`
   currently flows straight into `compute_innocence` indistinguishably from a wallet that
   genuinely has zero prior history — and an empty list can make an accusatory "no history
   before the incident" factor fire that is not actually a checked fact. `compute_innocence`
   (or its caller) needs a way to know "we couldn't check" versus "we checked and it's
   genuinely empty" and skip/soften that specific factor (with an honest "we couldn't check
   this wallet's earlier history" note) when the fetch failed rather than returning `[]`.

**Fix, general shape for all 3:** thread a `history_read_failed: bool` (or equivalent) signal
from each `try`/`except Exception` block through to whatever downstream logic renders a
human-facing statement from that data, and branch the message/computation on it — the same
pattern already used for the candidate-evaluation loop's `history_read_failed` flag (Task
F3/G1-predecessor), just extended to these 3 additional call sites. Don't invent 3 different
ad-hoc mechanisms — reuse or extend the existing pattern's shape so a future 4th instance is
easy to recognize and fix the same way.

**Tests:** one per instance, each forcing the relevant `client.get_transfers` call to raise and
asserting the resulting API response says something honest ("couldn't check"/"data
unavailable") rather than the false-confident version, for (1) conservation, (2) the
zero-candidates attribution message, (3) innocence's history-based factor.

---

## Task G4: unreported-victim enumeration must not run on an unverified fallback wallet (I-C)

**File:** `backend/app/api/v1/traces.py` (the `evaluated[-1]` fallback and the
`enumerate_unreported_victims` call immediately following it).

**Problem:** `hop, gate, sweep_signal, final_gate_passed = passed if passed is not None else
evaluated[-1]` picks an arbitrary last-candidate wallet purely so the attribution response has
*something* to report reasoning about when nothing passed the full gate. But the
`enumerate_unreported_victims(client, hop.wallet_address, ...)` call right after this runs
UNCONDITIONALLY on whatever `hop` ended up being — including this unverified fallback. With no
vetted labels seeded (true for every live trace today, per the review), this means depositors
into a wallet the money merely happened to pass through — never confirmed as any kind of
collection/deposit hub — get reported to the officer as "victims" of THIS case. That's a real,
potentially harmful false claim (implicating unrelated third parties), not a UX nitpick.

**Fix:** only run the unreported-victims enumeration when the wallet being reported on has
actually passed the deposit gate as a genuine collection point — i.e. guard the whole block
behind `if gate is not None and gate.gate_passed:` (note: deliberately `gate.gate_passed`, not
`final_gate_passed` — `final_gate_passed` also requires `sweep_signal.is_sweep`, which is a
correctness signal for EXCHANGE attribution specifically; enough-distinct-payers alone is the
right bar for "this is a real hub worth checking other depositors of," even if we're not
confident enough to name it as an exchange). When the guard fails, `unreported_victims_out`
stays the empty list it's already initialized to — no new code path needed for the negative
case, just don't enter the block.

**Test:** a fixture where attribution fails to pass any candidate's full gate (so the code
falls to `evaluated[-1]`), and that fallback wallet, if enumerated, WOULD produce spurious
"unreported victims" from unrelated depositors — assert the response's `unreportedVictims` is
empty in this case. A second fixture where a real candidate passes `gate.gate_passed` (enough
distinct payers) even without `sweep_signal.is_sweep` (not confident enough to name the
exchange) — assert unreported-victim enumeration DOES still run there, confirming the guard is
`gate.gate_passed`, not `final_gate_passed`.

---

## Task G5: TRON and Bitcoin adapters should use real server-side time-window filtering (I-D)

**File:** `backend/app/chains/tron.py`, `backend/app/chains/bitcoin.py`.

**Problem:** Both adapters currently paginate up to `MAX_PAGES` (10) and filter by `since`
client-side AFTER fetching — meaning a genuinely busy wallet can still silently truncate before
reaching records near the `since` bound the tracer actually cares about. Task F7's own
researched claim that TronGrid has no server-side time-window filtering was factually wrong,
per this review: TronGrid's real API supports `min_timestamp`/`max_timestamp` query parameters
(and per-contract filtering) — using them turns "paginate up to 10 pages hoping we reach
`since`" into "ask the server to only return records at or after `since` in the first place,"
which is both more correct (no truncation risk for a busy wallet with a `since` bound) and
cheaper (fewer pages needed on average).

**Fix (TRON):** verify the real TronGrid endpoint's parameter names via WebFetch (do not guess
— the round-1 fix pass's own mistake here is exactly what this task exists to correct; verify
independently rather than trusting this task brief's characterization of the API). Add
`min_timestamp` (from the `since` argument, when provided, converted to the API's expected
epoch-millisecond format) to the request params alongside the existing `fingerprint` cursor
pagination — this doesn't replace pagination (a busy wallet can still span many pages even
within a time window) but bounds what the server returns in the first place, so the existing
10-page cap is far less likely to truncate before reaching genuinely relevant records. Keep
the existing client-side `since` filter as a correctness backstop (defense in depth — trust but
verify the server actually applied the bound correctly) rather than removing it.

**Fix (Bitcoin):** check whether Esplora's real API (verify via WebFetch, same discipline)
supports an equivalent time-window parameter; if it does, apply the same pattern. If Esplora
genuinely has no server-side time filtering (Bitcoin/Esplora's data model may not support it —
verify rather than assume), document that explicitly in a code comment (mirroring the honest
"TRON deliberately skipped an early-stop optimization" comment pattern from Task F7) rather than
silently leaving it unfixed with no explanation.

**Tests:** a fixture proving the TRON adapter actually sends `min_timestamp` in its request
params when `since` is provided (inspect the mock HTTP client's captured request, don't just
check the returned data) — same discipline as Task F7's own pagination-termination test
("proving the cap actually engages," not just "the test didn't hang").

---

## Task G6: cap redundant live-trace requests from repeated screen loads (I-E)

**Files:** `frontend/src/api/httpApi.ts` (the `getRoutes` implementation), possibly
`frontend/src/store/caseStore.ts` if a cache belongs there instead.

**Problem:** The review's other request-volume findings (F3's per-candidate refetch, F6's
doubled Ethereum calls, F7's pagination) are each individually justified by what they fix and
are not, on their own, wasteful re-work — the actual compounding problem is architectural:
`getRoutes` re-runs the ENTIRE live backend trace from scratch every time ANY of the 4 screens
that call it mounts (Route Choice, Exchange Attribution, Risk Score, Evidence all independently
call `api.getRoutes(caseId)` per the existing frontend architecture) — so a single case's trace
work (however many real HTTP requests G1-G5 above cause it to make) gets paid for up to 4x
during one investigator's walk through the flow, for identical inputs.

**Scope decision (deliberately narrow, per this pass's own stated discipline — a backend-side
trace cache with staleness/invalidation semantics is a bigger, riskier change than a hackathon
timeline should take on right now):** add a simple frontend-side memoization in
`httpApi.getRoutes` — cache the in-flight/most-recent `Promise<TraceResult>` per `caseId`, so
that a second call for the SAME case within the same session reuses the pending or completed
result instead of firing a new backend request. A `Reset demo` action or navigating to a
different case should not reuse a stale cached result — key the cache by `caseId` (not
global), and the cache entry doesn't need any explicit invalidation beyond that, given cases
are treated as immutable once traced in the current architecture.

**Fix:** wrap `getRoutes` in a small `Map<string, Promise<TraceResult>>` cache keyed by
`caseId`, checking the map before making a real network call and storing the promise (not just
the resolved value, so concurrent calls for the same case during the same mount also dedupe
against the in-flight request rather than firing twice) before returning it.

**Test:** call `getRoutes(sameId)` twice in quick succession (e.g. from two different mounted
components in a test harness, or two sequential calls before the first resolves) and assert
the underlying HTTP client's mock was only invoked once, not twice. A second test with two
DIFFERENT `caseId`s asserts both make independent real calls (the cache doesn't wrongly conflate
different cases).
