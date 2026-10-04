# ANVESHAK UI v2 — flat/white-card redesign plan

This is a **re-skin, not a rebuild.** Every page's data-fetching, routing, zustand store usage, and business logic is already correct and stays untouched — only the JSX's className/structure and the CSS change, from the old neumorphic CSS-Modules system to the new Tailwind + shadcn-style primitives in `frontend/src/components/ui/` (Button, Card, Badge, IconTile, Tabs, Dialog, AuroraBackground — already built and committed).

Tasks run: Task 1 first (foundation — remaining primitives + layout shell), then Tasks 2-5 in parallel (each touches a disjoint set of page files).

## Global Constraints (apply to every task)

**Reference direction:** a clean, light fintech-dashboard style — white `rounded-2xl` cards on a very light grey-blue page background (`bg-background` = `#f6f7fb`), a single soft `shadow-sm`-style elevation (already baked into the `Card` primitive — never add a second shadow or a neumorphic dual-shadow), black/near-black headings (`text-foreground`), grey secondary text (`text-muted-foreground`), and colored circular icon tiles (`IconTile` primitive) for KPIs/status rather than neumorphic icon wells. See the reference screenshot: big bold numbers, generous whitespace, thin subtle borders, clean sans-serif type, colored pill badges for status.

**Colour semantics — unchanged, still fixed:** vermillion = criminal path/high risk, gold = exchange, teal = on-chain, violet = bridge, moss = safe/done, sky = info. Use them via `Badge`/`IconTile`'s `variant`/`color` prop (`vermillion|gold|teal|violet|moss|sky`), never a raw hex.

**Typography:** `--font-display` (Outfit) for headings via `font-[family-name:var(--font-display)]` (already used in `CardTitle`/`DialogTitle`), `--font-body` (Inter) for body text (already the default via `body`), `--font-mono` (JetBrains Mono) for addresses/amounts/timestamps — apply `font-[family-name:var(--font-mono)]` directly on those elements. Fonts are already loaded in `index.html`, no changes needed there.

**Aurora background:** use the `AuroraBackground` wrapper component around the whole app shell (`PageShell`) so it sits subtly behind the sidebar/content — not behind individual cards, not full-opacity, not on every nested panel. One aurora wrapper at the top of the tree is enough; do not add it per-page.

**Money formatting, Indian digit grouping, `DEMO DATA` chip, Judge Mode, plain-English-first copy, one-primary-action-per-screen** — every existing UX rule from `CLAUDE.md` still applies exactly as before. This plan changes visual skin only, never content, copy, or interaction behavior.

**Delete the old CSS Module file** for every component/page you restyle (e.g. `NewCase.module.css` once `NewCase.tsx` no longer imports it) — don't leave dead neumorphic CSS around. Do NOT delete `frontend/src/styles/tokens.css`/`surfaces.css`/`reset.css`/`global.css` yet if any file still imports them (grep first); once nothing imports them (should be true after all 5 tasks), a final cleanup commit removes them.

