# Tasks

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Owner: initials. Update the status **in the same commit** as the work.

## Where things stand (2026-09-25)
Read `docs/PROGRESS.md` top entry for full narrative.

1. **Frontend, React app (`frontend/`)** — all 9 screens built and functionally complete against mock data (Phase 1 of the original migration plan, `docs/plans/react-migration-plan.md`, Tasks 1-8 all done).
2. **Frontend, UI v2 visual redesign — COMPLETE.** Full migration from the neumorphic CSS-Modules system to a Tailwind v4 + shadcn-style flat/white-card system (light theme, aurora page background). All 6 tasks in `docs/plans/ui-v2-redesign-plan.md` done, reviewed clean, dead neumorphic system fully deleted. `npm run build` zero errors. Since then, a pilot pass (primitives + Dashboard) pushed the visual language closer to a reference fintech dashboard: pill-shaped buttons/tabs, per-KPI multi-color icon tiles, recolored trace chart — not yet propagated to the other 12 screens.
3. **Backend (`backend/`) — SPRINT 1 PLAN COMPLETE (12/12 tasks), pending final whole-branch review.** Design spec approved: `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`. Implementation plan fully executed: `docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md` (chain adapters, causal tracer, gated attribution, innocence scoring, backward victim enumeration, cross-chain bridge linking, API layer, frontend wiring). This plan amended the approved spec's sprint ordering at the user's explicit request: TRON+Ethereum+**Bitcoin** (3 chains, not 2) and **cross-chain bridge-hop linking** were pulled forward into this pass instead of staying Sprint 2/3. VASP feed, Tether freeze check, OFAC screening, evidence hashing, audit log, legal templates, and ML scoring remain deferred to later sprints, unchanged. See `docs/PROGRESS.md` top entry for exact task-by-task status.

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

