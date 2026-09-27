"""
app/auth/jwt.py
Verifies (never issues) the JWT that E:/API's Lighthouse Auth API hands out on
officer login. Shared-secret HS256 verification only -- no network call back to the
auth service. The token's shape is E:/API's own app/core/security.py::create_access_token
payload: {"user_id", "tenant_id", "email", "exp"}.

Not wired into any real endpoint in this pass (see docs/superpowers/specs/2026-09-27-
auth-and-vasp-portal-design.md, Feature 1) -- Feature 2's portal-replies endpoint will
`Depends(get_current_officer)` later. Built and tested standalone here.
"""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

bearer_scheme = HTTPBearer(auto_error=False)

_INVALID_TOKEN_DETAIL = "Invalid or expired token"


class OfficerClaims:
    """The decoded, verified claims for the logged-in officer."""

    def __init__(self, user_id: str, tenant_id: str, email: str | None):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.email = email


def get_current_officer(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> OfficerClaims:
    """FastAPI dependency: reads `Authorization: Bearer <token>`, verifies it against
    `settings.auth_jwt_secret`, and returns the decoded officer claims. Raises 401 on a
    missing header (HTTPBearer itself raises 403 for a fully missing header -- normalized
    to 401 here so every auth failure on this dependency reads the same way), an invalid
    token, a token signed with the wrong secret, or an expired token. Never leaks the raw
    jwt exception text/type to the client."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID_TOKEN_DETAIL)

    if not settings.auth_jwt_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID_TOKEN_DETAIL)

    try:
        payload = jwt.decode(credentials.credentials, settings.auth_jwt_secret, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID_TOKEN_DETAIL)

    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")
    if not user_id or not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID_TOKEN_DETAIL)

    return OfficerClaims(user_id=user_id, tenant_id=tenant_id, email=payload.get("email"))
