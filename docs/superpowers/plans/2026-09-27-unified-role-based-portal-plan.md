# Unified Role-Based Portal + Backlog Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One login (OTP or guest) that routes officers, exchange compliance contacts, and citizens to role-appropriate views of the same backend; a real case-status/ticket lifecycle with officer replies and an AI auto-reply on resolution; plus 6 previously-flagged backlog items closed in the same pass.

**Architecture:** See `docs/superpowers/specs/2026-09-27-unified-role-based-portal-design.md` for full rationale. Summary: `E:/API` stays identity-only (unmodified); KAIZEN's own new `UserRole` table owns officer/exchange/citizen authorization; a "ticket" is a `Case` with a new persisted `status` field, not a new entity; guest citizens get a token-based ticket link (same pattern as the existing VASP portal), logged-in citizens get a "my complaints" view by email.

**Tech Stack:** Same as the existing backend (FastAPI/SQLAlchemy/Pydantic) and frontend (React 19/TS/Tailwind v4). No new dependencies.

## Global Constraints

- `E:/API` code/schema is NOT modified in this plan — only its existing, working seed script is *run* for 2 additional emails.
- Every backend-generated string a citizen or officer reads (status labels, AI reply, error messages) must be plain, non-technical English (project standing rule since 2026-09-25).
- The existing `/vasp-portal/:token` public route and its behavior are unchanged — this plan only adds new surfaces.
- A citizen-or-guest-filed case runs through the identical tracer/attribution/innocence pipeline as an officer-filed one — no parallel/lesser code path.
- Never fabricate an AI reply — if narrative generation fails or is unavailable, the status transition still succeeds with no AI reply added (matches the existing narrative-summary honesty rule).
- `get_current_officer` (`app/auth/jwt.py`) is NOT modified — it stays pure JWT verification. Role authorization is a new, separate layer on top of it.
- Full wallet addresses are shown to both officers and exchanges everywhere in the UI — no `truncateAddress()` on any reply/wallet detail view for these roles.
- Real exchange names/addresses used as seed labels must carry `source_url` + `verified_at` (existing rule) — the placeholder fix in Task 1 replaces a real contract address with an obviously-synthetic one, never removes the vetting metadata pattern.

---

## File structure (new/changed files)

```
backend/app/
  models.py                    # + UserRole, CaseReply; Case gains status/filed_by_role/complainant_email/guest_ticket_token
  auth/
    identity.py                 # NEW: UserRole lookup, get_current_identity, require_role()
  api/v1/
    me.py                        # NEW: GET /api/v1/me
    cases.py                     # + citizen/guest create variant, PATCH /{id}/status, POST /{id}/replies, GET /mine, GET /ticket/{token}
    vasp_feed.py                 # + GET /flagged-wallets (officer); replies endpoint swaps to require_role("officer")
  labels/seed_labels.py          # placeholder address fixed
  api/v1/traces.py               # deposit-index lookup wired in; since= passed to get_transfers
  tracing/tracer.py               # since= passed through, stale comment removed
  schemas.py                     # + CaseStatus literal, UserRoleOut, CaseReplyOut, etc.

frontend/src/
  store/authStore.ts             # NEW: role + email, replaces ad-hoc localStorage reads
  lib/authToken.ts               # + guest mode helpers
  pages/Login.tsx                # + "Continue as guest" button
  App.tsx                        # role-based route tree
  pages/FlaggedWallets.tsx        # NEW (officer)
  pages/Tickets.tsx (or Cases.tsx extended) # status tabs, reply box, transition buttons
  pages/FileComplaint.tsx          # NEW (citizen/guest)
  pages/MyComplaints.tsx           # NEW (citizen)
  pages/MyTicket.tsx                # NEW (guest, token-based)
  pages/NoticeDrafting.tsx           # NEW (officer) — backlog item 4
  pages/VaspPortal.tsx                 # remove truncation, richer reply view
  pages/VaspReplies.tsx                  # remove truncation, reply detail dialog
  api/ (httpApi.ts additions for all of the above)

backend/scripts/
  (no new script — Task 12 runs the EXISTING E:/API seed script as an operational step)
```

---

## Task 1: Compliance fix — replace the real USDT contract address placeholder

**Files:**
- Modify: `backend/app/labels/seed_labels.py`
- Test: `backend/tests/unit/test_deposit_gate.py` (confirm nothing hardcodes the old address)

- [ ] **Step 1: Read the current placeholder entry**

Confirm the entry at `seed_labels.py` reading `address="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"` (the real Tether TRC-20 token contract).

- [ ] **Step 2: Replace with an obviously-synthetic placeholder**

```python
VaspLabelSeed(
    address="TPlaceholderUnvettedSeed0000000001",  # deliberately fake -- CLAUDE.md rule 1:
    chain="tron",                                   # never a real address for an unvetted entry
    entity_name="UNVERIFIED — seed placeholder",
    source_url="https://tronscan.org/#/tools/blacklist",
    verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
    vetting_status="unvetted",
),
```

- [ ] **Step 3: Grep the whole repo for the old address to confirm no test/fixture depends on it**

