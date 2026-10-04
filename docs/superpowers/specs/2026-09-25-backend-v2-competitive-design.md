# Backend v2 — real tracing, gated attribution, VASP feed, freeze check

**Date:** 2026-09-25
**Status:** approved, ready for implementation planning
**Supersedes:** `2026-09-25-real-tracing-vasp-feed-design.md`

## Why this version exists

Two competitive reviews happened between the v1 spec and this one:
1. A structured review of 6 rival SIH-26183 repos (`ANVESHAK_Competitive_Review_and_Build_Plan.md`), scoring each against the PS line-by-line.
2. A follow-up deep read of 6 more rival repos (Himanshu-Harsh, vishalmudhirajpokala, shubhamkrverma031-rgb, LostEmperor08, yoyostuu, xarjunpatil), each fully cloned and read file-by-file.

Across all 12 rivals, a consistent pattern emerged: **every team that runs real tracing produces wrong or fabricated answers underneath a polished UI.** The most dangerous, most common bug is treating "a wallet swept its funds onward" as equivalent to "this is a verified exchange deposit address" — this appears, in some form, in at least 4 of the 12 rivals reviewed. v1 of our own spec did not explicitly gate against this. This version fixes that, and folds in every other concrete, reusable lesson from the 12 repos, plus the PS-completeness gaps nobody else covers (freeze check, real evidence reproducibility, honest provenance).

**Goal: correct answers, not just live-looking ones.** Multiple rivals have real API calls wired up and still produce wrong or fabricated results. Live data is necessary but not sufficient — the differentiator is refusing to answer with unjustified confidence.

## What carries over unchanged from v1

- Single FastAPI monolith, Postgres + Redis/Celery, Docker Compose, deployed to the user's EC2.
- Chain-client interface abstraction (`ChainClient` protocol) so tracing code never branches on chain.
- Rule-based sweep/consolidation detection (no ML for detection — label scarcity is still the binding constraint, per `docs/DECISIONS.md`).
- The VASP flagged-wallet broadcast feed (Idea 3) — **still unique across all 12 rivals reviewed.** Nobody else has a real push/pull distribution system; BlockWeave's SAHYOG send is fake, DRAVYA's integration is a pitch, not code. Keep building it exactly as v1 specified (pull API + push webhooks + demo VASP receiver).
- `VITE_USE_MOCK` frontend switch as the mock/real integration point — unchanged, already correctly designed for this.

## What's new in v2

### 1. Causal, time-monotonic tracing (replaces v1's plain BFS)

The single most common rival bug: following an outgoing transaction that happened *before* the victim's funds ever arrived, or picking "most recent outgoing tx" without checking it postdates the inflow. LostEmperor08 does exactly this (`topTx = outgoing[0]`, no timestamp check). ChainTrace (from the first review) had 83% of its taint traced to a payment made 90 hours *before* the victim sent anything.

**Rule:** every hop in `services/graph_builder.py` must satisfy `outgoing_tx.timestamp >= incoming_tx.timestamp`. Walk forward only. Track taint against the *victim's reported amount*, not the wallet's total outflow (another rival bug — taint measured against total activity inflates every downstream number).

**Anti-pattern to avoid** (from yoyostuu): don't build a separate "validator" script that does this correctly while the production code path does something looser. The number we report must come from the exact code that runs when an officer submits a real case — no parallel proof-of-concept implementation that never ships.

### 2. Gated deposit-address attribution (the critical correctness fix)

A sweep ≠ a deposit. `services/attribution.py`'s rule from v1 ("N+ distinct payers and a sweep into a verified/exchange-like hot wallet, and not hop 0") stays, tightened with one more gate found in this review:

**New gate, from Himanshu-Harsh's bug:** "has any inbound edge" is not the same as "received directly from the wallet under trace." Their code did `if data: direct_deposit = True` for any non-empty edge attributes — a mixer-routed deposit 4 hops downstream got flagged `DIRECT DEPOSIT`. Our attribution must check the specific inbound edge's source is the immediately preceding node in *this trace's* path, not merely that some inbound edge exists.

**Never default to naming a real exchange on an unresolved trace.** LostEmperor08 defaults `targetVasp` to `'Binance Exchange'` when no address matches its label list, and can auto-draft a freeze notice against the real company. If attribution doesn't clear the gate, the result is `UNKNOWN` / `unresolved`, shown honestly, never silently substituted with a plausible-looking real name. This is the same principle already in `CLAUDE.md` for the fictional "Meridian Digital Exchange" demo name — extend it to production: real exchange names only ever appear when the gate is actually cleared.

