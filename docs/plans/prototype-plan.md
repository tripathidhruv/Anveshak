# KAIZEN prototype build plan

Single file: `prototype/index.html`. No build step, no npm, no framework — vanilla JS, inline CSS/JS, CDN libraries only. Target Chrome 1920×1080, degrade to 1440×900. This plan executes sequentially — every task after Task 1 edits the same file and depends on the previous task's state, so tasks run one at a time, never in parallel.

## Global Constraints (apply to every task)

**Design tokens — use exactly these values, define once in `:root`, reuse everywhere:**
```css
:root{
  --bg: #E0E5EC; --bg-sunken: #DCE1E8;
  --shadow-dark: #A3B1C6; --shadow-light: #FFFFFF;
  --ink: #2E3440; --ink-mid: #4A5568; --ink-soft: #7A879B;
  --indigo: #1E3A5C; --vermillion: #B93E28; --teal: #0E6E6B;
  --violet: #6A4C93; --moss: #4C7A3F; --gold: #B8912F; --sky: #2F7DBF;
  --r-lg: 22px; --r-md: 16px; --r-sm: 12px; --r-pill: 999px; --gap: 24px;
}
```

**Four surface recipes** (define once as CSS classes, reuse everywhere — never inline a shadow):
```css
.raised{ background: var(--bg); border-radius: var(--r-lg);
  box-shadow: 9px 9px 18px var(--shadow-dark), -9px -9px 18px var(--shadow-light); }
.raised-sm{ background: var(--bg); border-radius: var(--r-sm);
  box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light); }
.pressed{ background: var(--bg); border-radius: var(--r-md);
  box-shadow: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light); }
.flat{ background: var(--bg); box-shadow: none; }
.raised-sm, .raised{ transition: box-shadow .18s ease, transform .18s ease; }
.clickable:hover{ box-shadow: 7px 7px 14px var(--shadow-dark), -7px -7px 14px var(--shadow-light); }
.clickable:active{ box-shadow: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light);
  transform: translateY(1px); }
```

