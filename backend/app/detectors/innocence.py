from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from app.chains.base import Transfer
from app.bridge.registry import is_bridge_contract
from app.mixers.registry import is_mixer_contract

LONG_HISTORY_DAYS = 180
LONG_HISTORY_MIN_COUNTERPARTIES = 20
NEGLIGIBLE_FRACTION_THRESHOLD = 0.05

# Known-infrastructure gap (this file's own docstring, "no known infrastructure contract
# factor"): a real bridge or mixer contract is not merely "probably not" a person's
# fraud-collection wallet, it is definitely not one -- these are shared, publicly-verified
# protocol contracts (see app/bridge/registry.py and app/mixers/registry.py's own
# verification notes) that huge numbers of unrelated people's transactions pass through by
# construction. That is categorically stronger evidence than any of the four behavioural
# factors below (the strongest of which, long_history_many_counterparties, is only 0.55),
# so this factor alone clears the score to 1.0 rather than merely contributing toward it --
# matching the "HIGH weight" the task brief calls for.
KNOWN_INFRASTRUCTURE_WEIGHT = 1.0

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
                       victim_amount: Decimal, asset: str,
                       history_unavailable: bool = False, chain: str | None = None) -> InnocenceResult:
    """The exculpatory counterpart to the risk score. Every ANVESHAK risk factor accuses;
    this is the only check that can say 'not this one' -- same gating logic the deposit
    detector needs anyway (distinct payers, counter-flow, known-contract checks), surfaced
    as a first-class output instead of buried as an internal guard. Every wallet gets both
    a risk score and an innocence score; a high innocence score gates the notice-drafting
    flow (see app/api/v1/legal.py's create_notice, and Case.innocence_score in models.py).

    Every InnocenceFactor.description below is written in plain English a non-technical
    reader can follow -- no engineering jargon like 'counterparties', 'commingled', or
    'throughput'. See test_innocence.py's jargon-regression guard.

    `history_unavailable` (Task G3, I-B): the caller couldn't actually read this wallet's
    transaction history (a chain-API failure), so `all_transfers` is an empty stand-in, not
    a genuine "we checked and found nothing". An empty list is otherwise indistinguishable
    from real, checked history, and would make `no_pre_incident_history` fire as if "no
    activity before the incident" were a confirmed fact -- so that factor is skipped, and an
    honest "we couldn't check" factor is reported instead. Defaults to False so every
    existing caller/test that passes real (possibly genuinely empty) history is unaffected.

    `chain` (known-infrastructure factor, this file's own previously-documented gap): when
    given, `wallet_address` is checked against the same real, verified bridge/mixer
    registries app/api/v1/traces.py already consults for the exact same reason (a rival
    team's tool mistaking a Uniswap-router-style contract for a suspect's personal wallet is
    the named real-world failure mode this closes). Optional and defaults to None so every
    existing caller/test that has no chain to check against (or is testing wallet addresses
    that were never meant to resemble a real registry entry) is unaffected -- the check is
    simply skipped, not evaluated as a false 'no match'."""
    factors: list[InnocenceFactor] = []

    if chain is not None:
        bridge = is_bridge_contract(wallet_address, chain)
        mixer = is_mixer_contract(wallet_address, chain)
        infra = bridge or mixer
        if infra is not None:
            kind = "cross-chain bridge" if bridge is not None else "cryptocurrency mixing"
            factors.append(InnocenceFactor(
                "known_infrastructure_contract",
                f"This address is not a personal wallet at all -- it's {infra.name}, a piece of "
                f"automated software (what's called a 'smart contract') that runs a public "
                f"{kind} service used automatically by huge numbers of unrelated people. Software "
                "like this cannot be a scammer's personal collection wallet, because it wasn't "
                "created by, and isn't controlled by, any single person -- it's shared "
                "infrastructure that anyone's transactions can pass through.",
                True, KNOWN_INFRASTRUCTURE_WEIGHT,
            ))

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
            True, 0.55,
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
            f"The victim's {victim_amount} {asset} is less than {NEGLIGIBLE_FRACTION_THRESHOLD:.0%} of "
            "all the money that has ever come into this wallet. In other words, the victim's "
            "money is just mixed in with a lot of other people's money, not money that was "
            "specifically aimed at this wallet.",
            True, 0.2,
        ))

    if history_unavailable:
        factors.append(InnocenceFactor(
            "history_unavailable",
            "We could not check this wallet's transaction history from before the incident "
            "right now, so we can't say whether it's a wallet set up just for this scam or one "
            "with a longer track record.",
            False, 0.0,
        ))
    else:
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
