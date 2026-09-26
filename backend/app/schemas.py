from datetime import datetime
from pydantic import BaseModel

class CaseIn(BaseModel):
    ncrp: str
    complainant: str
    location: str
    phone: str
    incidentAt: datetime
    fraudType: str
    amountINR: float
    amountCrypto: float
    asset: str
    chain: str
    suspectWallet: str

class CaseOut(BaseModel):
    id: str
    ncrp: str
    complainant: str
    location: str
    phone: str
    incidentAt: datetime
    reportedAt: datetime
    fraudType: str
    amountINR: float
    amountCrypto: float
    asset: str
    chain: str
    suspectWallet: str

class HopOut(BaseModel):
    n: int
    addr: str
    role: str
    amt: float
    at: datetime
    flag: str | None
    chain: str
    stopReason: str | None

class ConservationOut(BaseModel):
    incomingTotal: float
    outgoingTotal: float
    fees: float
    remainder: float
    reconciled: bool
    # Task G3 (I-B): true when at least one terminal hop's own chain-API read failed rather
    # than genuinely running out of further transfers -- that hop's taint is excluded from
    # outgoingTotal (we never actually verified it stopped there) and reconciled is forced
    # False, so "reconciled": true is never reported when the trace simply couldn't check.
    dataUnavailable: bool

class AttributionOut(BaseModel):
    walletAddress: str
    chain: str
    gatePassed: bool
    entityName: str
    breakdown: dict
    reasoning: str
    limitations: str

class InnocenceFactorOut(BaseModel):
    check: str
    description: str
    supportsInnocence: bool
    weight: float

class InnocenceOut(BaseModel):
    innocenceScore: float
    factors: list[InnocenceFactorOut]

class UnreportedVictimOut(BaseModel):
    payerAddress: str
    chain: str
    totalAmount: float
    transferCount: int
    firstSeenAt: datetime

class BridgeLinkOut(BaseModel):
    sideATxHash: str
    sideAChain: str
    sideBTxHash: str
    sideBChain: str
    confidence: float

class TraceOut(BaseModel):
    hops: list[HopOut]
    conservation: ConservationOut
    attribution: AttributionOut
    innocence: InnocenceOut
    unreportedVictims: list[UnreportedVictimOut]
    # Task G3 (I-B, 4th instance found while fixing the 3 named ones): true when the
    # backward victim-enumeration read failed, so unreportedVictims == [] means "we
    # couldn't check", not "we checked and there are none".
    unreportedVictimsDataUnavailable: bool
    bridgeLinks: list[BridgeLinkOut]

# --- Sprint 2/3 additions (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md) ---
# Each Sprint 2/3 task (H1-H8) may extend these with its own request/response shapes as needed;
# these are the shared shapes for the H0 scaffolding pass only.

class CampaignOut(BaseModel):
    id: str
    hubAddress: str
    chain: str
    caseIds: list[str]
    totalAmountINR: float

class FlaggedWalletOut(BaseModel):
    address: str
    chain: str
    riskScore: float
    caseIds: list[str]
    flaggedAt: datetime
    broadcastStatus: dict

class VaspSubscriberIn(BaseModel):
    name: str
    webhookUrl: str

class FreezeCheckOut(BaseModel):
    walletAddress: str
    chain: str
    isBlacklisted: bool
    unfrozenBalance: float
    checkedAt: datetime
    goldenHourMinutesRemaining: float | None
    dataUnavailable: bool

class SanctionsMatchOut(BaseModel):
    walletAddress: str
    chain: str
    listSource: str
    matchedAt: datetime
    listVersion: str

class EvidencePackOut(BaseModel):
    caseId: str
    packHash: str
    manifestEntries: list[dict]
    createdAt: datetime

class AuditLogEntryOut(BaseModel):
    actor: str
    action: str
    objectType: str
    objectId: str
    hash: str
    createdAt: datetime

class AuditVerifyOut(BaseModel):
    valid: bool
    brokenAtEntryId: int | None
    checkedEntries: int