**The accessibility rule — do not violate:** neumorphism is for furniture (containers, buttons, nav, wells) — low contrast, tonal, OK. Text, numbers, risk states, status badges are FULL CONTRAST always: headings `--ink` (#2E3440), body `--ink-mid` (#4A5568), never body text lighter than `--ink-soft` (#7A879B). Never encode meaning in shadow alone — a "HIGH RISK" state is a solid vermillion fill with white text + icon, not a deeper grey groove. The one primary-action button per screen is solid `--indigo` fill, white text, neumorphic drop shadow — always bottom-right of the content area, always says what happens in plain words ("Start tracing the money", not "Execute").

**Type:**
```
Display/headings: 'Outfit','Plus Jakarta Sans',system-ui,sans-serif — 600/700
Body/UI:          'Inter',system-ui,-apple-system,sans-serif — 400/500/600
Numbers/addresses:'JetBrains Mono',ui-monospace,monospace — 400/500
```
Load via Google Fonts CDN. Wallet addresses, transaction IDs, amounts, timestamps always render in the mono face. Scale: page title 30px/700 · card title 18px/600 · KPI number 34px/700 mono · body 15px/400 · label 12px/600 uppercase letter-spacing .08em · caption 13px.

**Icons:** Lucide via CDN `<script src="https://cdn.jsdelivr.net/npm/lucide@0.544.0/dist/umd/lucide.min.js"></script>`. Markup `<i data-lucide="shield-check"></i>`, call `lucide.createIcons()` after EVERY render or icons stay blank. Every icon sits in a 44×44 `.raised-sm` tile, icon 20px `--ink-mid` (or the context colour inside coloured contexts). No emoji anywhere in the UI.

**Money:** rupees first, crypto second. `₹12,40,000` at 34px, `14,850 USDT` at 15px mono grey below it. Indian digit grouping via `Intl.NumberFormat('en-IN')` — never plain `toLocaleString()`.

**Colour semantics — fixed, never reused for a second meaning:** vermillion = criminal path / high risk. gold = exchange/destination. teal = ordinary on-chain movement. violet = bridge/cross-chain. moss = done/safe/verified. sky = information/links.

**UX laws — apply on every screen:**
1. One primary action per screen — biggest, only solid-indigo element, bottom-right.
2. Plain English heading + small grey technical subtitle for every technical term (e.g. "Money moved out in 42 seconds" / *sweep signature detected*).
3. Under every technical panel: a full-width `.pressed` strip, lightbulb icon, one sentence max 20 words, "In plain words" explanation.
4. Persistent 7-step progress rail at the top of every workflow screen: `New Case → Trace → Route → Exchange → Risk → Evidence → Action`. Completed = moss check in raised circle. Current = indigo-filled, larger. Future = `--ink-soft` in pressed wells.
5. Simulated work gets 1.2–2.0s animated progress with a changing status line, never instant, never over 2.5s.
6. Zero dead ends — every screen has a visible next action and back. No modal without close. Out-of-scope buttons open a small "Coming in v2" tooltip, never silently fail.
7. `Reset demo` control in the top bar returns to dashboard instantly.
8. Judge Mode toggle (top bar, default ON) — soft pulsing ring on the next element to click, coach-mark strip at bottom saying what to do next in one line.
9. No scroll during the core flow (each of the 7 steps fits 1920×1080); scrolling allowed only inside the graph panel and report preview.

**Micro-interactions:** screen transitions 260ms fade + 12px upward slide, staggered 40ms per card. KPI/score numbers count up from 0 via `requestAnimationFrame` over 700ms ease-out. Buttons depress on `:active`. Risk gauge needle animates 900ms `cubic-bezier(.22,1,.36,1)`. Graph edges on the criminal path: continuous `line-dash-offset` loop ~1.5s. Checklist items appear at 280ms intervals, `scale(.94)→1` + soft moss check. Toasts slide in bottom-right, `.raised` pill, auto-dismiss 3s. `prefers-reduced-motion: reduce` → disable all of the above except opacity fades (one media query).

**CDN tags — exact, pinned versions, use these:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/lucide@0.544.0/dist/umd/lucide.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.34.3/cytoscape.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.5.1/chart.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.14.0/html2pdf.bundle.min.js"></script>
```

**Data integrity rules:** `Meridian Digital Exchange` is fictional, all addresses synthetic — never substitute a real exchange name. Permanent small `DEMO DATA` chip in the top bar.

**Architecture:** one global `APP` state object (current screen, judge mode on/off, any user edits to case fields) + a `render(screenName)` router function that clears and rebuilds the content area from `DEMO`. Never hardcode a number that also lives in `DEMO` — always read from it. `DEMO` is a single JS object literal at the top of the script, defined exactly per Task 1's brief.

**After every task:** the file must open in a browser with zero console errors, and every screen built so far must be reachable and navigable with no dead buttons.

---

## Task 1: App shell, design system, DEMO dataset, router

Create `prototype/index.html` from scratch with:
1. `<!DOCTYPE html>` shell, `<head>` with title "KAIZEN — Cyber Cell Console", the font preconnects + stylesheet, the four CDN script tags, and a `<style>` block implementing every token and surface recipe from Global Constraints (`:root` vars, `.raised/.raised-sm/.pressed/.flat`, `.clickable` states, typography scale, a `<1000px` "best viewed on desktop" notice, and the `prefers-reduced-motion` media query).
2. The app shell layout:
   - Fixed left sidebar, 248px, `.raised`, margin 20px, radius 22: logo block (◆ diamond mark in indigo inside a `.raised-sm` tile + "KAIZEN" 20px/700 + "Cyber Cell Console" 11px `--ink-soft`); nav items (Dashboard, Cases (3), Trace, Campaigns (1), Reports, Exchanges) each 44px tall icon+label radius 12, active item `.pressed` with `--indigo` 600 label + 3px indigo left bar, inactive flat→`.raised-sm` on hover; a `+ New Case` solid-indigo full-width button; `Help & Support` link at the bottom.
   - Top bar, `.raised`, height 72: page title left; search `.pressed` well with Lucide `search` icon (decorative, accepts typing) center; on the right, in order: `DEMO DATA` chip (small, permanent, always visible), Judge Mode toggle (default ON), `Reset demo` button, notification bell icon, avatar circle.
   - A 7-step progress rail component (per Global Constraints #4) that every workflow screen (1–6) renders under the top bar; the Dashboard (screen 0) does not show it.
3. The `DEMO` object, defined verbatim below — every later screen task reads from this, never hardcodes a duplicate number:

```js
const DEMO = {
  case: {
    id: "KZN-2026-0417", ncrp: "31402260041789", complainant: "Rekha Sharma",
    location: "Jaipur, Rajasthan", phone: "+91 98XXX XXX41",
    incidentAt: "02 Sep 2026, 19:42 IST", reportedAt: "04 Sep 2026, 11:05 IST",
    fraudType: "Task-based job scam (Telegram)",
    amountINR: 1240000, amountCrypto: 14850, asset: "USDT (TRC-20)", chain: "TRON",
    suspectWallet: "TXk9mR4pQ2vL8nW3sD6fH1jK5bQ2aZ"
  },
  routeA: {
    label: "Same blockchain", chain: "TRON", accent: "teal",
    valueINR: 1090000, valueCrypto: 13050, durationMin: 32, hops: 5,
    trail: [
      { n:1, addr:"TVc2hL8sN4dR7gY1mX5wQ", role:"Victim's wallet", amt:14850, at:"19:42:04", flag:null },
      { n:2, addr:"TXk9mR4pQ2vL8nW3sD6fH", role:"Scammer's wallet", amt:14850, at:"19:42:11", flag:"SUSPECT" },
      { n:3, addr:"TQm7bK3xF9jH2nL6pV4sD", role:"Wallet 2", amt:14835, at:"19:42:53", flag:"SWEPT", gapSec:42 },
      { n:4, addr:"TPd4wS8cM1kR5tY9nB3gH", role:"Wallet 3", amt:14820, at:"19:43:38", flag:"SWEPT", gapSec:45 },
      { n:5, addr:"TNh8yW5vC2mQ7fL4xK9pR", role:"Collection wallet", amt:412900, at:"19:51:02", flag:"HUB · 38 victims" },
      { n:6, addr:"TBx1eM9nT7hG3sV5cW2kL", role:"Exchange deposit", amt:412900, at:"20:14:27", flag:"EXCHANGE" }
    ]
  },
  routeB: {
    label: "Through a bridge", chainFrom: "TRON", chainTo: "Ethereum", accent: "violet",
    valueINR: 150000, valueCrypto: 1800, durationMin: 49, hops: 6,
    trail: [
      { n:1, addr:"TXk9mR4pQ2vL8nW3sD6fH", role:"Scammer's wallet", amt:1800, at:"19:42:11", chain:"TRON", flag:"SUSPECT" },
      { n:2, addr:"TQm7bK3xF9jH2nL6pV4sD", role:"Wallet 2", amt:1795, at:"19:44:20", chain:"TRON", flag:"SWEPT", gapSec:129 },
      { n:3, addr:"TKb5nP6rJ8dF2mX7qL4wC", role:"Bridge contract", amt:1795, at:"19:58:41", chain:"TRON", flag:"BRIDGE IN" },
      { n:4, addr:"0x7a3fd21c9b4e8a5f2071", role:"Emerges here", amt:1782, at:"20:03:19", chain:"Ethereum", flag:"BRIDGE OUT" },
      { n:5, addr:"0x9e4b8f07a2c6d13e5b", role:"Wallet 4", amt:1776, at:"20:09:55", chain:"Ethereum", flag:"SWEPT", gapSec:396 },
      { n:6, addr:"0x2c8da154fe37b09c42", role:"Exchange deposit", amt:1776, at:"20:31:08", chain:"Ethereum", flag:"EXCHANGE" }
    ]
  },
  exchange: {
    name: "Meridian Digital Exchange", monogram: "MD", depositAddr: "TBx1eM9nT7hG3sV5cW2kL",
    jurisdiction: "Seychelles", fiuRegistered: false, indianUsers: "~2.1 lakh",
    evidence: [
      { label:"Address appears in 340 deposit-like transactions", conf:0.94 },
      { label:"Matches known exchange wallet pattern", conf:0.89 },
      { label:"Public blockchain-explorer tag", conf:0.81 },
      { label:"Consolidation behaviour typical of hot wallets", conf:0.77 }
    ]
  },
  risk: {
    score: 0.87, band: "HIGH",
    factors: [
      { plain:"Money moved out in 42 seconds", tech:"sweep latency", w:0.31 },
      { plain:"38 victims' money in one wallet", tech:"consolidation hub", w:0.24 },
      { plain:"99.9% of the amount kept", tech:"value preservation", w:0.15 },
      { plain:"Exchange not registered in India", tech:"VASP compliance", w:0.12 },
      { plain:"No money ever came back", tech:"no counter-flow", w:0.05 }
    ]
  },
  campaign: { cases:38, totalINR:47000000, states:11, sharedWallet:"TNh8yW5vC2mQ7fL4xK9pR" },
  dashboard: {
    kpis:[
      { label:"Active cases", value:"147", delta:"+12 this week", dir:"up" },
      { label:"Traced to an exchange", value:"112", delta:"76% success rate", dir:"up" },
      { label:"Value traced", value:"₹18.4 Cr", delta:"+₹3.1 Cr this quarter", dir:"up" },
      { label:"Median trace time", value:"41 s", delta:"was 4-6 weeks", dir:"down" }
    ],
    recentCases:[
      { id:"KZN-2026-0417", who:"Rekha Sharma", amt:1240000, chain:"TRON", status:"New", risk:null },
      { id:"KZN-2026-0416", who:"Arun Menon", amt:860000, chain:"TRON", status:"Traced", risk:"HIGH" },
      { id:"KZN-2026-0415", who:"Fatima Qureshi", amt:2150000, chain:"Ethereum", status:"Traced", risk:"HIGH" },
      { id:"KZN-2026-0414", who:"S. Balaji", amt:430000, chain:"Bitcoin", status:"Notice sent", risk:"MEDIUM" },
      { id:"KZN-2026-0413", who:"Priya Nair", amt:1780000, chain:"TRON", status:"Closed", risk:"HIGH" }
    ]
  }
};
```
4. Wallet addresses in this dataset render truncated in the mono face everywhere (e.g. `TXk9…q2aZ` — first 4 + last 4 chars), full address available via a copy-icon-on-hover / title attribute.
5. A `render(screenName)` function and an `APP = { screen: 'dashboard', judgeMode: true }` state object. For this task, `render()` only needs to produce placeholder content divs for all 8 screens (`dashboard`, `newcase`, `trace`, `route`, `exchange`, `risk`, `evidence`, `closed`) — just enough that sidebar nav and the `+ New Case` button can switch between visibly-different placeholder screens with the transition animation working. Full screen content is built in later tasks.
6. Judge Mode toggle and Reset demo button must be visibly present and clickable but can no-op beyond switching `APP.judgeMode` / returning to dashboard — full coach-mark behavior is a later task.

Verify: open the file in a browser, zero console errors, sidebar nav switches placeholder screens, `lucide.createIcons()` runs after every render so icons show.

**Report:** commit as `feat(prototype): app shell, design tokens, DEMO data, router`.

---

## Task 2: Screen 0 — Dashboard

Build the real Dashboard screen (replacing its placeholder), reading only from `DEMO.dashboard`.

- KPI strip: 4 `.raised` cards left-to-right, each with a 44px `.raised-sm` icon tile (pick a fitting Lucide icon per KPI: e.g. `folder-open`, `check-circle-2`, `indian-rupee` or `wallet`, `timer`), uppercase label, big mono number that counts up from 0 via requestAnimationFrame (700ms ease-out) on first render, a delta chip (moss pill + up arrow if `dir:"up"`, vermillion... actually median trace time improving is good news even though `dir:"down"` — use moss for both, arrow direction follows `dir`), and a small inline SVG sparkline (decorative, hand-drawn path, no library needed).
- Left column (2/3 width): "Recent cases" table from `DEMO.dashboard.recentCases` — columns Case ID (mono) · Complainant · Amount (₹ Indian grouping) · Chain · Status pill (colour: New=sky, Traced=teal, "Notice sent"=violet, Closed=moss) · Risk badge (HIGH=vermillion fill, MEDIUM=gold fill, null=empty dash). Top row (KZN-2026-0417) and the `+ New Case` sidebar button both set `APP.screen='newcase'` and call render.
- Right column (1/3): "Campaign alert" card, vermillion-tinted, text "38 complaints across 11 states share one wallet." (pull `38`/`11` from `DEMO.campaign`), with a `View campaign` link (routes to a `campaign` screen — if that screen doesn't exist yet, show a "Coming in v2" tooltip per Global Constraints #6, do not error).
- Below both columns: "Trace activity, last 14 days" — a Chart.js line chart per the Global Constraints chart styling: lives in a `.pressed` well, grid `#CDD5E0` 1px, `--ink-soft` 12px axis labels, 2.5px teal stroke, `tension:0.4`, gradient fill to transparent, points hidden until hover, custom `.raised-sm` pill tooltip (not default Chart.js black tooltip), `legend:{display:false}`. Use 14 synthetic but plausible daily trace-count values you invent (consistent with "147 active cases" scale) — label this data as illustrative only in a code comment, not in the UI (no separate on-screen disclaimer needed beyond the global DEMO DATA chip).
- Primary action bottom-right: solid-indigo `+ Register new case` → routes to `newcase` screen.

Verify: dashboard renders with real numbers from DEMO, KPI counters animate once per render (do not re-trigger endlessly), chart renders inside its pressed well with no default Chart.js styling bleeding through, clicking the top recent-case row or the primary action reaches the New Case screen.

**Report:** commit as `feat(prototype): build dashboard screen`.

---

## Task 3: Screen 1 — New Case

Build the New Case screen (replacing its placeholder), reading pre-fill values from `DEMO.case`, inside one `.raised` panel with the 7-step rail showing "New Case" as current.

- Two columns. Left "Who was defrauded?": Complainant name, NCRP acknowledgement number (mono), State/district, Contact — all pre-filled from `DEMO.case`, editable text inputs styled `.pressed`.
- Right "What was taken?": Amount lost (₹) input that live-formats with `Intl.NumberFormat('en-IN')` as the user types; Cryptocurrency as segmented `.raised-sm` chips (USDT (TRC-20) pre-selected ✓, BTC, ETH — clicking switches the pressed/selected chip, single-select); Date & time of transfer (pre-filled, editable); Fraud type dropdown pre-selected to "Task-based job scam (Telegram)" with a few other plausible options.
- Full width below: "The one thing we need" — 64px-tall `.pressed` well, mono 17px, pre-filled with `DEMO.case.suspectWallet`, label above "The wallet address the money was sent to", subtitle "This is the only technical input required.", and on focus/blur show a moss check + "Valid TRON address" confirmation (simple client-side check: non-empty and starts with a plausible prefix is enough, this is a demo).
- A small `Fill demo data` link that resets all fields to `DEMO.case` values.
- "In plain words" strip (per Global Constraints #3): "This is everything a police station already collects today. Nothing new is asked of the victim."
- Primary action bottom-right: solid-indigo `Start tracing the money →`, routes to `trace` screen. Back control per Global Constraints #6 (zero dead ends) — e.g. a back arrow near the page title returning to dashboard.

Verify: every field pre-filled but editable, amount field formats live with Indian grouping, wallet well shows the valid-address confirmation, Fill demo data restores defaults, primary action navigates to Trace screen, back control returns to dashboard.

**Report:** commit as `feat(prototype): build new case screen`.

---

## Task 4: Screen 2 — Trace (animated)

Build the Trace screen (replacing its placeholder). This is the single most important animated moment in the whole prototype — give it full, undivided screen focus, nothing else competing for attention.

- Centre-stage layout, 7-step rail showing "Trace" current.
- Large centred `.pressed` circular well ~260px containing an animated SVG ring (`stroke-dashoffset` technique) that fills 0→100% over 1.8s, with the live percentage in 40px mono at its centre.
- Under the ring, a status line that fade-swaps through exactly these 5 messages as the ring fills (evenly spaced across the 1.8s):
  1. `Connecting to the TRON blockchain…`
  2. `Reading transactions from this wallet…`
  3. `Following the money — hop 3 of 6…`
  4. `Checking how fast the money moved…`
  5. `Looking for a cash-out point…`
- To the right, a live-building checklist, items appearing one at a time at 280ms intervals (per Global Constraints micro-interactions) with a moss check and `scale(.94)→1` pop:
  - `847 transactions read`
  - `6 wallets in the chain`
  - `Money moved out in 42 seconds` — with a vermillion `SWEEP DETECTED` pill beside it
  - `Two possible routes found`
  - `Reached a cryptocurrency exchange`
- On completion (ring reaches 100% and all checklist items shown), auto-advance to the `route` screen after a brief pause (~600ms). Also show a `See what we found →` button that lets the presenter skip ahead immediately if clicked before auto-advance fires (guard against double-navigation if both the timer and the click fire).
- Respect `prefers-reduced-motion`: skip straight to the completed state (ring at 100%, all checklist items shown) rather than animating, still pause briefly before auto-advance.

Verify: animation runs once per screen entry (does not restart if screen re-rendered without re-navigating), auto-advances to Route screen, manual skip button also works and does not double-fire the navigation, reduced-motion users see the completed state without the animated build-up.

**Report:** commit as `feat(prototype): build animated trace screen`.

---

## Task 5: Screen 3 — Route (fork + hop timeline)

Build the Route screen (replacing its placeholder), reading from `DEMO.routeA` and `DEMO.routeB`. 7-step rail shows "Route" current.

- Heading "The money took two different routes." / subtitle "Click either route to follow it."
- Two large `.raised` cards side by side, each `.clickable`:
  - **Left — Route A · Same blockchain** (teal accent): a mini horizontal node-chain diagram in inline SVG — 6 teal dots joined by lines, last dot gold, one dot per `routeA.trail` entry; stats line `₹10,90,000 · 13,050 USDT` (from `routeA.valueINR`/`valueCrypto`, Indian grouping) · `Stayed on TRON` · `5 hops` · `32 minutes` (from `routeA.hops`/`durationMin`); moss badge `EASIER TO FOLLOW`.
  - **Right — Route B · Through a bridge** (violet accent): mini chain with a violet diamond mid-chain labelled `BRIDGE`, dots visibly changing colour from teal (TRON hops) to sky (Ethereum hops) after the bridge; stats `₹1,50,000 · 1,800 USDT` · `TRON → Ethereum` · `6 hops` · `49 minutes`; violet badge `HARDER — CROSSES CHAINS`.
- "In plain words" strip: "A bridge is a currency exchange between two blockchains. Criminals use it hoping the trail breaks. It doesn't — we pick it up on the other side."
- Clicking either card expands it in place into a full hop-by-hop timeline: a numbered vertical rail down the left (`.raised-sm` circles matching `trail[].n`), each hop a row showing the truncated mono address, role, amount (mono, Indian grouping where INR-relevant, else the crypto units), timestamp, and for hops with `flag:"SWEPT"` a highlighted vermillion-tinted `.pressed` row with `▲ {gapSec}s later` and a `⚠ SWEPT` label; the exchange-deposit hop gets a gold accent instead. A copy icon appears on hover over each address (can just copy the full address to clipboard via `navigator.clipboard`, wrapped so it never throws if unavailable).
- Primary action bottom-right: `Who cashed it out? →`, routes to `exchange` screen. Works regardless of whether the user expanded a route card first (expansion is optional exploration, not a gate).

Verify: both cards render correct mini chains and stats from DEMO, clicking either expands its hop timeline with SWEPT rows visually distinct, copy-to-clipboard doesn't throw if the API is unavailable, primary action reaches Exchange screen.

**Report:** commit as `feat(prototype): build route fork and hop-timeline screen`.

---

## Task 6: Screen 4 — Exchange attribution

Build the Exchange screen (replacing its placeholder), reading from `DEMO.exchange`. 7-step rail shows "Exchange" current.

- Heading "The money reached a cryptocurrency exchange." / subtitle "This is where a real, named person exists — exchanges are legally required to verify identity."
- Large gold-accented `.raised` hero card: monogram tile (`.raised-sm`, `exchange.monogram`), exchange name 28px/700, `Deposit address: {truncated exchange.depositAddr}` mono; three `.pressed` stat wells in a row — `Registered in — {jurisdiction}` · `FIU-IND registered — {fiuRegistered ? 'YES':'NO'}` · `Indian users — {indianUsers}`; a compliance strip in vermillion (since `fiuRegistered:false`) reading `Not registered with FIU-IND` with the explanatory line "A registered exchange must respond to Indian law enforcement. This one is not registered, which is itself a finding."
- Beside it, "How we know" — one `.pressed` well per `exchange.evidence[]` entry, each with a check icon, the label, and a confidence bar filled to `conf*100%` with the percentage shown in mono.
- "In plain words" strip: "Think of it as tracing stolen cash to the counter of a specific bank branch."
- Primary action bottom-right: `Calculate the risk score →`, routes to `risk` screen.

Verify: all values pulled from `DEMO.exchange` (no hardcoded duplicates), confidence bars width matches `conf` values, primary action reaches Risk screen.

**Report:** commit as `feat(prototype): build exchange attribution screen`.

---

## Task 7: Screen 5 — Risk score

Build the Risk screen (replacing its placeholder), reading from `DEMO.risk`. This is the strongest technical differentiator — give it generous room. 7-step rail shows "Risk" current.

- Left half: a 300px semicircular SVG arc gauge inside a `.pressed` circular well, gradient sweep moss→gold→vermillion. The needle animates to `risk.score` (0.87) over 900ms `cubic-bezier(.22,1,.36,1)`. Below the gauge: a solid vermillion pill `HIGH RISK` (from `risk.band`) and caption "Confidence that these funds are criminal proceeds."
- Right half: five horizontal contribution bars, one per `risk.factors[]` entry, each showing the plain-English label, a small grey technical subtitle, a bar growing from 0 to `w` (animated width) in vermillion, and the contribution value in mono with a `+` prefix (e.g. `+0.31`).
- A `.pressed` footnote well: "Every number above is shown to the officer. Nothing is a black box — a court can be told exactly why this wallet was flagged."
- "In plain words" strip: "0.87 out of 1. The five reasons below are the whole calculation — there is nothing hidden." (interpolate the actual `risk.score`, don't hardcode 0.87 as literal text — read it from DEMO and format to 2 decimals).
- Primary action bottom-right: `Build the evidence pack →`, routes to `evidence` screen.

Verify: gauge needle animates to the correct angle for `risk.score`, all five factor bars and values match `DEMO.risk.factors` exactly (values and order), primary action reaches Evidence screen.

**Report:** commit as `feat(prototype): build risk score screen`.

---

## Task 8: Screen 6 — Evidence (3 tabs: graph, report, lawful action)

Build the Evidence screen (replacing its placeholder) inside one large `.raised` panel with three tabs (`.raised-sm` chips that become `.pressed` when active): Fund flow graph · Investigation report · Lawful action. 7-step rail shows "Evidence" current.

**Tab 1 — Fund flow graph:** Cytoscape.js graph filling the panel on a `.flat` canvas with a `.pressed` inner border. Build nodes/edges from `DEMO.case`, `DEMO.routeA`, `DEMO.routeB`, `DEMO.exchange`: victim (sky), scammer's wallet (vermillion), intermediate wallets (teal), the bridge (violet diamond shape), the collection wallet (vermillion, larger, "Collection wallet · 38 victims" using `DEMO.campaign.cases`), the exchange (gold hexagon shape, larger, `DEMO.exchange.name`). Edges labelled with amounts; edges on the criminal path get an animated `line-dash-offset` loop so money visibly flows toward the exchange. Layout `breadthfirst`, `directed:true`, left-to-right. Every node's label includes a plain-English sub-label under the technical one (Cytoscape multi-line label or a wrapped HTML label extension — plain text label with `\n` and `text-wrap` if simpler). Clicking a node opens a right-hand `.raised` detail drawer (address, balance/amount, first-seen timestamp, transaction count if available, `Copy address` button). Controls as `.raised-sm` chips above the graph: `Fit` · `Show Route A` · `Show Route B` · `Show both` · `Animate flow`, each actually filtering/restyling the graph. A legend in a `.pressed` well bottom-left explaining the colour semantics.

**Tab 2 — Investigation report:** an A4-proportioned white page preview inside a `.pressed` well, scrollable, built as real HTML (not an image) so `html2pdf.js` can export it. Contents, all pulled from DEMO: KAIZEN header + `DEMO.case.id` + a generated timestamp (use current date at render time) · complainant + case details · the suspect wallet address · Route A and Route B hop tables (full untruncated addresses, amounts, timestamps) · exchange attribution + evidence list · risk score + the five contributing factors · a short methodology note (plain paragraph, can be authored freeform consistent with the rest of the project's tone) · an integrity block showing a SHA-256 hash of a JSON.stringify of the evidence set (compute with `crypto.subtle.digest` at render time — wrap in try/catch, if unavailable e.g. non-secure context show a static placeholder hash rather than crashing) and the line "Generated by KAIZEN v1.0 — reproducible, no third-party data". A `Download PDF` button wired to `html2pdf.js` targeting this report element, producing a real downloadable file.

**Tab 3 — Lawful action:** three stacked `.raised` action cards, each with a status chip:
1. `Request to the exchange` — pre-filled editable letter body (textarea or contenteditable) requesting KYC and account freeze for `DEMO.exchange.depositAddr`, quoting `DEMO.case.id`. Status `READY TO SEND` (sky/teal chip). Button `Preview & send`.
2. `Section 94 BNSS notice` (subtitle: *summons to produce documents — formerly Section 91 CrPC*) — pre-filled draft legal notice text. Status `DRAFT` (gold chip). Button `Open draft`. Include a small inline note near this card (visible in the UI, not just a code comment) that this is a draft for officer review, consistent with CLAUDE.md's non-negotiable rule that legal text is never presented as auto-generated legal advice — e.g. a small caption under the card: "Draft only — an officer must review before filing."
3. `Report to FIU-IND` — flags the unregistered VASP servicing Indian users. Status `READY` (moss chip). Button `Generate`.
Below the three cards, a moss-tinted `.raised` strip: "Because 38 complaints share this wallet, this one action covers 38 cases and ₹4.7 crore." (values from `DEMO.campaign.cases`/`totalINR`, Indian grouping). Clicking any card's button opens a neumorphic modal showing the document body and a `Send`/`Generate` button that, on click, animates that card's status chip to a moss `SENT ✓` (with a soft check animation) and closes the modal.

Primary action bottom-right, visible across all three tabs: `Finish case →`, routes to `closed` screen.

Verify: all three tabs render and switch correctly, graph shows correct node colours/shapes and the control chips actually do something, PDF download produces a real file with report content, all three lawful-action modals open and their Send/Generate button animates the status chip, primary action reaches the closed screen from any tab.

**Report:** commit as `feat(prototype): build evidence screen with graph, report, and lawful action tabs`.

---

## Task 9: Screen 7 — Case closed + Dashboard polish pass

Build the final Case Closed screen (replacing its placeholder), reading from `DEMO`. No 7-step rail on this screen (it's a completion state, similar to Dashboard).

- Single centred `.raised` card: large moss check icon in a `.pressed` circular well, then "Case {DEMO.case.id} traced." and "From one wallet address to a named exchange and a signed notice — in 47 seconds." (the 47s figure is illustrative flavor text consistent with the dashboard's "Median trace time" — fine to state directly here since it's the specific-case narrative, not a duplicated DEMO field).
- Four `.pressed` stat wells: `{routeA.hops + something reasonable} hops followed` — actually just use a clear combined figure: state "6 hops followed" consistent with routeA.hops(5)+1 exchange hop, or simplest: pull `Math.max(routeA.hops, routeB.hops)+1`; `2 routes`; `1 exchange identified`; `{campaign.cases} linked cases`.
- Comparison strip: "Manual investigation: 4–6 weeks. KAIZEN: 47 seconds." with two proportional horizontal bars (one long muted bar, one tiny moss bar) illustrating the scale difference.
- Buttons: `View campaign (38 cases)` (Coming in v2 tooltip if no campaign screen exists), `Start a new case` (routes to `newcase`, ideally resetting any edited case-field state back to DEMO defaults), `Back to dashboard` (routes to `dashboard`).

Also, in this task: do a full click-through polish pass across all 8 screens — confirm the 7-step rail correctly marks completed/current/future steps at every screen, confirm `Reset demo` (top bar) returns to dashboard from every screen, confirm Judge Mode toggle visibly does something real now (pulsing ring via CSS animation on the next primary action / suggested click target on each screen, plus a coach-mark strip pinned bottom-center with a one-line instruction per screen — implement this fully now, it was stubbed in Task 1), and confirm reduced-motion is respected everywhere animations were added in Tasks 2, 4, 5, 7.

Verify: full flow dashboard → new case → trace → route → exchange → risk → evidence (all 3 tabs) → closed → back to dashboard, three times in a row, with zero dead buttons and zero console errors. Judge Mode coach-marks appear and are accurate on every screen. Reset demo works from every screen.

**Report:** commit as `feat(prototype): build case-closed screen, complete judge mode, final polish pass`.
