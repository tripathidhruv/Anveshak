from decimal import Decimal
from app.tracing.conservation import check_conservation

def test_reconciled_when_within_tolerance():
    report = check_conservation(incoming_total=Decimal("150.0"), outgoing_total=Decimal("148.5"),
                                 fees=Decimal("1.5"))
    assert report.reconciled is True
    assert report.remainder == Decimal("0")

def test_not_reconciled_when_value_unaccounted():
    # double-counted Route A + B totals bug (docs/TASKS.md P2) is exactly this shape:
    # incoming doesn't match outgoing+fees, and the invariant must say so, not render silently.
    report = check_conservation(incoming_total=Decimal("150.0"), outgoing_total=Decimal("148.5"),
                                 fees=Decimal("0"))
    assert report.reconciled is False
    assert report.remainder == Decimal("1.5")
