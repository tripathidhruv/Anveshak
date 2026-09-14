# KAIZEN

**The police get a wallet address. KAIZEN turns it into the name of an exchange and a signed legal notice, in under a minute.**

Built for **Smart India Hackathon 2026, Problem Statement 26183** — cryptocurrency fraud detection and exchange attribution.

## The problem

A citizen is defrauded and sends cryptocurrency to a scammer. The money moves through a chain of wallets — often within seconds — until it reaches a **cryptocurrency exchange**, the only point in the chain where a real identity exists (exchanges collect KYC). Today, following that trail manually takes a cybercrime cell **4–6 weeks**.

## What KAIZEN does

Given one wallet address, KAIZEN:
1. Traces the funds across hops, on-chain, in seconds.
2. Detects the **sweep signature** — stolen funds emptied out within seconds, a behavioural fingerprint of scam automation that needs no labelled training data.
3. Detects **consolidation** — many victims' funds converging on one wallet, so one trace can solve many cases at once.
4. Attributes the destination to a named exchange.
5. Produces an explainable risk score (every contributing factor shown, nothing hidden).
6. Generates three outputs: a fund-flow graph, a court-ready evidence PDF, and a pre-filled lawful-action notice to the exchange.

## Status

Frontend prototype in progress. See [`docs/PROGRESS.md`](docs/PROGRESS.md) and [`docs/TASKS.md`](docs/TASKS.md) for current state, [`docs/HANDOFF.md`](docs/HANDOFF.md) if you're picking this up fresh.

## Running the prototype

No build step. Open [`prototype/index.html`](prototype/index.html) directly in a browser (Chrome, 1920×1080 target).

## Tech stack

- **Prototype:** vanilla JS, single HTML file, CDN libraries (Cytoscape.js, Chart.js, html2pdf.js, Lucide).
- **Planned backend:** FastAPI, PostgreSQL, Redis, Celery, rustworkx.
- **Planned ML:** LightGBM (risk scoring), PyTorch Geometric / GraphSAGE (clustering), SHAP (explainability).

## Team

KAIZEN — Owner: Dhruv Tripathi ([@tripathidhruv](https://github.com/tripathidhruv))

## Data integrity

**All data in this prototype is synthetic.** "Meridian Digital Exchange" is a fictional name; every wallet address, transaction, and case shown is fabricated demo data. No real complainant information or live case data appears anywhere in this repository.

See [`docs/SCOPE.md`](docs/SCOPE.md) for what is and isn't in scope, and what limitations we state openly.

## License

MIT — see [LICENSE](LICENSE).
