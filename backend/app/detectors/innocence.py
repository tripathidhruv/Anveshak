from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from app.chains.base import Transfer

LONG_HISTORY_DAYS = 180
LONG_HISTORY_MIN_COUNTERPARTIES = 20
NEGLIGIBLE_FRACTION_THRESHOLD = 0.05

@dataclass(frozen=True)
class InnocenceFactor:
    check: str
    description: str
    supports_innocence: bool
    weight: float

@dataclass(frozen=True)
class InnocenceResult:
    innocence_score: float  # 0..1
    factors: list[InnocenceFactor]

def compute_innocence(wallet_address: str, all_transfers: list[Transfer], incident_at: datetime,
                       victim_amount: Decimal) -> InnocenceResult:
    """The exculpatory counterpart to the risk score. Every KAIZEN risk factor accuses;
    this is the only check that can say 'not this one' -- same gating logic the deposit
    detector needs anyway (distinct payers, counter-flow, known-contract checks), surfaced
    as a first-class output instead of buried as an internal guard. Every wallet gets both
    a risk score and an innocence score; when innocence is high the notice-drafting flow
    refuses to fire (wired in the API layer, Task 11).

    Every InnocenceFactor.description below is written in plain English a non-technical
    reader can follow -- no engineering jargon like 'counterparties', 'commingled', or
    'throughput'. See test_innocence.py's jargon-regression guard."""
    factors: list[InnocenceFactor] = []

    incoming = [t for t in all_transfers if t.to_address == wallet_address]
    outgoing = [t for t in all_transfers if t.from_address == wallet_address]
    counterparties = {t.from_address for t in incoming} | {t.to_address for t in outgoing}
    counterparties.discard(wallet_address)

    long_history = any(t.timestamp <= incident_at - timedelta(days=LONG_HISTORY_DAYS) for t in all_transfers)
    many_counterparties = len(counterparties) >= LONG_HISTORY_MIN_COUNTERPARTIES
    if long_history and many_counterparties:
        factors.append(InnocenceFactor(
            "long_history_many_counterparties",
            f"{len(counterparties)} different people have sent money to or received money from "
            f"this wallet over more than {LONG_HISTORY_DAYS} days. That looks like a wallet that "
            "was already doing regular business with lots of different people, not one that was "
            "freshly made for this scam.",
            True, 0.35,
        ))

    counter_flow = any(
        t.from_address == wallet_address and t.to_address in {i.from_address for i in incoming}
        and t.timestamp > incident_at
        for t in outgoing
    )
    if counter_flow:
        factors.append(InnocenceFactor(
            "counter_flow_to_payer",
            "Some of the money was sent back to the same person who sent it here. That's what "
            "happens in a normal deal or trade, not what happens when someone steals money and "
            "keeps it.",
            True, 0.25,
        ))

    total_throughput = sum((t.amount for t in incoming), Decimal("0"))
    if total_throughput > 0 and (victim_amount / total_throughput) < Decimal(str(NEGLIGIBLE_FRACTION_THRESHOLD)):
        factors.append(InnocenceFactor(
            "negligible_fraction_of_throughput",
            f"The victim's {victim_amount} is less than {NEGLIGIBLE_FRACTION_THRESHOLD:.0%} of "
            "all the money that has ever come into this wallet. In other words, the victim's "
            "money is just mixed in with a lot of other people's money, not money that was "
            "specifically aimed at this wallet.",
            True, 0.2,
        ))

    pre_existing = any(t.timestamp < incident_at - timedelta(days=1) for t in all_transfers)
    if not pre_existing:
        factors.append(InnocenceFactor(
            "no_pre_incident_history",
            "We found no activity for this wallet from before the date of the incident. That "
            "fits a wallet that was set up just for this scam.",
            False, 0.2,
        ))

    if not factors:
        score = 0.1
    else:
        supporting = [f for f in factors if f.supports_innocence]
        score = min(1.0, sum(f.weight for f in supporting)) if supporting else 0.1

    return InnocenceResult(innocence_score=round(score, 2), factors=factors)