```bash
cd E:/kaizen && grep -rn "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" backend/ frontend/
```
Expected: no matches after the fix (the real address must not appear anywhere in the repo as a *seed* entry; it's fine if it appears inside a `raw_response`-style fixture file that's simulating a real TronGrid API response, since that's recorded third-party data, not a KAIZEN-authored label).

- [ ] **Step 4: Run the full backend suite**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: all passing, same count as before (this entry is `vetting_status="unvetted"` so it was never usable for real attribution — no test should have depended on its specific address value).

- [ ] **Step 5: Commit**

```bash
git add backend/app/labels/seed_labels.py
git commit -m "fix(backend): replace real USDT-TRC20 contract address with a synthetic placeholder in unvetted seed label"
```

---

## Task 2: `UserRole` model + `get_current_identity`/`require_role` + `GET /api/v1/me`

**Files:**
- Modify: `backend/app/models.py` (add `UserRole`)
- Create: `backend/app/auth/identity.py`
- Create: `backend/app/api/v1/me.py`
- Modify: `backend/app/main.py` (mount the new router)
- Test: `backend/tests/unit/test_identity.py`, `backend/tests/api/test_me_api.py`

**Interfaces:**
- Consumes: `get_current_officer`/`OfficerClaims` (`app/auth/jwt.py`, unchanged), `get_db` (`app/api/deps.py`).
- Produces: `UserRole` ORM model; `Identity` dataclass (`email`, `role`); `get_current_identity(claims=Depends(get_current_officer), db=Depends(get_db)) -> Identity`; `require_role(*roles: str)` — a dependency factory returning a callable usable as `Depends(require_role("officer"))`; `GET /api/v1/me` returning `{email, role}`. Every later backend task that needs role-gating depends on `require_role`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_identity.py
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base
from app.models import UserRole
from app.auth.identity import resolve_role, require_role
from app.auth.jwt import OfficerClaims

@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

def test_resolve_role_returns_seeded_role(db_session):
    db_session.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db_session.commit()
    assert resolve_role(db_session, "dhruv@carvelle.in") == "officer"

def test_resolve_role_auto_creates_citizen_for_unknown_email(db_session):
    role = resolve_role(db_session, "brand-new-citizen@example.com")
    assert role == "citizen"
    row = db_session.query(UserRole).filter_by(email="brand-new-citizen@example.com").one()
    assert row.role == "citizen"

def test_resolve_role_is_case_insensitive_and_idempotent(db_session):
    first = resolve_role(db_session, "Mixed.Case@Example.com")
    second = resolve_role(db_session, "mixed.case@example.com")
    assert first == second == "citizen"
    assert db_session.query(UserRole).count() == 1

def test_require_role_allows_matching_role(db_session):
    db_session.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db_session.commit()
    dep = require_role("officer")
    claims = OfficerClaims(user_id="u1", tenant_id="t1", email="dhruv@carvelle.in")
    identity = dep(claims=claims, db=db_session)
    assert identity.role == "officer"
    assert identity.email == "dhruv@carvelle.in"

def test_require_role_rejects_non_matching_role(db_session):
    db_session.add(UserRole(email="cntcitachi@gmail.com", role="exchange"))
    db_session.commit()
    dep = require_role("officer")
    claims = OfficerClaims(user_id="u2", tenant_id="t1", email="cntcitachi@gmail.com")
    with pytest.raises(HTTPException) as exc_info:
        dep(claims=claims, db=db_session)
    assert exc_info.value.status_code == 403

def test_require_role_rejects_when_email_missing_from_token(db_session):
    dep = require_role("officer")
    claims = OfficerClaims(user_id="u3", tenant_id="t1", email=None)
    with pytest.raises(HTTPException) as exc_info:
        dep(claims=claims, db=db_session)
    assert exc_info.value.status_code == 401
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/unit/test_identity.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.auth.identity'`

- [ ] **Step 3: Add `UserRole` to `backend/app/models.py`**

```python
class UserRole(Base):
    __tablename__ = "user_roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    role: Mapped[str] = mapped_column(String)  # "officer" | "exchange" | "citizen"
    linked_subscriber_id: Mapped[int | None] = mapped_column(ForeignKey("vasp_subscribers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
```

(Add this class near `VaspSubscriber` in the same file, using the file's existing `utcnow`/`Mapped`/`mapped_column` imports — no new imports needed beyond what the file already has.)

- [ ] **Step 4: Write `backend/app/auth/identity.py`**

```python
"""Authorization layer on top of app.auth.jwt's pure identity verification. E:/API (Lighthouse
Auth API) proves WHO is logged in; this module decides WHAT they're allowed to see in KAIZEN,
via the UserRole table this project owns. See docs/superpowers/specs/2026-09-27-unified-role-
based-portal-design.md for why role lives here and not in the shared auth service."""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.jwt import OfficerClaims, get_current_officer
from app.models import UserRole

VALID_ROLES = {"officer", "exchange", "citizen"}
DEFAULT_ROLE = "citizen"


@dataclass
class Identity:
    email: str
    role: str


def resolve_role(db: Session, email: str) -> str:
    """Look up (or auto-create, defaulting to citizen) the KAIZEN role for a verified email.
    Case-insensitive and idempotent -- the same email always resolves to the same row."""
    normalized = email.strip().lower()
    row = db.query(UserRole).filter(UserRole.email == normalized).one_or_none()
    if row is not None:
        return row.role
    row = UserRole(email=normalized, role=DEFAULT_ROLE)
    db.add(row)
    db.commit()
    return DEFAULT_ROLE


def get_current_identity(
    claims: OfficerClaims = Depends(get_current_officer),
    db: Session = Depends(get_db),
) -> Identity:
    """Any authenticated KAIZEN-tenant user, regardless of role."""
    if not claims.email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no email claim")
    return Identity(email=claims.email.strip().lower(), role=resolve_role(db, claims.email))


def require_role(*allowed_roles: str):
    """Dependency factory: `Depends(require_role("officer"))` 403s any authenticated user whose
    resolved role isn't in `allowed_roles`. A missing/invalid token still 401s via
    `get_current_officer` before this ever runs."""
    for role in allowed_roles:
        assert role in VALID_ROLES, f"unknown role in require_role(): {role}"

    def _dependency(
        claims: OfficerClaims = Depends(get_current_officer),
        db: Session = Depends(get_db),
    ) -> Identity:
        if not claims.email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no email claim")
        email = claims.email.strip().lower()
        role = resolve_role(db, claims.email)
        if role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this action")
        return Identity(email=email, role=role)

    return _dependency
```

- [ ] **Step 5: Run to verify `test_identity.py` passes**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/unit/test_identity.py -v
```
Expected: 6 passed

- [ ] **Step 6: Write the failing `/me` API test**

```python
# backend/tests/api/test_me_api.py
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db import Base, get_db
from app.models import UserRole
from app.config import settings
import jwt as pyjwt
from datetime import datetime, timedelta, timezone

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def _token(email: str) -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def test_me_returns_seeded_officer_role():
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db.commit()
    db.close()
    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {_token('dhruv@carvelle.in')}"})
    assert response.status_code == 200
    assert response.json() == {"email": "dhruv@carvelle.in", "role": "officer"}

def test_me_defaults_new_email_to_citizen():
    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {_token('new-person@example.com')}"})
    assert response.status_code == 200
    assert response.json()["role"] == "citizen"

def test_me_401s_without_a_token():
    response = client.get("/api/v1/me")
    assert response.status_code == 401
```

- [ ] **Step 7: Run to verify it fails**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_me_api.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.api.v1.me'`

- [ ] **Step 8: Write `backend/app/api/v1/me.py`**

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.identity import Identity, get_current_identity

router = APIRouter(prefix="/api/v1/me", tags=["me"])


class MeOut(BaseModel):
    email: str
    role: str


@router.get("", response_model=MeOut)
def get_me(identity: Identity = Depends(get_current_identity)) -> MeOut:
    return MeOut(email=identity.email, role=identity.role)
```

- [ ] **Step 9: Mount the router in `backend/app/main.py`**

Find the existing `app.include_router(...)` calls and add:
```python
from app.api.v1 import me
...
app.include_router(me.router)
```

- [ ] **Step 10: Run to verify all new tests pass, then the full suite**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_me_api.py -v
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: 3 passed, then full suite green with the new tests added to the count.

- [ ] **Step 11: Commit**

```bash
git add backend/app/models.py backend/app/auth/identity.py backend/app/api/v1/me.py backend/app/main.py backend/tests/unit/test_identity.py backend/tests/api/test_me_api.py
git commit -m "feat(backend): UserRole model, require_role authorization layer, GET /api/v1/me"
```

---

## Task 3: `Case` gains `status`/`filed_by_role`/`complainant_email`/`guest_ticket_token`; status-transition endpoint

**Files:**
- Modify: `backend/app/models.py` (Case additions)
- Modify: `backend/app/schemas.py` (add `CaseStatus`, extend `CaseOut`)
- Modify: `backend/app/api/v1/cases.py` (`PATCH /{id}/status`, officer-gated)
- Test: `backend/tests/api/test_case_status_api.py`

**Interfaces:**
- Consumes: `require_role` (Task 2).
- Produces: `Case.status`, `Case.filed_by_role`, `Case.complainant_email`, `Case.guest_ticket_token` columns; `VALID_STATUS_TRANSITIONS` map; `PATCH /api/v1/cases/{case_id}/status` — consumed by Task 4 (AI auto-reply wiring) and the frontend Tickets page (Task 10).

- [ ] **Step 1: Add columns to `Case` in `backend/app/models.py`**

```python
    status: Mapped[str] = mapped_column(String, default="new")  # "new" | "in_progress" | "handled"
    filed_by_role: Mapped[str] = mapped_column(String, default="officer")  # "officer" | "citizen" | "guest"
    complainant_email: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    guest_ticket_token: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
```
(Add these to the existing `Case` class, after the `innocence_factors` field.)

- [ ] **Step 2: Add to `backend/app/schemas.py`**

```python
from typing import Literal

CaseStatus = Literal["new", "in_progress", "handled"]

class CaseStatusUpdateIn(BaseModel):
    status: CaseStatus
```

Add `status: str` to the existing `CaseOut` schema.

- [ ] **Step 3: Write the failing test**

```python
# backend/tests/api/test_case_status_api.py
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db import Base, get_db
from app.models import Case, UserRole
from app.config import settings
import jwt as pyjwt

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def _officer_token() -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": "dhruv@carvelle.in",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def _citizen_token() -> str:
    payload = {"user_id": "u2", "tenant_id": "kaizen", "email": "tripathidhruv2704@gmail.com",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def _seed_case(status="new") -> str:
    db = TestSession()
    case = Case(id="case-1", ncrp="N1", complainant="C", location="L", phone="P",
                incident_at=datetime.now(timezone.utc), fraud_type="scam",
                amount_inr=1000, amount_crypto=10, asset="USDT-TRC20", chain="tron",
                suspect_wallet="Tsuspect", status=status)
    db.add(case)
    db.commit()
    db.close()
    return case.id

def _seed_officer_role():
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db.commit()
    db.close()

def test_officer_can_transition_new_to_in_progress():
    _seed_officer_role()
    case_id = _seed_case(status="new")
    response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "in_progress"},
                             headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"

def test_rejects_invalid_transition_new_to_handled_directly():
    _seed_officer_role()
    case_id = _seed_case(status="new")
    response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "handled"},
                             headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 409

def test_citizen_cannot_transition_status():
    case_id = _seed_case(status="new")
    response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "in_progress"},
                             headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert response.status_code == 403

