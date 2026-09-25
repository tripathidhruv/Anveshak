# Real screens for Cases / Trace / Campaigns / Reports / Exchanges

These five sidebar nav items currently toast "Coming in v2" (never real routes in the original 9-screen spec). This plan builds real, functioning screens for all five, reusing the existing `mock.ts` DEMO dataset honestly (the `DEMO DATA` chip stays visible everywhere, per `CLAUDE.md`'s non-negotiable rules — nothing here should read as fabricated beyond what's already established).

**Routing/nav wiring is done centrally first (by the controller, not a subagent)** since it touches shared files (`App.tsx`, `utils/constants.ts`, `components/layout/navConfig.ts`, `components/layout/Sidebar.tsx`) that all 5 tasks would otherwise conflict on. Once that lands, the 5 page-content tasks are fully parallel-safe (each is a new, disjoint file).

## Global Constraints

- Reuse the existing design system exactly: `Card`, `Badge`, `IconTile`, `Button`, `Tabs`, `Well`/`Stat` from `frontend/src/components/ui/`, imported via the `@/components/ui/*` alias (established convention as of the Task 6 cleanup).
- Every screen gets its data through `frontend/src/api/` (`import { api } from '@/api'`), never a direct mock import.
- Since the mock dataset has exactly ONE full case (`KZN-2026-0417`), list/registry screens that reference "other" cases should read from `api.listCases()` (which already returns multiple `RecentCase` rows per `DEMO.dashboard.recentCases`) for the list view, but any "drill into full detail" action should route into the one real case's existing flow — don't fabricate full trace/risk/evidence detail for the other 4 recentCases entries that don't have it. If a row doesn't have full backing data, clicking it shows a toast ("Full detail available for KZN-2026-0417 in this demo") rather than silently rendering broken/empty screens.
- Same spacing/contrast bar as the rest of the app: `gap-6`/`p-6` Tailwind scale, `text-foreground`/`text-muted-foreground`, solid `IconTile` fills (not faint tints — this was just fixed app-wide, don't regress it).

## Routing/nav wiring (controller does this first)

1. `utils/constants.ts` — add `ROUTES.cases`, `ROUTES.trace`, `ROUTES.campaigns`, `ROUTES.reports`, `ROUTES.exchanges` (all static paths: `/cases`, `/trace`, `/campaigns`, `/reports`, `/exchanges`).
2. `App.tsx` — add 5 new `<Route>` entries inside the `PageShell` layout route, pointing at 5 new page components (placeholder stubs are fine at this point, the parallel tasks fill them in).
3. `components/layout/navConfig.ts` — give each of the 5 `NAV_ITEMS` entries a real `to` path instead of `undefined` (which currently triggers the toast fallback in `Sidebar.tsx`).
4. Confirm `Sidebar.tsx`'s toast-fallback branch (`if (!item.to) { ...toast... }`) still works correctly for any future stub-only nav item (it will, this is just data-driven).

## Task 1: Cases registry

New file `frontend/src/pages/Cases.tsx`. A table/list screen: every row from `api.listCases()`, columns Case ID (mono) / Complainant / Amount (₹) / Chain / Status badge / Risk badge — same visual pattern as Dashboard's recent-cases table, just full-width and on its own screen with a search/filter row (status filter chips: All/New/Traced/Notice sent/Closed — client-side filter over the returned list, no new API needed). Clicking the `KZN-2026-0417` row (the one with full backing data) routes to `/case/KZN-2026-0417/tracing` or wherever its current stage implies (reuse whatever routing logic Dashboard already uses for its top row). Clicking any other row shows a toast per the Global Constraints note above.

## Task 2: Trace (quick-trace entry point)

New file `frontend/src/pages/Trace.tsx`. A focused single-purpose screen: a `Card` with the "Trace a wallet" heading, an `Input` for a wallet address (pre-filled with the DEMO wallet, editable, same valid-address-confirmation pattern already used in `NewCase.tsx` — check that file for the exact pattern and reuse it), a primary `Button` "Start tracing" that calls `api.createCase()`/routes into the existing New Case → Tracing flow exactly as the Dashboard's primary action already does. This screen is essentially a shortcut into the same flow, not a new pipeline — don't build a second tracing engine, reuse the existing one.

## Task 3: Campaigns registry

New file `frontend/src/pages/Campaigns.tsx`. A list screen showing campaign(s) from `api.getCampaign()` — since the mock only has one campaign, show it as a single prominent card (cases count, states affected, total ₹, shared wallet) with a "View campaign" button routing to the existing `/campaign/:id` detail page. Frame it as a registry (heading: "Linked-complaint campaigns"), structured so a second campaign card would slot in naturally later, but don't fabricate a second one now.

## Task 4: Reports archive

New file `frontend/src/pages/Reports.tsx`. A list of generated evidence reports — one row per case that has a report (`KZN-2026-0417` from `api.generateReport()`), showing case ID, generated date, a `Download PDF` button reusing the exact `html2pdf.js` export logic already built in `frontend/src/components/report/ReportDocument.tsx` (import and reuse that component/logic, don't reimplement PDF export). If useful, also surface a `View` button that routes to `/case/KZN-2026-0417/evidence?tab=report` (the existing report tab).

## Task 5: Exchanges registry

New file `frontend/src/pages/Exchanges.tsx`. A registry of known/flagged exchanges — from `api.getExchange()` (returns `Meridian Digital Exchange`, the one DEMO exchange), shown as a card: name, jurisdiction, FIU-IND registration status (vermillion non-compliance strip, matching `ExchangeAttribution.tsx`'s existing treatment), linked-cases count. Frame the heading as "Flagged exchanges" or "VASP watchlist" — this page is a natural frontend preview of the backend v2 spec's future VASP flagged-wallet feed (`docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`), so keep the structure simple/extensible but don't build the real feed logic here — that's backend work, not in scope for this frontend task.

## Verify (every task)

`cd frontend && npm run build` zero TS errors. New nav item routes correctly, real data renders, no dead buttons (every interactive element does something — navigates, filters, or shows an honest toast), spacing/contrast matches the rest of the app, `DEMO DATA` chip context makes the illustrative nature of multi-case data clear where relevant.
