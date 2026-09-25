# Tasks

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Owner: initials. Update the status **in the same commit** as the work.

## Where things stand (2026-09-25)
Read `docs/PROGRESS.md` top entry for full narrative.

1. **Frontend, React app (`frontend/`)** — all 9 screens built and functionally complete against mock data (Phase 1 of the original migration plan, `docs/plans/react-migration-plan.md`, Tasks 1-8 all done).
2. **Frontend, UI v2 visual redesign — COMPLETE.** Full migration from the neumorphic CSS-Modules system to a Tailwind v4 + shadcn-style flat/white-card system (light theme, aurora page background). All 6 tasks in `docs/plans/ui-v2-redesign-plan.md` done, reviewed clean, dead neumorphic system fully deleted. `npm run build` zero errors.
3. **Backend (`backend/`)** — NOT STARTED. Full design spec exists and is approved: `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md` (supersedes the earlier `2026-09-25-real-tracing-vasp-feed-design.md`). This is the next major track — needs a `writing-plans`-style task breakdown from the spec before subagent dispatch can start.

## P0 — UI v2 redesign (`docs/plans/ui-v2-redesign-plan.md`) — DONE
- [x] Task 1: remaining primitives (Input/Toast/Gauge/Spinner/Well/PlainWords) + layout shell restyle @Claude
- [x] Task 2: Dashboard, Case Closed, Campaign restyle @Claude
- [x] Task 3: New Case, Tracing, Route Choice restyle @Claude
- [x] Task 4: Exchange Attribution, Risk Score restyle @Claude
- [x] Task 5: Evidence page (graph/report/lawful-action tabs) restyle @Claude
- [x] Task 6: cleanup — dead neumorphic CSS deleted, imports normalized, full click-through QA @Claude

## P1 — Backend (spec approved, plan not yet written)
- [ ] Break `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md` into a task-by-task implementation plan (writing-plans skill)
- [ ] Sprint 1: chain HTTP client, TRON adapter, causal FIFO tracer, gated sweep+deposit detectors, vetted labels, OFAC screening, wire `httpApi`, probe tests
- [ ] Sprint 2: Ethereum adapter, VASP flagged-wallet feed (pull API + push webhooks + demo VASP receiver), Tether freeze check + golden hour, bridge-hop linking, campaign clustering
- [ ] Sprint 3: reproducible evidence hashing + hash-chained audit log, calibration pass, legal templates + SAHYOG payload, ML risk scoring (gated)

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
