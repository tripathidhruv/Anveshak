from datetime import datetime, timedelta, timezone
from decimal import Decimal
from app.chains.base import Transfer
from app.bridge.linker import find_bridge_links

def mk(chain, from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain=chain, from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT", timestamp=ts, fee=Decimal("0"), raw={})

def test_links_matching_deposit_and_withdrawal_within_window_and_tolerance():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    side_a = [mk("tron", "scammer", "bridge_tron_side", 1000, t0, tx="a1")]
    side_b = [mk("ethereum", "bridge_eth_side", "hop_after_bridge", 995, t0 + timedelta(minutes=8), tx="b1")]
    links = find_bridge_links(side_a, side_b, amount_tolerance_pct=0.02, time_window_minutes=60)
    assert len(links) == 1
    assert links[0].side_a_tx_hash == "a1" and links[0].side_b_tx_hash == "b1"
    assert links[0].confidence > 0.5

def test_rejects_when_outside_time_window():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    side_a = [mk("tron", "scammer", "bridge_tron_side", 1000, t0, tx="a1")]
    side_b = [mk("ethereum", "bridge_eth_side", "hop_after_bridge", 995, t0 + timedelta(hours=5), tx="b1")]
    links = find_bridge_links(side_a, side_b, amount_tolerance_pct=0.02, time_window_minutes=60)
    assert links == []

def test_rejects_when_amount_correlation_too_weak():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    side_a = [mk("tron", "scammer", "bridge_tron_side", 1000, t0, tx="a1")]
    side_b = [mk("ethereum", "bridge_eth_side", "hop_after_bridge", 400, t0 + timedelta(minutes=8), tx="b1")]
    links = find_bridge_links(side_a, side_b, amount_tolerance_pct=0.02, time_window_minutes=60)
    assert links == []

def test_rejects_when_side_b_amount_is_higher_than_side_a():
    # A bridge withdrawal can't exceed the deposit that funded it (a bridge takes a fee, it
    # doesn't add money). 1005 is only 0.5% above 1000 -- well within a symmetric 2% tolerance --
    # so the old `abs(a - b) / a` check would have wrongly accepted this as a match.
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    side_a = [mk("tron", "scammer", "bridge_tron_side", 1000, t0, tx="a1")]
    side_b = [mk("ethereum", "bridge_eth_side", "hop_after_bridge", 1005, t0 + timedelta(minutes=8), tx="b1")]
    links = find_bridge_links(side_a, side_b, amount_tolerance_pct=0.02, time_window_minutes=60)
    assert links == []

def test_picks_closest_time_match_when_multiple_candidates():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    side_a = [mk("tron", "scammer", "bridge_tron_side", 1000, t0, tx="a1")]
    side_b = [
        mk("ethereum", "bridge_eth_side", "far", 995, t0 + timedelta(minutes=50), tx="b_far"),
        mk("ethereum", "bridge_eth_side", "near", 995, t0 + timedelta(minutes=8), tx="b_near"),
    ]
    links = find_bridge_links(side_a, side_b, amount_tolerance_pct=0.02, time_window_minutes=60)
    assert len(links) == 1
    assert links[0].side_b_tx_hash == "b_near"
