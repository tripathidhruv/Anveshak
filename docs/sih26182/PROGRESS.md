# Progress — SIH 26182

Newest first. Update at the end of every session.

## 2026-10-05 · Rupee Exit Trail removed, top bar trimmed
- Removed the Rupee Exit Trail screen (`/fiat`, `pages/Fiat.tsx`, `pages/fiat/`), its nav item and links; it
  is out of scope (plan + backend docs marked). Nav is now 9 sections.
- Removed the apps-grid, notifications and messages icons from the top bar (they did nothing).
- Video script (`deck/ANVESHAK_VIDEO_SCRIPT.md`) and the deck updated to match.

## 2026-10-04 (evening) · Liquid-glass restyle + three themes
- Every surface (cards, buttons, pills, sidebar, top bar, section tabs) is now frosted glass over a themed
  glow backdrop with fine grain; bigger radii, pill buttons.
- Three switchable themes in the top bar, saved per browser: **Graphite** (default, monochrome, white
  primary pill), **Ember** (original brand, glassier), **Violet** (midnight indigo glow). Only the brand
  accent and backdrop change — meaning colours (crimson/gold/teal/violet/sky/moss) are fixed in all three.
- Hard-coded dark fills in ~27 files moved to theme variables (`--k-solid`, `--k-pop`, `--k-glass`).
- Content density unchanged by request ("light touch"); a deeper simplification pass is still open.

## 2026-10-04 (later) · Dhruv + Claude · Typology detection, staged trace, sub-tabs everywhere
**Did:**
- Backend `app/typology/`: on-chain crime typology (fraud/scam, ransomware, darknet market, terror-financing
  *indicators*, layering/other) — glass-box score = Σ weight × signal with every term returned, bands
  strong/present/not indicated, mandatory disclaimer. `POST /api/v1/typology/assess`,
  `GET /api/v1/typology/cases/{id}` (signals derived from stored hops). 490 → 524 tests.
- Live Trace is now a 6-stage flow with transitions (Run → Money trail → How it moved → Bridge & mixer →
  Verdict → Act); `?step=` deep links; the trace finishes before results open; Verdict shows attribution,
  risk, **typology** and innocence side by side; Act holds lawful actions + the hop record.
- Attribution: typology ring beside the risk score and innocence ring in the hero; sub-tabs Why this
  exchange · Risk score · Crime type · Innocence check · What would flip it.
- New kit pieces: `SubTabs` (URL-synced, animated underline tabs) and `StageRail`/`StageFrame`.
- 15 more screens split into sub-tabs (Fingerprint, Fiat, National memory, Syndicates, FIR dedup,
  Interdiction, Watchlists, Risk diffusion, Evidence — with its own **Lawful actions** tab — Cross-border,
  Compliance, Assurance, Officer feedback, Audit, Travel Rule & OSINT). Every card kept; 0 console errors.
- ANVESHAK SIH 26182 deck built on the team template (`deck/ANVESHAK_SIH26182.pptx` + `.pdf`).

**Next:**
- Typology signals for ransomware/darknet/terror lists need real label feeds (currently 0 unless supplied).
- Verify the official PS 26182 title and team ID on the deck.

## 2026-10-04 · Dhruv + Claude · Backend started (intake + national memory), intake rebuilt as a staged wizard
**Did:**
- Backend `app/intake/`: rule-based entity extraction for Hindi/English/Hinglish complaints (amounts incl.
  lakh/crore, IST dates incl. "shaam 7:42 pm", handles + platform, masked phones/UPI), pure-Python address
  validation (TRON/Bitcoin Base58Check, bech32/bech32m, EIP-55 via a hand-written Keccak-256), keyword
  typology classifier (10 classes), mapping to 13 case fields. `POST /api/v1/intake/parse`, `POST /api/v1/intake/cases`.
- Backend `app/memory/`: SAHYOG national memory (append-only wallet/event/syndicate tables, no citizen PII),
  idempotent synthetic seed on startup, `GET /api/v1/memory/wallets/{addr}` (every lookup audited), `GET /api/v1/memory/stats`.
  380 → 490 tests.
- `web/src/api/`: `client.ts`, `types.ts` (mirrors the Pydantic models), `mock.ts`, `http.ts`, `index.ts`
  switching on `VITE_USE_MOCK`. Vite proxies `/api` to `127.0.0.1:8000`. New launch config `web-live` (`--mode live`).
- Smart Intake rebuilt as a 5-stage wizard (Complaint → Reading → Check details → Scam type & links → Open case)
  with direction-aware slide/blur transitions, an animated progress rail, a live scan + pipeline that only advances
  as the real request completes, field ↔ source-text highlighting on hover, "Looks right" confirmation for
  low-confidence values, required-field gating with the reason shown, national-memory link graph, success reveal,
  Ctrl+Enter, draft kept in sessionStorage, NCRP queue import, double-click guard.
- Case queue now loads through the API layer; a case opened in the wizard appears in the queue (selected,
  tagged NEW, ranked with live cases). Case detail gained a 5-step progress tracker and a stage-aware "Next step".
  Untraced cases and expired freeze windows no longer show a fake countdown.
