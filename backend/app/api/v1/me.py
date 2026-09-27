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
