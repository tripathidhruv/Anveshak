# Scope

## In scope for SIH
- Fund trace pipeline (wallet address in, hop chain out)
- Sweep-signature detection (behavioural, no labels needed)
- Consolidation / campaign clustering (many victims, one wallet)
- Exchange (VASP) attribution
- Explainable risk scoring (every contributing factor shown)
- Evidence pack (fund-flow graph, PDF report, lawful-action drafts)
- Offline-capable deployment

## Out of scope, deliberately
- De-anonymising individuals beyond the exchange attribution point
- Accessing private exchange data (no real KYC data, ever)
- Following funds through mixers beyond flagging that the trail enters one
- Claiming to replace a forensic investigator or provide legal advice

## Known limitations — stated openly
- **Label scarcity.** Very little labelled fraud data exists publicly; this is why sweep detection is rule-based rather than fully learned.
- **Mixer opacity.** Once funds enter a mixer, KAIZEN can flag it but not see through it.
- **Cross-chain uncertainty.** Bridge attribution relies on timing and amount correlation, not a ground-truth link.
- **Attribution is probabilistic, not proof.** The risk score is an investigative lead, not a courtroom verdict — always reviewed by an officer.
