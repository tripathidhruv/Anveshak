# backend/tests/unit/test_sweep.py
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.detectors.sweep import detect_sweep

def mk(ts, amount=100, from_addr="a", to_addr="b"):
    return Transfer(tx_hash="tx", chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

def test_flags_sweep_when_funds_leave_within_seconds_with_value_preserved():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    incoming = [mk(t0, amount=150)]
    outgoing = [mk(t0 + timedelta(seconds=42), amount=148.5)]
    signal = detect_sweep("wallet", incoming, outgoing)
    assert signal.is_sweep is True
    assert signal.gap_seconds == 42
    assert signal.value_preserved_pct >= 0.95

def test_does_not_flag_when_funds_sit_for_days():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    incoming = [mk(t0, amount=150)]
    outgoing = [mk(t0 + timedelta(days=5), amount=148.5)]
    signal = detect_sweep("wallet", incoming, outgoing)
    assert signal.is_sweep is False

def test_does_not_flag_when_value_drops_significantly():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    incoming = [mk(t0, amount=150)]
    outgoing = [mk(t0 + timedelta(seconds=10), amount=60)]  # partial spend, not a sweep
    signal = detect_sweep("wallet", incoming, outgoing)
    assert signal.is_sweep is False

# I9 (ceiling): an unbounded value_preserved_pct would let "received 1, forwarded 1000
# shortly after" count as a sweep, since it only checked a floor. The wallet clearly combined
# this deposit with other funds before forwarding -- that is not "sweeping this deposit."
def test_does_not_flag_when_forwarded_amount_is_far_more_than_received():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    incoming = [mk(t0, amount=1)]
    outgoing = [mk(t0 + timedelta(seconds=5), amount=1000)]  # gap and floor both look fine
    signal = detect_sweep("wallet", incoming, outgoing)
    assert signal.is_sweep is False

def test_still_flags_a_small_fee_inclusive_overage_within_the_ceiling():
    # A tiny amount over 100% (e.g. the outgoing tx nets slightly more due to rounding/fee
    # accounting) must still count as a genuine sweep -- the ceiling guards against combining
    # with OTHER funds, not against small preserved-value noise right around 100%.
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    incoming = [mk(t0, amount=150)]
    outgoing = [mk(t0 + timedelta(seconds=5), amount=151.5)]  # 101% preserved
    signal = detect_sweep("wallet", incoming, outgoing)
    assert signal.is_sweep is True
