# Tasks

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Owner: initials. Update the status **in the same commit** as the work.

## Where things stand (2026-09-25)
Read `docs/PROGRESS.md` top entry for full narrative.

1. **Frontend, React app (`frontend/`)** — all 9 screens built and functionally complete against mock data (Phase 1 of the original migration plan, `docs/plans/react-migration-plan.md`, Tasks 1-8 all done).
2. **Frontend, UI v2 visual redesign — COMPLETE.** Full migration from the neumorphic CSS-Modules system to a Tailwind v4 + shadcn-style flat/white-card system (light theme, aurora page background). All 6 tasks in `docs/plans/ui-v2-redesign-plan.md` done, reviewed clean, dead neumorphic system fully deleted. `npm run build` zero errors. Since then, a pilot pass (primitives + Dashboard) pushed the visual language closer to a reference fintech dashboard: pill-shaped buttons/tabs, per-KPI multi-color icon tiles, recolored trace chart — not yet propagated to the other 12 screens.
3. **Backend (`backend/`) — Sprint 1 (12/12) + both whole-branch fix passes (F1-F11, G1-G6) + Sprint 2/3 (H0-H8, H11) ALL COMPLETE.** Design spec approved: `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`. Real causal multi-chain tracing (TRON+Ethereum+Bitcoin), gated attribution, campaign clustering, VASP flagged-wallet feed, Tether freeze check, OFAC screening, reproducible evidence hashing, hash-chained audit log, legal notice templates + SAHYOG payload, ML risk scoring (LightGBM+SHAP, synthetic-data-disclosed) — all built, reviewed clean, and wired into the live trace path (Task H11). 240/240 backend tests green. Two known follow-up gaps, both honestly discovered mid-implementation and documented, not hidden: `Hop` rows are never persisted (affects evidence-pack completeness), and the 3rd whole-branch review (after G1-G6) was explicitly skipped by user decision — see `docs/PROGRESS.md` for both. Docker Compose (H9) and 5 cheap frontend fixes (H10b) are the only items left in `docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md`.

## P0 — UI v2 redesign (`docs/plans/ui-v2-redesign-plan.md`) — DONE
- [x] Task 1: remaining primitives (Input/Toast/Gauge/Spinner/Well/PlainWords) + layout shell restyle @Claude
- [x] Task 2: Dashboard, Case Closed, Campaign restyle @Claude
- [x] Task 3: New Case, Tracing, Route Choice restyle @Claude
- [x] Task 4: Exchange Attribution, Risk Score restyle @Claude
- [x] Task 5: Evidence page (graph/report/lawful-action tabs) restyle @Claude
- [x] Task 6: cleanup — dead neumorphic CSS deleted, imports normalized, full click-through QA @Claude

## P1 — Backend (plan written, in active execution: `docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md`)
- [x] Task 1: FastAPI scaffolding, config, SQLAlchemy DB models @Claude
- [x] Task 2: adaptive HTTP client (per-host throttle, Retry-After honoring) + chain client base @Claude
- [x] Task 3: TRON TRC-20 adapter over TronGrid @Claude
- [x] Task 4: Ethereum ERC-20 adapter over Etherscan @Claude
- [x] Task 5: Bitcoin adapter over Blockstream Esplora, UTXO normalization @Claude
- [x] Task 6: chain registry, causal FIFO tracer, conservation invariant @Claude
- [x] Task 7: vetted VASP label seeds, gated sweep + deposit-address detectors (correctness-guard checklist) @Claude
- [x] Task 8: exculpatory/innocence scorer @Claude
- [x] Task 9: backward unreported-victim enumeration @Claude
- [x] Task 10: cross-chain bridge-hop linker (timing + amount correlation) @Claude
- [x] Task 11: API layer — cases/traces endpoints wiring everything together @Claude
- [x] Task 12: frontend `httpApi` wiring against the real endpoints @Claude

Deferred past this plan, unchanged from the approved spec: VASP flagged-wallet broadcast feed, Tether freeze check + golden hour, OFAC/sanctions screening, reproducible evidence hashing + hash-chained audit log, calibration pass, legal templates + SAHYOG payload, ML risk scoring.

**New standing rule (2026-09-25):** every backend-generated string meant for a human reader (risk-score reasons, attribution reasoning, innocence factors, flagged-exchange explanations) must be plain, non-technical English a 12-year-old could follow — extends CLAUDE.md rule 3 explicitly to backend prose, not just frontend copy. Task 7's `reasoning`/`limitations` fields follow this; carried into Tasks 8 and 11.

