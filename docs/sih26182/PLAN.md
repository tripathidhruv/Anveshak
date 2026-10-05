# ANVESHAK for SIH 26182 — Product plan

**Problem statement 26182:** automated attribution of unknown cryptocurrency wallets to the nearest
Virtual Asset Service Provider (VASP), including stronger cross-border investigations.

**One line:** the police get a wallet address; ANVESHAK names the exchange that holds the KYC, shows
exactly why, routes the right legal request to the right country, and tracks it until the money is frozen.

This plan reuses the ANVESHAK 26183 codebase (backend in `backend/`, old React app in `frontend/`) and adds
a new investigator console in `web/`. See `FRONTEND.md`, `BACKEND.md` and `PROGRESS.md` in this folder.

## Who it is for
- **Investigating officer** (cyber police station) — traces, reads attribution, drafts notices.
- **Supervisor / SP** — approves notices, watches golden-hour cases and syndicates.
- **I4C / SAHYOG nodal officer** — sees the national graph, merges multi-state FIRs, routes cross-border requests.
- **Exchange compliance desk** (receiver) — receives flagged wallets and pre-emptive alerts.

## Core ideas (carried from 26183)
1. **Sweep signature:** stolen funds leave a wallet within seconds with ~99% of value kept. Detecting scam
   automation this way needs no labelled training data.
2. **Consolidation:** many victims' funds land in one collection wallet, so one trace resolves many cases.
3. **Nothing is a black box:** every score shows its factors, weights and arithmetic.
4. **Honest limits:** probabilistic links (bridges, behavioural matches, predictions) always carry a
   confidence and a disclaimer. Legal text is always a draft for officer review.

## Feature set (what we're building)

Grouped by the sidebar sections (9 since Rupee Exit Trail was removed on 2026-10-05) of the new console. Items marked **★** are innovations none of the
12 rival repos reviewed have. Items marked **(picked)** are the five extra innovations Dhruv chose on 2026-10-03.

### 1. Command Center
- Total value traced / frozen / still moving, median trace time.
- Per-chain traced volume (TRON, Ethereum, Bitcoin), traced-vs-frozen curve, sweeps per weekday,
  "where the money went" Sankey, sweep-time heat map, golden-hour queue, syndicate summary.

### 2. Cases
- Case queue sorted by golden hour (minutes left before funds reach an exchange / cash out).
- **★ Smart intake:** OCR + entity extraction from raw NCRP complaint text (Hindi, English, Hinglish) and
  screenshots. Auto-detects chain from address format, normalises amounts/time, classifies scam type,
  and checks whether the wallet is already known.

### 3. Live Trace
- Causal, time-monotonic multi-hop trace across TRON/Ethereum/Bitcoin, with cross-chain bridge linking
  (confidence + disclaimer).
- Sweep signature and consolidation panels; hop-by-hop evidence table.
- **★ Cold-trail re-acquisition:** when the trail enters a mixer, rank later withdrawals by the operator's
  behavioural fingerprint (timing rhythm, amount minus fee, gas/fee setting, next-hop shape). Shown as a lead.

### 4. Attribution
- Exchange & risk: attribution evidence (deposit-address heuristic, hot-wallet consolidation, inverted
  deposit index, third-party tag) combined with a weighted noisy-OR; innocence check; explainable risk
  waterfall; rules vs gated ML (LightGBM + SHAP); **★ counterfactual "what would change the verdict"**;
  ruled-out candidates; operator-vs-beneficiary honesty card.
- **(picked) ★ Travel Rule cross-reference:** for transfers between Travel-Rule-compliant VASPs above
  threshold, a compliance record (IVMS101) should already exist. ANVESHAK flags it and drafts the request.
- **(picked) ★ OSINT crowd-intelligence:** cross-reference wallets against public scam-report sources,
  with per-report credibility scoring.
- Operator habits: behavioural similarity between cases (radar, ranking, active hours).

### 5. ~~Rupee Exit Trail~~ — removed from scope on 2026-10-05 (Dhruv)

### 6. National Graph
- **(picked) ★ SAHYOG national memory:** every wallet ever submitted becomes part of a permanent national
  graph; the next submission of a connected wallet is answered instantly with provenance.
- **★ Syndicates:** cross-case entity resolution (shared hubs, deposit addresses, handles, timing).
- **★ FIR dedup & routing:** detect the same operation reported in many states; recommend a lead jurisdiction.

### 7. Pre-emptive Freeze ★
- Predict the next hop and the likely exchange from the syndicate's past routes; ETA; send a watch/hold
  alert to that exchange before the deposit lands.

### 8. Sanctions & Broadcast
- VASP flagged-wallet broadcast feed (push to subscribed exchanges, ack tracking), auto-flag rules,
  webhook health, per-hop sanctions screening, stablecoin freeze check, receiver-side preview.
- **(picked) ★ Sanctions-proximity risk diffusion:** spread risk from listed addresses through the graph,
  decayed by hops and value share, so the "one shell wallet away" pattern is caught.

### 9. Notices & Routing
- Evidence pack with SHA-256 hash chain and integrity verification; notice drafts (BNSS §94 / §106,
  BSA §63 certificate) with auto-filled fields highlighted; approval workflow → SAHYOG payload.
- **(picked) ★ Cross-border routing:** for a foreign VASP, pick the right channel (direct compliance,
  MLAT, INTERPOL NCB, FIU-to-FIU), expected turnaround, document checklist, preserve-first request.
- **★ Exchange compliance:** response-window countdown per notice, escalation ladder, exchange scorecard.

### 10. Assurance
- **★ Accuracy & red team:** backtest on closed cases (precision/recall, calibration/reliability diagram,
  confusion matrix), adversarial stress test across laundering typologies, honest blind spots.
- **★ Officer feedback loop:** accept/reject/correct calls; weights move only after two-officer agreement.
- Audit ledger: hash-chained custody log with verify and tamper simulation.

## What was folded or dropped (2026-10-03 nav cleanup)
The console went from 16 sidebar items to 10. Nothing was deleted; lower-traffic screens became tabs:
Smart intake → Cases; Operator fingerprint → Attribution; Syndicates + FIR dedup → National Graph;
Exchange compliance → Notices & Routing; Feedback loop + Audit ledger → Assurance.

Candidate features considered and **not** taken forward: Bayesian multi-path reconstruction under missing
data, insider-misuse self-monitoring (both from the 2026-10-03 shortlist, items 5 and 6).

## Non-negotiables
- All demo data is synthetic. Exchange names are fictional (Meridian Digital Exchange, Kestrel Exchange,
  Northwind Coin, Arcadia Markets, Halcyon Pay, Orbita Exchange). Never a real exchange, bank or person.
- `DEMO DATA` chip visible on every screen.
- Plain English first; technical term as a subtitle.
- Legal text = draft for officer review. BNSS §94 and other section references flagged "to be verified".
- No secrets, no real PII, no live-case wallet addresses in the repo.
