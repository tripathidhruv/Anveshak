# Backend plan — SIH 26182

**Status (2026-10-04): `intake/` and `memory/` built and tested; 9 modules to go.** The 26183 backend in `backend/` (FastAPI, 380 passing tests as
of 2026-09-28) is the starting point. Do not start wiring until Dhruv says so — the frontend is the
current priority.

## Stack (unchanged from 26183)
FastAPI · Pydantic v2 · SQLAlchemy · PostgreSQL 16 · Redis · Celery · rustworkx (graph) ·
LightGBM + SHAP (gated risk model) · Docker Compose on a single host, fully offline-capable.
Chain adapters: TRON, Ethereum, Bitcoin (Blockstream Esplora).

## Reuse from the 26183 backend
| Module (`backend/app/…`) | What it gives 26182 | Screen(s) |
|---|---|---|
| `tracing/`, `chains/`, `graph/` | causal, time-monotonic multi-hop trace | Live Trace |
| `detectors/` | sweep signature, consolidation, innocence score | Live Trace, Attribution |
| `bridge/` | TRON↔Ethereum bridge-hop linking with confidence + disclaimer | Live Trace |
| `mixers/` | mixer entry detection (trail stops honestly) | Live Trace |
| `labels/`, `index/` | exchange labels, inverted deposit index | Attribution |
| `risk/` | rule score + gated LightGBM/SHAP, calibration script | Attribution, Assurance |
| `sanctions/` | OFAC/UN list screening per hop | Sanctions & Broadcast |
| `freeze/` | stablecoin (USDT) freeze check, golden hour | Sanctions & Broadcast, Cases |
| `vasp_feed/` | flagged-wallet broadcast: pull API, push webhooks | Sanctions & Broadcast |
| `legal/` | notice templates, draft → approve → send state machine, SAHYOG payload | Notices & Routing |
| `evidence/` | reproducible SHA-256 evidence pack, PDF | Notices & Routing |
| `audit/` | hash-chained audit log + verify | Assurance |
| `api/v1/campaigns.py`, `operator_fingerprint.py` | clustering, behavioural similarity | National Graph, Attribution |
| `auth/` | roles (officer, supervisor, nodal, exchange) | all |

## New modules for 26182
Each item: purpose → approach → API sketch. All endpoints under `/api/v1`.

### 1. Intake (`intake/`) — Smart intake
- OCR (Tesseract, offline) on screenshots; regex + rule NER for addresses (Base58Check / EIP-55 / bech32
  validation), tx hashes, amounts, timestamps, handles, phones/UPI (masked at ingest); scam-type classifier
  (keyword + small linear model).
- `POST /intake/parse` (text | image) → entities with spans, confidence and reason; `POST /intake/cases`.

### 2. National memory (`memory/`) — SAHYOG national graph
- Append-only store of every submitted wallet, edge and case reference, with provenance (unit, state,
  time, outcome). PostgreSQL tables + rustworkx in-memory projection rebuilt on start.
- `GET /memory/wallets/{addr}` → known/unknown, first seen, resolutions, linked cases, provenance timeline.
- `GET /memory/stats`. Every lookup is written to the audit log. No citizen PII in the graph.

### 3. Syndicates & FIR dedup (`syndicates/`)
- Entity resolution across cases on hard links (shared hub, deposit address, handle, UPI) + soft links
  (timing fingerprint); weighted score with per-evidence toggles.
- Lead-jurisdiction recommender (earliest FIR, victim count, hub origin).
- `GET /syndicates`, `GET /syndicates/{id}`, `GET /firs/duplicates`, `POST /firs/merge`.

### 4. Cold-trail re-acquisition (`reacquire/`)
- After a mixer entry, score subsequent withdrawals against the operator profile (timing rhythm,
  amount minus fee, gas/fee settings, next-hop shape). Output: ranked leads with factor breakdown.
- `GET /traces/{id}/reacquisition`.

