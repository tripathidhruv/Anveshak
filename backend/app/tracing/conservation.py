from dataclasses import dataclass
from decimal import Decimal

@dataclass(frozen=True)
class ConservationReport:
    incoming_total: Decimal
    outgoing_total: Decimal
    fees: Decimal
    remainder: Decimal
    reconciled: bool

def check_conservation(incoming_total: Decimal, outgoing_total: Decimal, fees: Decimal,
                        tolerance: Decimal = Decimal("0.01")) -> ConservationReport:
    """in == out + fees + remainder. If |remainder| exceeds tolerance, the trace is
    telling us value is unaccounted for and the UI/evidence pack must say so, per
    docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md."""
    remainder = incoming_total - (outgoing_total + fees)
    reconciled = abs(remainder) <= tolerance
    return ConservationReport(incoming_total, outgoing_total, fees,
                               remainder if not reconciled else Decimal("0"), reconciled)
