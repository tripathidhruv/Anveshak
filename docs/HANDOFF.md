# You just joined KAIZEN — start here

KAIZEN traces crypto fraud from a wallet address to a named exchange and a signed legal notice, in under a minute. Built for SIH 2026, PS 26183.

## Read in this order
1. `CLAUDE.md` — project context, design tokens, non-negotiable rules
2. `docs/PROGRESS.md` — top entry only, newest work
3. `docs/TASKS.md` — what's open, what's in progress

## Run the prototype
Open `prototype/index.html` directly in Chrome. No build step, no install.

## Session protocol — follow every time
**Start:** `git pull` → read the three files above → pick a task, mark `[~]` in TASKS.md.
**During:** commit after each unit of work (Conventional Commits: `feat(prototype): ...`) → log non-obvious choices in `DECISIONS.md` in the same commit.
**End (mandatory):** update `TASKS.md` statuses → append a `PROGRESS.md` entry (Did / Decided / Next / Blocked on / Note for whoever's next) → `git add -A && git commit -m "docs(progress): log <date> session" && git push`.

## Commit format
```
<type>(<scope>): <what changed, imperative, lowercase>

<optional body: why>
```
Types: feat · fix · docs · style · refactor · chore · data

## Who to ask
Dhruv Tripathi (@tripathidhruv), dhruv@carvelle.in.

## The single most important thing right now
UI is functionally complete (Phase 1 + v2 redesign done). **Backend is now the active track** — `docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md`, Tasks 1-10 of 12 done (chain adapters, causal tracer, gated attribution, innocence scoring, backward victim enum, cross-chain bridge linker). Task 11 (API layer) is next — read `docs/PROGRESS.md`'s top entry before touching it, it lists 3 real bugs already found in the plan's own Task 11 reference code that must be corrected, not implemented verbatim. Task 12 (frontend `httpApi` wiring) follows. Executed via subagent-driven-development — resume with that skill, not from scratch.
