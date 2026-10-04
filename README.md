<p align="center"><img src="web/public/favicon.svg" width="88" alt="ANVESHAK logo" /></p>

<h1 align="center">ANVESHAK · अन्वेषक</h1>

<p align="center"><em>The seeker.</em> The police get a wallet address. ANVESHAK names the exchange that holds the KYC,<br/>shows exactly why, routes the right legal request to the right country, and tracks it until the money is frozen.</p>

Built for **Smart India Hackathon 2026, Problem Statement 26182** — automated attribution of unknown cryptocurrency
wallets to the nearest Virtual Asset Service Provider (VASP), including stronger cross-border investigations.

The name: *anveṣaka* (Sanskrit) — one who searches, an investigator. The logo is an "A" drawn as a money trail:
victim's wallet → collection hub → the exchange the trace finds (gold).

## The problem

A citizen is defrauded and sends cryptocurrency to a scammer. The money moves through a chain of wallets — often within
seconds — until it reaches a **cryptocurrency exchange**, the only point in the chain where a real identity exists
(exchanges collect KYC). Following that trail by hand takes a cybercrime cell weeks.

## What ANVESHAK does

1. **Smart intake** — reads a raw complaint in Hindi, English or Hinglish, checks every wallet checksum, masks phones and UPI IDs, and opens the case.
2. **National memory** — every wallet ever submitted is remembered, so the next complaint about it, from any state, is matched instantly.
3. **Trace** — follows the funds hop by hop across TRON, Ethereum and Bitcoin, including cross-chain bridges.
4. **Sweep signature + consolidation** — stolen funds leave within seconds with ~99% of value kept (scam automation, no labelled data needed); many victims' money pools in one wallet, so one trace solves many cases.
5. **Attribution** — names the exchange, with every factor, weight and the arithmetic shown. Nothing is a black box.
6. **Lawful action** — evidence pack with a SHA-256 hash chain, pre-filled notices (drafts for officer review, never auto-filed), cross-border routing.

## Repository

| Folder | What it is |
|---|---|
| `web/` | The investigator console (React 19, Vite, Tailwind v4, Motion, Animate UI, Lenis). **Start here.** |
| `backend/` | FastAPI + SQLAlchemy. Trace, detectors, attribution, risk, evidence, legal, audit, plus `intake/` and `memory/` for 26182. |
| `frontend/` | Earlier console (kept as a reference for backend wiring). |
| `docs/sih26182/` | Plan, frontend and backend design, rival review, progress log. |

## Run it

```bash
npm --prefix web install
npm --prefix web run dev          # synthetic demo data, no backend needed
```

With the real backend:

```bash
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --port 8000
npm --prefix web run dev -- --mode live   # VITE_USE_MOCK=false, /api proxied to :8000
```

## Data integrity

**All data is synthetic.** Exchange names (Meridian Digital Exchange, Kestrel Exchange, …) are fictional; every wallet,
transaction, person and case is fabricated. Demo wallets are derived from hashed seed strings and were never used
on any blockchain. No real complainant information or live-case data appears anywhere in this repository.

## Team

Owner: Dhruv Tripathi ([@tripathidhruv](https://github.com/tripathidhruv))

## License

MIT — see [LICENSE](LICENSE).
