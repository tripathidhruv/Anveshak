# CLAUDE.md — Context for AI sessions on ANVESHAK

## What this project is
ANVESHAK traces cryptocurrency fraud from a victim's complaint to the exchange
where the stolen funds were cashed out, and produces a court-ready evidence
pack plus a pre-filled legal notice.

Built for **Smart India Hackathon 2026, Problem Statement 26183**
(cryptocurrency fraud detection and exchange attribution).
Team: ANVESHAK. Owner: Dhruv Tripathi (@tripathidhruv).

## The one-line pitch
The police get a wallet address. ANVESHAK turns it into the name of an exchange
and a signed legal notice, in under a minute.

## Why it works — the two core ideas
1. **Sweep signature.** Stolen funds leave the receiving wallet within seconds
   with ~99% of the value preserved. Humans don't do this; scam automation does.
   This is a behavioural fingerprint that needs **no labelled training data** —
   which matters because label scarcity is the binding constraint in this field.
2. **Consolidation.** Dozens of victims' funds land in one wallet, so a single
   trace resolves many cases at once.

## Current state
See `docs/PROGRESS.md` for the work log and `docs/TASKS.md` for what's open.
**Always read both before starting work.**

## Repo map
- `frontend/` — React 19 + TypeScript + Vite. The real app. Build here now.
- `backend/` — FastAPI + SQLAlchemy + Redis + Celery. Phase 2, functional but not blocking the demo.
- `prototype/index.html` — single-file fallback demo. **Keep until frontend/ reaches full 8-screen parity, then delete in its own commit.** Do not build new features here.
- `docs/` — scope, progress, tasks, decisions, handoff.
- `deck/` — SIH presentation + diagram HTML sources.
- `research/` — dataset sources and links.

## Tech stack
- **Frontend:** React 19 + TypeScript + Vite. CSS Modules + a `tokens.css`/`surfaces.css`
  pair for the neumorphic design system (no Tailwind — the shadow values need to live in
  one editable place). react-router-dom, zustand, cytoscape (wrapped by hand, not
  react-cytoscapejs), recharts, lucide-react, html2pdf.js.
- **Backend:** FastAPI · PostgreSQL 16 · Redis · Celery · rustworkx.
- **Planned ML:** LightGBM (risk scoring) · PyTorch Geometric / GraphSAGE
  (entity clustering) · SHAP (explainability).
- **Deployment target:** Docker Compose, single host, fully offline-capable.

## Architecture rules — not negotiable
1. Every screen gets its data through an async function in `frontend/src/api/`. No
   component ever imports the DEMO data directly.
2. `src/api/index.ts` switches mock vs. real HTTP on `VITE_USE_MOCK` — one env var,
   nothing in any component changes between Phase 1 and Phase 2.
3. No hard-coded colour or box-shadow outside `tokens.css` / `surfaces.css`.
4. Cytoscape instances must be destroyed on unmount (`cy.destroy()` in the `useEffect`
   cleanup) — skipping this leaks a canvas per navigation.
5. Pydantic schemas (backend) and TypeScript types (frontend) describe the same shapes —
   write the schema, mirror it in TS, keep them adjacent in commits.

## Design system — do not deviate
Neumorphic soft UI. Base `#E0E5EC`, light shadow `#FFFFFF`,
dark shadow `#A3B1C6`. Accents (same as the slide deck):
indigo `#4338CA` · vermillion `#DC2626` · teal `#0D9488` ·
violet `#7C3AED` · moss `#16A34A` · gold `#D97706` · sky `#2563EB`.
(Brightened 2026-09-25 from an earlier, more muted set — same semantics, more vivid tones.)
Fonts: Outfit (display) · Inter (body) · JetBrains Mono (data).

**Colour semantics are fixed:** vermillion = criminal path / high risk.
gold = exchange. teal = on-chain. violet = bridge. moss = safe / done.

## Rules that are not negotiable
1. **All prototype data is synthetic.** The exchange name
   "Meridian Digital Exchange" is fictional and all addresses are fake.
   Never substitute a real exchange name — it is defamatory.
   Keep the `DEMO DATA` chip visible in the UI.
2. **No secrets in the repo.** No API keys, no real complainant PII,
   no wallet addresses from live cases. Ever.
3. **Plain English in the UI.** Judges have zero crypto knowledge. Every
   technical term gets a human-readable heading and a small technical subtitle.
4. **Nothing is a black box.** Every risk score shows its contributing factors.
   This is our differentiator against commercial tools — protect it.
5. **Legal text is a draft for an officer to review**, never presented as
   auto-generated legal advice.

## Known gaps — do not present these as done
- The Section 94 BNSS reference in the lawful-action tab is **unverified**.
  Confirm the section number and wording against a law source before any
  round where a judge may have a legal background.
- Dashboard KPIs and trace timings are **illustrative**, not measured.
  Replace with real figures before the final round, or label them clearly.
- No backend exists yet. The prototype is a front-end demo only.

## How to work here
Read `docs/HANDOFF.md`. Commit often, per §Commit discipline there.
Update `docs/PROGRESS.md` at the end of every session — this is mandatory.