- Demo suspect wallet replaced by a checksum-valid synthetic TRON address (`TXk99ZPW…XKraUm`, derived from a
  hashed seed, never used on-chain) so validation passes honestly. Synthetic BTC/ETH wallets added for the NCRP samples.

**Decisions:**
- Built `intake` + `memory` first (not the `BACKEND.md` impact order) because they power the case-opening flow.
- Mock mode reads only the sample complaint and says so; it never pretends to parse arbitrary text.
- PII entities come back masked in `text`; spans still index the original so the UI highlights correctly.

**Next:**
- `txHash` and `platform` from intake aren't stored (no `Case` columns yet).
- No OCR/screenshot input yet (Tesseract not wired).
- `GET /api/v1/cases` maps only status/recoverability; risk, syndicate and exchange stay empty in live mode.
- Remaining backend modules in order: syndicates/dedup → routing → diffusion → intel → interdiction → compliance → assurance.
- Commit `web/`, docs and the backend changes (still uncommitted).

## Status board
| Area | State |
|---|---|
| Rival review (12 repos) | done → `COMPETITORS.md` |
| Product plan | done → `PLAN.md` |
| New frontend `web/` — shell, kit, design tokens | done |
| Screens (20 across 10 sections) | done (synthetic data) |
| Nav cleanup 16 → 10 items with tabs | done |
| Text-size bump for readability | done |
| Mobile pass on every screen | no horizontal overflow on all 20 screens at 375px; visual polish at phone size not yet reviewed screen-by-screen |
| `web/src/api/` mock/HTTP layer | started — intake, national memory, case queue go through it (`VITE_USE_MOCK`); other 19 screens still import data directly |
| Backend for 26182 (new modules) | 2 of 11 done: `intake/`, `memory/` (490 tests) → `BACKEND.md` |
| Typology detection (5 classes, glass-box) | backend + Trace/Attribution UI done |
| Live Trace as a 6-stage flow; sub-tabs on 16 screens | done |
| Smart Intake as a 5-stage wizard | done — mock and live backend both verified in the browser |
| Legal section references verified | not started (BNSS §94/§106, BSA §63, BNS/IT Act sections in drafts) |
| Cross-border country data verified | not started (treaty basis, languages, turnaround per country are illustrative) |
| Real KPIs instead of illustrative numbers | not started |

## 2026-10-03 · Dhruv + Claude · New 26182 console built from scratch in `web/`
**Did:**
- Copied the ANVESHAK repo from `E:\kaizen` into `E:\26182` (full git history, remote `tripathidhruv/kaizen`).
- Reviewed all 12 rival SIH 26182 repos with 4 parallel agents. Findings in `COMPETITORS.md`.
- Built a new frontend in `web/` (React 19, Vite, Tailwind v4, Motion, Animate UI, Lenis), replacing the
  neumorphic look with Dhruv's dark reference style. The old `frontend/` is kept for backend reference only.
- Built the kit: cards, chips, stats, glowing `FlowGraph`, `Sankey`, `CurveChart`, `BarColumns`,
  `HeatGrid`, `Donut`, `ScoreRing`, `Sparkline`; app shell with collapsible sidebar, ⌘K command palette,
  mobile sheet nav, section tab bars.
- Built Command Center and Live Trace directly; 7 agents built the other 18 screens in parallel against a
  shared brief; each screen QA'd in the browser afterwards.
- Dhruv asked for fewer nav items, bigger text, and 5 extra innovations (#4 SAHYOG memory, #7 risk diffusion,
  #8 cross-border MLAT routing, #9 Travel Rule, #10 OSINT). Did all three: 10 sidebar sections with tabs,
  text bumped one notch everywhere, 4 new screens added.
- Fixed along the way: grid children overflowing (`Reveal` now `min-w-0`), FlowGraph node overlap (columns
  now auto-size with a minimum strand gap), Animate UI pulled with the wrong shadcn style (base-nova
  produced base-ui `render` props; switched to new-york), stale Vite transform after a mid-write.

**Decisions:**
- New console lives in `web/`, separate from `frontend/`, so backend wiring later can borrow the old API
  layer without inheriting the old design.
- Hand-built SVG charts instead of a chart library, to match the reference exactly.
- Nav = 10 sections; secondary screens are tabs with their own routes (deep-linkable), and old paths redirect.

**Next:**
- Phone-size visual polish screen by screen (no overflow anywhere already).
- Verify cross-border country data with the central authority guidance before a judge sees that tab.
- Move attribution weights into `data/demo.ts` (now duplicated in `pages/attribution/model.ts` and `pages/attributionintel/`).
- Code-split routes (bundle > 500 kB warning on build).
- `web/src/api/` layer + TS types mirrored from Pydantic schemas (Phase 1 of `BACKEND.md`) — when Dhruv says go.
- Verify legal section references before any judged round.
- Commit the `web/` app and docs (not committed yet).
