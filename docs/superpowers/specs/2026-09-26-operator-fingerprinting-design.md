# Operator fingerprinting ("Idea 2") — design

Status: approved by user 2026-09-26. Closes the last remaining backlog item with zero prior
spec (`docs/TASKS.md` P3, `docs/SCOPE.md`, both spec docs only ever carried a one-line label:
"real, separate feature, own future design pass").

## What this is

Behavioral-signature similarity between cases, distinct from and complementary to Task H1's
campaign clustering (shared hub-wallet convergence — hard, deterministic evidence). Two cases
with **no shared wallet at all** can still be run by the same criminal operation if they share
operational habits: how fast the money got swept, how much value was preserved, how many
distinct payers fed the collection wallet, what time of day the operator was active, which
chain/asset they chose. This module surfaces that as a **suggested lead, never proof** — same
epistemic status this project already gives `find_bridge_links()`'s cross-chain correlations.

## Why unsupervised similarity, not a trained model

No real labelled fraud dataset exists (CLAUDE.md's "label scarcity" thesis) — Task H8's ML
risk model already carries a mandatory, unconditional synthetic-data disclosure on every
response because of this. Doubling that disclosure burden for a second synthetic-trained
model, for a feature whose main value is a new kind of insight rather than replacing an
existing one, isn't worth it. A cosine-similarity computation over real, already-computed
signals needs no training data at all, and every score decomposes transparently to
per-feature contributions — a stronger fit for CLAUDE.md rule 4 ("nothing is a black box")
than a model would be.

## Why no new chain-API reads

`app/api/v1/risk.py`'s `_build_trace_features()` already independently re-derives trace data
for its own purposes (predates `traces.py`'s current shape). Adding a THIRD independent
re-trace for this feature would be the same duplicated-cost mistake Task H11 explicitly
avoided when it declined to wire H8's real score into `traces.py`'s hot path. Since Task
(Hop persistence, 2026-09-26) and Task H11 together mean every real trace now persists both
`Hop` rows and `AttributionCandidate` rows to the DB, this feature can compute its fingerprint
entirely from **already-persisted data** — a DB query per case, zero chain reads.

## Data model — one small, additive extension

`traces.py`'s `_evaluate_candidate_report()` already computes `sweep_signal.gap_seconds` and
`sweep_signal.value_preserved_pct` and `distinct_payers` in memory, but only ever persists a
boolean `"sweep_confirmed"` into `AttributionCandidate.gate_breakdown` — the raw numbers are
computed and then discarded. Extend that same dict (same call site, no schema migration,
`gate_breakdown` is already a JSON column) with three more keys:
`sweep_gap_seconds: float | None`, `sweep_value_preserved_pct: float | None`,
`distinct_payer_count: int`. This is the one place this feature touches `traces.py`.

## Feature vector (per case)

Built from a case's own `Hop` rows + its winning `AttributionCandidate` row (the one
`traces.py` already selects as "the" reported attribution):
- `hop_count` — count of `Hop` rows for the case.
- `sweep_gap_seconds`, `sweep_value_preserved_pct`, `distinct_payer_count` — from the winning
  candidate's `gate_breakdown` (the extension above).
- `hour_of_day` — UTC hour extracted from the funding hop's `Hop.at` timestamp (automated scam
  operations tend to run on a consistent schedule; this is a real, cheap, already-available
  signal, not a new read).
- `chain`, `asset` — from `Case`, compared categorically (exact match is a bonus term, not a
  hard filter — different chains don't rule out the same operator).

A case with zero evaluated candidates (no winning `AttributionCandidate` row) has no
fingerprint and is excluded from similarity comparison entirely — never a fabricated
all-zero vector standing in for "we don't know."

## Similarity computation

Cosine similarity over the normalized numeric features (`hop_count`, `sweep_gap_seconds`,
`sweep_value_preserved_pct`, `distinct_payer_count`, `hour_of_day`), each z-score-normalized
across the comparison population so no single large-magnitude feature (e.g. `hop_count`
ranging 1-6 vs. `sweep_gap_seconds` ranging 0-300) silently dominates the score. A categorical
`chain`/`asset` exact-match bonus (a real, named constant, e.g. +0.1 to the final score,
capped at 1.0) is added after the cosine computation, not blended into it. A real, justified
minimum similarity threshold (e.g. 0.7) gates what counts as a "suggested match" worth
returning at all — below it, nothing is reported for that pair. Every returned match carries
its full per-feature breakdown (each feature's own contribution to the score), matching
`find_bridge_links()`'s own transparency convention.

## API surface

`GET /api/v1/cases/{case_id}/similar-operators` → for the given case, every OTHER case whose
fingerprint clears the similarity threshold against it, ranked descending, each with:
`caseId`, `similarityScore`, `featureBreakdown: dict`, and a mandatory, unconditional
disclaimer string (`"This is a suggested behavioral link based on operational patterns, not "
"proof of a shared operator — an officer must independently verify any connection before "
"acting on it."`) — present on every response, same seriousness as `SYNTHETIC_DATA_DISCLOSURE`
in Task H8, even though this feature involves no ML/synthetic training at all (the disclaimer
here is about correlation-vs-proof, not about synthetic data).

## Demo fixture

2-3 synthetic demo cases (backend test fixtures + a frontend mock-data addition) whose
fingerprints are deliberately close (same sweep timing profile, same hour-of-day, same
chain/asset) so the endpoint has something real to return in the demo, plus one control case
whose fingerprint is deliberately distant (to prove the threshold actually excludes something,
not just includes everything).

## Testing/acceptance

- Full existing backend suite stays green.
- Unit tests: feature-vector extraction from `Hop`/`AttributionCandidate` rows, cosine
  similarity computation correctness (verified against manually-computed expected values, not
  just "returns a float in [0,1]"), threshold gating (just above/below), chain/asset bonus
  applied correctly and capped, a case with zero candidates correctly excluded.
- Integration test: two demo-fixture cases with deliberately close fingerprints return each
  other above threshold with a real, correct-looking `featureBreakdown`; the deliberately
  distant control case does not appear in either's results.
- `docs/TASKS.md` P3's operator-fingerprinting line updated to done.

## Scope / sequencing

Out of scope: any new frontend screen (the demo fixture proves the backend works; UI surface
is a future task, per the earlier scope decision). This plan's one `traces.py` touch point
must land AFTER the cross-chain bridge-linking plan's Task 3 (which also modifies `traces.py`)
merges, to avoid two tasks colliding on the hottest file in the backend.