**After every task:** `cd frontend && npm run build` — zero TS errors. Visually verify in a browser if you have tooling: the page must not look broken/unstyled, spacing must be consistent (Tailwind's default spacing scale — `gap-4`/`gap-6`/`p-6` etc., not arbitrary pixel values), and text contrast must be comfortably readable (near-black on white/light-grey, never light-grey-on-light-grey).

---

## Task 1: Remaining primitives + layout shell restyle

1. **Remaining UI primitives** in `frontend/src/components/ui/`, matching the shadcn/Tailwind pattern already established by `Button`/`Card`/`Badge`/`IconTile`/`Tabs`/`Dialog`:
   - `Input` — a labeled text input, `rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-ring`, with an optional subtitle slot (for the plain-English-heading pattern already used across the app).
   - `Toast`/`ToastHost` — restyle to a white `rounded-xl shadow-lg border border-border` pill, slide-in from bottom-right, auto-dismiss — keep wiring to the existing `uiStore` toast state (`frontend/src/store/uiStore.ts`), only restyle the rendered markup.
   - `Gauge` — the semicircular risk-score arc; keep the SVG animation logic, restyle the surrounding well to `rounded-2xl bg-muted p-8` instead of the old `.pressed` well.
   - `Spinner`/progress-ring — same approach, keep the `stroke-dashoffset` animation, restyle the container.
   - `Well`/`Stat` — a generic small stat block (label + big number), used for the KPI-style panels across Exchange/Risk/CaseClosed — `rounded-xl bg-muted p-4`.
   - `PlainWords` — the "in plain words" strip: `rounded-xl bg-primary/5 border border-primary/10 p-4 flex items-start gap-3` with a lightbulb icon, same copy/behavior as before.
2. **Layout shell restyle** — `frontend/src/components/layout/Sidebar.tsx`, `TopBar.tsx`, `StepRail.tsx`, `PageShell.tsx`:
   - `PageShell` wraps everything in `<AuroraBackground>`; sidebar and top bar become white `Card`-style surfaces (or a plain `bg-card border-b border-border` top bar, `bg-card border-r border-border` sidebar — your call which reads cleaner, the reference has a clean white sidebar with a subtle border, not a floating shadow card).
   - Sidebar nav items: active item gets `bg-primary/10 text-primary font-semibold`, inactive `text-muted-foreground hover:bg-muted`.
   - `+ New Case` button uses the new `Button` primary variant.
   - Keep the `LogoMark` component as-is (already a standalone SVG, not neumorphic-dependent).
   - `StepRail`: restyle the 7 steps as small circular badges (`IconTile`-style, `sky`/`moss`/muted per completed/current/future) with a thin connecting line — same completed/current/future logic, just restyled.
   - Top bar: `DEMO DATA` chip → `Badge` with `variant="outline"`; Judge Mode toggle, Reset demo button, bell, avatar all restyled with the new primitives, same behavior.
3. Remove the `<1024px>` "best viewed on desktop" notice's old CSS-module styling, rebuild with Tailwind classes, same copy/behavior.

Verify: `npm run build` zero TS errors; app shell (sidebar/topbar/rail) renders cleanly with the aurora background subtly visible behind it; every primitive built here renders correctly in isolation (spot-check by temporarily rendering one on any page if useful, then remove).

**Report:** commit as `feat(frontend): restyle remaining UI primitives and layout shell to flat/white-card system`.

---

## Task 2: Dashboard, CaseClosed, Campaign restyle

Restyle `frontend/src/pages/Dashboard.tsx`, `CaseClosed.tsx`, `Campaign.tsx` (and their component dependencies under `frontend/src/components/` that are exclusively used by these three pages — check imports first) to the new system. Keep every existing data-fetch (`api.getDashboard`, `api.getCampaign`, etc.), every existing route/navigation call, every existing `useCountUp` usage — only change the rendered markup and styling.

- Dashboard's KPI strip: 4 `Card`s in a `grid grid-cols-4 gap-6`, each with an `IconTile` (colored per KPI), a `text-sm text-muted-foreground` label, a big `text-3xl font-bold font-[family-name:var(--font-mono)]` number (still `useCountUp`-driven), and a small delta badge — matches the reference screenshot's "Digital Assets / Pending Staking / Funds Available" card pattern closely.
- Recent-cases table: a clean `Card` with a simple `<table>` inside, `border-b border-border` row dividers, status/risk as `Badge`s.
- The `recharts` trace-activity chart: restyle its container to a plain `Card`, keep the chart config, adjust colors/gridlines to sit well on white (light grey gridlines, primary-colored line/area) matching the reference chart's soft blue gradient-fill look.
- CaseClosed: centered `Card` with a large `IconTile` (moss, checkmark icon) success state, stat wells restyled per Task 1's `Well` primitive.
- Campaign: same card-based restyle, keep existing content.

Verify: `npm run build` zero TS errors; full click-through Dashboard → New Case (still using old styling until Task 3 lands, that's fine) and CaseClosed → Campaign → Dashboard works with no broken layout.

**Report:** commit as `feat(frontend): restyle Dashboard, Case Closed, Campaign pages`.

---

## Task 3: New Case, Tracing, Route Choice restyle

Restyle `frontend/src/pages/NewCase.tsx`, `Tracing.tsx`, `RouteChoice.tsx` and their exclusive component dependencies (`frontend/src/components/route/` etc.) to the new system. Keep every existing form-state, validation, animation-timing, and navigation behavior — only change markup/styling.

- NewCase: two-column form using the new `Input` primitive, `Card` wrapping the whole form with real `gap-6` spacing between sections (this fixes, permanently, the earlier neumorphic-era spacing bug — Tailwind's gap utilities make it structurally hard to regress to 0px spacing).
- Tracing: keep the animated SVG ring and status-line logic exactly as-is; restyle the surrounding well to `rounded-2xl bg-muted`.
- RouteChoice: the two route cards become `Card`s with `hover:shadow-md transition-shadow cursor-pointer`, colored `IconTile`s/badges for teal/violet accents, expandable hop timeline restyled with clean row dividers instead of neumorphic pressed rows.

Verify: `npm run build` zero TS errors; full click-through NewCase → Tracing (still animates/auto-advances) → RouteChoice (cards expand, hop timelines correct) with the new visual system, no broken layout.

**Report:** commit as `feat(frontend): restyle New Case, Tracing, Route Choice pages`.

---

## Task 4: Exchange Attribution, Risk Score restyle

Restyle `frontend/src/pages/ExchangeAttribution.tsx`, `RiskScore.tsx` to the new system. Keep every existing data-fetch and computed value — only change markup/styling.

- Exchange hero card: white `Card`, gold `IconTile` monogram, stat `Well`s in a row, vermillion `Badge`/alert strip for non-compliance.
- Evidence confidence bars: keep the animated width logic, restyle the track to `bg-muted rounded-full h-2`, fill to `bg-gold rounded-full`.
- RiskScore: the `Gauge` primitive from Task 1 (already restyled) drives this page; five contribution bars restyled the same way as the confidence bars above, in vermillion.

Verify: `npm run build` zero TS errors; gauge still animates to the correct score, bars match values/order exactly as before, primary actions still navigate correctly.

**Report:** commit as `feat(frontend): restyle Exchange Attribution and Risk Score pages`.

---

## Task 5: Evidence page restyle (graph, report, lawful-action tabs)

Restyle `frontend/src/pages/Evidence.tsx` and its component dependencies (`frontend/src/components/graph/`, `frontend/src/components/report/`, `frontend/src/components/action/`) to the new system. This is the largest single page — keep every existing tab-routing (`?tab=` query param), every existing Cytoscape/SVG graph logic, every existing PDF-export call, every existing modal/status-chip behavior. Only change markup/styling.

- Tab switcher: use the new `Tabs`/`TabsList`/`TabsTrigger` primitives from `components/ui/tabs.tsx` instead of the old raised-sm-chip tab buttons.
- Graph tab: restyle the surrounding panel to a plain white `Card`, keep the graph canvas/SVG itself as-is (colors on graph nodes/edges follow the same semantic accent colors, unchanged); restyle the node detail drawer and legend to the new card system.
- Report tab: the printable report's own internal styling can stay closer to a print-document look (it's meant to look like a formal PDF page, not a dashboard card) — just make sure the surrounding "well" it sits in matches the new system.
- Lawful-action tab: three `Card`-based action rows, `Badge` status chips, `Dialog` (from Task 1, already built) replacing the old neumorphic modal for the Send/Generate flows.

Verify: `npm run build` zero TS errors; all three tabs render and switch correctly, graph interactive controls still work, PDF download still produces a real file, all three lawful-action dialogs still open and animate their status chip on Send/Generate.

**Report:** commit as `feat(frontend): restyle Evidence page (graph, report, lawful-action tabs)`.

---

## Task 6 (after 2-5 land): cleanup

Grep the whole `frontend/src` for any remaining `.module.css` imports or references to `frontend/src/styles/tokens.css`/`surfaces.css`/`reset.css`/`global.css`. Delete every now-unused `.module.css` file and, if nothing imports them anymore, delete the four old neumorphic style files themselves. Run `npm run build` one final time to confirm zero errors and no dangling imports. Do a full click-through of all 9 screens to confirm visual consistency end-to-end.

**Report:** commit as `chore(frontend): remove dead neumorphic CSS system after v2 redesign`.