### 3. Calibrated confidence + honest states

- Confidence scores must be calibrated against held-out verified labels (report actual precision, not a hand-tuned number — FineX has 140 of 241 rows pinned at a 0.95 cap, which is not calibration).
- `wallets.status` gets first-class states: `at_rest`, `moving_unattributed`, `unreadable`, `at_exchange` — never collapse "couldn't read this wallet" and "confirmed clean" into the same UI state (a mistake FineX makes with its single CRITICAL catch-all).
- Every wallet/hop carries a `stop_reason` when tracing halts there (hop cap reached, no further transfers found, API read failure, chain unsupported) — this was ChainTrace's good idea, worth adopting directly.
- **No hardcoded weight constants disguised as computed scores.** yoyostuu sends `rules_score: 0.5, graph_features_score: 0.5` unconditionally in production while presenting a "4-signal ML blend." If a scoring component isn't wired up for real, either compute it or don't include it in the weighted sum — never ship a constant standing in for a real signal.

### 4. Vetted, sourced VASP labels (replaces v1's under-specified "public labeled datasets")

Every entry in the exchange-label table carries `address`, `chain`, `entity_name`, `source_url`, `verified_at`. Seeded from Etherscan's public label exports and community-maintained TRON exchange-address lists (as v1 specified), but now **vetted by behavior** before being trusted: `scripts/vet_labels.py` checks each seed label's actual on-chain behavior (high fan-in, low fan-out, consistent with a real hot wallet) rather than trusting the source list blindly — this catches the exact class of error BlockWeave made (a Uniswap router address labelled as CoinDCX) and CryptoTrace made (Binance 14 labelled as WazirX).

No repo in the 12 reviewed ships more than ~40 labels; our bar is a smaller but *correctly vetted* set over a larger unvetted one.

### 5. Freeze check + golden-hour urgency (new capability — zero of 12 rivals have this)

`services/freeze.py`: for a USDT (TRC-20/ERC-20) terminal wallet, query Tether's public `isBlackListed`/blacklist-status endpoint and the wallet's current unfrozen balance. Combine with time-since-last-move to compute a golden-hour urgency indicator (how much of the practical freeze window remains). This is the single most concrete "we help freeze money, not just find it" capability, and it's cheap to build — one or two API calls per terminal wallet, no new infrastructure.

### 6. OFAC + sanctions screening, shipped in-repo

