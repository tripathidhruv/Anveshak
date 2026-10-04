# ANVESHAK React migration plan

Monorepo target: `frontend/` (React 19 + TS + Vite, already scaffolded, deps installed — react-router-dom, zustand, cytoscape, recharts, lucide-react, html2pdf.js, clsx). This plan covers Phase 1 (frontend against a mock API) in 8 sequential tasks. Tasks run one at a time, never in parallel — later tasks import components/types/stores earlier tasks create.

**Screen content, copy, and the 7 UX laws do not change from the HTML prototype.** For the full content spec of each screen (exact headings, copy, "In plain words" strips, field lists, evidence lists, hop-timeline behaviour, graph node/edge spec, PDF report contents, lawful-action card text) — read `docs/plans/prototype-plan.md`. That file's "Global Constraints" section (design tokens, surface recipes, accessibility rule, type scale, colour semantics, UX laws 1-9, micro-interactions, the full `DEMO` dataset) is the content source of truth for every task below; this plan only specifies how to build the same thing in React+TS+CSS-Modules instead of vanilla JS.

## Global Constraints (apply to every task)

- **Design tokens & surfaces:** exact same hex/px values as `docs/plans/prototype-plan.md`'s Global Constraints — but expressed as `frontend/src/styles/tokens.css` (`:root` custom properties) and `frontend/src/styles/surfaces.css` (`.raised`/`.raised-sm`/`.pressed`/`.flat`/`.clickable:hover`/`.clickable:active`). Component stylesheets `compose` these via CSS Modules — **never hard-code a colour or shadow value outside these two files.**
- **Fonts:** same Google Fonts (Outfit, Inter, JetBrains Mono) loaded via `<link>` in `frontend/index.html`.
- **Icons:** `lucide-react` components (e.g. `<ShieldCheck size={20} />`), not the CDN UMD build. No `createIcons()` call needed — this is the point of the React migration.
- **Money formatting:** `frontend/src/utils/format.ts` exports `formatINR` (Indian grouping via `Intl.NumberFormat('en-IN')`), `truncateAddress`, `formatDuration`. Every screen uses these, never ad-hoc formatting.
- **Data access:** every page gets its data through an async function in `frontend/src/api/`. **No component ever imports DEMO data directly.** `src/api/mock.ts` (Phase 1) returns the same values as `docs/plans/prototype-plan.md`'s `DEMO` object, reshaped into the typed API response shapes defined in `src/types/`, with realistic `delay()` latency matching each screen's original animation timing (1.8s for trace, etc).
- **State:** `zustand` — `store/caseStore.ts` (active case, trace results, current step) and `store/uiStore.ts` (Judge Mode on/off, toasts, active evidence tab). Components read state via the store hooks, never prop-drill the whole case through every page.
- **Routing:** react-router-dom, routes exactly as:
  ```
  /                                    Dashboard
  /case/new                            New Case
  /case/:id/tracing                    Trace animation
  /case/:id/routes                     Route fork
  /case/:id/exchange                   Exchange attribution
  /case/:id/risk                       Risk score
  /case/:id/evidence                   Evidence pack (tabs via ?tab=graph|report|action)
  /case/:id/closed                     Summary
  /campaign/:id                        Campaign view (stub is fine if time-constrained)
  ```
  Guard the flow: landing on a later route without the case store populated redirects to the earliest valid step for that case (never a blank/white screen on refresh).
- **Cytoscape:** wrap the core library by hand in `hooks/useCytoscape.ts` / `components/graph/FundFlowGraph.tsx` via `useRef`+`useEffect`, per the pattern in the migration prompt — **`cy.destroy()` in the cleanup function is mandatory**, do not skip it.
- **TypeScript:** no `any` in `src/types/`. `npm run build` must pass with zero TypeScript errors at the end of every task.
- **After every task:** `npm run dev` starts clean, `npm run build` has zero TS errors, everything built so far is reachable with no dead buttons/links, zero browser console errors.

