# Frontend — `web/`

The new investigator console for SIH 26182. The older `frontend/` app (26183, neumorphic) is kept only
as a reference for backend wiring and will not get new features.

## Run
```bash
npm --prefix web install
npm --prefix web run dev      # http://localhost:5180
npm --prefix web run build    # tsc -b && vite build
```
`.claude/launch.json` has a `web` entry for the desktop preview.

## Stack
- React 19 + TypeScript + Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom 7.
- **Motion** (`motion/react`) for transitions. **Animate UI** components (copied in via the shadcn
  registry `@animate-ui`, style `new-york`) for Tabs, Tooltip, Dialog, Sheet, Switch, Progress,
  CountingNumber, SlidingNumber, Highlight. **Lenis** (`lenis/react`) for smooth scrolling.
- lucide-react icons. Fonts: Space Grotesk (numbers/headings), Inter (body), JetBrains Mono (addresses).
- No chart library: charts are hand-built SVG components in the kit, so they match the design exactly.

## Design language
Dark "Vaulto"-style console, from Dhruv's reference shots on 2026-10-03: near-black frame, gradient cards
with a hairline border, grain/speckle stat tiles, a top spotlight, an ember (`#ff4f12`) primary button,
red/white glowing curves, grayscale bar tracks with one red highlight, Sankey ribbons, square heat
cells, and glowing Bézier relationship graphs (the signature visual).

Tokens live in `web/src/index.css` (`--k-*` variables plus Tailwind `@theme` colours). Colour meaning
is fixed:

| Tone | Meaning |
|---|---|
| ember | brand / primary action |
| crimson | criminal path / high risk |
| gold | exchange |
| teal | on-chain hop |
| violet | cross-chain bridge |
| sky | victim / origin |
| moss | safe / done / verified |

Text sizes were bumped one notch on 2026-10-03 for readability (`scratchpad bump.cjs`, mapping
11→12.5px, 12→13.5px, etc.). Minimum readable text is ~11px.

## Structure
```
web/src/
  app/            AppShell, Sidebar, TopBar, CommandPalette (⌘K), Section (tab bar), nav.ts (IA)
  components/
    kit/          Card, CardHeader, Chip, DemoChip, Delta, Button, Stat, Address, Meter, ScoreRing,
                  PageHeader, Reveal, KV, IconTile, useCountdown, useTick,
                  Sparkline, CurveChart, BarColumns, HeatGrid, Donut, FlowGraph, Sankey, tone.ts
    animate-ui/   copied Animate UI components (adapted overlay styling)
  data/demo.ts    shared synthetic dataset (case KZN-2026-0417, exchanges, routes, risk, cases, syndicates)
  lib/format.ts   inr(), num(), usdt(), short(), pct(), mmss()
  pages/          one file per screen, plus a lowercase folder per screen for page-local data/components
```

## Information architecture (10 sidebar items, tabs inside)
| Sidebar | Route | Tabs |
|---|---|---|
| Command Center | `/` | — |
| Cases | `/cases` | Case queue · Smart intake (`/cases/new`) |
| Live Trace | `/trace` | — |
| Attribution | `/attribution` | Exchange & risk · Travel Rule & OSINT (`/intel`) · Operator habits (`/fingerprint`) |
| Rupee Exit Trail | `/fiat` | — |
| National Graph | `/network` | National memory · Syndicates (`/syndicates`) · FIR dedup & routing (`/dedup`) |
| Pre-emptive Freeze | `/interdiction` | — |
| Sanctions & Broadcast | `/watchlists` | Broadcast & screening · Proximity risk (`/diffusion`) |
| Notices & Routing | `/evidence` | Evidence & notices · Cross-border routing (`/cross-border`) · Exchange compliance (`/compliance`) |
| Assurance | `/assurance` | Accuracy & red team · Officer feedback (`/feedback`) · Audit ledger (`/audit`) |

Old flat paths (`/intake`, `/syndicates`, `/jurisdiction`, `/fingerprint`, `/compliance`, `/learning`,
`/audit`) redirect to their new homes.

