# Inverted deposit index ("Idea 1") — design

Status: decided by user directive (established pattern this session: user asks for autonomous
decisions on scoping, wants building not consulting). Documented here per this project's
standing practice of writing a spec before a plan.

## What this is

Every existing trace walks forward from the suspect wallet and evaluates each hop live against
`evaluate_deposit_gate()` (distinct payers, immediate predecessor, vetted label). That gate
requires a *vetted* label — and **`app/labels/seed_labels.py`'s `SEED_LABELS` has exactly zero
vetted entries today** (its one entry is explicitly `vetting_status="unvetted"`, marked
`"UNVERIFIED — seed placeholder"`). This means the entire gated-attribution pipeline has never
been able to name a real exchange outside of test fixtures that mock a vetted label in — a real,
previously-undiscovered gap, not a hypothetical one.

The fix for that gap, and the "inverted index" idea, are the same piece of work: get real,
verified vetted hot-wallet labels into the system, then build a backward index of the deposit
addresses that feed them, so a live trace can hit that index directly instead of only ever
relying on live, per-request heuristic checks.

```
Offline (re-runnable script):  hot wallet (vetted label) → its own inbound history →
                                 every distinct depositor address → DepositIndexEntry rows
Online, per trace:              hop wallet → INDEX HIT → gate passes via real backward-crawled
                                 evidence, not just live distinct-payer/predecessor heuristics
```

## Honest scoping — what this is NOT

This project has no scheduler/cron/Celery-beat infrastructure (Docker Compose was honestly
scoped around this same fact — SQLite not Postgres, `BackgroundTasks` not Celery). This spec
does **not** claim a live, continuously-running crawler. It builds a real, re-runnable script
(same precedent as `backend/scripts/calibrate.py`) that indexes a hot wallet's inbound history
when run — honestly documented as needing to be re-run periodically (cron, or manually) to stay
current, not wired to an always-on daemon. Claiming otherwise would be exactly the kind of
overclaiming this project's whole discipline exists to prevent.

## Real vetted hot-wallet labels — the actual foundation

Real, independently-verified (direct block-explorer fetch, not search-summary or memory —
this project's established bar) hot wallet addresses for 2-3 real exchanges, added to
`SEED_LABELS` with `vetting_status="vetted"` and a real `source_url`. TRON and Ethereum only
(matching this project's real chain support). This alone is valuable independent of the index —
it's what makes gated attribution exercisable against real live data for the first time.

## Architecture — two sequential tasks (Task B depends on Task A, and must wait for
any other in-flight `traces.py` work to merge first — this file is the busiest, highest-risk
file in the backend)

### Task A: real vetted labels + backward-crawl script + index table (no `traces.py` touch)

- `app/models.py`: new `DepositIndexEntry` table — `address`, `chain`, `hot_wallet_address`,
  `entity_name`, `indexed_at`. Real schema addition (unlike bridge-linking, which specifically
  avoided one) because this is genuinely new, queryable, persistent data — not a per-hop
  computed value.
- `app/index/deposit_index.py` (new module): `lookup_indexed_deposit(address, chain) ->
  DepositIndexEntry | None` — a pure DB query, no chain-API call, mirroring `is_bridge_contract`/
  `is_mixer_contract`'s exact shape.
- `backend/scripts/build_deposit_index.py` (new, re-runnable): for each `vetted` entry in
  `SEED_LABELS`, calls `get_chain_client(chain).get_transfers(hot_wallet_address)` (the same,
  already-existing chain-adapter method every other feature uses — no new API integration
  needed), extracts every distinct `from_address`, upserts one `DepositIndexEntry` per address.
  Prints a summary (how many hot wallets indexed, how many deposit addresses found) — same
  "run it, get a real number" bar as `calibrate.py`.

### Task B: wire the index into the live trace path (`traces.py` + `tracer.py`)

- In the candidates-evaluation loop (`app/api/v1/traces.py`), before or alongside the existing
  `lookup_label`/`evaluate_deposit_gate` call for a hop: check
  `lookup_indexed_deposit(hop.wallet_address, hop.chain)`. On a hit, the gate is satisfied via
  real backward-crawled evidence — `entity_name` comes from the index entry's own hot-wallet
  label, and `gate_breakdown` gets an honest, visible `"index_hit": true` flag (never a black
  box — CLAUDE.md rule 4) alongside whichever of the existing checks (distinct-payers,
  predecessor, sweep) still independently hold or don't. An index hit does NOT bypass the
  sweep-signal check — sweep detection is this project's core behavioural fingerprint and stays
  required even when the destination is confirmed-real, matching the existing
  `final_gate_passed = gate.gate_passed and sweep_signal.is_sweep` invariant.
- This must not duplicate or fight the existing candidate-loop logic already carrying several
  interacting fixes from this session (G1-G6, H11, bridge/mixer exclusions) — Task B's
  implementer must read the CURRENT full `traces.py` end to end before touching it, not assume
  any prior description of its shape is still accurate.

## Testing/acceptance

- Task A: unit tests for `lookup_indexed_deposit`, an integration test running the indexing
  script against a fake chain client and confirming real rows land in the table.
- Task B: an integration test where a hop's wallet is a pre-seeded `DepositIndexEntry` and the
  live trace correctly names the real exchange via the index path, distinguishable in the
  response (`gate_breakdown["index_hit"]`) from a live-heuristic-only pass. Full existing suite
  stays green throughout both tasks.
- `docs/TASKS.md`/`docs/SCOPE.md` updated once both tasks land, honestly describing this as a
  real, re-runnable indexing script — not a live continuous crawler.
