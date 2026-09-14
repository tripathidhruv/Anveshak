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
UI is priority. Backend must eventually be real and functional, but does not block the demo path — see `docs/DECISIONS.md` "UI-first build order". Screens 1–5 are the spine: get those right before anything else (dashboard, campaign view are the most expendable).
