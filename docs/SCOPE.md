# Scope

## In scope for SIH
- Real, causal, time-monotonic fund trace (TRON + Ethereum, both fully, per `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`)
- Gated deposit-address / exchange attribution (never sweep-as-deposit, never defaults to a real exchange name unresolved)
- Sweep-signature + consolidation/campaign clustering, rule-based (no ML for detection — label scarcity)
- Explainable risk scoring, every contributing factor shown
- Evidence pack: reproducible SHA-256 hashing, PDF report, lawful-action drafts
- **VASP flagged-wallet broadcast feed** (auto-flag on risk threshold, pull API, push webhooks, demo VASP receiver) — our unique differentiator, confirmed unmatched across all 12 rival repos reviewed
- Tether freeze check + golden-hour urgency indicator — zero of 12 rivals have this
- OFAC/sanctions screening, shipped in-repo, refreshable
- Offline-capable deployment (Docker Compose, user's own EC2)

## Out of scope, deliberately
- De-anonymising individuals beyond the exchange attribution point
- Accessing private exchange data (no real KYC data, ever)
- Idea 1 from `THREE_BIG_IDEAS.md` (sovereign NCRP/bank/UPI join) — no data access, stays roadmap-only
- Idea 2 (operator fingerprinting) — real, separate feature, own future design pass
- BTC adapter — Sprint 3+ at earliest
- Full ML/SHAP risk model — gated behind a correct, calibrated rule-based pipeline first
- Following funds through mixers beyond flagging that the trail enters one
- Claiming to replace a forensic investigator or provide legal advice

## Known limitations — stated openly
- **Label scarcity.** Rule-based sweep detection exists because of this, not despite it.
- **Mixer opacity.** KAIZEN can flag entry into a mixer but not see through it.
- **Cross-chain uncertainty.** Bridge attribution relies on timing/amount correlation, not a ground-truth link (real bridge-hop linking is Sprint 2 scope, not yet built).
- **Attribution is probabilistic, not proof.** The risk score is an investigative lead, reviewed by an officer, never a courtroom verdict.
- **Competitive reality (as of 2026-09-25, 12 rivals reviewed):** every rival that runs real tracing produces wrong or fabricated answers underneath a polished UI — the most common bug (found in 4+ rivals) is treating a burner-wallet sweep as if it were a verified exchange deposit. KAIZEN's backend v2 spec explicitly gates against this and the other concrete bugs found. See `docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md`.