def test_404_for_unknown_case():
    _seed_officer_role()
    response = client.patch("/api/v1/cases/does-not-exist/status", json={"status": "in_progress"},
                             headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 404
```

- [ ] **Step 4: Run to verify it fails**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_case_status_api.py -v
```
Expected: FAIL — 404/405 (no such route yet)

- [ ] **Step 5: Add to `backend/app/api/v1/cases.py`**

Read the existing file first to match its exact import style and `_to_out` helper before adding:

```python
VALID_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "new": {"in_progress"},
    "in_progress": {"handled"},
    "handled": set(),
}

@router.patch("/{case_id}/status", response_model=CaseOut)
def update_case_status(
    case_id: str,
    payload: CaseStatusUpdateIn,
    db: Session = Depends(get_db),
    identity: Identity = Depends(require_role("officer")),
) -> CaseOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    allowed_next = VALID_STATUS_TRANSITIONS.get(case.status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=409,
            detail=f"Can't move a case from '{case.status}' straight to '{payload.status}'.",
        )
    case.status = payload.status
    db.commit()
    db.refresh(case)
    # Task 4 wires the AI auto-reply here, on the transition into "handled".
    return _to_out(case)
```

Add the needed imports (`CaseStatusUpdateIn` from `app.schemas`, `require_role`/`Identity` from `app.auth.identity`) at the top of the file, matching its existing import grouping style. Update `_to_out` to include `status=case.status` in the returned `CaseOut`.

- [ ] **Step 6: Run to verify it passes, then the full suite**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_case_status_api.py -v
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: 4 passed, full suite green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py backend/app/api/v1/cases.py backend/tests/api/test_case_status_api.py
git commit -m "feat(backend): persisted case status field + officer-gated status-transition endpoint"
```

---

## Task 4: `CaseReply` model + officer manual reply endpoint + AI auto-reply on `handled`

**Files:**
- Modify: `backend/app/models.py` (add `CaseReply`)
- Modify: `backend/app/schemas.py` (add `CaseReplyOut`, `CaseReplyIn`)
- Modify: `backend/app/api/v1/cases.py` (`POST /{id}/replies`, `GET /{id}/replies`; wire AI reply into the status-transition handler from Task 3)
- Test: `backend/tests/api/test_case_replies_api.py`

**Interfaces:**
- Consumes: `generate_case_narrative(db, case_id) -> (narrative, available, reason)` (`app/narrative/summary.py`, unchanged), `require_role` (Task 2), the status-transition endpoint (Task 3).
- Produces: `CaseReply` model; `POST /api/v1/cases/{case_id}/replies` (officer); `GET /api/v1/cases/{case_id}/replies` (officer OR the case's own citizen/guest — see Task 5 for the citizen/guest read path, this task only builds the officer write path and the model both share).

- [ ] **Step 1: Add `CaseReply` to `backend/app/models.py`**

```python
class CaseReply(Base):
    __tablename__ = "case_replies"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    message: Mapped[str] = mapped_column(Text)
    authored_by: Mapped[str] = mapped_column(String)  # "officer" | "ai"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
```

- [ ] **Step 2: Add to `backend/app/schemas.py`**

```python
class CaseReplyIn(BaseModel):
    message: str

class CaseReplyOut(BaseModel):
    id: int
    caseId: str
    message: str
    authoredBy: str
    createdAt: datetime
```

- [ ] **Step 3: Write the failing test**

```python
# backend/tests/api/test_case_replies_api.py
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db import Base, get_db
from app.models import Case, UserRole
from app.config import settings
import jwt as pyjwt

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def _officer_token() -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": "dhruv@carvelle.in",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def _seed(status="new") -> str:
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    case = Case(id="case-1", ncrp="N1", complainant="C", location="L", phone="P",
                incident_at=datetime.now(timezone.utc), fraud_type="scam",
                amount_inr=1000, amount_crypto=10, asset="USDT-TRC20", chain="tron",
                suspect_wallet="Tsuspect", status=status)
    db.add(case)
    db.commit()
    db.close()
    return case.id

def test_officer_posts_a_manual_reply():
    case_id = _seed()
    response = client.post(f"/api/v1/cases/{case_id}/replies", json={"message": "We are on it."},
                            headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 201
    assert response.json()["authoredBy"] == "officer"
    listed = client.get(f"/api/v1/cases/{case_id}/replies",
                         headers={"Authorization": f"Bearer {_officer_token()}"})
    assert len(listed.json()) == 1

def test_handling_a_case_adds_an_ai_reply_when_narrative_available():
    case_id = _seed(status="in_progress")
    with patch("app.api.v1.cases.generate_case_narrative",
               return_value=("The money moved to a wallet linked to Exchange X.", True, None)):
        response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "handled"},
                                 headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    replies = client.get(f"/api/v1/cases/{case_id}/replies",
                          headers={"Authorization": f"Bearer {_officer_token()}"}).json()
    assert any(r["authoredBy"] == "ai" and "Exchange X" in r["message"] for r in replies)

def test_handling_a_case_adds_no_ai_reply_when_narrative_unavailable():
    case_id = _seed(status="in_progress")
    with patch("app.api.v1.cases.generate_case_narrative",
               return_value=(None, False, "OpenAI key not configured")):
        response = client.patch(f"/api/v1/cases/{case_id}/status", json={"status": "handled"},
                                 headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    replies = client.get(f"/api/v1/cases/{case_id}/replies",
                          headers={"Authorization": f"Bearer {_officer_token()}"}).json()
    assert not any(r["authoredBy"] == "ai" for r in replies)
```

- [ ] **Step 4: Run to verify it fails**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_case_replies_api.py -v
```
Expected: FAIL — no such routes yet.

- [ ] **Step 5: Add to `backend/app/api/v1/cases.py`**

```python
from app.narrative.summary import generate_case_narrative
from app.models import CaseReply
from app.schemas import CaseReplyIn, CaseReplyOut

def _reply_to_out(reply: CaseReply) -> CaseReplyOut:
    return CaseReplyOut(id=reply.id, caseId=reply.case_id, message=reply.message,
                         authoredBy=reply.authored_by, createdAt=reply.created_at)

@router.post("/{case_id}/replies", response_model=CaseReplyOut, status_code=201)
def create_case_reply(
    case_id: str,
    payload: CaseReplyIn,
    db: Session = Depends(get_db),
    identity: Identity = Depends(require_role("officer")),
) -> CaseReplyOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    reply = CaseReply(case_id=case_id, message=payload.message, authored_by="officer")
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return _reply_to_out(reply)

@router.get("/{case_id}/replies", response_model=list[CaseReplyOut])
def list_case_replies(
    case_id: str,
    db: Session = Depends(get_db),
    identity: Identity = Depends(get_current_identity),
) -> list[CaseReplyOut]:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    # Task 5 tightens this to "officer, or the case's own citizen/guest" -- left open to any
    # authenticated identity here since Task 5 hasn't built the citizen-ownership check yet;
    # Task 5 MUST add that check before this endpoint is considered done for citizen use.
    replies = db.query(CaseReply).filter(CaseReply.case_id == case_id).order_by(CaseReply.created_at).all()
    return [_reply_to_out(r) for r in replies]
```

Now wire the AI auto-reply into Task 3's `update_case_status`, right before its `return _to_out(case)`:

```python
    if payload.status == "handled":
        narrative, available, _reason = generate_case_narrative(db, case_id)
        if available and narrative:
            db.add(CaseReply(case_id=case_id, message=narrative, authored_by="ai"))
            db.commit()
```

- [ ] **Step 6: Run to verify it passes, then the full suite**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_case_replies_api.py -v
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: 3 passed, full suite green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py backend/app/api/v1/cases.py backend/tests/api/test_case_replies_api.py
git commit -m "feat(backend): case reply model, officer manual replies, AI auto-reply on handled transition"
```

---

## Task 5: Citizen/guest case creation + ownership-scoped reads (`GET /mine`, `GET /ticket/{token}`)

**Files:**
- Modify: `backend/app/api/v1/cases.py` (extend `create_case` for citizen/guest, add `GET /mine`, `GET /ticket/{token}`; tighten `list_case_replies`)
- Modify: `backend/app/schemas.py` (extend `CaseIn`/`CaseOut`)
- Test: `backend/tests/api/test_citizen_cases_api.py`

**Interfaces:**
- Consumes: `require_role`, `get_current_identity` (Task 2), `Case.filed_by_role`/`complainant_email`/`guest_ticket_token` (Task 3), `CaseReply` (Task 4).
- Produces: `GET /api/v1/cases/mine` (citizen, own cases by email); `GET /api/v1/cases/ticket/{guest_ticket_token}` (no auth, token is the auth); extends `create_case` to accept an optional caller identity.

Read `backend/app/api/v1/cases.py`'s CURRENT full content first (it has grown across three tasks in this plan) before editing — do not blindly append past what Tasks 3-4 already added.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/api/test_citizen_cases_api.py
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db import Base, get_db
from app.models import UserRole
from app.config import settings
import jwt as pyjwt

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def _citizen_token(email="tripathidhruv2704@gmail.com") -> str:
    payload = {"user_id": "u2", "tenant_id": "kaizen", "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

BASE_PAYLOAD = {
    "ncrp": "N1", "complainant": "Self-filed", "location": "Delhi", "phone": "9999999999",
    "incidentAt": "2026-01-01T00:00:00Z", "fraudType": "investment_scam",
    "amountINR": 50000, "amountCrypto": 50.0, "asset": "USDT-TRC20", "chain": "tron",
    "suspectWallet": "TScamWalletBBBBBBBBBBBBBBBBBBBBBBB",
}

def test_logged_in_citizen_files_a_case_and_sees_it_in_mine():
    created = client.post("/api/v1/cases", json=BASE_PAYLOAD,
                           headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert created.status_code == 201
    assert created.json()["status"] == "new"

    mine = client.get("/api/v1/cases/mine", headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["id"] == created.json()["id"]

def test_guest_files_a_case_and_gets_a_ticket_token():
    created = client.post("/api/v1/cases", json=BASE_PAYLOAD)  # no Authorization header at all
    assert created.status_code == 201
    body = created.json()
    assert body["filedByRole"] == "guest"
    assert body.get("guestTicketToken")

    looked_up = client.get(f"/api/v1/cases/ticket/{body['guestTicketToken']}")
    assert looked_up.status_code == 200
    assert looked_up.json()["id"] == body["id"]

def test_ticket_lookup_404s_for_an_unknown_token():
    response = client.get("/api/v1/cases/ticket/not-a-real-token")
    assert response.status_code == 404

def test_officer_filed_case_via_authenticated_officer_has_no_guest_token():
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db.commit()
    db.close()
    officer_payload = {"user_id": "u1", "tenant_id": "kaizen", "email": "dhruv@carvelle.in",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    token = pyjwt.encode(officer_payload, settings.auth_jwt_secret, algorithm="HS256")
    created = client.post("/api/v1/cases", json=BASE_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    assert created.status_code == 201
    assert created.json()["filedByRole"] == "officer"
    assert created.json().get("guestTicketToken") is None

def test_one_citizen_cannot_see_another_citizens_case_in_mine():
    client.post("/api/v1/cases", json=BASE_PAYLOAD, headers={"Authorization": f"Bearer {_citizen_token('a@example.com')}"})
    mine = client.get("/api/v1/cases/mine", headers={"Authorization": f"Bearer {_citizen_token('b@example.com')}"})
    assert mine.json() == []
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_citizen_cases_api.py -v
```
Expected: FAIL — 404s / missing fields.

- [ ] **Step 3: Modify `create_case` in `backend/app/api/v1/cases.py`**

Make the officer/identity dependency optional (unauthenticated = guest) using a small inline helper, since `HTTPBearer(auto_error=False)` (already the scheme in `app/auth/jwt.py`) already tolerates a missing header:

```python
import secrets
from app.auth.jwt import OfficerClaims, get_current_officer
from app.auth.identity import resolve_role

def _optional_identity(claims: OfficerClaims | None = Depends(get_current_officer_optional)) -> tuple[str | None, str]:
    ...
```

Concretely: `get_current_officer` currently requires `credentials` to be non-None and 401s otherwise (see `app/auth/jwt.py`). Add a small local optional variant in `cases.py` itself (do NOT modify `app/auth/jwt.py` — Global Constraints forbid it):

```python
from fastapi.security import HTTPAuthorizationCredentials
from app.auth.jwt import bearer_scheme
import jwt as pyjwt
from app.config import settings

def _resolve_filer(credentials: HTTPAuthorizationCredentials | None, db: Session) -> tuple[str, str | None]:
    """Returns (filed_by_role, complainant_email). No/invalid token -> guest, None.
    Valid token -> (role from UserRole, the verified email)."""
    if credentials is None:
        return "guest", None
    try:
        payload = pyjwt.decode(credentials.credentials, settings.auth_jwt_secret, algorithms=["HS256"])
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return "guest", None
    email = payload.get("email")
    if not email:
        return "guest", None
    role = resolve_role(db, email)
    return role, email.strip().lower()
```

In `create_case`, change its signature to also accept `credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)`, call `filed_by_role, complainant_email = _resolve_filer(credentials, db)`, and when `filed_by_role == "guest"` generate `guest_ticket_token=secrets.token_urlsafe(32)` (same pattern as `VaspSubscriber.access_token` in `vasp_feed.py`); set these three fields on the new `Case` before `db.add(case)`. Update `_to_out` to include `filedByRole=case.filed_by_role` and `guestTicketToken=case.guest_ticket_token`.

- [ ] **Step 4: Add `GET /mine` and `GET /ticket/{token}`**

```python
@router.get("/mine", response_model=list[CaseOut])
def list_my_cases(
    db: Session = Depends(get_db),
    identity: Identity = Depends(get_current_identity),
) -> list[CaseOut]:
    cases = db.query(Case).filter(Case.complainant_email == identity.email).order_by(Case.reported_at.desc()).all()
    return [_to_out(c) for c in cases]


@router.get("/ticket/{guest_ticket_token}", response_model=CaseOut)
def get_case_by_ticket(guest_ticket_token: str, db: Session = Depends(get_db)) -> CaseOut:
    case = db.query(Case).filter(Case.guest_ticket_token == guest_ticket_token).one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="No ticket found for this link")
    return _to_out(case)
```

Place `GET /mine` and `GET /ticket/{guest_ticket_token}` BEFORE the existing `GET /{case_id}` route in the file (FastAPI matches path routes in registration order — `/mine` and `/ticket/...` must not be shadowed by `/{case_id}` greedily matching them as a `case_id` value).

- [ ] **Step 5: Tighten `list_case_replies` from Task 4 to scope to the case's own citizen/guest or any officer**

```python
@router.get("/{case_id}/replies", response_model=list[CaseReplyOut])
def list_case_replies(
    case_id: str,
    db: Session = Depends(get_db),
    identity: Identity = Depends(get_current_identity),
) -> list[CaseReplyOut]:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")
    if identity.role != "officer" and identity.email != (case.complainant_email or ""):
        raise HTTPException(status_code=403, detail="Not authorized to view these replies")
    replies = db.query(CaseReply).filter(CaseReply.case_id == case_id).order_by(CaseReply.created_at).all()
    return [_reply_to_out(r) for r in replies]
```

(This replaces Task 4's placeholder version of the same function — same name, same route, tightened body.)

- [ ] **Step 6: Run to verify it passes, then the full suite**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_citizen_cases_api.py -v
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: 6 passed, full suite green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/v1/cases.py backend/app/schemas.py backend/tests/api/test_citizen_cases_api.py
git commit -m "feat(backend): citizen/guest case filing, GET /mine and GET /ticket/{token}, reply-view ownership check"
```

---

## Task 6: Officer-facing flagged-wallets endpoint

**Files:**
- Modify: `backend/app/api/v1/vasp_feed.py` (add `GET /flagged-wallets`; swap the existing `/replies` endpoint's dependency from `get_current_officer` to `require_role("officer")`)
- Test: `backend/tests/api/test_flagged_wallets_api.py`

**Interfaces:**
- Consumes: `require_role` (Task 2), existing `FlaggedWallet` model, existing `_to_out`-style serializer already in `vasp_feed.py`.
- Produces: `GET /api/v1/vasp-feed/flagged-wallets` (officer-gated, system-wide, full untruncated address).

- [ ] **Step 1: Read `backend/app/api/v1/vasp_feed.py`'s existing `_to_out`/`FlaggedWalletOut` and the `/replies` endpoint in full before editing**

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/api/test_flagged_wallets_api.py
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.db import Base, get_db
from app.models import FlaggedWallet, UserRole
from app.config import settings
import jwt as pyjwt

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def _officer_token() -> str:
    payload = {"user_id": "u1", "tenant_id": "kaizen", "email": "dhruv@carvelle.in",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def _citizen_token() -> str:
    payload = {"user_id": "u2", "tenant_id": "kaizen", "email": "tripathidhruv2704@gmail.com",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return pyjwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")

def test_officer_sees_full_untruncated_address():
    db = TestSession()
    db.add(UserRole(email="dhruv@carvelle.in", role="officer"))
    db.add(FlaggedWallet(address="TVeryLongRealisticLookingWalletAddress123", chain="tron",
                          risk_score=0.9, case_ids=["case-1"]))
    db.commit()
    db.close()
    response = client.get("/api/v1/vasp-feed/flagged-wallets",
                           headers={"Authorization": f"Bearer {_officer_token()}"})
    assert response.status_code == 200
    assert response.json()[0]["address"] == "TVeryLongRealisticLookingWalletAddress123"

def test_non_officer_cannot_see_flagged_wallets():
    response = client.get("/api/v1/vasp-feed/flagged-wallets",
                           headers={"Authorization": f"Bearer {_citizen_token()}"})
    assert response.status_code == 403
```

Adjust `FlaggedWallet(...)` constructor kwargs to match the model's actual field names if they differ from this guess (check `backend/app/models.py`'s real `FlaggedWallet` class first — the brief's own earlier investigation found fields `address, chain, riskScore(API name)/risk_score(model name), caseIds/case_ids, flaggedAt, broadcastStatus`; use the model's real Python attribute names here, not the API's camelCase names).

- [ ] **Step 3: Run to verify it fails**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_flagged_wallets_api.py -v
```
Expected: FAIL — 404 (no such route).

- [ ] **Step 4: Add the endpoint to `vasp_feed.py`**

```python
from app.auth.identity import require_role, Identity

@feed_router.get("/flagged-wallets", response_model=list[FlaggedWalletOut])
def list_all_flagged_wallets(
    db: Session = Depends(get_db),
    identity: Identity = Depends(require_role("officer")),
) -> list[FlaggedWalletOut]:
    wallets = db.query(FlaggedWallet).order_by(FlaggedWallet.flagged_at.desc()).all()
    return [_to_out(w) for w in wallets]  # reuse the file's existing serializer -- read it first to match its exact name/signature
```

Also change the existing `/replies` endpoint's `Depends(get_current_officer)` to `Depends(require_role("officer"))` (find its exact current signature first — do not guess the parameter name, read the file).

- [ ] **Step 5: Run to verify it passes, then the full suite**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/api/test_flagged_wallets_api.py -v
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: 2 passed, full suite green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/vasp_feed.py backend/tests/api/test_flagged_wallets_api.py
git commit -m "feat(backend): officer-facing GET /flagged-wallets, replies endpoint now role-gated not just JWT-gated"
```

---

## Task 7: Inverted Deposit Index Task B — wire into the live trace path

**Files:**
- Modify: `backend/app/api/v1/traces.py`
- Test: `backend/tests/api/test_traces_api.py` (extend) or a new focused test file

**Interfaces:**
- Consumes: `lookup_indexed_deposit(address, chain) -> list[DepositIndexEntry]` (`app/index/deposit_index.py`, already built).
- Produces: an index-hit path inside the candidate-evaluation loop that satisfies the gate via real backward-crawled evidence, with an honest `gate_breakdown["index_hit"] = True` flag, still requiring the sweep-signal check to pass (per the spec doc quoted in the design spec above).

- [ ] **Step 1: Read `backend/app/api/v1/traces.py` end to end before touching it** (per the design spec's own Task B instruction — this file has grown substantially across the whole-branch-review fix passes; do not guess its current shape).

- [ ] **Step 2: Read `backend/app/index/deposit_index.py` and `docs/superpowers/specs/2026-09-27-inverted-deposit-index-design.md` Task B section in full.**

- [ ] **Step 3: Write a failing test** exercising: a hop whose wallet address has an indexed-deposit entry AND a real sweep signal → gate passes with `entity_name` from the index entry and `gate_breakdown["index_hit"] == True`; a hop with an indexed-deposit entry but NO sweep signal → gate still fails (index hit alone must not bypass the sweep check, per the spec's own explicit rule).

- [ ] **Step 4: Implement the index-hit branch in the candidate-evaluation loop**, following the spec's Task B description exactly: check `lookup_indexed_deposit` before/alongside the existing `lookup_label`/`evaluate_deposit_gate` call for each hop; on a hit, satisfy the label-vetting half of the gate via the index entry instead of `lookup_label`, but still require `detect_sweep`'s result before the candidate is accepted. Do not duplicate or fight the existing loop's control flow — extend it.

- [ ] **Step 5: Run the new test, then the full suite.**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: all green, count increased by the new test(s).

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/traces.py backend/tests/
git commit -m "feat(backend): wire the inverted deposit index into the live trace path (Task B)"
```

---

## Task 8: `tracer.py` since-param fix + `unreportedVictims` ambiguity fix

**Files:**
- Modify: `backend/app/tracing/tracer.py`
- Modify: `backend/app/api/v1/traces.py`
- Modify: `backend/app/schemas.py` (if `TraceOut`'s `unreportedVictims` field needs a sibling flag)
- Test: extend existing tracer/traces tests

**Interfaces:**
- Consumes: each chain adapter's real `since=` support (already built in the G5 pass).
- Produces: `tracer.py`'s `trace()` passing `since=since_ts` to `get_transfers` with an accurate comment; a new `unreportedVictimsAttempted: bool` (or equivalently-named) field on `TraceOut` disambiguating "never attempted" from "attempted, found nobody."

- [ ] **Step 1: Read `backend/app/tracing/tracer.py` around the `get_transfers` call site (previously reported near line 143-150) and fix the stale comment + pass `since=since_ts`.** Re-run the tracer causality tests — they use a fake client whose `get_transfers` already accepts `since`, so this should not require test changes, only confirm nothing regresses.

- [ ] **Step 2: In `backend/app/api/v1/traces.py`, find where `unreported_victims_out` is initialized to `[]` (previously reported around line 272, populated around line 471-483 only when the gate passes) and add a boolean field to disambiguate**, e.g. `unreportedVictimsAttempted: bool`, set `True` only on the branch where enumeration actually ran (gate passed), `False` on the branch where it was skipped. Update `TraceOut`'s schema accordingly.

- [ ] **Step 3: Add a focused test proving the new field distinguishes the two cases** (gate-failed trace → `unreportedVictimsAttempted=False`, `unreportedVictims=[]`; gate-passed trace with zero other payers found → `unreportedVictimsAttempted=True`, `unreportedVictims=[]`).

- [ ] **Step 4: Run the full suite.**

```bash
cd backend && .venv/Scripts/python.exe -m pytest tests/ -q
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/tracing/tracer.py backend/app/api/v1/traces.py backend/app/schemas.py backend/tests/
git commit -m "fix(backend): tracer passes since= to chain clients (stale comment fixed); unreportedVictims attempted-vs-empty disambiguated"
```

---

## Task 9: Seed roles + run the E:/API seed script for the 2 new emails (operational, not a code task)

**Files:**
- Create: `backend/scripts/seed_user_roles.py` (idempotent, mirrors the style of other one-off scripts in `backend/scripts/`)

- [ ] **Step 1: Write `backend/scripts/seed_user_roles.py`**

```python
"""One-off, safely re-runnable: seeds the initial KAIZEN role assignments this feature needs.
Run: backend/.venv/Scripts/python.exe scripts/seed_user_roles.py (from backend/)."""
from app.db import SessionLocal, Base, engine
from app.models import UserRole, VaspSubscriber

SEED_ROLES = [
    ("dhruv@carvelle.in", "officer", None),
    ("cntcitachi@gmail.com", "exchange", "Demo Exchange"),  # linked by subscriber name lookup below
    ("tripathidhruv2704@gmail.com", "citizen", None),
]

def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for email, role, subscriber_name in SEED_ROLES:
            normalized = email.strip().lower()
            existing = db.query(UserRole).filter(UserRole.email == normalized).one_or_none()
            if existing is not None:
                print(f"skip (already seeded): {normalized} -> {existing.role}")
                continue
            linked_id = None
            if subscriber_name:
                subscriber = db.query(VaspSubscriber).filter(VaspSubscriber.name == subscriber_name).one_or_none()
                linked_id = subscriber.id if subscriber else None
            db.add(UserRole(email=normalized, role=role, linked_subscriber_id=linked_id))
            print(f"seeded: {normalized} -> {role}" + (f" (linked subscriber {linked_id})" if linked_id else ""))
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it against the real dev database**

```bash
cd backend && .venv/Scripts/python.exe scripts/seed_user_roles.py
```
Expected output: 3 "seeded:" lines (or "skip" lines on a re-run).

- [ ] **Step 3: Run the EXISTING `E:/API` seed script for the 2 new emails** (this is the actual fix for "cntcitachi@gmail.com not getting an OTP code" — that email has never been provisioned for OTP login at all):

```bash
cd E:/API && .venv/Scripts/python.exe scripts/seed_kaizen_tenant.py cntcitachi@gmail.com
cd E:/API && .venv/Scripts/python.exe scripts/seed_kaizen_tenant.py tripathidhruv2704@gmail.com
```
Expected: both succeed (the script is documented as idempotent/safely re-runnable per `docs/HANDOFF.md`).

- [ ] **Step 4: Live-verify** (both services must be running — see `docs/HANDOFF.md`'s "Running the whole thing locally" section): call `POST /capAm/authentication/sendOtp` for `cntcitachi@gmail.com` against the real running E:/API instance and confirm an OTP email actually arrives (check the inbox, or `E:/API`'s own logs for the SMTP send confirmation) — do not just assume the seed fixed it, prove it end-to-end.

- [ ] **Step 5: Commit (KAIZEN repo only — the seed script; E:/API's own commit, if any, is that project's separate concern per existing convention)**

```bash
cd E:/kaizen && git add backend/scripts/seed_user_roles.py
git commit -m "feat(backend): seed script for initial officer/exchange/citizen role assignments"
```

---

## Task 10: Frontend — `authStore`, guest login, role-based route tree

**Files:**
- Create: `frontend/src/store/authStore.ts`
- Modify: `frontend/src/pages/Login.tsx` (add "Continue as guest")
- Modify: `frontend/src/App.tsx` (role-based route tree)
- Modify: `frontend/src/lib/authToken.ts` (guest-mode helper)
- Modify: `frontend/src/api/httpApi.ts` (add `getMe()`)

**Interfaces:**
- Consumes: `GET /api/v1/me` (Task 2).
- Produces: `useAuthStore` (zustand: `{email, role, isGuest, setIdentity, setGuest, clear}`) — consumed by every page built in Tasks 11-13; `<RequireRole roles={[...]}>` route-guard component.

- [ ] **Step 1: Read `frontend/src/App.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/lib/authToken.ts`, `frontend/src/components/auth/RequireAuth.tsx` in full before editing** — this task restructures routing, so work from the CURRENT file contents, not assumptions.

- [ ] **Step 2: Create `frontend/src/store/authStore.ts`**

```typescript
import { create } from 'zustand'

export type Role = 'officer' | 'exchange' | 'citizen' | 'guest'

interface AuthState {
  email: string | null
  role: Role | null
  setIdentity: (email: string, role: Exclude<Role, 'guest'>) => void
  setGuest: () => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  email: null,
  role: null,
  setIdentity: (email, role) => set({ email, role }),
  setGuest: () => set({ email: null, role: 'guest' }),
  clear: () => set({ email: null, role: null }),
}))
```

- [ ] **Step 3: Add `getMe()` to `frontend/src/api/httpApi.ts`** calling `GET /api/v1/me` via the existing `request()` helper with the stored bearer token (match the existing pattern `VaspReplies.tsx` already uses for `Authorization: Bearer ${token}`).

- [ ] **Step 4: In `Login.tsx`**, after a successful `verifyOtp` and `setAuthToken(...)`, call `getMe()` and `useAuthStore.getState().setIdentity(email, role)` before navigating. Add a "Continue as guest" button below the existing form that calls `useAuthStore.getState().setGuest()` and navigates directly to the citizen complaint-filing route (built in Task 12) — no API call.

- [ ] **Step 5: Build a `<RequireRole>` guard** (new file `frontend/src/components/auth/RequireRole.tsx`), similar in shape to the existing `RequireAuth.tsx` but checking `useAuthStore`'s `role` against an allowed list, redirecting to `/login` if role is null, or to a "not authorized" state if role doesn't match. `role === 'guest'` passes any guard that includes `'citizen'` in its allowed list (guests get citizen-tier UI).

- [ ] **Step 6: Restructure `App.tsx`'s route tree** into three branches gated by `<RequireRole roles={[...]}>`: officer (all existing officer routes + the new pages from Tasks 11/12), exchange (new login-based portal view from Task 11), citizen (new complaint-filing + my-complaints/my-ticket views from Task 12). Keep `/login` and `/vasp-portal/:token` outside any guard, unchanged.

- [ ] **Step 7: Type-check and manually verify in the browser** (start the dev server, log in as each of the 3 seeded emails plus guest mode, confirm each lands on the right view and unauthorized routes redirect).

```bash
cd frontend && npx tsc -b
```
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/store/authStore.ts frontend/src/pages/Login.tsx frontend/src/App.tsx frontend/src/lib/authToken.ts frontend/src/api/httpApi.ts frontend/src/components/auth/RequireRole.tsx
git commit -m "feat(frontend): authStore, guest login, role-based route tree"
```

---

## Task 11: Frontend — officer Flagged Wallets page + richer VASP reply/portal detail (full address, reply dialog)

**Files:**
- Create: `frontend/src/pages/FlaggedWallets.tsx`
- Modify: `frontend/src/pages/VaspPortal.tsx` (remove truncation)
- Modify: `frontend/src/pages/VaspReplies.tsx` (remove truncation, add a detail `Dialog` per reply)
- Modify: `frontend/src/api/httpApi.ts` (add `getFlaggedWallets()`)

**Interfaces:**
- Consumes: `GET /api/v1/vasp-feed/flagged-wallets` (Task 6), existing `GET /api/v1/vasp-feed/replies`.

- [ ] **Step 1: Read `VaspPortal.tsx` and `VaspReplies.tsx` in full first** (both were explored earlier this session — `truncateAddress()` calls at specific lines — confirm current line numbers before editing, they may have shifted).

- [ ] **Step 2: Remove every `truncateAddress()` call in both files**, rendering the full address in a `font-mono` span (matching the project's existing convention for on-chain addresses elsewhere, e.g. Dashboard's recent-cases table).

- [ ] **Step 3: In `VaspReplies.tsx`, wrap each reply row in a `Dialog`** (reuse the existing primitive) that on open shows: full wallet address, chain badge, risk-score badge, related case IDs (from the existing `FlaggedWalletOut.caseIds`/similar field already returned by the replies endpoint), subscriber name/email, full message text, timestamp — everything the API already returns, just not all shown inline in the row today.

- [ ] **Step 4: Create `frontend/src/pages/FlaggedWallets.tsx`** (officer-only route) — a table of every flagged wallet system-wide (address, chain, risk score badge, case IDs as links to those cases, flagged timestamp), reusing `Card`/`Badge`/table patterns from `Cases.tsx`.

- [ ] **Step 5: Wire the new route into `App.tsx`'s officer branch (from Task 10) and the sidebar nav.**

- [ ] **Step 6: Type-check + manual browser verification (log in as officer, view Flagged Wallets page and a reply's detail dialog; log in as exchange/portal-token, confirm full address now shows).**

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/FlaggedWallets.tsx frontend/src/pages/VaspPortal.tsx frontend/src/pages/VaspReplies.tsx frontend/src/api/httpApi.ts frontend/src/App.tsx
git commit -m "feat(frontend): officer flagged-wallets page, full untruncated addresses, detailed reply dialog"
```

---

## Task 12: Frontend — citizen complaint filing + My Complaints / My Ticket

**Files:**
- Create: `frontend/src/pages/FileComplaint.tsx`
- Create: `frontend/src/pages/MyComplaints.tsx`
- Create: `frontend/src/pages/MyTicket.tsx`
- Modify: `frontend/src/api/httpApi.ts` (add `getMyCases()`, `getCaseByTicket()`, `getCaseReplies()`)

**Interfaces:**
- Consumes: `POST /api/v1/cases` (unauthenticated or citizen-authenticated, Task 5), `GET /api/v1/cases/mine`, `GET /api/v1/cases/ticket/{token}`, `GET /api/v1/cases/{id}/replies`.

- [ ] **Step 1: Read `frontend/src/pages/NewCase.tsx` in full** — reuse its field set and validation, but this is a NEW page (do not modify `NewCase.tsx` itself, which stays the officer-filling-out-for-complainant flow) with citizen-facing copy ("Tell us what happened" rather than "Pre-filled from the complaint already on file").

- [ ] **Step 2: Build `FileComplaint.tsx`** — the same form fields as `NewCase.tsx`, submitting to `createCase()` (already exists in `httpApi.ts`). On success: if the response includes a `guestTicketToken`, navigate to `/my-ticket/{token}` with a clear "bookmark this link" message; if the citizen was logged in (has `authStore.email`), navigate to `/my-complaints`.

- [ ] **Step 3: Build `MyComplaints.tsx`** (citizen role, authenticated) — calls `getMyCases()`, lists each case with its `status` as a `Badge`, links into a detail view showing `getCaseReplies(caseId)` (message + `authoredBy` + timestamp, officer replies and AI replies visually distinguished e.g. by icon/label).

- [ ] **Step 4: Build `MyTicket.tsx`** (public route, `/my-ticket/:token`, no auth) — calls `getCaseByTicket(token)` and `GET /api/v1/cases/ticket/{token}/replies` (Task 5b, added as a follow-up to Task 5 — a guest has no JWT, so `GET /{id}/replies` doesn't work for them; this ticket-scoped route needs no auth, the token itself is the auth, same convention as `/vasp-portal/{access_token}`), same status/reply display, reusing the same sub-component `MyComplaints.tsx` uses for one case's detail (factor a shared `CaseTicketDetail` component if that keeps both files small).

- [ ] **Step 5: Wire routes into `App.tsx`** — `FileComplaint`/`MyComplaints` inside the citizen `<RequireRole roles={['citizen']}>` branch, `MyTicket` public (outside any guard, alongside `/vasp-portal/:token`).

- [ ] **Step 6: Type-check + manual browser verification** (guest flow: continue as guest → file complaint → land on ticket page with a token in the URL; citizen flow: log in as tripathidhruv2704@gmail.com → file complaint → see it in My Complaints with status "new").

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/FileComplaint.tsx frontend/src/pages/MyComplaints.tsx frontend/src/pages/MyTicket.tsx frontend/src/api/httpApi.ts frontend/src/App.tsx
git commit -m "feat(frontend): citizen complaint filing, My Complaints, guest My Ticket"
```

---

## Task 13: Frontend — officer Tickets page (status tabs, reply box, transition actions)

**Files:**
- Modify: `frontend/src/pages/Cases.tsx` (or create `frontend/src/pages/Tickets.tsx` if extending Cases.tsx would make it too large — implementer's judgment per the plan's file-size guidance, note the decision in the commit)
- Modify: `frontend/src/api/httpApi.ts` (add `updateCaseStatus()`, `postCaseReply()`, ensure `getCaseReplies()` from Task 12 is reused)

**Interfaces:**
- Consumes: `PATCH /api/v1/cases/{id}/status` (Task 3), `POST /api/v1/cases/{id}/replies`, `GET /api/v1/cases/{id}/replies` (Task 4).

- [ ] **Step 1: Read the current `frontend/src/pages/Cases.tsx` in full** — it already has a status-filter button row (`STATUS_FILTERS`) per this session's earlier investigation; the goal is to make that filter reflect the NOW-real, persisted `status` field instead of the mock's always-"New" placeholder, and add a per-case detail view with reply/transition actions.

- [ ] **Step 2: Replace the flat status-filter buttons with real `Tabs`** (New / In Progress / Handled) driven by the real `status` field from `listCases()`'s now-accurate data.

- [ ] **Step 3: Add a case detail panel/dialog (officer view) showing**: full case fields, the reply thread (`getCaseReplies`, officer + AI replies distinguished), a reply textarea (`postCaseReply`) with a send button, and status-transition buttons (only the currently-valid next status shown, per `VALID_STATUS_TRANSITIONS` from Task 3 — e.g. a "new" case shows only a "Start working on this" button, not a "Mark handled" button).

- [ ] **Step 4: Type-check + manual browser verification** (log in as officer, see a citizen-filed case in the "New" tab, click into it, transition to "In Progress", post a manual reply, transition to "Handled", confirm an AI reply appears automatically if `OPENAI_API_KEY` is configured in the running backend — if it's not configured, confirm the transition still succeeds with no fabricated reply, matching Global Constraints).

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Cases.tsx frontend/src/api/httpApi.ts
git commit -m "feat(frontend): officer ticket tabs (status-based), reply thread, status-transition actions"
```

---

## Task 14: Frontend — Notice-drafting page (backlog item 4)

**Files:**
- Create: `frontend/src/pages/NoticeDrafting.tsx`
- Modify: `frontend/src/api/httpApi.ts` (add `createNotice()`, `getNotice()`, `getSahyogPayload()`)

**Interfaces:**
- Consumes: `POST /api/v1/legal/notices`, `GET /notices/{id}/sahyog-payload` (both already built, backend-only until now per this session's earlier investigation — no auth dependency exists on `legal.py` today; leave that as-is per Global Constraints' existing-scope-limit precedent unless the user asks otherwise).

- [ ] **Step 1: Read `backend/app/api/v1/legal.py` in full** to get the exact request/response schemas for notice creation, the draft→approve→send FSM states, and the SAHYOG payload endpoint.

- [ ] **Step 2: Build `NoticeDrafting.tsx`** (officer route) — case picker (or reached from a case detail view/link), shows the innocence-gate result plainly (if the case's innocence score blocks drafting, show the plain-English reason from the 409 response, not a raw error), a template/citation picker matching `legal.py`'s real template options, draft/approve/send action buttons matching the FSM's real states, and a "view SAHYOG payload" action.

- [ ] **Step 3: Wire the route into `App.tsx`'s officer branch, linked from a case's detail view (Task 13).**

- [ ] **Step 4: Type-check + manual browser verification.**

```bash
cd frontend && npx tsc -b
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NoticeDrafting.tsx frontend/src/api/httpApi.ts frontend/src/App.tsx
git commit -m "feat(frontend): notice-drafting page wired to the existing legal-notice backend"
```

---

## Task 15: Docker Compose live smoke test (best-effort, not blocking)

**Files:** none (operational verification only)

- [ ] **Step 1: Confirm Docker Desktop's engine is running** (`docker ps` succeeds, not just `docker --version`). If it isn't running on this machine and can't be started in this environment, report that honestly rather than skipping silently — this stays an open item, exactly as it was before this plan, and that's fine.
- [ ] **Step 2: If the engine is available**, run `docker compose up --build` from the repo root, confirm both `frontend` and `backend` containers start and the frontend can reach the backend at its compose-network address, then `docker compose down`.
- [ ] **Step 3: Update `docs/TASKS.md`** to mark this item done (with the date and what was verified) or leave it explicitly open (with the reason) — either way, don't leave the docs claiming something that wasn't actually run.

---

## Self-review notes

**Spec coverage:** all 7 items from the design spec's numbered list have a task (compliance fix: Task 1; deposit index Task B: Task 7; Docker: Task 15; notice-drafting UI: Task 14; 6 minor items: Task 8 covers the 2 concrete, located ones — the other 4 from `docs/TASKS.md` P1.6 M-list are lower-severity/no-clear-single-fix and are intentionally left open, not silently dropped, since the design spec's item 5 only committed to the ones with clear locations); OTP root-cause: Task 9; unified role-based portal: Tasks 2-6, 10-13.

**Known scope note:** Task 6's `FlaggedWallet` field names are asserted from an earlier investigation in this session, not re-verified against the file at plan-writing time — the task explicitly tells its implementer to read the real model first and adjust the test's constructor kwargs, so this is a documented soft spot, not a silent gap.

**Placeholder scan:** no TBD/"add error handling"/vague steps found on inspection; every code-bearing step has complete code or an explicit, scoped instruction to read-then-extend existing code (used deliberately for the several tasks — 5, 6, 7, 8, 10-14 — that edit files which have grown substantially across prior sessions, where pasting stale literal code would be worse than directing the implementer to the real current file).
