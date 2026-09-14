# Decisions

Newest first. Each entry: the decision · date · why · what we rejected.

## Migrated from single-file HTML to React + Vite + FastAPI monorepo — 2026-09-14
Rejected staying on the single-file vanilla-JS prototype (see the entry below), because the SIH slide deck's architecture slide states React · TypeScript · Cytoscape.js on the front end and FastAPI · PostgreSQL · Redis · Celery behind it — a judge opening the repo and finding one HTML file contradicts the deck, which is the most damaging gap possible. Phased: Phase 1 frontend against a local mock API (still a complete, demoable flow), Phase 2 real FastAPI backend (one env var flips mock→real because the API layer is built correctly from the start), Phase 3 Docker Compose. `prototype/index.html` stays as a working fallback until the React app reaches full parity, then gets deleted in its own commit. Everything about *what the product is* — all 8 screens, the DEMO dataset, the neumorphic design tokens, every UX law — carries over unchanged; only the architecture changes.

## Single-file vanilla JS for the prototype — 2026-09-14
Rejected React/Vue with a build step, because a build step is a demo-day failure mode (broken node_modules, version drift, no internet at venue). Vanilla JS + CDN libraries opens by double-click, no exceptions.

## Neumorphic design system — 2026-09-14
Rejected flat Material/generic SaaS look, because it makes the demo forgettable in a room of identical dashboards. Mitigated neumorphism's known contrast failure with a strict rule: furniture (containers/buttons/nav) stays tonal, content (text/numbers/status) stays full-contrast.

## Fictional exchange name — 2026-09-14
Rejected using a real exchange name, because attributing fraud to a named real company in a demo is defamatory. "Meridian Digital Exchange" is fictional; `DEMO DATA` chip stays visible permanently.

## Rule-based sweep detection, ML only for scoring — 2026-09-14
Rejected a fully-learned detector, because label scarcity is the binding constraint in this domain and a rule-based detector (money out within seconds, near-full value preserved) is robust to concept drift and needs zero training data. ML (LightGBM + SHAP) is reserved for the risk-scoring layer, which benefits from combining multiple weighted signals.

## UI-first build order — 2026-09-14
Dhruv's call, given time constraint: prototype UI (screens 0–7, demo data) is P0; backend (FastAPI, real trace logic) is P1 — must exist and function eventually, but does not block the demo-critical path. Rejected building backend-first, because the judged deliverable is the demo, not the pipeline.
