from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import Base, SessionLocal, engine
from app.api.v1 import (
    cases, traces, campaigns, vasp_feed, freeze, sanctions, evidence, audit, legal, risk,
    operator_fingerprint, narrative, me, deposit_index, intake, memory,
)

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Seeding runs in the lifespan hook, not at import time: importing app.main (which every API
    # test does) must never write demo rows. A TestClient only runs this when used as a context
    # manager, and tests/conftest.py also switches the setting off.
    if settings.seed_demo_memory:
        from app.memory.seed import seed_demo
        db = SessionLocal()
        try:
            seed_demo(db)
        finally:
            db.close()
    yield


app = FastAPI(title="KAIZEN backend", lifespan=lifespan)

# Two browser origins talk to this backend: the 26183 Vite app on port 5173 (frontend/) and the
# 26182 console on port 5180 (web/). Both localhost and 127.0.0.1 are listed since browsers
# treat them as distinct origins for CORS purposes.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5180", "http://127.0.0.1:5180",
    ],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
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
app.include_router(deposit_index.router)
app.include_router(intake.router)
app.include_router(memory.router)

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
