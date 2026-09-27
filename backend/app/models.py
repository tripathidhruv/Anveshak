from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, JSON, Text, UniqueConstraint
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
    # Innocence-score persistence (this task): exactly one innocence score per case, computed
    # fresh on every `POST /{case_id}/trace` (app/api/v1/traces.py's run_trace) and now written
    # here so a LATER, separate request -- app/api/v1/legal.py's create_notice -- can gate
    # notice-drafting on it without re-running a trace. Added directly to `Case` rather than as
    # a new table: unlike Hop/AttributionCandidate (one-to-many, a list per case), there is
    # never more than one innocence score per case, so a separate table would only ever hold a
    # single row per case_id -- pure overhead (a join, an extra idempotency-delete step) for no
    # relational benefit. `innocence_factors` mirrors AttributionCandidate.gate_breakdown's
    # existing JSON-column pattern for the same reason: a small, case-specific, non-relational
    # blob that's only ever read back whole, never queried by its contents.
    innocence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    innocence_factors: Mapped[list | None] = mapped_column(JSON, nullable=True)

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

# --- Sprint 2/3 additions (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md) ---

class FlaggedWallet(Base):
    __tablename__ = "flagged_wallets"
    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String, index=True)
    chain: Mapped[str] = mapped_column(String)
    risk_score: Mapped[float] = mapped_column(Float)
    case_ids: Mapped[list] = mapped_column(JSON)  # list[str] of Case.id
    flagged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    broadcast_status: Mapped[dict] = mapped_column(JSON, default=dict)  # {subscriber_id: "delivered"|"failed"|"pending"}

class VaspSubscriber(Base):
    __tablename__ = "vasp_subscribers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String)
    # Nullable (Task: VASP wallet-sharing portal, docs/superpowers/specs/2026-09-27-auth-and-
    # vasp-portal-design.md Feature 2): a portal-only subscriber (shared the /vasp-portal link
    # instead of a push webhook) has nothing to POST deliveries to. distribution.py's
    # deliver_webhooks skips any subscriber with no webhook_url rather than posting to None.
    webhook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    api_key: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Same task: portal-only subscribers may have no push delivery but still want the officer
    # who registered them to know who to follow up with.
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    # The opaque bearer of `GET/POST /api/v1/vasp-feed/portal/{access_token}` -- this token
    # itself IS the auth for external exchanges (no login flow for them at all, per the spec).
    # Generated server-side at creation time (secrets.token_urlsafe(32) in vasp_feed.py),
    # never supplied by the caller, unique+indexed so a lookup by token is a plain equality
    # query (never a prefix/fuzzy match that could leak how "close" a guessed token is).
    access_token: Mapped[str] = mapped_column(String, unique=True, index=True)


class VaspWalletReply(Base):
    """A reply an external exchange (identified only by their own `VaspSubscriber.access_token`)
    left on one `FlaggedWallet` via the public portal. Never visible to any other subscriber's
    own portal token -- only surfaced in bulk to KAIZEN officers via
    `GET /api/v1/vasp-feed/replies` (gated behind `get_current_officer`)."""
    __tablename__ = "vasp_wallet_replies"
    id: Mapped[int] = mapped_column(primary_key=True)
    subscriber_id: Mapped[int] = mapped_column(ForeignKey("vasp_subscribers.id"))
    flagged_wallet_id: Mapped[int] = mapped_column(ForeignKey("flagged_wallets.id"))
    message: Mapped[str] = mapped_column(Text)
    replied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class FreezeCheck(Base):
    __tablename__ = "freeze_checks"
    id: Mapped[int] = mapped_column(primary_key=True)
    wallet_address: Mapped[str] = mapped_column(String, index=True)
    chain: Mapped[str] = mapped_column(String)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean)
    unfrozen_balance: Mapped[float] = mapped_column(Float)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    golden_hour_minutes_remaining: Mapped[float | None] = mapped_column(Float, nullable=True)

class SanctionsMatch(Base):
    __tablename__ = "sanctions_matches"
    id: Mapped[int] = mapped_column(primary_key=True)
    wallet_address: Mapped[str] = mapped_column(String, index=True)
    chain: Mapped[str] = mapped_column(String)
    list_source: Mapped[str] = mapped_column(String)
    matched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    list_version: Mapped[str] = mapped_column(String)

class EvidenceManifest(Base):
    __tablename__ = "evidence_manifests"
    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"))
    entries: Mapped[list] = mapped_column(JSON)  # list[{source_url, raw_response_hash, fetched_at}]
    pack_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

# --- Task A, inverted deposit index (docs/superpowers/specs/2026-09-27-inverted-deposit-
# index-design.md) ---

class DepositIndexEntry(Base):
    """One backward-crawled deposit address that has been observed sending funds directly
    into a vetted hot wallet (`hot_wallet_address`/`entity_name`), built offline by
    `backend/scripts/build_deposit_index.py`. Unlike BridgeLink/FreezeCheck/etc (per-trace,
    per-case computed data), this is genuinely new, queryable, persistent reference data --
    a real schema addition, not a per-hop computed value (see the design doc's own note on
    why this differs from bridge-linking, which specifically avoided one). Looked up via
    app.index.deposit_index.lookup_indexed_deposit(), a pure DB query mirroring
    app.bridge.registry.is_bridge_contract / app.mixers.registry.is_mixer_contract in style.

    A single depositor address can genuinely feed MULTIPLE different vetted hot wallets (e.g.
    it is a customer of both Kraken and Coinbase) -- that is not a duplicate, it is two real,
    distinct deposit relationships, so the row identity is `(chain, address, hot_wallet_address)`,
    not `(chain, address)`. `lookup_indexed_deposit` therefore returns a list, not a single
    row/None -- see its own docstring for why silently collapsing to "the" one match would be
    misleading (CLAUDE.md rule 4, "nothing is a black box")."""
    __tablename__ = "deposit_index_entries"
    __table_args__ = (
        UniqueConstraint(
            "chain", "address", "hot_wallet_address",
            name="uq_deposit_index_chain_address_hot_wallet",
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String, index=True)          # the depositor address
    chain: Mapped[str] = mapped_column(String)
    hot_wallet_address: Mapped[str] = mapped_column(String)            # the vetted hot wallet
                                                                        # this address paid into
    entity_name: Mapped[str] = mapped_column(String)                   # copied from the hot
                                                                        # wallet's own vetted label
    indexed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class UserRole(Base):
    __tablename__ = "user_roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    role: Mapped[str] = mapped_column(String)  # "officer" | "exchange" | "citizen"
    linked_subscriber_id: Mapped[int | None] = mapped_column(ForeignKey("vasp_subscribers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class AuditLogEntry(Base):
    __tablename__ = "audit_log_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    object_type: Mapped[str] = mapped_column(String)
    object_id: Mapped[str] = mapped_column(String)
    prev_hash: Mapped[str] = mapped_column(String)
    hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
