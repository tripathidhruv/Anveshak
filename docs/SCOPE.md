# Scope

## Shipped (as of 2026-09-26)
- Real, causal, time-monotonic fund trace (TRON + Ethereum, both fully, per `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`)
- Gated deposit-address / exchange attribution (never sweep-as-deposit, never defaults to a real exchange name unresolved)
- Sweep-signature + consolidation/campaign clustering, rule-based (no ML for detection — label scarcity)
- Explainable rule-based risk scoring, every contributing factor shown, PLUS a gated ML score (LightGBM+SHAP, trained on disclosed synthetic data, never presented as ground truth)
- Evidence pack: reproducible SHA-256 hashing, PDF report, lawful-action drafts, hash-chained audit log
- **VASP flagged-wallet broadcast feed** (auto-flag on risk threshold — now using the real ML score, not just the interim proxy — pull API, push webhooks, demo VASP receiver) — our unique differentiator, confirmed unmatched across all 12 rival repos reviewed
- Tether freeze check + golden-hour urgency indicator — zero of 12 rivals have this
- OFAC/sanctions screening, shipped in-repo, refreshable, per-hop
- Legal notice templates (BNSS§94/§106, BNS§223, BSA§63) + draft-approve-send FSM + SAHYOG payload
- **Real cross-chain bridge-hop linking** (TRON↔Ethereum USDT, real verified Allbridge Core contract addresses) — a confirmed bridge crossing continues the same causal trace onto the new chain, fee-adjusted
- **Operator fingerprinting** — unsupervised behavioral-similarity ranking across cases (`GET /cases/{id}/similar-operators`), complementary to hard-evidence campaign clustering
- Bitcoin/Blockstream Esplora adapter
- A real, reproducible calibration script (precision/recall against synthetic held-out gate cases, not a hand-picked constant)
- Offline-capable deployment (Docker Compose, user's own EC2 — static config verified, live run still needs Docker's engine actually running somewhere)

## Out of scope, deliberately
- De-anonymising individuals beyond the exchange attribution point
- Accessing private exchange data (no real KYC data, ever)
- Idea 1 ("sovereign NCRP/bank/UPI join") — no data access, stays roadmap-only
- A live, synchronous, query-before-transaction VASP oracle — needs a statutory mandate neither of which exist; the broadcast/feed model (KAIZEN pushes flagged wallets out) is what's built instead
- Full ML/SHAP risk model as the ONLY score — it's gated behind, and blended with, the correct, calibrated rule-based pipeline, never presented alone
- Following funds through mixers beyond flagging that the trail enters one
- A new frontend screen for operator fingerprinting (backend + demo fixture only, for now)
- Claiming to replace a forensic investigator or provide legal advice

## Known limitations — stated openly
- **Label scarcity.** Rule-based sweep detection exists because of this, not despite it.
- **Mixer opacity.** KAIZEN can flag entry into a mixer but not see through it.
- **Cross-chain correlation is heuristic, not ground truth.** Real bridge-hop linking (shipped) relies on timing/amount correlation via `find_bridge_links()` — every confirmed crossing is presented as an investigative lead, never proof, same as operator-fingerprinting's similarity scores.
- **Attribution is probabilistic, not proof.** The risk score is an investigative lead, reviewed by an officer, never a courtroom verdict.
- **`docker compose up --build` has only been statically verified** (config parses clean) — nobody has run the live stack yet on a machine with Docker's engine actually available.
- **Competitive reality (as of 2026-09-25, 12 rivals reviewed):** every rival that runs real tracing produces wrong or fabricated answers underneath a polished UI — the most common bug (found in 4+ rivals) is treating a burner-wallet sweep as if it were a verified exchange deposit. KAIZEN's backend v2 spec explicitly gates against this and the other concrete bugs found. See `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`.