## P1.5 — Final whole-branch review findings (2026-09-25) — triaged, fix plan: `docs/superpowers/plans/2026-09-26-backend-whole-branch-review-fixes.md` (11 tasks, F1-F11, in progress)
The mandatory post-plan whole-branch review (opus, with an executed probe script, not just a code read) found 3 Critical + 8 Important + 11 Minor issues that per-task reviews structurally could not see — each is an integration/design contradiction *between* already-approved tasks, not a single-file bug. **Do not claim the backend is demo-ready or "real end-to-end" until these are triaged.**
- [x] **C1 — live frontend→backend path fails on the first request:** @Claude — fixed (CORS, chain-casing normalized at case creation, form fields); review also caught and fixed an unrelated `getCase('demo')` 404 hang on the same screen, required in-scope since it contradicted the task's own goal. `NewCase.tsx` omits `amountCrypto`, sends `incidentAt` in display format not ISO, sends capitalized `chain` (`registry.py` only accepts lowercase) → 422/500; no `CORSMiddleware` on the FastAPI app → browser preflight fails before any of that.
- [x] **C2 + C3 + I9 + I1 + I6 — merged into Task F3** (all land in the same `traces.py` attribution block): attribution now selects the earliest candidate hop with `taint > 0` that passes the full gate (not just wherever the BFS stopped); sweep is anchored to each hop's own funding transfer with an upper bound; chain-API refetches are guarded (with an honest "couldn't check this wallet" reasoning, not a fabricated "0 payers"); unreported-victims excludes every wallet already in the trace path. @Claude — reviewed twice (independent FIFO/BFS hand-trace + `git show` verification of a modified pre-existing test), approved.
- [x] I2: TRON and Bitcoin adapters now paginate their real history instead of truncating (TronGrid `fingerprint` cursor, Esplora `/txs/chain/:last_seen_txid`) — both contracts independently verified via WebFetch by implementer and reviewer separately. Bounded to 10 pages each. @Claude
- [x] I3: Ethereum adapter — confirmed via WebSearch (independently re-verified by reviewer) that Etherscan V1 was deprecated 15 Aug 2025; migrated to V2 (`chainid=1`). Real API errors now raise instead of returning "no activity". Ethereum wallet addresses lowercased at case-creation time (TRON/Bitcoin explicitly untouched, case-sensitive formats). Native ETH fully implemented (txlist merged with tokentx, real gasUsed*gasPrice fee, reverted-tx exclusion) — not deferred. @Claude
- [ ] I4: no component filters by `Transfer.asset`/token contract — a spam/poisoned-address token can hijack the trace and pollute payer/innocence counts.
- [ ] I5: Bitcoin's one-Transfer-per-input UTXO normalization inflates "distinct payer" count on ordinary multi-input self-consolidation transactions (opposite of common-input-ownership heuristic).
- [x] I7: converging trace paths silently drop taint at an already-visited wallet instead of adding it — breaks the project's own "Consolidation" thesis; conservation then reports an honest-looking but wrong non-zero remainder. @Claude
- [ ] I8: bridge-linking is dead code as wired (same chain client both sides → always empty output) and would self-pair (a transfer matching itself) even if it weren't; `KNOWN_BRIDGES`/`bridges_for_chain` registry is never referenced.
- [ ] I10: "nothing is a black box" doesn't survive to the UI — `httpApi.ts`'s `toRoute` drops `reasoning`/`limitations`/`breakdown`/innocence/conservation/unreported-victims entirely; the promised "high innocence blocks notice drafting" integration (documented in `innocence.py`'s own docstring as "wired in the API layer, Task 11") was never built anywhere.
- [ ] I11: plain-English rule breaches reach the UI in live mode — raw internal codes (`api_read_failure`, `no_outgoing_activity`, `hop_cap_reached`, `"suspect"`/`"intermediate"` roles) go out as `flag`/`role` fields and render verbatim as badges; `innocence.py`'s throughput sentence prints a bare unit-less Decimal.
- [ ] M1 (flag before adding any real vetted label): `seed_labels.py`'s "placeholder" seed entry uses the actual real USDT-TRC20 token contract address, not a fake one — CLAUDE.md rule 1 concern. `bridge/registry.py` names a real bridge protocol ("Multichain") on fake addresses.
- [ ] M2-M11: `_verified_predecessor` docstring overclaims what it guards against; `settings.max_trace_hops` unused; conservation's `0.01` tolerance is a unit-blind absolute and `fees` is a hardcoded constant presented as computed; conservation can look "reconciled" even when the trace gave up (`hop_cap_reached`/`api_read_failure` count toward the total); no address/chain input validation (path-interpolation risk); several HTTP-client edge cases (HTTP-date `Retry-After` crashes, only 429 retried not 5xx, throttle timer not threadpool-safe, API key travels in query string); `getRoutes` re-runs a full live trace every call; trace results are never persisted to the `Hop`/`Wallet`/etc. DB tables (fine for Sprint 1, just don't claim reproducible evidence yet); `CLAUDE.md`'s "No backend exists yet" known-gap note is now stale; missing test coverage for zero-taint stopping wallets, converging paths, multi-hop unreported-victim exclusion, bridge self-pairing, Etherscan error responses, EVM address casing, BTC multi-input inflation, API error paths, and the frontend `toRoute` mapping / any real frontend-backend contract test.

## P0.5 — Sidebar registry screens (`docs/plans/stub-screens-plan.md`) — DONE
- [x] Cases / Trace / Campaigns / Reports / Exchanges — all 5 built as real screens, reviewed, fixed @Claude
- [x] Fixed a real bug found during review: Reports' "View" button bounced to New Case because Evidence.tsx's route guard requires caseStore populated — now pre-fetches case+trace before navigating @Claude
- [ ] Minor cleanup (non-blocking): `FULL_DATA_CASE_ID` constant duplicated across Cases/Reports/Trace/Exchanges instead of one shared constant; `STATUS_COLOUR`/`RISK_COLOUR` maps duplicated between Dashboard.tsx and Cases.tsx — from parallel-agent builds, worth consolidating if time allows @

## P2 — Frontend honesty fixes (cheap, do anytime, listed in backend v2 spec)
- [ ] `ReportDocument.tsx` PDF claim ("read directly from public blockchain data") — make true or label as demo data
- [ ] `mock.ts` — fix invalid address formats, double-counted Route A+B totals, duplicate node, suspect/scammer mismatch
- [ ] `NodeDrawer.tsx` — USDT shown with a ₹ sign, wrong unit label
- [ ] `Reset demo` doesn't actually reset the case store — real bug
- [ ] Inconsistent timing claims (47s / 41s / "under a minute") — pick one or label illustrative

## P3 — Nice to have / deferred
- [ ] Docker Compose: frontend, backend, postgres, redis, worker (deploy target: user's EC2)
- [ ] BTC adapter
- [ ] Full ML/SHAP risk model
- [ ] Operator fingerprinting (Idea 2 from `THREE_BIG_IDEAS.md`) — own future design pass

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