### 5. Travel Rule & OSINT (`intel/`)
- Travel Rule eligibility: threshold + both VASPs' compliance status → "record should exist" + draft request.
  ANVESHAK never reads Travel Rule messages itself.
- OSINT: scheduled ingest of public scam-report sources (configurable, offline cache), match on
  address, credibility score (corroboration, age, consistency with on-chain behaviour).
- `GET /intel/travel-rule?trace_id=`, `GET /intel/osint/{addr}`, `POST /intel/osint/scan`.

### 6. Rupee exit (`fiat/`)
- Ingest bank statements obtained by lawful request (CSV/PDF parsers), match P2P orders ↔ credits on
  amount, time window and counterparty reuse; mule-account graph; freeze-request draft.
- `POST /fiat/statements`, `GET /fiat/matches?case_id=`, `GET /fiat/mules`.

### 7. Pre-emptive freeze (`interdiction/`)
- Next-hop predictor from syndicate route history (empirical transition probabilities + time-to-deposit
  distribution); watch-alert dispatch through `vasp_feed` webhooks; outcome tracking.
- `GET /interdiction/watch`, `GET /interdiction/{case}/prediction`, `POST /interdiction/{case}/alert`.

### 8. Risk diffusion (`diffusion/`)
- risk(w) = Σ over paths from listed seeds: seed × decay^hops × value-share; dust filter; max hops.
  Computed on the trace subgraph plus memory neighbours.
- `GET /diffusion?trace_id=&decay=&max_hops=&min_share=`.

### 9. Cross-border routing (`routing/`)
- Rules table per jurisdiction: channels available (direct compliance, MLAT central authority,
  INTERPOL NCB, FIU-to-FIU), typical turnaround, binding or not, document checklist. Data marked
  "illustrative — verify with central authority" until it is reviewed.
- `GET /routing/{exchange_id}` → decision path, recommended + fallback channel, checklist, draft.

### 10. Compliance SLA (`compliance/`)
- Response windows per notice type; Celery beat checks deadlines → reminder → escalate to FIU-IND;
  exchange scorecard (response time, SLA hit rate, freezes honoured).
- `GET /notices`, `POST /notices/{id}/remind`, `POST /notices/{id}/escalate`, `GET /exchanges/scorecard`.

### 11. Assurance (`assurance/`)
- Backtest runner over closed cases (precision, recall, calibration bins, confusion matrix).
- Red-team generator: synthetic peel chains, bridge hops, mixer layering, dust decoys, timing jitter,
  wash round-trips, split-and-merge; runs the real pipeline and reports detection.
- Feedback: verdict queue; weight updates only after two-officer agreement; every change audited.
- `GET /assurance/backtest`, `POST /assurance/redteam/run`, `GET/POST /feedback`.

## Data model additions (sketch)
`memory_wallet`, `memory_edge`, `memory_event(provenance)`, `syndicate`, `syndicate_link`,
`fir`, `fir_merge`, `osint_report`, `travel_rule_check`, `bank_statement`, `fiat_match`,
`interdiction_alert`, `notice_sla`, `routing_rule`, `feedback_verdict`, `model_version`.

## Phases
1. **API contract first:** write Pydantic schemas for every screen's data, mirror as TS types in
   `web/src/api/`, serve the current mock data from FastAPI fixtures. The frontend switches by env var.
2. **Wire reused modules:** trace, detectors, attribution, risk, sanctions, evidence, legal, audit.
3. **New modules in impact order:** memory → syndicates/dedup → routing → diffusion → intel →
   interdiction → fiat → compliance → assurance → intake.
4. **Hardening:** auth/roles on every route, rate limits, audit on every read of the national graph,
   Docker Compose live run, backtest on held-out synthetic cases.

## Honesty constraints that carry into code
- Attribution says where funds were cashed out, never who the beneficiary is.
- Bridge links, behavioural matches, predictions, diffusion and crowd reports carry a confidence and a
  mandatory `disclaimer` field in the API response.
- No real KYC data, ever. No live-case addresses in fixtures.
