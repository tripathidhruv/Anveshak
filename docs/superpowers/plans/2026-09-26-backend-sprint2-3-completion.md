# Plan: finish Sprint 2 + Sprint 3 (remaining backend v2 scope)

Source: `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`'s Sprint 2/3 plan
(items 8-15) plus the "frontend fixes to do alongside this" list. Sprint 1 (items 1-6) and
Sprint 2 items 7 (Ethereum adapter) and 10 (bridge-hop linker) are already done, from the
executed `2026-09-25-backend-sprint1-multichain.md` plan (Tasks 4 and 10) — confirmed via
`docs/TASKS.md` P1. This plan covers everything still unbuilt: campaign clustering (item 11),
VASP flagged-wallet feed (item 8), freeze check (item 9), reproducible evidence + audit log
(item 12), calibration (item 13), legal templates + SAHYOG (item 14), ML risk scoring (item
15), Docker Compose, and the 5 cheap frontend fixes.

**Global constraints (apply to every task):**
- `Decimal` for all money math; never introduce a `float` money field.
- Every human-readable string a non-technical reader sees must be plain English — the standing
  rule from every prior fix pass in this project (`docs/TASKS.md` P1's "New standing rule").
- All data stays synthetic — no real exchange names, no real wallet addresses attributed to a
  real entity, no fabricated "real" training/calibration data presented as genuine when it's
  synthetic. **Every task that touches ML/calibration must state plainly, in code comments AND
  in its API-facing output, when the underlying data is synthetic** — never let a number look
  more authoritative than its actual evidentiary basis.
- A chain-API read failure is never reported as a checked fact — apply the same
  `history_read_failed`/`data_unavailable` pattern already established in `traces.py` to any
  new code that reads chain data.
- Every task must run `cd backend && .venv/Scripts/pytest tests/ -v` clean before committing;
  frontend-touching tasks must run `cd frontend && npx tsc -b` clean.
- Follow the same subagent-driven-development discipline as every prior pass in this
  project: implementer + task review + fix loop per task, ledger updated, docs pushed after
  each task, final whole-branch review at the end (on the model tier this session's user has
  standing-instructed: **sonnet, medium/high — never opus, no exceptions, for any dispatch
  including the final whole-branch review**).

**Task order:** H0 (shared scaffolding: new DB models + Pydantic schemas + router registration)
lands FIRST and is done directly by the controller (not a subagent) to avoid multiple
implementers colliding on `models.py`/`schemas.py`/`main.py`. After H0, H1-H8 are independent
new modules/endpoints and run in whatever grouping keeps parallel agents on disjoint files —
each task below states its exact file scope. H9 (Docker Compose) and H10 (frontend fixes) are
independent of the backend tasks and each other.

---

## Task H0 (controller, not a subagent): shared scaffolding

Add to `backend/app/models.py`: `FlaggedWallet` (address, chain, risk_score, case_ids as a
JSON/relationship, flagged_at, broadcast_status), `VaspSubscriber` (name, webhook_url, api_key,
active), `FreezeCheck` (wallet_address, chain, is_blacklisted, unfrozen_balance, checked_at,
golden_hour_minutes_remaining), `SanctionsMatch` (wallet_address, chain, list_source,
matched_at, list_version), `EvidenceManifest` (case_id, entries as JSON: source_url,
raw_response_hash, fetched_at), `AuditLogEntry` (actor, action, object_type, object_id,
prev_hash, hash, created_at), `Campaign` (shared hub/deposit address, case_ids, total_amount,
states — or derive this at query time instead of persisting, controller's call once reading
the existing `Hop`/`Case` schema). Add matching Pydantic schemas to `schemas.py`. Register new
empty router files under `backend/app/api/v1/` (`campaigns.py`, `vasp_feed.py`, `freeze.py`,
`sanctions.py`, `evidence.py`, `audit.py`, `legal.py`, `risk.py`) in `main.py` so every
subsequent task only adds to its own already-registered router file, never touches `main.py`
again. Commit as `chore(backend): scaffold Sprint 2/3 data models, schemas, and routers`.

---

## Task H1: campaign clustering on real hub-wallet convergence

**Files:** `backend/app/graph/` (new `campaigns.py` or extend `backward.py` if that reads
cleaner — controller's H0 pass didn't decide this, implementer's call), `backend/app/api/v1/campaigns.py`.

Union-find (or equivalent) clustering: cases whose traces converge on the same hub wallet or
the same attributed deposit address merge into one campaign. Endpoint: `GET /api/v1/campaigns`
(list) and `GET /api/v1/campaigns/{id}` (detail: linked case IDs, total traced amount, states
touched — derive "states" from whatever case metadata exists, or omit that field honestly if
the data model has no geography field yet, don't fabricate it). This is the real backend
counterpart to the frontend's existing `Campaigns.tsx`/`Campaign.tsx` (currently mock-data-only)
— don't wire the frontend in this task (that's separate frontend work, out of scope here),
just build the real backend logic + endpoint.

**Tests:** two cases whose traces both terminate at the same wallet cluster into one campaign;
two cases with no overlap stay separate; a case with `attribution.gatePassed=False` (no
confirmed hub) doesn't spuriously cluster with anything (reuse the same "verified attribution
only" discipline `Task G4` already established for unreported-victim enumeration — don't
cluster on an unverified fallback wallet either).

---

## Task H2: VASP flagged-wallet feed (the project's most unique differentiator)

**Files:** new `backend/app/vasp_feed/` package (`distribution.py`, `demo_receiver.py` or a
separate lightweight FastAPI sub-app/route group clearly labeled as a simulated VASP),
`backend/app/api/v1/vasp_feed.py`.

Per the approved spec (`2026-09-25-backend-v2-competitive-design.md`'s VASP-feed section,
unchanged from the original v1 spec): auto-flag a wallet into `FlaggedWallet` whenever
`traces.py`'s attribution produces `gatePassed=True` and a risk score above a threshold (use
whatever risk-scoring exists at this point — if Task H8's ML risk scorer isn't built yet
because tasks run out of order, use a simple rule-based proxy score for now: e.g.
`distinct_payers`-and-sweep-confirmed alone crossing the gate is enough to flag, refine later
once H8 lands real scoring — note this explicitly as a documented interim behavior, not a
silent shortcut). Pull API: `GET /api/v1/vasp-feed/flagged-wallets` (paginated, filterable by
chain/since-timestamp). Push webhooks: a background task (use FastAPI's `BackgroundTasks` if
Celery/Redis isn't wired yet — note honestly which mechanism is actually used) POSTs to every
active `VaspSubscriber.webhook_url` on a new flag, with retry/backoff, recording delivery
status back onto `FlaggedWallet.broadcast_status`. Demo VASP receiver: a second route group
(e.g. `/api/v1/demo-vasp/*`) that registers itself as a subscriber, receives the webhook, and
exposes a simple "incoming deposit screening" view showing a deposit attempt to a flagged
address getting auto-held with reason codes — clearly labeled as a SIMULATED exchange in every
response, never implying it's a real VASP integration.

**Tests:** a flagged wallet triggers a webhook POST to a registered subscriber (use a test
HTTP client/mock, not a real network call); the demo receiver correctly shows a held deposit
when queried against a flagged address; the pull API paginates and filters correctly.

---

## Task H3: Tether freeze check + golden-hour urgency

**Files:** new `backend/app/freeze/tether.py`, `backend/app/api/v1/freeze.py`.

For a USDT (TRC-20/ERC-20) terminal/attributed wallet: query Tether's real public
`isBlackListed` (or equivalent — WebFetch-verify the actual current API/contract-call shape for
both TRC-20 and ERC-20 USDT before writing code, do not guess; this project has twice already
been burned by an implementer guessing an external API contract instead of checking, and twice
caught it in review — verify for real this time from the start) and the wallet's current
unfrozen balance (a real balance query against the chain, reusing existing chain-client
adapters). Combine with time-since-last-move (already available from existing hop/trace data)
to compute a golden-hour urgency indicator (a plain-English "how much of the practical freeze
window remains" statement, not a raw number with no context). Endpoint: `GET
/api/v1/freeze/{case_id}` returning blacklist status + balance + urgency + a
one-click-freeze-request draft (a plain-English pre-filled request to the exchange, in the same
"draft an officer reviews" pattern as this project's existing lawful-action notices — never
auto-sent, never presented as legal advice, per `CLAUDE.md` rule 5).

**Tests:** a blacklisted address returns the correct status; a real (mocked) balance query
returns the correct unfrozen amount; the urgency calculation is tested against at least 2
different "time since last move" scenarios (recently moved = urgent, long ago = less urgent);
a chain-API read failure here follows the same honest-failure pattern as `traces.py` (never
silently reports "not blacklisted" when the check genuinely couldn't run).

---

## Task H4: OFAC + sanctions screening shipped in-repo

**Files:** new `backend/app/sanctions/ofac_refresh.py`, `backend/app/sanctions/screen.py`,
`backend/app/api/v1/sanctions.py`, a small shipped seed data file (e.g.
`backend/app/sanctions/data/sdn_seed.json` or similar — a real, small, publicly-sourced subset
is fine given hackathon scope; WebFetch the real OFAC SDN list format/source before writing the
refresh script so it's a genuine parser against the real published format, not an invented
schema).

Screen every hop in a trace (not just the terminal wallet) against the sanctions list, ship a
refresh script that can re-pull the real OFAC list and **refuses silent removals** (an address
present in the old list but missing from a re-pull is flagged for manual review, not silently
dropped — per the approved spec). Endpoint or integration point: sanctions matches surface in
the existing `traces.py` response (add a `sanctionsMatches` field) and are separately queryable
via `GET /api/v1/sanctions/matches/{case_id}`.

**Tests:** a hop matching a seeded sanctioned address is flagged; a non-matching hop isn't; the
refresh-refusal logic is tested with a synthetic "list shrank" scenario, asserting the removed
address is flagged for review rather than silently vanishing.

---

## Task H5: reproducible evidence hashing + manifest

**Files:** new `backend/app/evidence/raw_store.py`, `backend/app/evidence/manifest.py`,
`backend/app/evidence/pack.py`, `backend/app/api/v1/evidence.py`.

Per the approved spec: hash the canonical, sorted, CONTENT-ONLY representation of each
transfer/finding (no generation-time metadata inside the hashed payload — this is the exact bug
a rival (FineX) shipped and this project's own spec calls out by name). Store the hash alongside
a manifest (source URLs, raw response bodies, fetched-at timestamps) separately from the hash
itself. The evidence pack's own top-level SHA-256 is computed the same deterministic way.
Endpoint: `GET /api/v1/evidence/{case_id}/pack` returns the full pack + its hash;
`POST /api/v1/evidence/{case_id}/verify` re-fetches the same on-chain data and confirms the hash
reproduces identically (this is the actual "click any hash to verify" capability the project's
own pitch line promises — make sure it's genuinely correct, not just present).

**Tests:** hashing the same logical content twice (with different generation timestamps
injected around it) produces the IDENTICAL hash — this is the core correctness property, test
it explicitly by constructing two payloads that differ only in an outer timestamp and asserting
equal hashes; a payload with genuinely different content produces a different hash.

---

## Task H6: hash-chained audit log with `verify_chain()`

**Files:** new `backend/app/audit/chain.py`, `backend/app/api/v1/audit.py`.

Per the approved spec (and the "adopt directly from rival code" section — Himanshu-Harsh's
hash-chained pattern was good but incomplete): each audit event hashes
`actor|action|object_type|object_id|prev_hash`, genesis-anchored. **The one thing the rival
repo this pattern is borrowed from got wrong and this task must not repeat:** add a real
`verify_chain()` function/endpoint that actually walks the full chain from genesis and confirms
no link is broken — making tamper-evidence OPERATIONAL (something you can run and get a
pass/fail answer from), not merely theoretical (a hash field nobody ever re-checks). Every
significant write action elsewhere in this backend (case creation, attribution result, freeze
request, notice send) should append an audit entry — wire at least 2-3 real call sites, not
just build the audit module in isolation with nothing calling it.

**Tests:** a genuine chain of 5+ entries passes `verify_chain()`; tampering with one entry's
stored data (simulating a direct DB edit) makes `verify_chain()` correctly detect the break at
the right position, not just report "invalid" with no location.

---

## Task H7: legal templates + SAHYOG-ready payload

**Files:** new `backend/app/legal/templates/` (BNSS §94, BNSS §106, BNS §223, BSA §63 — as
plain-text or Jinja-style templates, NOT hardcoded English prose scattered in Python strings),
`backend/app/legal/notice_fsm.py` (draft → officer-approve state machine, server-side roles if
auth exists yet — if this backend has no auth/role system at all yet, note that honestly and
build the simplest state machine that still enforces "never auto-sent," rather than fabricating
a fake role check), `backend/app/legal/sahyog_payload.py`, `backend/app/api/v1/legal.py`.

**Explicit, hard requirement, not optional:** every legal citation and every generated notice
must carry a visible "DRAFT — for an officer's review, not legal advice" marker in its own
text, per `CLAUDE.md` rule 5. The exact section numbers/wording are marked **UNVERIFIED** in
this project's own `CLAUDE.md` ("Known gaps") — do not remove that caveat; if you cannot get a
legal professional to review the citations in this task (you almost certainly cannot, as an
implementer subagent), keep the citations as they currently exist in the codebase/spec
(BNSS §94/§106, BNS §223, BSA §63) but make ABSOLUTELY SURE the unverified status is visible in
the generated document text itself, not just in an internal doc nobody user-facing ever reads.

SAHYOG payload: a real JSON export shape matching whatever the actual SAHYOG platform's
published integration format is IF you can find real public documentation for it via
WebFetch/WebSearch; if no real public spec is findable (plausible — SAHYOG integration details
may not be public), build a clearly-labeled "SAHYOG-ready" payload shape based on this
project's own case/attribution schema, documented as "shaped for a future real SAHYOG
integration, not verified against SAHYOG's actual API" rather than silently implying it's a
confirmed-compatible format.

**Tests:** generating a notice includes the unverified-citation disclaimer text; the
draft→approve state machine rejects a "send" action on a notice that hasn't been approved.

---

## Task H8: ML risk scoring (LightGBM + SHAP), gated behind a data-quality check

**Files:** new `backend/app/risk/model.py`, `backend/app/risk/data_quality.py`,
`backend/app/risk/rules.py` (if a rule-based fallback score doesn't already exist — check
`detectors/deposit.py`/`sweep.py` first, this project may already compute an implicit
rule-based signal that this task should reuse/expose rather than duplicate),
`backend/app/api/v1/risk.py`.

**This is the highest-risk task in this plan to get honest, not fake.** This project has no
real labeled fraud dataset (the whole point of the "label scarcity" thesis in `CLAUDE.md`).
Build the REAL pipeline (LightGBM classifier + SHAP explainability, real library usage, not
stubbed), but train it on SYNTHETIC, CLEARLY-LABELED-AS-SYNTHETIC feature data you construct
yourself (e.g. procedurally generate several hundred synthetic wallet-feature rows with
plausible fraud/non-fraud labels based on the SAME rule-based signals this project's detectors
already compute — sweep latency, consolidation, distinct payers, etc. — so the "ML" model is
learning to approximate a combination of already-understood signals, not fabricating a
black-box authority from nothing). The `data_quality.py` gate must genuinely and correctly
DISABLE the ML score (falling back to the existing rule-based score alone) whenever real input
data for a given trace is too thin (e.g., very few hops, no vetted label match, an
API-read-failure-heavy trace) — this gate is the single most important piece of this task,
more important than the model's accuracy, since it's what prevents an under-evidenced ML number
from ever reaching an officer. SHAP output must be a real per-feature contribution breakdown,
consumed and shown the same "nothing is a black box" way the existing rule-based `breakdown`
field already is.

**Every API response this model contributes to MUST include an explicit note that the model
was trained on synthetic data** — this is not optional framing, it is a correctness/honesty
requirement equal in weight to a Critical bug elsewhere in this project.

**Tests:** the data-quality gate correctly disables ML scoring on a thin-data fixture and falls
back to the rule-based score; a well-evidenced fixture gets a real ML score with real SHAP
values; the "synthetic data" disclosure is present in every response that includes an ML score.

---

## Task H9: calibration pass

**Files:** new `backend/scripts/calibrate.py` (or `backend/app/risk/calibrate.py` if it needs
to be importable, implementer's call), reusing whatever synthetic labeled data Task H8 built
(if H8 lands first) or building a small standalone synthetic "held-out verified cases" set if
run independently.

Report actual precision (true positives / (true positives + false positives)) of the gated
attribution pipeline against this held-out synthetic set — the point is a real, reproducible
number computed by a real script an officer/judge could re-run, not a hand-picked confidence
constant (the exact rival mistake — FineX, ChainTrace — this project's own spec calls out by
name). **State plainly, everywhere this number is surfaced, that the held-out set is synthetic**
— a precision number computed against synthetic data still has value (proves the gating logic
behaves correctly on data with known ground truth) but must never be presented as if it
reflects real-world accuracy.

**Tests/output:** the script runs end-to-end and prints/returns a precision figure plus the
per-case breakdown (which cases were true/false positive and why) — this is itself the
deliverable, "run it and get a real number" is the acceptance bar.

---

## Task H10: Docker Compose deployment

**Files:** repo root `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` (if one
doesn't exist), any `.dockerignore` needed.

Services: `frontend` (served on its dev/preview port or a built static bundle — controller's
call/implementer's call on which is more appropriate for a demo), `backend` (the FastAPI app),
`postgres:16` (only if this backend is actually using Postgres already — check `db.py`'s current
engine; if it's still SQLite, either add real Postgres wiring as part of this task or
honestly scope Postgres out and ship SQLite-in-Docker for now, noting the gap rather than
silently claiming Postgres when it isn't actually used), `redis:7` (only if Celery/BackgroundTasks
from Task H2 actually needs it — if H2 used FastAPI `BackgroundTasks` instead of real Celery,
say so and skip Redis/a separate worker container rather than shipping unused services).
One `docker compose up` should bring up a working stack reachable at the frontend's port.

**Test/acceptance:** actually run `docker compose up` (or as close to it as this environment
allows) and confirm the stack starts and the frontend can reach the backend — this is an
infra task, its "test" is a real run, not a unit test file.

---

## Task H11 (added after H1-H8 landed): wire live integration points into `traces.py`

**Files:** `backend/app/api/v1/traces.py` ONLY (H1-H8 are all done and merged, so this file is
now safe to edit — it was deliberately kept off-limits during the H1-H8 parallel wave).

**Why this task exists:** every one of H1-H8's task reviews independently discovered the same
systemic gap: `AttributionCandidate` is never persisted anywhere — `run_trace` computes
attribution purely in-memory and never writes a row. This means, TODAY, on a live system:
`GET /api/v1/campaigns` always returns `[]` (H1), the evidence pack (H5) and legal/SAHYOG
payload (H7) can't find real attribution rows to build from, and the VASP feed's auto-flag
(H2) and sanctions screening (H4) were built with no live call site wiring them into an actual
trace. All 8 modules are individually correct and tested — they are just not yet connected to
the one place a real trace actually runs. This task closes that gap.

**Fix, in `run_trace` (or wherever the attribution/candidate loop currently lives):**
1. **Persist `AttributionCandidate`.** When a candidate hop is evaluated (the existing
   `gate`/`sweep_signal`/`final_gate_passed` logic already computes everything needed), write a
   real `AttributionCandidate` row (`case_id`, `wallet_address`, `chain`, `gate_passed`,
   `gate_breakdown`, `entity_name`, `reasoning`, `limitations`) — reuse the existing model from
   `models.py`, don't invent a new one. This single change unblocks H1 (campaigns) immediately.
2. **Call `screen_case_hops`** (Task H4, `backend/app/sanctions/screen.py`) after hops are
   computed, and fold any sanctions matches into the trace's response (add a `sanctionsMatches`
   field to `TraceOut` if H0's scaffolding didn't already anticipate one — check `schemas.py`
   first, extend minimally if needed).
3. **Call `auto_flag_wallet`** (Task H2, `backend/app/vasp_feed/distribution.py`) whenever a
   candidate's `gate_passed=True` and its (real, now-available-from-H8) risk score clears the
   flag threshold — replace H2's interim rule-based proxy scoring with a real call to H8's
   `backend/app/risk/` scorer if that's a clean, low-risk change; if wiring the full ML risk
   pipeline into the live trace path is too large a change to do safely in this task, keep H2's
   documented interim proxy for now and say so explicitly — don't silently leave `auto_flag_wallet`
   uncalled at all, since that's the actual gap this task exists to close.
4. **Append an audit log entry** (Task H6, `backend/app/audit/chain.py`'s `append_entry`) for
   the case-creation and attribution-result events, at minimum — the two call sites already
   named as examples in H6's original brief.
5. Do NOT touch H3 (freeze)/H7 (legal)'s own endpoints in this task — they already correctly
   read `Case`/`Hop` data directly and don't need `AttributionCandidate` persistence to function
   (freeze re-runs its own trace; legal reads whatever data it needs at request time). Confirm
   this is still true before skipping them, don't just assume.

**Tests:** running a full trace via `POST /api/v1/cases/{id}/trace` on a fixture that would
pass the deposit gate results in: a real `AttributionCandidate` row queryable afterward; a
subsequent `GET /api/v1/campaigns` call (given 2+ such cases sharing a hub) returns a real,
non-empty campaign; a sanctioned-address fixture produces a non-empty `sanctionsMatches` in the
trace response; a qualifying case results in a `FlaggedWallet` row (verify via the VASP feed's
own pull API); at least one audit log entry exists and `verify_chain()` still passes clean
afterward.

---

## Task H10b (bundle with H10 or its own task, implementer's/controller's call): cheap frontend fixes

**Files:** `frontend/src/components/report/ReportDocument.tsx`, `frontend/src/api/mock.ts`,
`frontend/src/components/graph/NodeDrawer.tsx`, `frontend/src/store/caseStore.ts` (Reset demo),
wherever the inconsistent timing claims (47s/41s/"under a minute") live.

Per the approved spec's own list:
1. `ReportDocument.tsx`'s claim that values were "read directly from public blockchain data" —
   make true now that a real backend exists (check `VITE_USE_MOCK` state / whether this report
   is generated from real or mock data at render time and label accordingly), or clearly label
   as demo data if still mock-sourced in a given render.
2. `mock.ts` — fix invalid-looking address formats, the double-counted Route A+B totals, the
   duplicate node, the suspect/scammer mismatch (read the file fresh, these may already be
   partially stale given how much has changed — verify each claim against current `mock.ts`
   before "fixing" something that no longer exists).
3. `NodeDrawer.tsx` — USDT shown with a ₹ sign is wrong, fix the unit label.
4. `Reset demo` — the spec claims this "doesn't actually reset the case store." **Verify this
   claim against CURRENT code first** — a lot of frontend work has landed since this finding was
   written and it may already be fixed; don't "fix" a bug that no longer exists, and if it's
   already fixed, say so in the report rather than silently no-op'ing.
5. Inconsistent timing claims — pick one measured figure (now that real tracing exists and
   could be genuinely timed) or clearly label as illustrative.

**Verify each of these 5 claims against current code before touching anything** — this list was
written before several rounds of other frontend work landed and may be partially stale.