**Resolved in Task 11:** `detect_sweep()` is now consumed and AND-combined with the payer/label gate (`final_gate_passed = gate.gate_passed and sweep_signal.is_sweep`) in `backend/app/api/v1/traces.py`. Task 11's review also caught and fixed 2 further plan-mandated bugs beyond the 3 pre-flight corrections: the "immediate predecessor" check was a tautology (fixed via an independent `_verified_predecessor` cross-check against the trace's own hop list), and the innocence scorer was fed only forward-followed transfers, so it could never see money sent *to* the suspect wallet (fixed by fetching the suspect wallet's own full history separately).

**Task 12 note:** review caught 2 more plan-mandated bugs in the brief's own sample code, both fixed same pass: `routeB`'s placeholder was spreading the real route's hop count/value (self-contradictory next to "Not yet computed" — now an honest all-zero literal), and `valueCrypto` used `Math.max` over every hop's amount (risking a consolidation-hub total instead of the victim's own reported amount — now reads `conservation.incomingTotal`, the server-computed reported amount).

**Known gap, called out not hidden (Task 12):** the backend's real trace is a flat hop list + one attribution, but the frontend's `TraceResult` type still has a fixed two-route (`routeA`/`routeB`) shape from the mock-data design. `routeA` gets the one real trace; `routeB` is an honest "Not yet computed" placeholder. A real N-ary-route frontend type change is out of scope for this plan — future work if the UI needs to show multiple real branches.

## P1.5 — Final whole-branch review findings (2026-09-25) — triaged, fix plan: `docs/superpowers/plans/2026-09-26-backend-whole-branch-review-fixes.md` — ALL 11 TASKS (F1-F11) COMPLETE, second whole-branch review complete (see P1.6)

## P1.6 — Second whole-branch review findings (2026-09-26) — TRIAGED, fix plan: `docs/superpowers/plans/2026-09-26-backend-review2-fixes.md` (tasks G1-G6) — user chose: fix C-A + all 5 Important, defer the 6 Minor. ALL 6 TASKS (G1-G6) COMPLETE. **User explicitly chose to SKIP the mandatory 3rd whole-branch review** (stopped mid-dispatch — it had been started on opus, which violated the user's standing "sonnet medium/high only, no exceptions" rule) — round-2 fix pass is considered done without that final cross-task-interaction check. This is a real, accepted risk given the hackathon timeline, not an oversight: the prior TWO whole-branch reviews in this project both found real cross-task bugs no per-task review caught, so it is plausible (not confirmed) that G1-G6 have a similar undiscovered interaction bug. Re-run one later if time allows — see `docs/PROGRESS.md`'s entry for the exact command/range.
The fix plan's own closing step (a second whole-branch review, opus + executed probe script,
range `78da8aa..06f0093`) independently re-verified several of the fix pass's external-fact
claims (all held up) but found the fix pass's OWN changes interact badly in places no single
task's review could see. **Do not claim Ethereum attribution or live-mode busy-wallet tracing
is trustworthy until these are fixed (in progress below).**
- [x] **C-A (Critical, Task G1 DONE) — Ethereum traces mix assets/units, reproducing the C2 bug class on the ETH path:** the frontend's only Ethereum option (`'ETH'`) resolves to no asset-contract filter, so spam ERC-20 tokens still merge with native ETH transfers and the tracer's FIFO budget compares ETH amounts against token amounts. Probe: a fake token transfer took the FIFO budget from a real 1 ETH victim payment, leaving the real recipient at `taint=0` and excluded from attribution.
- [x] I-A (Task G2 DONE): F2 (taint accumulation) + F3 (`taint > 0` candidate filter) can still combine badly — a wallet expanded before a later-arriving branch adds more taint to it never re-propagates that taint to its already-queued children, so a downstream wallet holding all the real money can end up excluded.
- [x] I-B (Task G3 DONE): a single chain-API failure produces 3 separate false statements at once (conservation "reconciled" using stale taint from a failed hop; attribution's zero-candidate message asserts "no wallet ever received the money" when a read failure is the real reason; innocence adds an accusatory "no pre-incident history" factor from an empty list after a failed read) — F3's "failed read ≠ checked zero" principle wasn't applied consistently to the suspect-history and victim-enumeration refetches.
- [x] I-C (Task G4 DONE): unreported-victim enumeration runs on the `evaluated[-1]` fallback wallet even when attribution outright failed — with no vetted labels seeded (every live trace today), ordinary depositors into a wallet the money merely passed through get listed as "victims" of this case.
- [x] I-D (Task G5 DONE): TRON/Bitcoin still truncate in practice on a genuinely busy wallet (bounded to 10 pages) — **and Task F7's own researched claim that TronGrid has no server-side time-window filtering was factually wrong**, per this review: TronGrid's API does support `min_timestamp`/`max_timestamp` and per-contract filtering.
- [x] I-E (Task G6 DONE): the fix pass's own changes multiply live request volume (F3 refetches each candidate a second time, F6 doubles every Ethereum call, F7 adds up to 10 pages/wallet) — compounded by the frontend's `getRoutes` re-running the entire live trace from scratch on every one of 4 different screen loads. A single small TRON trace now makes 7+ real HTTP requests.
- [ ] M (6 minor): F2 taint-accumulation can inflate hop 0's own amount on a round-trip path; zero-value "poisoning" transfers on the real USDT contract still pass F8's filter and can corrupt sweep detection; no input validation at case creation (unescaped wallet address reaches a real external API URL path — low risk, same-host GET only); TRON doesn't distinguish an HTTP-200-wrapped error body from empty history (same bug class F6 fixed for Ethereum, not carried to TRON); M1 (real USDT contract address in the fake label seed) is now worse since the same address means two contradictory things in two files; innocence prints the display label as a unit (cosmetic only, works fine).

Reviewer's own recommendation if continuing: fix C-A and I-B first ("small and self-contained"); I-E matters most only if a live demo (not mock mode) is actually planned. Reviewer's verdict: "I would trust the attribution output for a live demo on the TRON USDT path with small, non-busy wallets and API keys configured. I would not trust it yet for a live Ethereum case, for busy wallets, or under rate limits."
The mandatory post-plan whole-branch review (opus, with an executed probe script, not just a code read) found 3 Critical + 8 Important + 11 Minor issues that per-task reviews structurally could not see — each is an integration/design contradiction *between* already-approved tasks, not a single-file bug. **Do not claim the backend is demo-ready or "real end-to-end" until these are triaged.**
- [x] **C1 — live frontend→backend path fails on the first request:** @Claude — fixed (CORS, chain-casing normalized at case creation, form fields); review also caught and fixed an unrelated `getCase('demo')` 404 hang on the same screen, required in-scope since it contradicted the task's own goal. `NewCase.tsx` omits `amountCrypto`, sends `incidentAt` in display format not ISO, sends capitalized `chain` (`registry.py` only accepts lowercase) → 422/500; no `CORSMiddleware` on the FastAPI app → browser preflight fails before any of that.
- [x] **C2 + C3 + I9 + I1 + I6 — merged into Task F3** (all land in the same `traces.py` attribution block): attribution now selects the earliest candidate hop with `taint > 0` that passes the full gate (not just wherever the BFS stopped); sweep is anchored to each hop's own funding transfer with an upper bound; chain-API refetches are guarded (with an honest "couldn't check this wallet" reasoning, not a fabricated "0 payers"); unreported-victims excludes every wallet already in the trace path. @Claude — reviewed twice (independent FIFO/BFS hand-trace + `git show` verification of a modified pre-existing test), approved.
- [x] I2: TRON and Bitcoin adapters now paginate their real history instead of truncating (TronGrid `fingerprint` cursor, Esplora `/txs/chain/:last_seen_txid`) — both contracts independently verified via WebFetch by implementer and reviewer separately. Bounded to 10 pages each. @Claude
- [x] I3: Ethereum adapter — confirmed via WebSearch (independently re-verified by reviewer) that Etherscan V1 was deprecated 15 Aug 2025; migrated to V2 (`chainid=1`). Real API errors now raise instead of returning "no activity". Ethereum wallet addresses lowercased at case-creation time (TRON/Bitcoin explicitly untouched, case-sensitive formats). Native ETH fully implemented (txlist merged with tokentx, real gasUsed*gasPrice fee, reverted-tx exclusion) — not deferred. @Claude
- [x] I4: TRON/ETH adapters now filter by real token contract address (not spoofable symbol string) — USDT-ERC20 contract address independently verified via WebSearch. Bitcoin untouched (no smart-contract attack surface). @Claude
- [x] I5: Bitcoin now emits exactly one Transfer per multi-input transaction (first input as representative sender, common-input-ownership convention), not one per input claiming the full value each — fixes both amount inflation and distinct-payer inflation. @Claude
- [x] I7: converging trace paths silently drop taint at an already-visited wallet instead of adding it — breaks the project's own "Consolidation" thesis; conservation then reports an honest-looking but wrong non-zero remainder. @Claude
- [x] I8: `find_bridge_links` now excludes same-chain/self candidates inside candidate-building (not an after-the-fact filter — proven by a test where the excluded candidate would otherwise have won on time-closeness). Still structurally dead code given this architecture (one chain per case) — documented honestly in `traces.py` + `docs/TASKS.md` P3, not hidden. @Claude
- [x] I10 (partial) + I11 — fixed in Task F11: `traces.py`'s `HopOut.flag`/`.role` now go out as plain-English strings (`_ROLE_PLAIN_ENGLISH`/`_STOP_REASON_PLAIN_ENGLISH` mappings), not the raw internal codes/literals (`stopReason`, a separate field, intentionally keeps the raw code); `innocence.py`'s throughput sentence now names the asset (`compute_innocence`'s new `asset` parameter) instead of printing a bare Decimal; `innocence.py`'s docstring no longer claims the notice-drafting gate was wired in Task 11 (see the new line below). Deliberately did NOT add real per-hop "this is the exchange"/"this hop swept" detection to match the frontend mock data's richer flag vocabulary (`'EXCHANGE'`/`'SWEPT'`/`'BRIDGE IN'`) — that's separate, not-yet-built per-hop attribution work, out of scope for this jargon-cleanup task. @Claude — note: `httpApi.ts`'s `toRoute` still drops reasoning/limitations/breakdown/innocence/conservation/unreported-victims (I10's other half) — out of scope for this task, needs the routeA/routeB N-ary redesign already noted as a known gap.
- [ ] "High innocence blocks notice drafting" (mentioned in `innocence.py`'s docstring) has never been built — there is no notice-drafting flow in this backend at all yet. Deferred, not a Task 11 gap (Task F11, 2026-09-26).
- [ ] M1 (flag before adding any real vetted label): `seed_labels.py`'s "placeholder" seed entry uses the actual real USDT-TRC20 token contract address, not a fake one — CLAUDE.md rule 1 concern. `bridge/registry.py` names a real bridge protocol ("Multichain") on fake addresses.
- [ ] M2-M11: `_verified_predecessor` docstring overclaims what it guards against; `settings.max_trace_hops` unused; conservation's `0.01` tolerance is a unit-blind absolute and `fees` is a hardcoded constant presented as computed; conservation can look "reconciled" even when the trace gave up (`hop_cap_reached`/`api_read_failure` count toward the total); no address/chain input validation (path-interpolation risk); several HTTP-client edge cases (HTTP-date `Retry-After` crashes, only 429 retried not 5xx, throttle timer not threadpool-safe, API key travels in query string); `getRoutes` re-runs a full live trace every call; trace results are never persisted to the `Hop`/`Wallet`/etc. DB tables (fine for Sprint 1, just don't claim reproducible evidence yet); `CLAUDE.md`'s "No backend exists yet" known-gap note is now stale; missing test coverage for zero-taint stopping wallets, converging paths, multi-hop unreported-victim exclusion, bridge self-pairing, Etherscan error responses, EVM address casing, BTC multi-input inflation, API error paths, and the frontend `toRoute` mapping / any real frontend-backend contract test.

## P0.5 — Sidebar registry screens (`docs/plans/stub-screens-plan.md`) — DONE
- [x] Cases / Trace / Campaigns / Reports / Exchanges — all 5 built as real screens, reviewed, fixed @Claude
- [x] Fixed a real bug found during review: Reports' "View" button bounced to New Case because Evidence.tsx's route guard requires caseStore populated — now pre-fetches case+trace before navigating @Claude
- [ ] Minor cleanup (non-blocking): `FULL_DATA_CASE_ID` constant duplicated across Cases/Reports/Trace/Exchanges instead of one shared constant; `STATUS_COLOUR`/`RISK_COLOUR` maps duplicated between Dashboard.tsx and Cases.tsx — from parallel-agent builds, worth consolidating if time allows @

## P1.7 — Sprint 2/3 completion (2026-09-26) — plan: `docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md` (tasks H0-H11) — H0-H8 + H11 ALL COMPLETE, all clean on first review pass. H9 (Docker) + H10b (frontend fixes) remain.
- [x] H0 (controller-done, not a subagent): shared DB models/schemas/router scaffolding @Claude
- [x] H1: campaign clustering (union-find on gate_passed hub convergence) @Claude
- [x] H2: VASP flagged-wallet feed — pull API, push webhooks, demo receiver @Claude
- [x] H3: Tether freeze check + golden-hour urgency + freeze-request draft @Claude
- [x] H4: OFAC/sanctions screening shipped in-repo, per-hop, refresh-refusal @Claude
- [x] H5: reproducible evidence hashing + manifest + verify endpoint @Claude
- [x] H6: hash-chained audit log with real `verify_chain()` @Claude
- [x] H7: legal notice templates (BNSS§94/§106, BNS§223, BSA§63) + draft-approve-send FSM + SAHYOG payload @Claude
- [x] H8: ML risk scoring (LightGBM+SHAP), gated behind data-quality check, synthetic training data disclosed in every response @Claude
- [x] H11: wired H1/H2/H4/H6 into the live trace path — `AttributionCandidate` now actually persists, unblocking campaigns/evidence/legal @Claude
- [ ] H9: Docker Compose (frontend, backend, postgres-or-honest-sqlite, redis-only-if-actually-used) @
- [ ] H10b: 5 cheap frontend fixes, verify each claim against current code first (see below, may be partially stale) @

**Known follow-up gaps, found honestly mid-implementation, not hidden:**
- `Hop` rows are never persisted anywhere in the backend (`tracer.py` only builds in-memory dataclasses) — found independently by both H4's and H11's implementers/reviewers. This means Task H4's `screen_case_hops(case_id, db)` DB-query helper would always return `[]`; H11 worked around it by calling the pure `screen_hops()` function on in-memory hops instead. It also means Task H5's evidence packs have an empty `hops` array for every real case. A future task should add real `Hop` persistence in `traces.py` (same place H11 added `AttributionCandidate` persistence) to close both gaps at once.
- A real `action="case.create"` audit entry at the true case-creation site (`cases.py`) is still missing — H11 used `trace.run` as the nearest in-scope substitute since `cases.py` was outside its file scope.
- H2's VASP auto-flag still uses its original interim rule-based proxy score (`gate_passed -> 1.0/0.0`), not H8's real ML risk score — H11 deliberately did not wire this in, judging it unsafe to add a second full risk-feature computation to the hottest endpoint in the backend. `GET /api/v1/risk/{case_id}/score` is where the real score lives today; wiring it into auto-flag is a clean future task.

## P2 — Frontend honesty fixes (cheap, do anytime, listed in backend v2 spec) — Task H10b
- [ ] `ReportDocument.tsx` PDF claim ("read directly from public blockchain data") — make true or label as demo data
- [ ] `mock.ts` — fix invalid address formats, double-counted Route A+B totals, duplicate node, suspect/scammer mismatch
- [ ] `NodeDrawer.tsx` — USDT shown with a ₹ sign, wrong unit label
- [ ] `Reset demo` doesn't actually reset the case store — real bug
- [ ] Inconsistent timing claims (47s / 41s / "under a minute") — pick one or label illustrative

## P3 — Nice to have / deferred
- [ ] Docker Compose: frontend, backend, postgres, redis, worker (deploy target: user's EC2) — Task H9, in progress
- [x] BTC adapter — done, Bitcoin/Blockstream Esplora adapter (P1 Task 5)
- [x] Full ML/SHAP risk model — done (Task H8), gated behind data-quality check, trained on disclosed synthetic data
- [ ] Operator fingerprinting (Idea 2 from `THREE_BIG_IDEAS.md`) — own future design pass
- [ ] Real cross-chain bridge-hop linking needs a case model that traces two chains simultaneously and correlates between them — deferred, not built despite Task 10 implementing the correlation logic (`find_bridge_links`) correctly in isolation (Task F10, 2026-09-26).
- [ ] Calibration pass (Sprint 2/3 item 13, precision reported against held-out synthetic verified cases) — not built, lowest priority per the reviewer's own recommendation, no known blocker if picked up later.

## Blocked
- [!] (nothing currently)

## Done
- [x] Repo scaffolding + six handoff docs @DT+Claude
- [x] HTML prototype app shell (tokens, DEMO data, router) — frozen fallback, do not extend @DT+Claude
- [x] React migration Phase 1, all 8 tasks — full 9-screen app on mock data @DT+Claude
- [x] Competitive review: 12 rival SIH-26183 repos cloned and read file-by-file @Claude
- [x] Backend v2 design spec, approved @DT+Claude
- [x] UI v2 redesign: Tailwind v4 + shadcn scaffolding, core primitives (Button/Card/Badge/IconTile/Tabs/Dialog/AuroraBackground) @Claude
- [x] Pushed to https://github.com/tripathidhruv/kaizen, branch main @DT+Claude
