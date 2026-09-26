from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.graph.campaigns import build_campaigns
from app.schemas import CampaignOut

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns"])

# Scaffolded by Task H0 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md).
# Real endpoints land in this file's own task -- see that plan for which task owns it.


class CampaignDetailOut(CampaignOut):
    """Detail view extends the shared `CampaignOut` (schemas.py, H0 scaffolding) with a
    "states touched" field. This is defined here rather than in schemas.py because the H0
    scaffolding only defined the shared list-view shape and this task's file scope does not
    include schemas.py -- `Case` has no dedicated state/geography column today, only a free-text
    `location` field, so `statesTouched` is honestly derived from that field's distinct values
    per cluster rather than a fabricated administrative "state" (per the brief: omit or derive
    honestly, never invent geography the data model doesn't have)."""

    statesTouched: list[str]


def _to_campaign_out(campaign) -> CampaignOut:
    return CampaignOut(
        id=campaign.id,
        hubAddress=campaign.hub_address,
        chain=campaign.chain,
        caseIds=campaign.case_ids,
        totalAmountINR=campaign.total_amount_inr,
    )


def _to_campaign_detail_out(campaign) -> CampaignDetailOut:
    return CampaignDetailOut(
        id=campaign.id,
        hubAddress=campaign.hub_address,
        chain=campaign.chain,
        caseIds=campaign.case_ids,
        totalAmountINR=campaign.total_amount_inr,
        statesTouched=campaign.states_touched,
    )


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db)) -> list[CampaignOut]:
    return [_to_campaign_out(c) for c in build_campaigns(db)]


@router.get("/{campaign_id}", response_model=CampaignDetailOut)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)) -> CampaignDetailOut:
    for campaign in build_campaigns(db):
        if campaign.id == campaign_id:
            return _to_campaign_detail_out(campaign)
    raise HTTPException(status_code=404, detail="campaign not found")