---

## Task 1: Design tokens, surfaces, UI primitives

1. `frontend/src/styles/tokens.css` — `:root` custom properties, verbatim values from `docs/plans/prototype-plan.md` Global Constraints (`--bg`, `--bg-sunken`, `--shadow-dark`, `--shadow-light`, `--ink`, `--ink-mid`, `--ink-soft`, the 7 accent colours, `--r-lg/md/sm/pill`, `--gap`, plus font-family custom properties `--font-display`, `--font-body`, `--font-mono`).
2. `frontend/src/styles/surfaces.css` — `.raised`, `.raised-sm`, `.pressed`, `.flat`, `.clickable:hover`, `.clickable:active`, exact shadow values from the plan.
3. `frontend/src/styles/reset.css` — box-sizing border-box, margin reset, font smoothing.
4. `frontend/src/styles/global.css` — imports the three above, sets `body` background `var(--bg)`, base font `var(--font-body)`, base text colour `var(--ink-mid)`; import all four in `main.tsx`.
5. Google Fonts `<link>` tags (Outfit 500/600/700, Inter 400/500/600, JetBrains Mono 400/500) added to `frontend/index.html` `<head>`, plus the page `<title>ANVESHAK — Cyber Cell Console</title>`.
6. `frontend/src/utils/format.ts`: `formatINR(n: number): string` (₹ + `Intl.NumberFormat('en-IN')`), `truncateAddress(addr: string): string` (first 4 + `…` + last 4), `formatDuration(seconds: number): string`.
7. `frontend/src/utils/constants.ts`: route paths as named constants, the 7-step rail definition (`{key,label}[]`: New Case, Trace, Route, Exchange, Risk, Evidence, Action), the colour-semantics map (`{ criminal: 'vermillion', exchange: 'gold', onchain: 'teal', bridge: 'violet', safe: 'moss', info: 'sky' }`).
8. `frontend/src/components/ui/` — one folder per primitive, each `Component.tsx` + `Component.module.css`:
   - `Card` (composes `.raised`, padding prop)
   - `Button` (variants: `primary` = solid indigo fill + white text + neumorphic shadow, per the "one primary action" rule; `default` = `.raised-sm` + `.clickable`; disabled state)
   - `Chip` (segmented-control style and status-pill style — both used across screens; accepts a colour prop keyed to the colour-semantics map)
   - `Input` (composes `.pressed`, label + optional subtitle slot for the plain-English-heading pattern)
   - `Well` (generic `.pressed` container, used for stat wells / footnotes)
   - `Badge` (small status/risk indicator, solid fill + white text per the "never encode meaning in shadow alone" rule)
   - `PlainWords` (the full-width `.pressed` strip with a lightbulb icon + one sentence, per UX law 3 — takes `children` for the sentence)
   - `Modal` (neumorphic modal shell, close button always present, closes on backdrop click and Escape)
   - `Toast` (slide-in-from-bottom-right `.raised` pill, auto-dismiss 3s, driven by `uiStore`)
   - `Gauge` (semicircular SVG arc primitive, 0-1 value in, animates on mount — used by RiskScore, generic enough to take value/size/colour-stops props)
   - `Spinner`/progress-ring primitive (the animated SVG ring used by Tracing — `stroke-dashoffset` technique, 0-100% prop, optional label)
   Every primitive must render pixel-right neumorphic surfaces on first try — this is the foundation every later page inherits, get it right here.
9. A `frontend/src/pages/_PrimitivesPreview.tsx` scratch page (not routed, or routed at `/dev/primitives` temporarily) is optional but encouraged so you can visually sanity-check every primitive before moving on — remove or leave it, your call, just don't ship it as a real nav destination.

Verify: `npm run build` zero TS errors; every primitive visually matches the neumorphic surface recipes (soft shadows, no borders, correct contrast per the accessibility rule — text never lighter than `--ink-soft`).

