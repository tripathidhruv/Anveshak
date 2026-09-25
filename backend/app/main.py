from fastapi import FastAPI
from app.db import Base, engine
from app.api.v1 import cases, traces

Base.metadata.create_all(bind=engine)

app = FastAPI(title="KAIZEN backend")
app.include_router(cases.router)
app.include_router(traces.router)

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
