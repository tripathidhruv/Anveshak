"""Typology classes, their indicators, and the scoring arithmetic.

Why a hand-weighted linear sum and not a trained classifier: there is no labelled typology data
for Indian complaints (label scarcity is the binding constraint in this field -- see CLAUDE.md),
and a judge or officer must be able to re-do the sum on paper. Each class's weights add up to
1.0 and every signal is in [0, 1], so a class score reads directly as "how much of this class's
evidence is present". Weights are fixed by the product brief, not fitted.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Mapping

DISCLAIMER = (
    "Typology is an investigative indication from on-chain behaviour, not a finding that an "
    "offence occurred. Terror-financing is shown only as indicators and needs specialist review "
    "before any action."
)

# Band cut-offs. Scores are rounded to 3 dp before banding so float noise (0.6999999) never
# drops a class into the wrong band.
STRONG_AT = 0.70
PRESENT_AT = 0.40


@dataclass(frozen=True)
class Indicator:
    id: str
    plain: str   # the heading a non-crypto judge reads
    tech: str    # the small technical subtitle under it
    weight: float


@dataclass(frozen=True)
class TypologyClass:
    id: str
    name: str
    indicators: tuple[Indicator, ...]


# List order matters: it is the tie-break when two classes score the same, so the class ANVESHAK
# is built to catch (scam) wins ties, and the most sensitive one (terror financing) never wins a
# tie against a more ordinary explanation listed before it.
CLASSES: tuple[TypologyClass, ...] = (
    TypologyClass("scam", "Fraud / scam", (
        Indicator("sweep_signature", "Money left within seconds with ~99% kept",
                  "hold < 60 s, kept ≥ 99%", 0.30),
        Indicator("consolidation", "Many victims' money pooled in one wallet",
                  "hub wallet, ≥ 5 distinct senders", 0.25),
        Indicator("fresh_wallet", "Receiving wallet created hours before the scam",
                  "first activity shortly before the incident", 0.15),
        Indicator("victim_complaints", "Linked victim complaints",
                  "other cases naming the same wallet", 0.20),
        Indicator("fast_cashout", "Reached an exchange within the hour",
                  "exchange hop ≤ 60 min after first hop", 0.10),
    )),
    TypologyClass("ransomware", "Ransomware", (
        Indicator("round_usd_inbound", "Many one-off payments in round dollar amounts",
                  "inbound ≈ round USD values, single-use payers", 0.30),
        Indicator("new_payer_wallets", "Payers are brand-new wallets",
                  "payer first-seen ≈ payment time", 0.15),
        Indicator("btc_payments", "Paid in Bitcoin", "chain = bitcoin", 0.15),
        Indicator("ransomware_list_match", "Address on a public ransomware list",
                  "public ransomware address list match", 0.40),
    )),
    TypologyClass("darknet", "Darknet market activity", (
        Indicator("market_exposure", "Deposits into known darknet-market wallets",
                  "direct exposure to labelled market clusters", 0.45),
        Indicator("escrow_pattern", "Hold-and-release escrow timing",
                  "funds held for days, then released in batches", 0.20),
        Indicator("mixer_exposure", "Funds pass through a mixer",
                  "mixer counterparty in the flow", 0.20),
        Indicator("many_small_purchases", "Many small purchase-sized payments",
                  "high count of small inbound transfers", 0.15),
    )),
    TypologyClass("terror_financing", "Terror-financing indicators", (
        Indicator("sanctions_proximity", "Within 3 hops of a UN/OFAC terror-listed wallet",
                  "≤ 3 hops to a UN/OFAC-listed address", 0.45),
        Indicator("donation_pattern", "Many small donor-style payments",
                  "many small, unrelated inbound gifts", 0.25),
        Indicator("osint_mention", "Named in public reports",
                  "address cited in OSINT / public reporting", 0.20),
        Indicator("cross_border_stablecoin", "Stablecoin moved across borders",
                  "USDT reaching an exchange", 0.10),
    )),
    TypologyClass("laundering", "Layering / other suspicious patterns", (
        Indicator("bridge_hop", "Hopped to another blockchain", "cross-chain bridge used", 0.25),
        Indicator("mixer_entry", "Entered a mixer", "mixer contract deposit", 0.25),
        Indicator("peel_chain", "Peel chain (small amounts shaved off each hop)",
                  "≥ 3 consecutive hops each losing 1–10%", 0.20),
        Indicator("structuring", "Amounts kept just under reporting thresholds",
                  "repeated amounts just below a threshold", 0.15),
        Indicator("round_trip", "Money sent out and back (wash)",
                  "funds return to an origin wallet", 0.15),
    )),
)

INDICATOR_IDS: frozenset[str] = frozenset(i.id for c in CLASSES for i in c.indicators)


@dataclass(frozen=True)
class IndicatorScore:
    id: str
    plain: str
    tech: str
    weight: float
    value: float
    contribution: float


@dataclass(frozen=True)
class ClassScore:
    id: str
    name: str
    score: float
    band: str
    indicators: tuple[IndicatorScore, ...]


@dataclass(frozen=True)
class TypologyResult:
    primary: str
    classes: tuple[ClassScore, ...]
    disclaimer: str
    signals_used: int


def band_for(score: float) -> str:
    """Three bands rather than a bare number, because officers act on 'strong / present / not
    indicated' -- 0.68 vs 0.71 is false precision for a hand-weighted sum."""
    if score >= STRONG_AT:
        return "strong"
    if score >= PRESENT_AT:
        return "present"
    return "not_indicated"


def validate_signals(signals: Mapping[str, float]) -> dict[str, float]:
    """Rejects rather than silently clips bad input: an unknown id is almost always a typo that
    would otherwise score as 0 and quietly hide evidence, and a value outside [0, 1] means the
    caller derived it wrong. Missing ids default to 0 (no evidence) -- the conservative choice."""
    unknown = sorted(set(signals) - INDICATOR_IDS)
    if unknown:
        raise ValueError(f"unknown indicator id(s): {', '.join(unknown)}")
    clean: dict[str, float] = {}
    for key, raw in signals.items():
        value = float(raw)
        if math.isnan(value) or not 0.0 <= value <= 1.0:
            raise ValueError(f"indicator {key!r} must be between 0 and 1, got {raw!r}")
        clean[key] = value
    return clean


def score_typology(signals: Mapping[str, float]) -> TypologyResult:
    """score = Σ weight × signal per class, clipped to [0, 1]. Every indicator comes back with
    its own contribution so the UI can show the waterfall, not just the total (CLAUDE.md rule 4)."""
    clean = validate_signals(signals)
    scored: list[ClassScore] = []
    for cls in CLASSES:
        rows = tuple(
            IndicatorScore(ind.id, ind.plain, ind.tech, ind.weight, clean.get(ind.id, 0.0),
                           round(ind.weight * clean.get(ind.id, 0.0), 3))
            for ind in cls.indicators
        )
        raw = sum(ind.weight * clean.get(ind.id, 0.0) for ind in cls.indicators)
        total = round(min(1.0, max(0.0, raw)), 3)
        scored.append(ClassScore(cls.id, cls.name, total, band_for(total), rows))

    # sorted() is stable, so equal scores keep CLASSES order -- that IS the documented tie-break.
    ordered = tuple(sorted(scored, key=lambda c: -c.score))
    return TypologyResult(
        primary=ordered[0].id,
        classes=ordered,
        disclaimer=DISCLAIMER,
        signals_used=sum(1 for v in clean.values() if v > 0),
    )
