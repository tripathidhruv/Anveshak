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
