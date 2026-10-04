# ANVESHAK — 2-Minute Showcase Video: Script + Recording Guide

Goal: one continuous 120-second walkthrough that touches every major feature, in the order a
judge would find most convincing (problem → speed → proof → trust). Written for a screen
recording with voiceover (record voiceover separately and lay it over captured screen footage —
much easier to get clean timing than talking live while clicking).

Total runtime target: **120 seconds**. Timings below are cumulative — treat them as checkpoints,
not hard cuts. If you run long, cut from the Fingerprinting/Sanctions beat (0:58-1:08) first —
it's the most skippable without losing the core story.

---

## Before you record — setup checklist

1. **Use mock mode for the recording** (`VITE_USE_MOCK=true`, the frontend's default). It's
   guaranteed to render every feature instantly with no network calls, no OTP wait, and no risk
   of a live-backend hiccup on camera. Nobody watching a 2-minute reel needs to see a real
   blockchain API call — they need to see the *product*.
2. Run `npm run build` once beforehand and use `npm run preview` (or your normal dev server) —
   confirm zero console errors before you start recording.
3. Set the browser window to a clean 16:9 size (1920×1080 or 1600×900), hide bookmarks bar,
   close dev tools, disable notifications.
4. Log in once as the officer demo account before recording starts so the login screen isn't
   eating your 120 seconds (or, if you want login on camera, budget it inside the 0:08-0:20 beat
   — see the note there).
5. Have the case ID `ANV-2026-0417` (or whatever your demo case is called) ready — several pages
   default to it.
6. Keep the **DEMO DATA** badge visible in every shot it appears in. Don't crop it out — it's
   there on purpose (CLAUDE.md rule: never imply real data or a real exchange).

---

## The script

### 0:00–0:08 — Cold open: the problem
**Screen:** Dashboard or a blank New Case form.
**Voiceover:**
> "A fraud victim reports a crypto scam. The police get one thing: a wallet address. ANVESHAK turns that into the name of the exchange holding the stolen funds — and a signed legal notice — in under a minute."

### 0:08–0:20 — File the case, kick off the trace
**Screen:** New Case form → submit → Tracing/loading screen.
**Voiceover:**
> "One wallet address in. ANVESHAK traces every hop the money took, across chains, automatically."
**Action note:** Type the address, hit submit, let the trace-in-progress animation play for ~2-3 seconds before cutting to the result — a beat of "it's actually working" sells the product more than the number of screens you show.

### 0:20–0:35 — The fund-flow graph
**Screen:** Fund Flow Graph (Evidence page's graph tab), zoomed to show the full path.
**Voiceover:**
> "This is the sweep signature — stolen funds moving out within seconds, almost the full amount preserved. That's not how a real person spends money. That's scam automation. And when dozens of victims' money lands in the same wallet, ANVESHAK sees the whole campaign, not just one case."
**Action note:** Hover/click through 2-3 nodes to show the drawer opening. If your demo data includes a bridge-crossing or mixer-entry hop, pause on it for one second each — the dashed violet "unconfirmed bridge" and dashed indigo "mixer" badges are a visible, differentiated detail worth a half-second each.

### 0:35–0:48 — Exchange attribution + innocence score
**Screen:** Exchange Attribution page.
**Voiceover:**
> "The trail ends at a named exchange — not a guess, a gated match against verified hot-wallet records. And before any legal notice goes out, ANVESHAK checks the other side too: could this wallet be innocent? Every factor is shown, never hidden."
**Action note:** Let the innocence-score gauge and factor list sit on screen for a beat — the moss/vermillion color coding reads instantly even without narration.

### 0:48–0:58 — Risk score, explained
**Screen:** Risk Score page.
**Voiceover:**
> "Every risk score comes with its reasons attached — rule-based factors, plus a machine-learning layer, both shown, both explained. Nothing here is a black box."
**Action note:** Scroll to show the factor-bar breakdown. If mock data includes a synthetic-data-disclosure line, let it be legible on screen for at least a second — it's an honesty feature, not a caveat to hide.

### 0:58–1:08 — Fingerprinting + sanctions (fast pair)
**Screen:** Operator Fingerprinting page, then a quick cut to Sanctions Screening.
**Voiceover:**
> "ANVESHAK also spots when different cases were run by the same operator — and screens every wallet against sanctions lists automatically."
**Action note:** ~5 seconds each. This is the first beat to cut if you're over time.

### 1:08–1:18 — The inverted index: instant reverse lookup
**Screen:** Inverted Index page — type an address, hit lookup, show the instant match.
**Voiceover:**
> "And here's the one thing no rival tool does: an instant reverse lookup. ANVESHAK pre-scans exchange wallets offline, so it can answer 'does this address feed a known exchange' immediately — no live trace required."
**Action note:** This is your differentiator beat. Make sure the "this is not a live trace" framing text is visible for at least a moment — it's the whole point of the feature.

### 1:18–1:30 — Evidence pack + audit log
**Screen:** Evidence page's report tab → click "Verify" → show the result → quick cut to Audit Log → click "Verify integrity."
**Voiceover:**
> "Every finding is hash-verifiable and tamper-evident — court-ready by design, not an afterthought. The full audit trail is hash-chained, and you can verify it hasn't been altered with one click."
**Action note:** Let the green "Verified" state actually appear on screen, not just get narrated over — a checkmark landing live is more convincing than a claim.

### 1:30–1:42 — Legal notice + VASP portal
**Screen:** Notice-drafting page (draft view) → quick cut to the VASP wallet-sharing portal.
**Voiceover:**
> "ANVESHAK drafts the legal notice for an officer to review and send — and can share flagged wallets directly with exchanges, who can reply back the moment they act."
**Action note:** Show the notice text rendering, then the portal's flagged-wallet card. Keep each on screen ~5-6 seconds.

### 1:42–1:52 — Recoverability triage
**Screen:** Cases list with the recoverability badges (at rest / at exchange / moving).
**Voiceover:**
> "And because timing matters most in fraud, every case is triaged by how recoverable the funds still are — most urgent first."

### 1:52–2:00 — Close
**Screen:** Return to Dashboard or a title card with the ANVESHAK name.
**Voiceover:**
> "One wallet address. A named exchange. A signed legal notice. In under a minute. This is ANVESHAK."
**Action note:** Hold the final frame for a full second before cutting to black — don't let the video just stop mid-motion.

---

## Full voiceover script (copy-paste for recording in one take)

> A fraud victim reports a crypto scam. The police get one thing: a wallet address. ANVESHAK turns that into the name of the exchange holding the stolen funds — and a signed legal notice — in under a minute.
>
> One wallet address in. ANVESHAK traces every hop the money took, across chains, automatically.
>
> This is the sweep signature — stolen funds moving out within seconds, almost the full amount preserved. That's not how a real person spends money. That's scam automation. And when dozens of victims' money lands in the same wallet, ANVESHAK sees the whole campaign, not just one case.
>
> The trail ends at a named exchange — not a guess, a gated match against verified hot-wallet records. And before any legal notice goes out, ANVESHAK checks the other side too: could this wallet be innocent? Every factor is shown, never hidden.
>
> Every risk score comes with its reasons attached — rule-based factors, plus a machine-learning layer, both shown, both explained. Nothing here is a black box.
>
> ANVESHAK also spots when different cases were run by the same operator — and screens every wallet against sanctions lists automatically.
>
> And here's the one thing no rival tool does: an instant reverse lookup. ANVESHAK pre-scans exchange wallets offline, so it can answer "does this address feed a known exchange" immediately — no live trace required.
>
> Every finding is hash-verifiable and tamper-evident — court-ready by design, not an afterthought. The full audit trail is hash-chained, and you can verify it hasn't been altered with one click.
>
> ANVESHAK drafts the legal notice for an officer to review and send — and can share flagged wallets directly with exchanges, who can reply back the moment they act.
>
> And because timing matters most in fraud, every case is triaged by how recoverable the funds still are — most urgent first.
>
> One wallet address. A named exchange. A signed legal notice. In under a minute. This is ANVESHAK.

Read at a natural, slightly brisk pace, this comes to roughly 115-125 seconds — matches the target with a few seconds of slack for cuts.

---

## Shot list (for editing)

| # | Time | Screen | Key visual to hold on |
|---|------|--------|------------------------|
| 1 | 0:00-0:08 | Dashboard / New Case form | Clean, no clutter |
| 2 | 0:08-0:20 | New Case → Tracing | Loading/progress animation |
| 3 | 0:20-0:35 | Fund Flow Graph | Sweep timing, campaign hub, bridge/mixer badges |
| 4 | 0:35-0:48 | Exchange Attribution | Named exchange + innocence gauge |
| 5 | 0:48-0:58 | Risk Score | Gauge + factor bars + synthetic-data disclosure |
| 6 | 0:58-1:03 | Operator Fingerprinting | Similarity % badges |
| 7 | 1:03-1:08 | Sanctions Screening | Vermillion match card or honest "no match" |
| 8 | 1:08-1:18 | Inverted Index | Instant match + "not a live trace" text |
| 9 | 1:18-1:24 | Evidence pack verify | Green "Verified" result |
| 10 | 1:24-1:30 | Audit Log | "Verify integrity" → chain-valid result |
| 11 | 1:30-1:36 | Legal Notice draft | Drafted notice text |
| 12 | 1:36-1:42 | VASP Portal | Flagged wallet card |
| 13 | 1:42-1:52 | Cases list | Recoverability badges |
| 14 | 1:52-2:00 | Dashboard / title card | Hold on ANVESHAK name |

## If something breaks mid-recording
- Blank/errored screen → cut, re-shoot just that clip, splice in editing. Don't try to record 120 seconds in one perfect take.
- If a real backend call fails on camera (OTP wall, `anveshak.db` schema issue, etc.) — you're in mock mode per the setup checklist, so this shouldn't happen. If you deliberately want a live-data shot, reset `backend/anveshak.db` first (see `docs/TASKS.md` P6's "Known gap" note) and log in via the real OTP flow before recording, not during it.