Ship a refreshable `sdn.xml`-derived address list (per the source competitive doc's finding that FineX does this well) and screen every hop against it, not just the terminal wallet. A refresh script that **refuses silent removals** (an address disappearing from a re-pulled list is flagged for review, not silently dropped) — this guards against a stale or bad refresh quietly weakening the sanctions check.

### 7. Reproducible evidence (fixes v1's underspecified hashing + a concrete rival bug)

FineX's own evidence hashes can't be reproduced because they include the server's wall-clock timestamp at generation time. Fix: hash the **canonical, sorted, content-only** representation of each transfer/finding (no generation-time metadata inside the hashed payload); store the hash alongside a manifest (source URLs, raw response bodies) separately from the hash itself. The evidence pack's own SHA-256 is computed the same way — deterministic, re-verifiable by re-fetching the same on-chain data.

### 8. Honest mock-fallback signaling

Two rivals (yoyostuu, shubhamkrverma031-rgb) silently fall back to mock/placeholder data on any fetch failure with zero UI signal — a broken backend is indistinguishable from a working one at demo time. Our existing `DEMO DATA` chip rule (global, permanent, per `CLAUDE.md`) gets a companion **per-request provenance badge**: every number/panel on screen is tagged live / recorded / illustrative, shown inline (small, not intrusive) — directly adapted from FineX's provenance-badge idea, which the source competitive doc already flagged as worth copying. If a live call fails, the UI must say so, never silently render the mock value as if it were live.

### 9. Secrets discipline

LostEmperor08 ships two real API keys (Etherscan, TronGrid) hardcoded in client-side JS, publicly extractable from the deployed bundle. Our chain-client calls are already server-side only per the v1 architecture (frontend never talks to Tronscan/Etherscan directly) — this section is a confirmation, not a new decision: keep it that way, and add a CI check that fails the build if a plausible API-key-shaped string appears in any file under `frontend/`.

### 10. Cross-chain, deferred scope decision

v1 committed to TRON + Ethereum "both fully" from day one. This review found real cross-chain linking is unbuilt by every single rival (all "cross-chain" claims reviewed are either a hardcoded fictional bridge node, a string-equality match on a manually-set `cross_chain_ref` field, or absent entirely). Given that, and that nobody else has it either: **TRON + Ethereum tracing stays in scope as v1 specified (this is genuinely a differentiator once both work correctly)**, but real bridge-hop linking (matching a TRON-side bridge deposit to an Ethereum-side withdrawal by timing + amount correlation) is explicitly Sprint 2 scope, not Sprint 1 — don't let it block shipping a correct single-chain-at-a-time trace first. BTC support stays deferred (Sprint 3+), matching the source competitive doc's own prioritization.

## What we adopt directly from rival code (not just avoid their mistakes)

- **Hash-chained audit log** (Himanshu-Harsh's pattern, done correctly): each audit event hashes `actor|action|object_type|object_id|prev_hash`, genesis-anchored. Add what they're missing — a `verify_chain()` endpoint/check that actually walks the chain and confirms no link is broken, making tamper-evidence operational, not merely theoretical.
- **Per-finding `reasoning` + `limitations` breakdown** (Himanshu-Harsh) — every attribution candidate and every risk factor carries a plain-language reasoning string and an explicit limitations note. Matches our own "nothing is a black box" rule (`CLAUDE.md` #4) and is worth making structurally explicit in the API response shape, not just a UI convention.
- **Adaptive per-host rate limiting with Retry-After honoring** (ChainTrace, vishalmudhirajpokala) — both independently built solid versions of this; our chain HTTP client should do the same rather than hand-rolling naive retry.
- **Multi-provider fallback with response normalization** (vishalmudhirajpokala, LostEmperor08) — if one public explorer API is down/rate-limited, fall back to a second provider for the same chain, normalizing both into one internal shape.

## Correctness-guard checklist (binds every task in the implementation plan)

This is the gate every tracing/attribution/scoring task must pass before being considered done — copied forward as literal acceptance criteria, not aspirational prose:

- [ ] Every traced hop's timestamp is ≥ the timestamp of the transfer that funded it (causal, time-monotonic).
- [ ] Taint/value tracking is against the victim's reported amount, not the wallet's total outflow.
- [ ] A wallet is never labeled a deposit address from "has an inbound edge" alone — the inbound edge must be the immediately preceding node in this specific trace's path, plus the existing N-payers-and-sweep gate.
- [ ] Unresolved attribution renders as `UNKNOWN`, never silently defaults to a real exchange name.
- [ ] No scoring component is a hardcoded constant presented as a computed signal — if it's not wired up, it's excluded from the weighted sum, not faked.
- [ ] Every label carries `source_url` + `verified_at` and passes behavioral vetting before being trusted.
- [ ] Confidence is calibrated against held-out verified cases; the pipeline reports actual precision.
- [ ] Every wallet/hop has a `stop_reason` when tracing halts; `unreadable` is never conflated with `confirmed clean`.
- [ ] Evidence hashes are computed from canonical content only (no generation-time metadata inside the hash), and are independently reproducible by re-running the hash function against re-fetched data.
- [ ] Every UI panel shows a live/recorded/illustrative provenance badge; a failed live call never silently renders as if it succeeded.
- [ ] No API key or credential appears in any file under `frontend/`.

## Data model additions (on top of v1's schema)

- `wallets.status` — enum: `at_rest | moving_unattributed | unreadable | at_exchange`.
- `hops.stop_reason` — nullable text, set when tracing halts at this node.
- `flags.gate_passed` — bool + a JSON breakdown of which specific gate conditions were checked and their results, per attribution candidate.
- `vasp_labels` — replaces the flat lookup table implied by v1: `address`, `chain`, `entity_name`, `source_url`, `verified_at`, `vetting_status`.
- `freeze_checks` — `wallet_address`, `chain`, `is_blacklisted`, `unfrozen_balance`, `checked_at`, `golden_hour_minutes_remaining`.
- `sanctions_matches` — `wallet_address`, `list_source` (OFAC/etc.), `matched_at`, `list_version`.
- `evidence_manifest` — per evidence pack: list of `{source_url, raw_response_hash, fetched_at}` entries, separate from the pack's own top-level SHA-256.
- `audit_log` — `actor`, `action`, `object_type`, `object_id`, `prev_hash`, `hash`, `created_at`.

## Backend module layout (extends v1's layout)

```
backend/app/
  main.py  config.py  deps.py
  api/v1/  cases  traces  attribution  campaigns  evidence  notices  freeze  audit  health  vasp_feed
  chains/  base.py  tron.py  evm.py  http.py (adaptive pacer, multi-provider fallback, retry)
  tracing/ tracer.py (causal FIFO, stop_reason, taint-vs-reported-amount)
  detectors/ sweep.py  deposit.py (gated per checklist above)  fan_in_out.py
  clustering/ campaigns.py (union-find over hubs + deposit addresses)
  attribution/ labels/  vet_labels.py  scorer.py  calibrate.py
  freeze/  tether.py  fiu_status.py
  sanctions/ ofac_refresh.py (refuses silent removals)  screen.py
  evidence/ raw_store.py (canonical, content-addressed)  manifest.py  pack.py
  audit/   chain.py (hash-chained, with verify_chain())
  vasp_feed/ distribution.py (pull API + push webhooks, from v1)  demo_receiver/ (simulated VASP app)
  storage/ db.py  migrations/
tests/ unit/  probes/ (causality, burner-vs-deposit, hop-0, converging paths, unresolved-attribution-never-defaults)  contract/ (recorded fixtures, no live API calls in CI)
```

## Sprint plan

### Sprint 1 — a correct live core

1. Chain HTTP client: adaptive throttle, multi-provider fallback, cache with offline/pin mode.
2. TRON TRC-20 adapter, causal FIFO tracer with `stop_reason`, taint vs. reported amount.
3. Gated sweep + deposit-address detectors, passing every item in the correctness-guard checklist.
4. Vetted label seeds (source + verified_at + behavioral vetting), OFAC list shipped and screened per-hop.
5. Wire `httpApi` in the frontend; `VITE_USE_MOCK` flips per-case; provenance badges live.
6. Probe tests: causality, burner-vs-deposit, hop-0, unresolved-never-defaults-to-real-name.

### Sprint 2 — the VASP feed + Ethereum + freeze check (our unique ground)

7. Ethereum ERC-20 adapter, same gates as TRON.
8. VASP flagged-wallet feed: auto-flag on risk threshold, pull API, push webhooks, demo VASP receiver (full v1 spec, unchanged).
9. Tether freeze check + golden-hour urgency indicator, one-click freeze-request draft.
10. Bridge-hop linking (timing + amount correlation), Route A/B on real data.
11. Campaign clustering on real hub-wallet convergence.

### Sprint 3 — reproducibility, audit, completeness

12. Reproducible evidence hashing + manifest; hash-chained audit log with `verify_chain()`.
13. Calibration pass: precision reported against held-out verified cases.
14. Legal templates (BNSS §94/§106, BNS §223, BSA §63) reviewed by a mentor; SAHYOG-ready JSON payload.
15. ML risk scoring (LightGBM + SHAP), gated behind a data-quality check — only after the rule-based pipeline is correct and calibrated.

## Frontend fixes to do alongside this (cheap, do now regardless of backend timeline)

Pulled directly from the source competitive doc's own audit of our current frontend:
- `ReportDocument.tsx`'s claim that values were "read directly from public blockchain data" — make true, or label the PDF as demo data until it is.
- `mock.ts` — fix invalid-looking address formats, the double-counted Route A+B totals, the duplicate node, the suspect/scammer mismatch.
- `NodeDrawer.tsx` — USDT shown with a ₹ sign is wrong, fix the unit label.
- `Reset demo` doesn't actually reset the case store — real bug, fix it.
- Inconsistent timing claims (47s / 41s / "under a minute") — pick one measured figure once real tracing exists, or clearly label as illustrative until then.

## Explicit non-goals (still, per v1 and the source doc's own prioritization)

- Idea 1 (sovereign NCRP/bank/UPI join) — no data access, stays roadmap-only.
- Idea 2 (operator fingerprinting) — real, separate feature, own future design pass.
- BTC adapter — Sprint 3+ at earliest.
- Full ML risk model — gated behind a correct, calibrated rule-based pipeline first.
