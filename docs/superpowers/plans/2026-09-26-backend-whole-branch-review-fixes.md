# Plan: fix whole-branch review findings (Critical + Important)

Source: the mandatory final whole-branch review of `docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md`
(range `b7e7a7d..78da8aa`, all 12 tasks), run 2026-09-25 on opus with an executed probe script.
Full findings logged in `docs/TASKS.md` P1.5 and `docs/PROGRESS.md`'s "cont'd 6" entry. User
chose scope: fix all 3 Critical + all 11 Important findings; Minor findings stay documented,
not fixed, in this pass.

**Global constraints (apply to every task below):**
- `Decimal` for all money math; never introduce a `float` money field.
- Every new/changed human-readable string a non-technical reader sees must be plain English
  (no "gate", "hop", "taint", "sweep", "immediate predecessor", "vetted", "FIFO", "distinct
  payers") — the standing rule from Tasks 7/8/11/12.
- All data stays synthetic — no real exchange names, no real wallet addresses in seed data,
  tests, or fixtures (this pass also fixes an existing violation, Task F-Minor below is NOT
  in scope but is flagged for a separate quick pass).
- `Case`'s `chain` field and every chain-facing address comparison must be internally
  consistent — pick one casing convention (lowercase for chain identifiers; EVM addresses
  lowercase-normalized at the adapter boundary) and apply it everywhere the finding touches,
  not just at the one call site that happened to break.
- Every task must run the full backend suite (`cd backend && .venv/Scripts/pytest tests/ -v`)
  before committing, and the frontend tasks must run `cd frontend && npx tsc -b` clean.
- Do not silently expand scope beyond what each task states. Several findings have a
  deliberately narrowed fix (see each task's "Scope decision") rather than a full redesign —
  this is intentional, to keep this fix pass finishing in reasonable time; broader versions
  are logged back into `docs/TASKS.md` as new Minor/future items, not silently dropped.

**Task order matters:** F1 unblocks live verification for everything after it. F2 and F3 touch
the same taint/attribution invariants and should land before F4/F5 (which build on
`traces.py`'s attribution loop). F6-F10 are independent chain-adapter/detector fixes and can
run in any order after F3. F11 is UI-facing and independent of the rest.

---

## Task F1: unblock the live frontend→backend path (C1)

**Files:** `backend/app/main.py`, `backend/app/schemas.py` or `backend/app/chains/registry.py`,
`frontend/src/pages/NewCase.tsx` (or wherever case creation currently builds its request body
— locate via the existing `createCase`/`startTrace` call sites).

**Problem:** `NewCase.tsx` never sends `amountCrypto` and sends `incidentAt` in display format
(not ISO 8601) — case creation 422s. It also sends `chain: 'TRON'|'Bitcoin'|'Ethereum'`
(capitalized/mixed-case) but `chains/registry.py`'s `get_chain_client` only matches lowercase
literals — tracing 500s with an unhandled `ValueError`. There is no `CORSMiddleware` on the
FastAPI app, so a browser at Vite's dev origin can't even complete a preflight `OPTIONS`
request before any of the above matters.

**Fix:**
1. Add `fastapi.middleware.cors.CORSMiddleware` to `backend/app/main.py`, allowing the Vite
   dev origin(s) (read `frontend/.env.development` for the actual dev port; support both
   `http://localhost:5173` and `http://127.0.0.1:5173` to be safe) — methods `GET`/`POST`,
   headers `*`, no credentials needed (no cookie auth in this project).
2. Make chain matching case-insensitive at the boundary: either normalize `payload.chain` in
   `create_case` before storing (`.lower()`), or make `get_chain_client` accept a raw string
   and `.lower()` it before comparing. Prefer normalizing once, at case-creation time, so
   every downstream read of `case.chain` is already canonical lowercase — don't scatter
   `.lower()` calls across every consumer.
3. In the frontend's case-creation form/submit handler, include `amountCrypto` as a real
   collected field (check what `NewCase.tsx` currently collects — if the field exists in the
   form state but isn't being sent, that's the bug; if it's missing from the form entirely,
   add a minimal input for it) and send `incidentAt` as `new Date(...).toISOString()`, not the
   display-formatted string. Send `chain` as whatever canonical value the backend now accepts
   (lowercase) rather than the display label — map the UI's display labels
   (`'TRON'`/`'Ethereum'`/`'Bitcoin'`) to lowercase values at the point of building the request
   body, don't change what's displayed to the user.

**Verification (this is the part Task 12 skipped — do not skip it this time):**
Actually run both servers and complete one real browser round-trip:
```bash
cd backend && .venv/Scripts/uvicorn app.main:app --reload --port 8000
```
(separate terminal) start the Vite dev server with `VITE_USE_MOCK=false`, open the New Case
screen, fill in a real form submission, and confirm in the browser network tab that
`POST /api/v1/cases` returns 201 and `POST /api/v1/cases/{id}/trace` returns 200 — not just
that `tsc -b` is clean. Screenshot or paste the actual response bodies into the task report as
evidence. If a real backend server can't be started in the implementer's environment, say so
explicitly in the report as a concern rather than substituting a weaker check.

**Tests:** a focused backend test confirming `get_chain_client`/case creation accepts
`"TRON"`, `"tron"`, `"Tron"` equivalently (whichever normalization point you chose) and that
`OPTIONS /api/v1/cases` returns CORS headers for the dev origin.

---

## Task F2: converging trace paths must accumulate taint, not drop it (I7)

**Files:** `backend/app/tracing/tracer.py`, its tests.

**Problem:** `trace()`'s `visited` set causes a second arrival at an already-visited wallet to
be silently dropped — including its taint. Two victims (or two branches of the same victim's
funds) converging on the same hub wallet lose the second branch's value entirely, which
directly undermines the project's own "Consolidation" thesis and produces a false
"unreconciled" conservation result even when the trace is actually complete. The design spec
lists a "converging paths" probe test that was never added — this task adds it.

**Scope decision:** fix the accumulation, not the whole BFS structure. When a hop for an
address that's already been visited is dequeued, add its taint to the EXISTING `TraceHop`
record for that address (update `taint` in place) instead of creating a duplicate hop or
discarding it. Do not re-expand that wallet's own outgoing edges a second time (that would
double-count downstream) — only fold the incoming taint into the existing node. If the
existing hop already has a `stop_reason` set (already fully processed), the added taint should
still count toward totals but does not need to re-trigger re-expansion.

**Tests:** a fixture where two separate causal branches from the suspect wallet both reach the
same third wallet; assert the resulting hop's `taint` equals the sum of both branches
(FIFO-capped as before per-branch, but not lost on merge), and that conservation reconciles
correctly for a case where the two branches' amounts + this hub's outgoing exactly account for
the reported amount.

---

## Task F3: attribution must not name an exchange for a wallet holding none of the victim's money, and the sweep check must be reachable for a real deposit address (C2 + C3 + I9 + I1 + I6, merged)

**Merge note (added when F3 was actually dispatched):** F4 (I1 — guard chain-API refetch
failures) and F5 (I6 — exclude every trace-path wallet from unreported-victims, not just the
suspect) are absorbed into this task rather than run as separate tasks. All three land in the
exact same ~50-line block of `traces.py` that this task already fully rewrites (the per-hop
attribution loop this task introduces makes multiple `get_transfers` calls, one per candidate
— exactly where I1's guarding needs to apply — and the same loop already has every wallet in
`result.hops` in scope, which is exactly what I6's fix needs). Doing them as 3 separate serial
passes over the same lines would be pure waste. F4 and F5 below are marked absorbed; their
fixes are folded into this task's brief.

**Files:** `backend/app/api/v1/traces.py`, `backend/app/detectors/sweep.py`, their tests.

**Problem (read `docs/PROGRESS.md`'s "cont'd 6" entry for the full probe evidence before
starting):**
- `traces.py` currently picks `terminal_hops[-1]` (whichever wallet the BFS physically stopped
  at last) as the sole attribution candidate. Task 6's own FIFO fan-out budget can legitimately
  allocate a stopping wallet exactly 0 taint (a sibling branch consumed the whole budget
  first) — so an unrelated wallet holding none of the victim's money can be attributed.
- `detect_sweep` is only ever evaluated against the wallet the tracer chose to stop at. But a
  wallet only becomes a stop point if it did NOT forward money on after the victim's funds
  arrived — which is the exact opposite of what a real sweeping deposit address does. A real
  exchange deposit wallet that sweeps the victim's own deposit onward gets walked straight
  past by the tracer's causal expansion and is never evaluated for attribution at all.
- `detect_sweep` also has no upper bound on `value_preserved_pct`, and is anchored to the
  wallet's first-ever incoming transfer (from full history), not the specific transfer that
  this trace's own funds arrived through — so it can flag "sweep" behavior unrelated to the
  victim's actual money, or accept a wallet that forwarded far more than it received as if
  that were a legitimate 100%+ sweep.

**Fix (this is one coherent design change across the three problems, not three patches):**
1. In `run_trace`, build attribution candidates from EVERY hop in `result.hops` with
   `hop_index > 0` and `taint > 0` (Decimal comparison) — not just `result.terminal_hops`. A
   hop with `taint == 0` never qualifies as a deposit-address candidate: nothing the victim
   sent ever reached it, so naming an exchange there is never correct regardless of what else
   is true about that wallet.
2. For each candidate hop, fetch its full transfer history exactly as before (fix from Task
   11: `client.get_transfers(hop.wallet_address)`, filtered both directions), compute
   `distinct_payers` from that, and run `evaluate_deposit_gate` as before.
3. Anchor the sweep check on THIS hop's own funding transfer, not the wallet's earliest-ever
   transfer: call `detect_sweep(hop.wallet_address, incoming=[hop.funding_transfer],
   outgoing=outgoing_from_wallet)` — i.e. pass a single-item incoming list (the specific
   transfer that carried the victim's traced money into this wallet), so `detect_sweep`'s
   "first_in" is genuinely this trace's own money, not some unrelated earlier transfer to the
   same wallet. This also naturally fixes the "wallet never stopped here" problem: a wallet
   that DID sweep the money onward (and so has `stop_reason = None`, still causally followed
   by the tracer) is now still evaluated, because candidacy no longer depends on
   `stop_reason` being set at all.
4. In `backend/app/detectors/sweep.py`, add an upper bound so `is_sweep` requires
   `SWEEP_MIN_VALUE_PRESERVED <= preserved <= SWEEP_MAX_VALUE_PRESERVED` (add a new constant,
   suggest `1.02` — allows small rounding/fee-inclusive slack above 100%, rejects anything
   that forwarded meaningfully more than it received, which is not "sweeping this deposit,"
   it's combining with other funds).
5. Selection among multiple qualifying candidates: evaluate candidates in ascending
   `hop_index` order (closest to the suspect wallet first) and attribute to the FIRST one
   where `gate.gate_passed and sweep_signal.is_sweep` both hold. This is a deliberate,
   documented choice — the earliest genuine deposit point in the causal chain is the most
   directly implicated and most actionable for an investigator. If you think a different
   selection rule is clearly better given what you find while implementing, note it in your
   report as a concern rather than silently picking something else.
6. If no candidate passes, report using the LAST candidate hop in the list (i.e. the wallet
   closest to wherever the traceable money currently sits) for the failure `reasoning`/
   `limitations` text — this preserves the "here's the most useful next place to look" framing
   the old code had, just sourced from a real candidate instead of an arbitrary BFS artifact.
   If there are no candidates at all (every hop has `taint == 0` past hop 0, which shouldn't
   normally happen but guard it), keep the existing "no stopping point to evaluate" message.

**Tests — all four of these must exist and demonstrably fail without the fix (write them
first, confirm RED, then GREEN):**
1. Zero-taint wallet reproduction: suspect sends 150 to wallet A and, in a separate causal
   branch, some large unrelated amount to wallet B such that B ends up with `taint == 0`
   (mirror the reviewer's probe). Confirm B is never attributed even if it would otherwise
   pass every other gate.
2. Sweeping-but-not-terminal wallet: construct a case where the deposit-candidate wallet DOES
   forward the victim's money onward shortly after receiving it (so the tracer's causal filter
   follows it to a further hop, and it is NOT in `result.terminal_hops`) — confirm it is now
   correctly evaluated and can pass the full gate.
3. Sweep anchored to the wrong transfer: a wallet with a much-earlier, unrelated first-ever
   transfer that happens to look like a sweep, but whose response to THIS trace's own funding
   transfer does not qualify — confirm `detect_sweep` is evaluated against the right transfer
   and does not false-positive off old, unrelated history.
4. Sweep upper bound: a wallet that received X and forwarded far more than X shortly after —
   confirm `is_sweep` is `False`.

Run the full backend suite after — this touches shared logic several existing tests rely on;
if any existing test's fixture assumptions broke because attribution semantics changed, fix
the fixture (not the new logic) only if the old fixture was relying on the buggy behavior
being fixed here — say so explicitly in the report if that happens.

---

## Task F4 (ABSORBED INTO F3 — see F3's merge note): don't 500 when a chain API read fails mid-attribution (I1)

**Files:** `backend/app/api/v1/traces.py`, its tests.

**Problem:** the tracer already turns a chain-API failure into a clean `api_read_failure` stop
reason, but `traces.py`'s three separate refetches (candidate wallet full history in F3's new
loop, `enumerate_unreported_victims`, the suspect wallet's own history for innocence) call
`client.get_transfers(...)` again with no guard — any of these re-raises as an unhandled
exception, which FastAPI turns into a bare 500.

**Fix:** wrap each of these three refetch call sites in a `try`/`except` that catches whatever
exception class the chain adapters actually raise on a failed request (check
`backend/app/chains/http_client.py` and one adapter for the real exception type rather than
guessing — likely an `httpx`/`requests` exception or the adapters' own `ValueError` for
malformed records) and falls back to an empty transfer list plus an honest note. Do not
silently treat "API read failed" the same as "wallet has no history" in anything the API
response exposes — if you add a field to signal this (e.g. a `dataIncomplete: bool` or a note
folded into `limitations`), keep it plain English and don't invent new schema fields the
frontend doesn't consume without checking `frontend/src/api/httpApi.ts` first — if adding a
new response field, this task also updates `httpApi.ts`'s local `BackendTraceOut` type to
match (a two-line addition, not a redesign).

**Tests:** simulate a chain client whose `get_transfers` raises on the candidate-wallet
refetch, the victim-enumeration refetch, and the innocence refetch independently (three
focused cases) — confirm the endpoint still returns 200 with an honest, non-crashing result
in each case, not a 500.

---

## Task F5 (ABSORBED INTO F3 — see F3's merge note): unreported-victim enumeration must not list the criminal's own wallets as victims (I6)

**Files:** `backend/app/api/v1/traces.py`, its tests.

**Problem:** `enumerate_unreported_victims` is called with
`known_victim_addresses={case.suspect_wallet}` — only excluding the original suspect wallet.
For any multi-hop trace, an intermediate wallet in the causal path (e.g. a hub the money
passed through) shows up in the "unreported victims" list, because it's a payer into the
attributed wallet from the criminal's own side, not a genuine additional victim.

**Fix:** exclude every wallet address already present in `result.hops`, not just
`case.suspect_wallet`: `known_victim_addresses={h.wallet_address for h in result.hops}`.

**Tests:** a 2+-hop trace where an intermediate hop wallet also appears as a payer into the
attributed wallet in the chain client's fixture data — confirm it's excluded from
`unreportedVictims`, and a genuinely separate third-party payer is still included.

---

## Task F6: Ethereum adapter — error handling, address casing, endpoint currency, native ETH (I3)

**Files:** `backend/app/chains/evm.py`, its tests, possibly `backend/app/api/v1/traces.py` /
`frontend` if a scope decision below requires a small follow-on change.

**Problem (four distinct issues in one adapter):**
1. Any Etherscan response with `status != "1"` is turned into `[]` — this conflates "no
   transactions found" (a legitimate empty result) with a rate limit, bad API key, or
   deprecated-endpoint error (which Etherscan reports as HTTP 200 with `status "0"`/`"NOTOK"`
   and a message field). Real errors are silently swallowed as "wallet has no activity."
2. The adapter targets `https://api.etherscan.io/api` (V1). Etherscan is reported to have
   deprecated V1 in favor of a V2 endpoint (`/v2/api?chainid=1`) — **verify this against
   current Etherscan documentation before changing anything** (use WebFetch/WebSearch if
   available in your environment; if not available, say so in your report and flag this as
   unverified rather than guessing). If V1 truly no longer works, every ETH trace today
   silently returns "no outgoing activity" for every wallet, which is a severe, undetected bug
   given issue #1 above masks the real error.
3. Etherscan returns lowercase addresses; every downstream comparison in this codebase
   (`tracer.py`, `traces.py`, `graph/backward.py`, `detectors/innocence.py`,
   `labels/seed_labels.py`) is case-sensitive. A checksummed (mixed-case) suspect address
   entered by a user matches nothing.
4. `tokentx` only covers ERC-20 transfers; native ETH transfers are never fetched, even though
   the frontend's case-creation form offers `ETH` as a selectable asset.

**Scope decision for issue 4 (native ETH):** implementing full native-ETH tracing (a second
Etherscan endpoint, `txlist`, merged with `tokentx` results into one `Transfer` stream) is a
reasonable amount of work but not overly large — do it if issues 1-3 leave you enough budget
in this task; if it turns out more involved than expected (e.g. needs its own fee/gas
handling to stay consistent with `Transfer.fee`), STOP and report DONE_WITH_CONCERNS rather
than shipping a half-implementation, and note the frontend's ETH option should be temporarily
removed or clearly labeled if native ETH tracing isn't landing in this task.

**Fix:**
1. Distinguish "no transactions" from a real error: Etherscan's convention is
   `status: "0", message: "No transactions found"` for a genuine empty result vs. `status:
   "0"` with a different message (or `message: "NOTOK"`) for real errors — raise an exception
   (the same class the HTTP client / other adapters use for a failed read, so Task F4's
   guarding catches it uniformly) for anything that isn't the genuine-empty case.
2. Verify the V1-vs-V2 endpoint question and fix if confirmed deprecated.
3. Normalize every address this adapter returns (`from_address`, `to_address`) to lowercase in
   `_normalize`, and normalize wallet/case addresses the same way wherever an Ethereum-chain
   case address is accepted or compared (coordinate with Task F1's case-creation
   normalization point if that's already landed — add EVM lowercasing there too, don't
   duplicate the logic in multiple places).
4. Fetch and merge native ETH transfers if in scope per the decision above.

**Tests:** Etherscan `status: "0"` with a real error message raises; genuine empty result
returns `[]`; a mixed-case input address is normalized and matches a lowercase record from the
API; (if native ETH implemented) a native-ETH transfer round-trips into a `Transfer` correctly.

---

## Task F7: stop truncating TRON and Bitcoin transfer history silently (I2)

**Files:** `backend/app/chains/tron.py`, `backend/app/chains/bitcoin.py`, their tests.

**Problem:** TRON's adapter fetches `limit=200` with no pagination — a busy wallet's older
history beyond the first 200 records is invisible, and a wallet that looks like a trace
stopping point may simply be one whose relevant older transfers were never fetched. Bitcoin's
Esplora adapter fetches only the newest ~25 confirmed transactions via `/address/{a}/txs` with
no follow-up pagination call. Payer counts, sweep detection, innocence, and unreported-victim
enumeration all silently run on this partial data with no indication it's partial.

**Scope decision:** fix by actually paginating (not by adding a `truncated` flag and leaving
the gap) — both APIs support it:
- TronGrid: `/v1/accounts/{address}/transactions/trc20` accepts a `fingerprint` cursor from
  the previous response's `meta.fingerprint` for the next page; loop until no fingerprint is
  returned or a sane page cap is hit (pick something generous but bounded, e.g. 10 pages / up
  to 2000 records, to avoid an unbounded loop against a wallet with years of history — note
  the cap you chose and why in your report; if the true correct behavior needs a `since` date
  bound instead of a hard page cap, use `since` when the caller provides one, matching the
  existing `since` parameter this method already accepts).
- Esplora: `/address/{a}/txs/chain/:last_seen_txid` continues from the oldest tx of the
  previous page; loop similarly with the same bounded-page reasoning.

**Tests:** a mocked multi-page response for each adapter (2+ pages) — confirm all pages are
merged into one result, not just the first.

---

## Task F8: filter transfers by the case's own asset/token contract (I4)

**Files:** `backend/app/chains/tron.py`, `backend/app/chains/evm.py`, possibly
`backend/app/chains/base.py` if a shared filtering point makes more sense than adapter-level
filtering — your call, but keep it to one place, don't filter redundantly in multiple spots.

**Problem:** nothing filters by `Transfer.asset` or the underlying token contract address
against the case's own declared asset. A spam/poisoned-address token contract can emit
transfer events with an arbitrary, attacker-chosen `from_address` that has nothing to do with
the real fund flow — the tracer has no way to tell this apart from a genuine transfer and will
follow it, and payer-count/innocence-throughput calculations mix it in with genuine USDT
transfers.

**Fix:** the TRON adapter already normalizes `asset` from `token_info.symbol` — filter
`get_transfers`'s returned records to the token contract matching the wallet's declared asset
(the TRON test fixture, `tron_trc20_sample.json`, should already have a real USDT-TRC20
contract address you can use as the known-good filter value — check it rather than
hardcoding a fresh one). Do the equivalent for the Ethereum adapter's `tokentx` `contractAddress`
field. This needs the adapter to know which asset/contract it should be filtering for — check
how `get_chain_client`/the adapter constructors currently get their configuration and add
whatever's the smallest consistent way to pass "the case's asset" through (e.g. an optional
constructor/method parameter), rather than hardcoding one specific contract at the adapter
class level.

**Tests:** a mocked response containing both the case's real asset's transfers and an
unrelated/spam-token transfer — confirm only the matching-asset transfers survive.

---

## Task F9: Bitcoin multi-input transactions must not inflate distinct-payer counts (I5)

**Files:** `backend/app/chains/bitcoin.py`, its tests.

**Problem:** the adapter currently emits one incoming `Transfer` per input address on a
multi-input transaction, each carrying the wallet's full received value. A single ordinary
self-consolidation transaction with 3 inputs counts as 3 distinct payers — enough to pass
`MIN_DISTINCT_PAYERS` on its own, which is backwards: the common-input-ownership heuristic
says all inputs of one transaction usually belong to ONE owner, not N different payers. It
also multiplies unreported-victim totals and innocence throughput by the input count.

**Fix:** for a multi-input transaction, emit exactly ONE incoming `Transfer` representing that
transaction (using one representative input address — e.g. the first input in the record, or
whichever the adapter already picks as canonical per its existing `multi_input` handling —
check what `raw["multi_input"]` is already recording, since the adapter apparently already
detects this case but doesn't act on it), carrying the wallet's actual received value once,
not once per input.

**Tests:** a mocked multi-input transaction fixture — confirm exactly one `Transfer` is
produced for it (not one per input), and its amount is not multiplied by input count.

---

## Task F10: bridge-linking must not self-pair, and must be honestly scoped given this architecture (I8)

**Files:** `backend/app/api/v1/traces.py`, `backend/app/bridge/linker.py`, `docs/TASKS.md`.

**Problem:** `traces.py` calls `find_bridge_links(all_outgoing, all_outgoing)` — the same
list on both sides. Every transfer's best match is itself (zero time delta, zero amount
delta), and because `find_bridge_links` picks the best match by time delta BEFORE the
same-chain output filter is applied, a genuine cross-chain candidate would lose to the
self-pair and then get filtered out anyway. Since a single case only ever traces ONE chain in
this architecture (`Case.chain` is one value), `all_outgoing` can in practice never contain
more than one chain's transfers regardless — so bridge-linking is structurally dead code as
currently wired, self-pairing bug or not.

**Scope decision:** do NOT attempt to make cross-chain bridge detection actually work in this
task — that needs a case to trace on two chains simultaneously and correlate between them,
which is a bigger architecture change (a case would need to name a second "bridge-destination"
chain/wallet, and `run_trace` would need to run two chain clients) than "fix a bug." Instead:
1. Fix `find_bridge_links` itself so it can never self-pair regardless of caller (exclude a
   candidate from matching itself by `tx_hash` equality, and exclude same-`chain` pairs
   *before* picking the best match, not after) — this makes the function correct in isolation
   even though nothing currently calls it with genuinely different-chain data.
2. In `traces.py`, keep calling it (harmless — will simply keep returning `[]` given
   single-chain data, which is honest) but add a one-line code comment explaining why it's
   currently always empty and what a real fix would need, so the next person doesn't have to
   rediscover this.
3. Add a `docs/TASKS.md` P3 item: "Real cross-chain bridge-hop linking needs a case model that
   traces two chains — deferred, not built despite Task 10 implementing the correlation logic
   in isolation."

**Tests:** unit tests directly on `find_bridge_links` — same-`tx_hash` never matches itself,
same-chain pairs never match, a genuine two-different-chains-different-tx-hashes-within-tolerance
case still matches correctly (regression-guard the existing fee-direction-asymmetry behavior
from Task 10's own fix pass, don't regress it).

---

## Task F11: fix plain-English leaks in live API output, and stop overclaiming an integration that doesn't exist (I10 partial + I11)

**Files:** `backend/app/api/v1/traces.py`, `backend/app/detectors/innocence.py`,
`frontend/src/api/httpApi.ts`.

**Problem:**
- Raw internal codes (`api_read_failure`, `no_outgoing_activity`, `hop_cap_reached`,
  `no_further_transfers`) go out verbatim as each hop's `flag` field and get rendered as
  literal badges in the UI (`RouteCard.tsx`, `HopTable.tsx`) — they don't match that
  component's expected vocabulary (`"SUSPECT"`/`"SWEPT"`/`"EXCHANGE"`/etc.) at all, so hop
  coloring silently doesn't work in live mode, and any code path a badge DOES render shows raw
  jargon to a judge/officer.
- Hop `role` is either `"suspect"` or `"intermediate"` — also raw internal vocabulary,
  never matching the frontend's existing role display expectations.
- `innocence.py`'s "negligible fraction of throughput" sentence prints a bare `Decimal` with no
  unit: "The victim's 150.0 is less than 5%...". Needs the asset name attached.
- `innocence.py`'s own docstring claims "when innocence is high the notice-drafting flow
  refuses to fire (wired in the API layer, Task 11)" — this was never built anywhere, in
  Task 11 or since. The docstring overclaims a finished integration that doesn't exist.

**Scope decision:** this task fixes the STRING-LEVEL jargon leaks and the false docstring
claim. It does NOT implement the "high innocence blocks notice drafting" feature itself —
that's a real feature (a notice-drafting flow doesn't exist yet in this backend at all; it's
future scope per `docs/TASKS.md`'s deferred items). Fix the docstring to say it's planned, not
done, and add a `docs/TASKS.md` P2/P3 note that this integration is still unbuilt so it isn't
silently forgotten.

**Fix:**
1. Map `stop_reason`/`flag` values to plain-English equivalents that also make sense next to
   whatever vocabulary `RouteCard.tsx`/`HopTable.tsx` already expect — read those two
   components first to see what flag strings they actually branch on, and produce values
   compatible with that existing display logic where a sensible mapping exists (e.g. a hop
   that stopped because it swept elsewhere maps toward whatever concept already renders as
   "swept"), falling back to a clear plain-English sentence fragment (not a raw code) for any
   internal state that has no existing UI concept to map to.
2. Map `role` (`"suspect"`/`"intermediate"`) the same way — check what the frontend already
   expects for a hop role, if anything, and align.
3. Fix `innocence.py`'s throughput sentence to include the asset name (available on the
   `Transfer`/case data already flowing through `compute_innocence` — check what's accessible
   at that call site; if `compute_innocence`'s signature doesn't currently receive an asset
   string, that's a small signature addition, not a redesign).
4. Fix `innocence.py`'s docstring per the scope decision above.
5. Update `frontend/src/api/httpApi.ts`'s `toRoute`/hop mapping if the plain-English values
   chosen in steps 1-2 need a corresponding frontend-side change to actually display well (only
   if needed — if the backend now emits values the frontend already handles, no frontend
   change may be necessary; check before editing).

**Tests:** backend jargon-regression test extended to cover `flag`/`role` output (matching the
existing pattern in `test_deposit_gate.py`/`test_innocence.py`); a test confirming the
throughput sentence includes a unit/asset name.

---

## After all 11 tasks

Run the full backend suite and `frontend`'s `tsc -b` one final time. Update `docs/TASKS.md`'s
P1.5 section (mark each fixed finding, keep Minor findings as still-open documented gaps) and
`docs/PROGRESS.md`. Then dispatch a second whole-branch review (same range extended to the new
HEAD, opus) before considering this fix pass done — the same discipline that caught these
findings in the first place should verify they're actually fixed, not just claimed fixed.
