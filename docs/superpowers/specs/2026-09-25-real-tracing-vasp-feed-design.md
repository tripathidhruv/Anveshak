# Real tracing + VASP flagged-wallet feed — design

**Date:** 2026-09-25
**Status:** SUPERSEDED — see `2026-09-25-backend-v2-competitive-design.md`. Kept for history; the VASP feed section here is still accurate but the tracing/attribution/scoring sections below are superseded by stricter correctness rules learned from a 12-rival competitive review.

## Why

The current app (`frontend/`, Tasks 1-7) is a fully-built UI running entirely on the hardcoded `DEMO` dataset — a convincing demo of the workflow, but none of the tracing, attribution, or scoring is real. This spec covers the first phase of the real backend: a genuine blockchain-tracing engine plus a real implementation of "Idea 3" from `THREE_BIG_IDEAS.md` — a live feed that broadcasts flagged fraud wallets out to exchanges (VASPs), instead of a one-off manual notice per case.

**Explicitly out of scope for this phase** (see `docs/DECISIONS.md`):
- Idea 1 (sovereign on-chain/off-chain join) — needs NCRP/bank/UPI data the team does not have access to; stays roadmap/deck-only.
- Idea 2 (operator fingerprinting) — a real, separate feature; deferred to its own design/build phase, not bolted onto this one.
- A live, synchronous, query-before-transaction oracle — needs a statutory mandate and real VASP integration neither of which exist. This phase builds the broadcast/feed model instead (KAIZEN pushes flagged wallets out; VASPs don't need to query us mid-transaction).

## Architecture

One FastAPI monolith (`backend/`), matching the stack already committed in `CLAUDE.md`: FastAPI + SQLAlchemy + PostgreSQL 16 + Redis + Celery, deployed as one Docker Compose stack. No service split — chain client, scorer, and VASP feed all live in this one deployable unit. Async work (webhook delivery, long trace jobs) runs via Celery workers against the same codebase, not a separate service.

Real tracing targets **both TRON and Ethereum from the start**, behind one chain-client interface so tracing/scoring code never branches on chain.

The frontend's existing `VITE_USE_MOCK` switch (built in the React migration, Task 3) is the integration point: entering a real wallet address routes through the real API; anything else falls back to the existing `DEMO` dataset. No frontend architecture change needed — this was designed in from the start.

## Data model (Postgres)

- **`cases`** — complainant, wallet, chain, amount; mirrors `DEMO.case`'s shape.
- **`wallets`** — every address seen during any trace: `address`, `chain`, `first_seen`, `label` (exchange name if known), `is_exchange`.
- **`hops`** — one row per on-chain transfer discovered: `case_id`, `from_wallet`, `to_wallet`, `amount`, `asset`, `tx_hash`, `timestamp`, `chain`.
- **`flags`** — computed findings per wallet (sweep, consolidation), replacing the hardcoded `DEMO.risk.factors`.
- **`flagged_wallets`** — the Idea-3 feed table: `address`, `chain`, `risk_score`, `case_ids[]`, `flagged_at`, `broadcast_status`.
- **`vasp_subscribers`** — exchanges registered for the feed: `name`, `webhook_url`, `api_key`, `active`.

## Chain client + tracing engine

```python
class ChainClient(Protocol):
    async def get_transfers(self, address: str, asset: str | None) -> list[Transfer]
```

Two real implementations: `TronscanClient` (Tronscan public API) and `EtherscanClient` (Etherscan API, requires a free API key). `services/graph_builder.py` does a capped BFS (≈6 hops, matching the current demo's depth, within a bounded time window) from the reported wallet outward, producing the same `Route.trail[]` shape the frontend already renders.

## Sweep detection (rule-based — unchanged principle from `docs/DECISIONS.md`)

A hop is flagged `SWEPT` if funds leave a wallet within a short window (e.g. <5 minutes) with >95% of value preserved. Computed from real `timestamp`/`amount` data, not hardcoded. Stays rule-based, not ML — label scarcity is still the binding constraint, and this detector needs zero training data.

## VASP attribution

`services/attribution.py` — a lookup table seeded from **public labeled-address datasets** (Etherscan's exported address-label data, community-maintained TRON exchange-address lists), refreshable via a periodic re-pull script rather than a one-time hardcode. A hop whose destination matches a label gets `is_exchange = true` and `label = "<exchange name>"`. No custom clustering algorithm is built in this phase (deferred as a stretch item, not required for this spec).

## Consolidation detection

Query `hops` for wallets receiving from many distinct `case_id`s — N+ separate cases converging on one wallet reproduces the "38 victims, one wallet" pattern from real case data instead of the fixed `DEMO.campaign` object.

## Risk scoring

`services/risk_scorer.py` keeps the existing, already-demoed 5-factor explainable model (sweep latency, consolidation, value preservation, VASP compliance, counter-flow) — same weights as today's `DEMO.risk.factors` unless tuned later. Every factor is now computed from the real `hops`/`wallets`/`flags` tables. No ML model in this phase; this is the layer `THREE_BIG_IDEAS.md`'s honest-novelty note already earmarks for later ML (LightGBM + SHAP), not required for a real, defensible score today.

## VASP flagged-wallet feed (the core Idea 3 deliverable)

**Trigger:** fully automatic. Any wallet whose `risk_scorer` output crosses a threshold (e.g. ≥0.7) is inserted into `flagged_wallets` with no manual approval step.

**Distribution, two channels:**
1. **Pull API** — `GET /v1/flagged-wallets` (paginated, filterable by chain / since-timestamp), plus an authenticated variant for registered subscribers returning full detail (case count, evidence links).
2. **Push webhooks** — a Celery task fires on every new `flagged_wallets` row, POSTs address + risk score + reason codes to every active `vasp_subscribers.webhook_url`, with retry/backoff and delivery status recorded back onto the row.

**Demo VASP receiver:** since no real exchange will integrate with a student project, build a second small app (or a clearly-labeled second route set in the same backend) that:
- Registers itself as a `vasp_subscriber`.
- Receives the webhook.
- Shows a live "incoming deposit screening" view — an operator at this simulated exchange sees a deposit attempt to a flagged address get auto-held, with reason codes displayed.

This is what proves the broadcast model live rather than just narrating it: judges watch KAIZEN flag a wallet and see it arrive, unprompted, at a second, independent-looking system within seconds.

## Frontend integration

The sidebar's existing stub "Exchanges" nav item (currently a "Coming in v2" toast) becomes a real page: the flagged-wallet feed, the subscriber list, and per-subscriber delivery status. No other frontend architecture change — `api/index.ts`'s mock/real switch already anticipated this.

## Deployment

Docker Compose (`frontend`, `backend`, `postgres:16`, `redis:7`, `worker`), deployed to the user's own EC2 instance. This was already the Phase-3 plan in `docs/TASKS.md`; this spec pulls it forward because the feed/webhook system needs a real host to demo against (localhost can't receive webhooks from an outside registrant convincingly, though the demo VASP receiver running alongside on the same box sidesteps that for the live demo itself).

## Testing / validation plan

- Chain client: unit tests against recorded fixture responses (don't hit live APIs in CI) for both Tronscan and Etherscan clients.
- Sweep/consolidation/risk scoring: unit tests with synthetic hop data covering the SWEPT threshold boundary and the N-victims-one-wallet boundary.
- Feed: integration test that a `flagged_wallets` insert triggers a webhook POST to a test subscriber and records delivery status.
- End-to-end: at least one real wallet address (if ≥5 real scammer-associated addresses can be sourced per the user's note) traced through the full pipeline into a flagged-wallet feed entry and a received webhook on the demo VASP receiver.

## Open questions carried forward (not blocking, but flag before final build)

- Exact risk-score threshold for auto-flagging (0.7 is a placeholder matching the demo's HIGH band; may need tuning once real scores are computed).
- Where the "≥5 real scammer wallet addresses" would come from if pursued — likely public postmortems/reports of known scams, or CERT-In/I4C public advisories, not live NCRP data (which the team doesn't have access to). Confirm sourcing before committing to the "real tracing only" path over the demo fallback.
