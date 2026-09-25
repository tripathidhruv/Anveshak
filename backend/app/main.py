from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.api.v1 import cases, traces

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

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
