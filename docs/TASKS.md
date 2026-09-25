# Tasks

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Owner: initials. Update the status **in the same commit** as the work.

## Where things stand (2026-09-25)
Read `docs/PROGRESS.md` top entry for full narrative.

1. **Frontend, React app (`frontend/`)** — all 9 screens built and functionally complete against mock data (Phase 1 of the original migration plan, `docs/plans/react-migration-plan.md`, Tasks 1-8 all done).
2. **Frontend, UI v2 visual redesign — COMPLETE.** Full migration from the neumorphic CSS-Modules system to a Tailwind v4 + shadcn-style flat/white-card system (light theme, aurora page background). All 6 tasks in `docs/plans/ui-v2-redesign-plan.md` done, reviewed clean, dead neumorphic system fully deleted. `npm run build` zero errors. Since then, a pilot pass (primitives + Dashboard) pushed the visual language closer to a reference fintech dashboard: pill-shaped buttons/tabs, per-KPI multi-color icon tiles, recolored trace chart — not yet propagated to the other 12 screens.
3. **Backend (`backend/`) — IN PROGRESS.** Design spec approved: `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`. Implementation plan written and in active execution: `docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md` (12 tasks — chain adapters, causal tracer, gated attribution, innocence scoring, backward victim enumeration, cross-chain bridge linking, API layer, frontend wiring). This plan amends the approved spec's sprint ordering at the user's explicit request: TRON+Ethereum+**Bitcoin** (3 chains, not 2) and **cross-chain bridge-hop linking** are pulled forward into this pass instead of staying Sprint 2/3. VASP feed, Tether freeze check, OFAC screening, evidence hashing, audit log, legal templates, and ML scoring remain deferred to later sprints, unchanged. See `docs/PROGRESS.md` top entry for exact task-by-task status.

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
- [ ] Task 11: API layer — cases/traces endpoints wiring everything together
- [ ] Task 12: frontend `httpApi` wiring against the real endpoints

Deferred past this plan, unchanged from the approved spec: VASP flagged-wallet broadcast feed, Tether freeze check + golden hour, OFAC/sanctions screening, reproducible evidence hashing + hash-chained audit log, calibration pass, legal templates + SAHYOG payload, ML risk scoring.

**New standing rule (2026-09-25):** every backend-generated string meant for a human reader (risk-score reasons, attribution reasoning, innocence factors, flagged-exchange explanations) must be plain, non-technical English a 12-year-old could follow — extends CLAUDE.md rule 3 explicitly to backend prose, not just frontend copy. Task 7's `reasoning`/`limitations` fields follow this; carry it into Task 8 (innocence factors) and any later task that generates explanatory text.

**Flagged for Task 11:** Task 7's `detect_sweep()` is not yet consumed anywhere — the spec's correctness-guard checklist implies deposit-address attribution should require "N-payers-and-sweep," but `evaluate_deposit_gate()` currently gates on distinct-payer count without checking the sweep signal. Task 11 (API layer) must wire `detect_sweep` into the attribution decision, or this checklist item goes unenforced.

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
