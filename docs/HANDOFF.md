# You just joined KAIZEN — start here

KAIZEN traces crypto fraud from a wallet address to a named exchange and a signed legal notice, in under a minute. Built for SIH 2026, PS 26183.

## Read in this order
1. `CLAUDE.md` — project context, design tokens, non-negotiable rules
2. `docs/PROGRESS.md` — top entry only, newest work
3. `docs/TASKS.md` — what's open, what's in progress

## Current state (2026-09-27) — read this before assuming anything is missing
The backend is fully built, not a prototype: real multi-chain tracing (TRON/Ethereum/Bitcoin),
gated attribution, campaign clustering, operator fingerprinting, real cross-chain bridge
linking, real mixer-entry detection, VASP flagged-wallet feed + a token-based external
exchange portal with a private reply channel, Tether freeze check, OFAC screening,
reproducible evidence hashing, hash-chained audit log, legal notice generation + SAHYOG
export, ML risk scoring, an AI narrative-summary layer (OpenAI), officer login (email+OTP),
and a real calibration script. **342/342 backend tests green.** Every task this session went
through implementer → independent sonnet reviewer (never opus, per standing project rule) —
check `docs/PROGRESS.md` for the full history if you need to know why something is shaped the
way it is; several real bugs were caught in review before merge, not after.

Read `docs/superpowers/specs/` and `docs/superpowers/plans/` (dated files) for the full design
history of every feature above — each has its own spec + plan doc explaining what it does and
why, written before it was built.

## Running the whole thing locally — two separate services

**KAIZEN's own backend + frontend** (this repo):
```bash
# backend (from repo root, or use .claude/launch.json's "backend" config)
cd backend && .venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
# frontend
cd frontend && npm run dev
```

**The auth service is a SEPARATE project, `E:/API` ("Lighthouse Auth API"), not part of this
repo.** Officer login (email+OTP) won't work without it running too:
```bash
cd E:/API && .venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8001
```
It cannot be started via this project's own `preview_start`/`.claude/launch.json` — that tool
refuses any `cwd` outside the project root, since `E:/API` is a genuinely separate checkout.
Start it manually (a plain background shell command) whenever officer login needs to work.

**Real MySQL database in use for the auth service**: `E:/API/.env`'s `MYSQL_DATABASE` points at
`lighthouse` (not the default `lighthouse_mysql`, which is a different, separate DB also on
this MySQL instance, used by another project — do not confuse the two). `lighthouse` also
predates this session (3 other tenants already existed in it before KAIZEN's own `kaizen`
tenant was added) — this is a real, shared, populated database, not an empty sandbox.

**Two accounts already seeded and ready to use right now:**
- `dhruv@carvelle.in` — officer login (email+OTP via the auth service). Re-seed more officers
  any time with `cd E:/API && .venv/Scripts/python.exe scripts/seed_kaizen_tenant.py <email>`
  (safely re-runnable, skips already-seeded emails).
- `cntcitachi@gmail.com` — a demo VASP/exchange subscriber ("Demo Exchange"), with a demo
  flagged wallet and a real test reply already in the system. Its portal link (dev):
  `http://localhost:5173/vasp-portal/RQuiGLs09nbxNEluga-jnftGhZ3AdJnr9x00t7Gx3VE`

**One shared secret both services must agree on**: `KAIZEN_AUTH_JWT_SECRET`
(`backend/.env`) must be the EXACT SAME VALUE as `E:/API/.env`'s `JWT_SECRET` — already set
correctly in both files right now, but if either ever gets rotated independently, every login
silently breaks with a generic 401 (by design — never leaks which failure mode occurred).

**A real bug worth knowing about if anything env-related ever looks broken again**:
`backend/app/config.py`'s `Settings` didn't read `backend/.env` at all until 2026-09-27 (no
`env_file` was configured) — every key in that file was silently inert regardless of how the
backend was launched. Fixed now, pinned to an *absolute* path (not just `env_file=".env"`,
which still depended on the process's own working directory and could silently fail again
under a different launch method). If a feature that reads a `KAIZEN_*` setting ever behaves as
if the key isn't set even though it's plainly in `backend/.env`, check this file first before
assuming the key itself is wrong.

## Known, honestly-disclosed gaps (not oversights — read before "fixing" any of these)
- The VASP portal's wallet visibility is a **broadcast**, not per-subscriber scoping: every
  active subscriber currently sees every flagged wallet system-wide. This is inherited,
  unchanged behavior from the original webhook feed (Task H2), not a bug introduced later —
  and arguably the *correct* model for this kind of system (real flagged-wallet alerts, e.g.
  OFAC-style lists, broadcast to every subscriber, who each check locally). Don't build a
  wallet-relevance-matching system to "fix" this without discussing it first.
- `docker compose up --build` has only been statically verified (config parses clean) — nobody
  has run the live stack on a machine with Docker's engine actually running.
- Officer login (Feature 1) is NOT retrofitted onto any pre-existing KAIZEN API endpoint — only
  the new VASP-replies endpoint uses `get_current_officer` today. This is a disclosed, deliberate
  scope limit, not partial work left broken.
- `E:/API/scripts/migrate.py` (a script in the OTHER repo) can't actually bootstrap a fresh
  SQLite database despite that being its whole documented purpose (a MySQL-only
  `information_schema` query) — irrelevant to KAIZEN's own use (which runs real MySQL), but
  worth knowing if anyone ever tries to stand up `E:/API` fresh against SQLite.
- Real, independently-verified fraud-adjacent addresses in this entire codebase: exactly 3
  (the OFAC seed data). The ML risk model stays 100% synthetic-trained by deliberate choice,
  not oversight — see `app/risk/model.py`'s own docstring for the full reasoning.

## Session protocol — follow every time
**Start:** `git pull` → read the three files above → pick a task, mark `[~]` in TASKS.md.
**During:** commit after each unit of work (Conventional Commits: `feat(backend): ...`) → log non-obvious choices in `DECISIONS.md` in the same commit.
**End (mandatory):** update `TASKS.md` statuses → append a `PROGRESS.md` entry (Did / Decided / Next / Blocked on / Note for whoever's next) → `git add -A && git commit -m "docs: log <date> session" && git push`.

## Commit format
```
<type>(<scope>): <what changed, imperative, lowercase>

<optional body: why>
```
Types: feat · fix · docs · style · refactor · chore · data

## Who to ask
Dhruv Tripathi (@tripathidhruv), dhruv@carvelle.in.
