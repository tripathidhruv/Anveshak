from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.api.v1 import (
    cases, traces, campaigns, vasp_feed, freeze, sanctions, evidence, audit, legal, risk,
    operator_fingerprint, narrative, me,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="KAIZEN backend")

# Vite's dev server (default port 5173) is the only browser origin that talks to this
# backend today — see frontend/.env.development and frontend/vite.config.ts (no port
# override). Both localhost and 127.0.0.1 are listed since browsers treat them as
# distinct origins for CORS purposes.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(cases.router)
app.include_router(traces.router)
app.include_router(campaigns.router)
app.include_router(vasp_feed.router)
app.include_router(freeze.router)
app.include_router(sanctions.router)
app.include_router(evidence.router)
app.include_router(audit.router)
app.include_router(legal.router)
app.include_router(risk.router)
app.include_router(operator_fingerprint.router)
app.include_router(narrative.router)
app.include_router(me.router)

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
