from dataclasses import dataclass
from decimal import Decimal
from app.chains.base import Transfer

@dataclass(frozen=True)
class BridgeLinkCandidate:
    side_a_tx_hash: str
    side_a_chain: str
    side_b_tx_hash: str
    side_b_chain: str
    amount_delta_pct: float
    time_delta_seconds: float
    confidence: float

def find_bridge_links(side_a_candidates: list[Transfer], side_b_candidates: list[Transfer],
                       amount_tolerance_pct: float = 0.03, time_window_minutes: int = 60) -> list[BridgeLinkCandidate]:
    """Cross-chain linking is unbuilt by every rival reviewed (docs/superpowers/specs/
    2026-09-25-backend-v2-competitive-design.md #10) -- this is a heuristic correlation, not a
    ground-truth link (a bridge doesn't publish a 1:1 tx mapping). For each side-A deposit into
    a bridge contract, find the closest-in-time side-B withdrawal whose amount is within
    tolerance (bridges take a small fee, so side B is expected to be slightly less than side A),
    inside the time window. Confidence trades off amount closeness and time closeness; this is
    explicitly an investigative lead, never presented as proof (matches SCOPE.md's stated
    'cross-chain uncertainty' limitation)."""
    links: list[BridgeLinkCandidate] = []
    window_seconds = time_window_minutes * 60

    for a in side_a_candidates:
        if a.amount == 0:
            continue
        candidates = []
        # A tiny epsilon absorbs float/Decimal rounding noise right at equality; it must not be
        # large enough to let a genuinely-higher side-B amount slip through as a "fee".
        equality_epsilon = a.amount * Decimal("1e-9")
        for b in side_b_candidates:
            if b.chain == a.chain or b.tx_hash == a.tx_hash:
                continue  # never match a transfer to itself, or to another transfer on the same
                          # chain -- a bridge link is by definition cross-chain
            if b.timestamp < a.timestamp:
                continue
            time_delta = (b.timestamp - a.timestamp).total_seconds()
            if time_delta > window_seconds:
                continue
            if b.amount - a.amount > equality_epsilon:
                continue  # a bridge withdrawal can't exceed the deposit that funded it
            amount_delta_pct = float((a.amount - b.amount) / a.amount)
            if amount_delta_pct > amount_tolerance_pct:
                continue
            candidates.append((b, amount_delta_pct, time_delta))

        if not candidates:
            continue

        best_b, amount_delta_pct, time_delta = min(candidates, key=lambda c: c[2])
        time_confidence = max(0.0, 1 - (time_delta / window_seconds))
        amount_confidence = max(0.0, 1 - (amount_delta_pct / amount_tolerance_pct))
        confidence = round((time_confidence + amount_confidence) / 2, 2)

        links.append(BridgeLinkCandidate(
            side_a_tx_hash=a.tx_hash, side_a_chain=a.chain,
            side_b_tx_hash=best_b.tx_hash, side_b_chain=best_b.chain,
            amount_delta_pct=round(amount_delta_pct, 4), time_delta_seconds=time_delta,
            confidence=confidence,
        ))

    return links