## Screen inventory (each has at least one interactive moment)
| Screen | File | Interactive moment |
|---|---|---|
| Command Center | `pages/Dashboard.tsx` | range toggle, live golden-hour countdowns, chart hover |
| Case queue | `pages/Cases.tsx` | filters/search/sort with layout animation, detail side card / sheet |
| Smart intake | `pages/Intake.tsx` + `pages/intake/` | 5-stage wizard: complaint → reading (live scan) → check details → scam type & national memory → open case |
| Live Trace | `pages/Trace.tsx` | re-run pipeline, route/cold-trail views, node detail, candidate re-acquisition |
| Exchange & risk | `pages/Attribution.tsx` | counterfactual what-if sliders/presets recompute the score live |
| Travel Rule & OSINT | `pages/AttributionIntel.tsx` | eligibility checker, scan public sources |
| Operator habits | `pages/Fingerprint.tsx` | pick operator → radar morph + breakdown |
| Rupee Exit Trail | `pages/Fiat.tsx` | match-engine row → evidence pair + timeline, re-run matching |
| National memory | `pages/NationalMemory.tsx` | check a wallet against the national graph |
| Syndicates | `pages/Syndicates.tsx` | toggle evidence types → links and confidence recompute |
| FIR dedup & routing | `pages/Jurisdiction.tsx` | India tile map filter, FIR A/B comparison, merge & route |
| Pre-emptive Freeze | `pages/Interdiction.tsx` | send alert → confirm dialog → 4-step held timeline |
| Broadcast & screening | `pages/Watchlists.tsx` | live feed, auto-flag rules & threshold, sanctions review |
| Proximity risk | `pages/RiskDiffusion.tsx` | decay / hops / dust controls recompute diffusion |
| Evidence & notices | `pages/Evidence.tsx` | verify hash chain, tamper toggle, notice tabs, approval workflow |
| Cross-border routing | `pages/CrossBorder.tsx` | pick jurisdiction → channel, ETA, checklist update |
| Exchange compliance | `pages/Compliance.tsx` | select notice → escalation ladder; remind / escalate |
| Accuracy & red team | `pages/Assurance.tsx` | run stress test across 7 scenarios |
| Officer feedback | `pages/Learning.tsx` | accept / reject / correct → weights update |
| Audit ledger | `pages/Audit.tsx` | verify chain; simulate tampering breaks it at entry #6 |

## Conventions
- Pages compose kit components; wrap sections in `<Reveal>`; one ember button per view.
- Every card title = plain English (`CardHeader title`) + technical subtitle (`tech`).
- `FlowGraph` sizes columns automatically and never overlaps nodes; give wide columns `width` per node.
- Probabilistic outputs always show confidence + one-line disclaimer.

## Backend wiring plan (started 2026-10-04 — intake, memory, case queue use `src/api/`)
1. Add `web/src/api/` mirroring the old `frontend/src/api` pattern: one async function per screen query,
   `index.ts` switching mock vs HTTP on `VITE_USE_MOCK`.
2. Move page-local `data.ts` objects behind those functions (mock returns them unchanged).
3. Mirror Pydantic schemas from `backend/app/schemas.py` as TS types next to each API function.
4. Replace timers/fake progress with real job status (Celery task polling or SSE).
5. Keep `DEMO DATA` chip until every number on a screen comes from the backend.

## Known gaps
- Pages import their data directly (no `src/api/` layer yet) — acceptable for the prototype, must change
  before backend wiring.
- KPIs, backtest numbers, timings are illustrative and labelled as such.
- Section references in legal drafts (BNSS §94/§106, BSA §63, BNS/IT Act sections) are unverified.
- All 20 screens checked visually at 1600px; all 20 checked for horizontal overflow at 375px (none).
- Attribution weights are duplicated in `pages/attribution/model.ts` and `pages/attributionintel/` — move to `data/demo.ts`.
- Single JS bundle > 500 kB; add route-level code splitting.
