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
    bridgeLinks: list[BridgeLinkOut]
