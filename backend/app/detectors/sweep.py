from dataclasses import dataclass
from decimal import Decimal
from app.chains.base import Transfer

@dataclass(frozen=True)
class SweepSignal:
    is_sweep: bool
    gap_seconds: float | None
    value_preserved_pct: float | None

SWEEP_MAX_GAP_SECONDS = 300       # funds leave within 5 minutes
SWEEP_MIN_VALUE_PRESERVED = 0.95  # ~99% value preserved per the sweep-signature thesis; 95% floor for fee slack

def detect_sweep(wallet_address: str, incoming: list[Transfer], outgoing: list[Transfer]) -> SweepSignal:
    """KAIZEN's core behavioural fingerprint: stolen funds leave a receiving wallet within
    seconds with ~99% of value preserved — a pattern automation produces, humans don't.
    Needs no labelled training data (see CLAUDE.md 'Why it works')."""
    if not incoming or not outgoing:
        return SweepSignal(is_sweep=False, gap_seconds=None, value_preserved_pct=None)

    first_in = min(incoming, key=lambda t: t.timestamp)
    next_out = min((t for t in outgoing if t.timestamp >= first_in.timestamp),
                    key=lambda t: t.timestamp, default=None)
    if next_out is None:
        return SweepSignal(is_sweep=False, gap_seconds=None, value_preserved_pct=None)

    gap = (next_out.timestamp - first_in.timestamp).total_seconds()
    preserved = float(next_out.amount / first_in.amount) if first_in.amount > Decimal("0") else 0.0
    is_sweep = gap <= SWEEP_MAX_GAP_SECONDS and preserved >= SWEEP_MIN_VALUE_PRESERVED
    return SweepSignal(is_sweep=is_sweep, gap_seconds=gap, value_preserved_pct=preserved)
