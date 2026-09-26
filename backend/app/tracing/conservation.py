from dataclasses import dataclass
from decimal import Decimal

@dataclass(frozen=True)
class ConservationReport:
    incoming_total: Decimal
    outgoing_total: Decimal
    fees: Decimal
    remainder: Decimal
    reconciled: bool
    data_unavailable: bool = False

def check_conservation(incoming_total: Decimal, outgoing_total: Decimal, fees: Decimal,
                        tolerance: Decimal = Decimal("0.01"),
                        data_unavailable: bool = False) -> ConservationReport:
    """in == out + fees + remainder. If |remainder| exceeds tolerance, the trace is
    telling us value is unaccounted for and the UI/evidence pack must say so, per
    docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md.

    Task G3 (I-B): `data_unavailable` signals that the caller already excluded a
    read-failed terminal hop's taint from `outgoing_total` -- a chain-API read failure is
    not the same fact as "this trace's money genuinely stopped moving here", so this case
    must never be reported as `reconciled: True` even if the arithmetic happens to balance
    (e.g. because the unread hop's taint was the only unaccounted-for value)."""
    remainder = incoming_total - (outgoing_total + fees)
    reconciled = (abs(remainder) <= tolerance) and not data_unavailable
    return ConservationReport(incoming_total, outgoing_total, fees,
                               remainder if not reconciled else Decimal("0"), reconciled,
                               data_unavailable)
