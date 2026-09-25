from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    ncrp: Mapped[str] = mapped_column(String)
    complainant: Mapped[str] = mapped_column(String)
    location: Mapped[str] = mapped_column(String)
    phone: Mapped[str] = mapped_column(String)
    incident_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    fraud_type: Mapped[str] = mapped_column(String)
    amount_inr: Mapped[float] = mapped_column(Float)
    amount_crypto: Mapped[float] = mapped_column(Float)
    asset: Mapped[str] = mapped_column(String)
    chain: Mapped[str] = mapped_column(String)
    suspect_wallet: Mapped[str] = mapped_column(String)

class Wallet(Base):
    __tablename__ = "wallets"
    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String, index=True)
    chain: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="at_rest")  # at_rest|moving_unattributed|unreadable|at_exchange

class Hop(Base):
    __tablename__ = "hops"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    route_label: Mapped[str] = mapped_column(String)  # "routeA" | "routeB" | ...
    hop_index: Mapped[int] = mapped_column()
    wallet_address: Mapped[str] = mapped_column(String)
    chain: Mapped[str] = mapped_column(String)
    tx_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    stop_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    flag: Mapped[str | None] = mapped_column(String, nullable=True)

class AttributionCandidate(Base):
    __tablename__ = "attribution_candidates"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    wallet_address: Mapped[str] = mapped_column(String)
    chain: Mapped[str] = mapped_column(String)
    gate_passed: Mapped[bool] = mapped_column(Boolean)
    gate_breakdown: Mapped[dict] = mapped_column(JSON)
    entity_name: Mapped[str | None] = mapped_column(String, nullable=True)
    reasoning: Mapped[str] = mapped_column(Text)
    limitations: Mapped[str] = mapped_column(Text)

class VaspLabel(Base):
    __tablename__ = "vasp_labels"
    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String, index=True)
    chain: Mapped[str] = mapped_column(String)
    entity_name: Mapped[str] = mapped_column(String)
    source_url: Mapped[str] = mapped_column(String)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    vetting_status: Mapped[str] = mapped_column(String, default="unvetted")

class BridgeLink(Base):
    __tablename__ = "bridge_links"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    side_a_chain: Mapped[str] = mapped_column(String)
    side_a_tx_hash: Mapped[str] = mapped_column(String)
    side_b_chain: Mapped[str] = mapped_column(String)
    side_b_tx_hash: Mapped[str] = mapped_column(String)
    bridge_name: Mapped[str] = mapped_column(String)
    amount_delta_pct: Mapped[float] = mapped_column(Float)
    time_delta_seconds: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)

class UnreportedVictim(Base):
    __tablename__ = "unreported_victims"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    payer_address: Mapped[str] = mapped_column(String)
    chain: Mapped[str] = mapped_column(String)
    total_amount: Mapped[float] = mapped_column(Float)
    transfer_count: Mapped[int] = mapped_column()
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