**Report:** commit as `feat(frontend): design tokens, surfaces, UI primitive components`.

---

## Task 2: Layout shell, routing, App shell

1. `frontend/src/components/layout/Sidebar.tsx` — 248px, `.raised`, logo block (◆ diamond mark, "ANVESHAK" / "Cyber Cell Console"), nav items (Dashboard, Cases (3), Trace, Campaigns (1), Reports, Exchanges) using `react-router-dom`'s `NavLink` for active-state styling (`.pressed` + indigo label + 3px left bar when active), `+ New Case` primary button linking to `/case/new`, Help & Support footer link. Counts (3)/(1) are illustrative — pull from `uiStore` or hardcode as static demo chrome, your call, just don't invent a data source that doesn't exist yet.
2. `frontend/src/components/layout/TopBar.tsx` — 72px `.raised`: page title (derived from current route), decorative search `.pressed` well, then in order: `DEMO DATA` chip (always visible, permanent), Judge Mode toggle (from `uiStore`, default ON), `Reset demo` button (clears `caseStore`, navigates to `/`), notification bell, avatar circle.
3. `frontend/src/components/layout/StepRail.tsx` — the 7-step progress rail from `utils/constants.ts`, current step derived from the current route, completed/current/future styling per UX law 4. Rendered on `/case/new` through `/case/:id/evidence` only — **not** on Dashboard or CaseClosed (this was a bug narrowly avoided in the old prototype's Task 1 — do not repeat it: CaseClosed explicitly gets no rail).
4. `frontend/src/components/layout/PageShell.tsx` — composes Sidebar + TopBar + (conditionally) StepRail + an `<Outlet/>` content area, screen-transition animation (260ms fade + 12px upward slide, `prefers-reduced-motion` respected) on route change.
5. `frontend/src/App.tsx` — `react-router-dom` route tree per the Global Constraints route list, `PageShell` as the layout route wrapping all pages; each page component is a placeholder stub for now (a `.raised` panel with the screen name and "Built in Task N" — mirrors how the old HTML prototype's Task 1 scoped placeholders, same idea, now as React components) — **except** don't build real screen content yet, that's Tasks 4-7.
6. `<1024px` (or whatever breakpoint reads cleanest for the sidebar layout) shows a "best viewed on desktop" notice and stops rendering the app shell, matching the old prototype's `<1000px` rule.

Verify: `npm run build` zero TS errors; clicking every sidebar nav item and the `+New Case` button navigates via real routes (URL bar changes); refreshing on any placeholder route does not white-screen; step rail shows/hides correctly per route.

**Report:** commit as `feat(frontend): layout shell, routing, step rail`.

---

## Task 3: Types, mock API, stores, shared hooks

1. `frontend/src/types/case.ts`, `trace.ts`, `index.ts` — full TypeScript interfaces for every shape in `DEMO` (Case, Hop, Route, Exchange, EvidenceItem, RiskFactor, RiskScore, CampaignSummary, DashboardKpi, RecentCase). No `any` anywhere. Mirror the exact field names from the `DEMO` object in `docs/plans/prototype-plan.md` Task 1 so later tasks read predictably.
2. `frontend/src/api/client.ts` — thin fetch wrapper (base URL from `import.meta.env.VITE_API_BASE_URL`, JSON parsing, error handling) — used only by the future real API, not by mock, but scaffold it now so Task numbering in Phase 2 doesn't have to revisit this file's shape.
3. `frontend/src/api/mock.ts` — the full `DEMO` dataset (verbatim values, ported from `docs/plans/prototype-plan.md` Task 1's `DEMO` object into TS objects typed against `src/types/`), plus a `delay(ms)` helper, plus every function the `AnveshakApi` interface needs: `createCase`, `getCase`, `listCases`, `startTrace` (1800ms delay, matches the old Trace screen's animation timing), `getRoutes`, `getExchange`, `getRisk`, `getGraph`, `generateReport`, `sendNotice`, `getDashboard`, `getCampaign`.
4. `frontend/src/api/index.ts` — `const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; export const api = USE_MOCK ? mockApi : httpApi;` (a `httpApi` stub throwing "not implemented" is fine for now, Phase 2 fills it in).
5. `frontend/.env.development` (`VITE_USE_MOCK=true`, `VITE_API_BASE_URL=http://localhost:8000`) and a committed `frontend/.env.example` mirroring it — confirm `.env` itself stays gitignored (repo's root `.gitignore` already covers `.env*`, verify `frontend/.env.development` isn't accidentally excluded too — if that pattern is too broad, adjust the root `.gitignore` to allow `.env.example` and `.env.development` explicitly while still blocking real `.env`).
6. `frontend/src/store/caseStore.ts` (zustand) — active case, trace results (routeA/routeB once fetched), current step, a `reset()` action.
7. `frontend/src/store/uiStore.ts` (zustand) — judgeMode (default true), toasts array + add/dismiss actions, active evidence tab.
8. `frontend/src/hooks/useCountUp.ts` (animate a number 0→target via requestAnimationFrame, 700ms ease-out, re-triggers only on value change not on every re-render), `useStepper.ts` (derives current step index + guards), `useCytoscape.ts` (mount/update/destroy pattern per the Global Constraints Cytoscape rule, generic enough for Task 6 to consume).

Verify: `npm run build` zero TS errors; `mockApi.startTrace()` callable from a scratch component and resolves to typed data matching `DEMO` values after the delay; stores are readable/writable from React DevTools or a temporary console.log.

**Report:** commit as `feat(frontend): types, mock API layer, zustand stores, shared hooks`.

---

## Task 4: Pages — NewCase, Tracing, RouteChoice

Build these three real pages (replacing their Task 2 placeholders), each fetching through `src/api`, each screen's full content/copy/behaviour identical to the corresponding screen spec in `docs/plans/prototype-plan.md`:
- **NewCase** ≈ that plan's Task 3 (New Case) spec — two-column form, pre-filled editable fields from the mock `getCase`/case defaults, live Indian-grouping amount formatting, segmented crypto chips, the wallet-address `.pressed` well with valid-address confirmation, `Fill demo data` link, "In plain words" strip, primary action → `startTrace()` then navigate to `/case/:id/tracing`.
- **Tracing** ≈ that plan's Task 4 (Trace) spec — animated SVG ring, 5 fade-swapping status lines, live-building checklist with the SWEEP DETECTED pill, auto-advance to `/case/:id/routes` on completion (guard against double-navigation), manual skip button, `prefers-reduced-motion` shows the completed state immediately.
- **RouteChoice** ≈ that plan's Task 5 (Route) spec — two clickable route cards (mini SVG node-chain diagrams, teal Route A / violet Route B with the bridge diamond and TRON→Ethereum colour change), expandable hop-by-hop timeline with SWEPT rows highlighted, copy-to-clipboard on addresses (wrapped so it never throws), primary action → `/case/:id/exchange`.

Route guard: landing directly on `/case/:id/tracing` or `/case/:id/routes` with no active case in `caseStore` redirects to `/case/new` (or to `/`, whichever reads cleaner) rather than crashing.

Verify: `npm run build` zero TS errors; full click-through NewCase → Tracing (animates, auto-advances) → RouteChoice (both cards expand, hop timelines correct) works with real data from the mock API, matching the old prototype's screen 1-3 behaviour and copy exactly.

**Report:** commit as `feat(frontend): New Case, Tracing, Route Choice pages`.

---

## Task 5: Pages — ExchangeAttribution, RiskScore

- **ExchangeAttribution** ≈ `docs/plans/prototype-plan.md` Task 6 (Exchange) spec — gold hero card (monogram, name, deposit address, 3 stat wells, vermillion non-compliance strip), "How we know" evidence list with confidence bars, "In plain words" strip, primary action → `/case/:id/risk`.
- **RiskScore** ≈ that plan's Task 7 (Risk) spec — the `Gauge` primitive from Task 1 driven to `risk.score`, `HIGH RISK` pill, five animated contribution bars from `risk.factors`, footnote well, "In plain words" strip with the actual score interpolated (not hardcoded 0.87 as literal text), primary action → `/case/:id/evidence`.

Both pages fetch through `src/api` (`getExchange`, `getRisk`), never import mock data directly. Route guards consistent with Task 4's pattern.

Verify: `npm run build` zero TS errors; full click-through from RouteChoice through Exchange and Risk matches copy/values/behaviour from the source spec exactly, gauge needle animates correctly to the fetched score.

**Report:** commit as `feat(frontend): Exchange Attribution and Risk Score pages`.

---

## Task 6: Evidence page — graph, report, lawful-action tabs

Build `frontend/src/pages/Evidence.tsx` with the three tabs from `docs/plans/prototype-plan.md` Task 8 (Evidence) spec, tab state driven by the `?tab=graph|report|action` query param and/or `uiStore`.

- **Graph tab:** `frontend/src/components/graph/FundFlowGraph.tsx` using the `useCytoscape` hook from Task 3 — nodes/edges built from the fetched case/route/exchange data, colours/shapes exactly per the source spec (sky victim, vermillion scammer, teal intermediates, violet bridge diamond, larger vermillion collection-wallet hub, larger gold hexagon exchange), animated `line-dash-offset` on the criminal-path edges, `breadthfirst` left-to-right layout, `NodeDrawer.tsx` detail panel on node click, `GraphLegend.tsx`, and the `Fit`/`Show Route A`/`Show Route B`/`Show both`/`Animate flow` control chips actually filtering/restyling the graph. **`cy.destroy()` on unmount is mandatory** — verify by navigating away and back several times and confirming no console warnings/leaks.
- **Report tab:** `frontend/src/components/report/ReportDocument.tsx` + `ReportHeader.tsx` + `HopTable.tsx` — A4-proportioned scrollable preview inside a `.pressed` well, built as real HTML (not canvas/image) so `html2pdf.js` (dynamically imported: `await import('html2pdf.js')`) can export it. Contents per the source spec: header + case ID + timestamp, complainant/case details, suspect wallet, both route hop tables (full untruncated addresses), exchange attribution + evidence, risk score + factors, methodology note, SHA-256 integrity hash (via `crypto.subtle.digest`, wrapped in try/catch with a static-placeholder fallback), the "Generated by ANVESHAK v1.0" line. `Download PDF` button produces a real downloadable file.
- **Lawful action tab:** three stacked action cards (Request to the exchange / Section 94 BNSS notice with its "draft only, officer must review" caption / Report to FIU-IND) per the source spec, each opening a `Modal` (from Task 1) with document body + Send/Generate button that animates the card's status chip to `SENT ✓` via `uiStore`/local state, plus the moss campaign-impact strip below the three cards.

`getGraph`, `generateReport`, `sendNotice` all come from `src/api`. Primary action bottom-right on all three tabs: → `/case/:id/closed`.

Verify: `npm run build` zero TS errors; all three tabs render and switch via the URL query param (shareable/bookmarkable), graph interactive with working control chips and no destroy-on-unmount leaks across 5+ tab/page navigations, PDF download produces a real file with correct content, all three lawful-action modals work end to end.

**Report:** commit as `feat(frontend): Evidence page with graph, report, lawful-action tabs`.

---

## Task 7: Pages — CaseClosed, Dashboard, Campaign stub

- **CaseClosed** ≈ `docs/plans/prototype-plan.md` Task 9 (Case closed) spec — centred summary card, 4 stat wells, manual-vs-ANVESHAK comparison strip, buttons to Campaign/New Case/Dashboard. **No StepRail on this route** — confirm `PageShell`'s rail-visibility logic (Task 2) actually excludes `/case/:id/closed`.
- **Dashboard** ≈ that plan's Task 2 (Dashboard) spec — 4 KPI cards with `useCountUp`, sparkline SVGs, recent-cases table (routes to `/case/:id/...` appropriately, or realistically just the top "New" row routing into `/case/new` prefilled / or directly into an existing case's mid-flow state — pick whichever reads cleaner given cases 2-5 aren't full interactive flows, a reasonable simplification is fine, note it in your report), campaign alert card, `recharts` line chart styled per the Global Constraints chart rules (custom tooltip component, no default recharts styling bleeding through, gridlines `#CDD5E0`), primary action → `/case/new`.
- **Campaign** — a real but simple page at `/campaign/:id`: campaign totals from `getCampaign` (cases, states, total INR), can be lighter than a full Cytoscape multi-victim graph if time-constrained — a clean summary card is an acceptable v1, note the simplification in your report rather than skipping the route entirely (Dashboard and CaseClosed both link to it, it must not 404).

Verify: `npm run build` zero TS errors; Dashboard is now the working `/` route (no longer a placeholder), full loop Dashboard → New Case → ... → Evidence → Closed → back to Dashboard works, Campaign route resolves from both links that point to it.

**Report:** commit as `feat(frontend): Case Closed, Dashboard, Campaign pages`.

---

## Task 8: Judge Mode, polish, route guards, prototype/ retirement

1. **Judge Mode**, fully implemented (was stubbed as a bare toggle in Task 2): when `uiStore.judgeMode` is true, a soft pulsing ring (CSS animation) highlights the next suggested click target on every real screen, plus a coach-mark strip pinned bottom-center with a one-line instruction — implement this generically enough (e.g. a `data-judge-target` attribute + a small `JudgeCoachmark` component reading the current route) that it doesn't require bespoke wiring on every page.
2. **Toasts** wired end-to-end via `uiStore` (e.g. on `Reset demo`, on lawful-action Send/Generate).
3. **`prefers-reduced-motion`** verified respected across every animation added in Tasks 4-7 (Tracing ring/checklist, Gauge needle, KPI count-up, graph edge dash animation, screen transitions).
4. **Route guards** double-checked across the whole app: refreshing on any `/case/:id/...` route with an empty `caseStore` redirects sensibly instead of white-screening; confirm this for every route in the Global Constraints route list.
5. **Full click-through QA:** run the entire Dashboard → New Case → Tracing → Route → Exchange → Risk → Evidence (all 3 tabs) → Closed → back to Dashboard flow three times without a break, confirm zero dead buttons, zero console errors, `npm run build` zero TypeScript errors, no `any` in `src/types/`.
6. **Retire `prototype/`:** once the above passes, delete `prototype/index.html` (and the now-empty `prototype/` folder) **in its own commit**, and add a `docs/PROGRESS.md` entry noting the retirement. Do this step last, only after full parity is confirmed — if anything above is still shaky, leave `prototype/` in place and note what's blocking retirement instead of deleting prematurely.
7. Update `README.md`: new `frontend/`/`backend/` structure, `cd frontend && npm install && npm run dev` run instructions, remove the old "open prototype/index.html" instruction (replace, don't just append).
8. Append the mandatory `docs/PROGRESS.md` session-end entry (Did/Decided/Next/Blocked on/Note for whoever's next) covering this whole Phase 1 migration, and update `docs/TASKS.md` statuses to reflect everything completed in Tasks 1-8.

Verify: everything in step 5's QA checklist passes; if `prototype/` was retired, confirm `frontend/` alone reproduces the full demo with no regressions.

**Report:** commit polish work as `feat(frontend): judge mode, route guards, reduced-motion polish`; commit prototype retirement separately as `chore(prototype): retire single-file demo, frontend/ has full parity` (only if actually retiring); commit doc updates as `docs(progress): log Phase 1 frontend migration complete`.
