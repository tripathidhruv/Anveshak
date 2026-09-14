# Tasks

Status: `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
Owner: initials. Update the status **in the same commit** as the work.

## Migration note (2026-09-14)
Pivoted from single-file HTML prototype to React+TS+Vite / FastAPI monorepo — see `docs/DECISIONS.md`. `prototype/index.html` frozen as a fallback (app shell + DEMO data + router only, screens 1-7 never built there — do not resume that work). All new UI work happens in `frontend/`.

## P0 — Phase 1: frontend against mock API (UI priority, per Dhruv)
- [ ] Scaffold Vite React-TS, install deps, tokens.css + surfaces.css           @
- [ ] UI primitives: Card, Button, Chip, Input, Well, Badge, PlainWords, Modal, Toast, Gauge, Spinner @
- [ ] Layout shell: Sidebar, TopBar, StepRail, router                          @
- [ ] Types + api/mock.ts + store/caseStore.ts + store/uiStore.ts              @
- [ ] Pages: NewCase → Tracing → RouteChoice → ExchangeAttribution → RiskScore (the spine) @
- [ ] Evidence page: graph tab, report tab, lawful-action tab                  @
- [ ] CaseClosed, Dashboard                                                    @
- [ ] Judge Mode, toasts, reduced-motion, route guards (refresh mid-flow safe) @
- [ ] Run the full 8-screen flow 3× without a break                           @
- [ ] Delete prototype/, screenshot app into README                           @

## P1 — Phase 2: backend (functional, not demo-blocking)
- [ ] FastAPI skeleton: main.py, config, api/v1 routers matching frontend API shape @
- [ ] Pydantic schemas mirroring frontend/src/types                            @
- [ ] data/demo.py — single source of truth, served over the same shapes       @
- [ ] services/: chain_client (fixtures), graph_builder, sweep_detector (rule-based), clustering, attribution, risk_scorer @
- [ ] Flip VITE_USE_MOCK=false, verify zero frontend changes needed            @
- [ ] Verify Section 94 BNSS reference with a law source                       @

## P2 — Phase 3 + nice to have
- [ ] Docker Compose: frontend, backend, postgres, redis, worker               @
- [ ] Campaign view with India map                                            @
- [ ] Train LightGBM sweep detector, report AUC                                @
- [ ] Collect real I4C-style cases for ground truth                            @

## Blocked
- [!] (nothing currently)

## Done
- [x] Repo scaffolding + six handoff docs                                     @DT+Claude
- [x] HTML prototype app shell (tokens, DEMO data, router) — frozen fallback  @DT+Claude
