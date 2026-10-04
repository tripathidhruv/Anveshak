from datetime import datetime, timedelta, timezone

from app.models import Case, Hop, MemoryEvent
from app.typology.model import INDICATOR_IDS
from app.typology.signals import derive_signals, victim_complaints_value

T0 = datetime(2026, 9, 2, 14, 12, tzinfo=timezone.utc)
SUSPECT = "TDemoSuspectWallet000000000000001"


def _case(db, case_id="C-1", chain="tron", asset="USDT-TRC20", wallet=SUSPECT):
    c = Case(id=case_id, ncrp="N", complainant="Synthetic", location="Jaipur", phone="x",
             incident_at=T0, fraud_type="task_job", amount_inr=1.0, amount_crypto=1000.0,
             asset=asset, chain=chain, suspect_wallet=wallet)
    db.add(c)
    db.commit()
    return c


def _hops(db, case_id, rows, route="routeA"):
    """rows: (wallet, amount, seconds_after_T0, stop_reason, flag)."""
    for i, (w, amt, secs, stop, flag) in enumerate(rows):
        db.add(Hop(case_id=case_id, route_label=route, hop_index=i, wallet_address=w, chain="tron",
                   amount=amt, at=T0 + timedelta(seconds=secs), stop_reason=stop, flag=flag))
    db.commit()


def _get(db, case_id):
    case = db.get(Case, case_id)
    hops = db.query(Hop).filter(Hop.case_id == case_id).all()
    return derive_signals(db, case, hops)


def test_returns_every_indicator_in_range(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("W1", 400, 3600 * 5, None, None)])
    s = _get(db_session, "C-1")
    assert set(s) == INDICATOR_IDS
    assert all(0.0 <= v <= 1.0 for v in s.values())
    # A plain, slow, value-losing hop shows nothing but the stablecoin asset (no exchange -> 0).
    assert all(v == 0 for v in s.values())


def test_sweep_signature_fast_and_value_preserving(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("W1", 995, 40, None, None)])
    assert _get(db_session, "C-1")["sweep_signature"] == 1.0


def test_sweep_needs_both_speed_and_value(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("W1", 995, 120, None, None),
                              ("W2", 900, 130, None, None)])
    assert _get(db_session, "C-1")["sweep_signature"] == 0.0


def test_consolidation_from_hub_flag(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("W1", 990, 30, None, "HUB")])
    assert _get(db_session, "C-1")["consolidation"] == 1.0


def test_consolidation_from_five_distinct_senders_across_cases(db_session):
    for n in range(5):
        _case(db_session, case_id=f"C-{n}", wallet=f"S{n}")
        _hops(db_session, f"C-{n}", [(f"S{n}", 1000, 0, None, None), ("POOL", 990, 30, None, None)])
    assert _get(db_session, "C-0")["consolidation"] == 1.0


def test_four_senders_is_not_consolidation(db_session):
    for n in range(4):
        _case(db_session, case_id=f"C-{n}", wallet=f"S{n}")
        _hops(db_session, f"C-{n}", [(f"S{n}", 1000, 0, None, None), ("POOL", 990, 30, None, None)])
    assert _get(db_session, "C-0")["consolidation"] == 0.0


def test_fast_cashout_and_cross_border_stablecoin(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None),
                              ("EX", 990, 50 * 60, None, "Meridian Digital Exchange deposit")])
    s = _get(db_session, "C-1")
    assert s["fast_cashout"] == 1.0
    assert s["cross_border_stablecoin"] == 1.0


def test_slow_cashout_is_zero(db_session):
    _case(db_session, asset="ETH")
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("EX", 990, 61 * 60, "at_exchange", None)])
    s = _get(db_session, "C-1")
    assert s["fast_cashout"] == 0.0
    assert s["cross_border_stablecoin"] == 0.0


def test_btc_bridge_mixer(db_session):
    _case(db_session, chain="bitcoin", asset="BTC")
    _hops(db_session, "C-1", [("W0", 1, 0, None, None), ("W1", 0.9, 9000, "bridge_crossing_unconfirmed", None)],
          route="routeA")
    _hops(db_session, "C-1", [("M0", 1, 0, None, None), ("M1", 0.9, 9000, "entered_mixer", None)], route="routeB")
    s = _get(db_session, "C-1")
    assert s["btc_payments"] == 1.0
    assert s["bridge_hop"] == 1.0
    assert s["mixer_entry"] == 1.0


def test_peel_chain_three_consecutive_small_losses(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("W1", 950, 9000, None, None),
                              ("W2", 900, 18000, None, None), ("W3", 860, 27000, None, None)])
    assert _get(db_session, "C-1")["peel_chain"] == 1.0


def test_two_peels_is_not_a_peel_chain(db_session):
    _case(db_session)
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None), ("W1", 950, 9000, None, None),
                              ("W2", 900, 18000, None, None), ("W3", 500, 27000, None, None)])
    assert _get(db_session, "C-1")["peel_chain"] == 0.0


def test_victim_complaints_scale():
    assert [victim_complaints_value(n) for n in (0, 1, 2, 3, 7)] == [0.0, 0.5, 0.75, 1.0, 1.0]


def test_victim_complaints_from_memory_and_other_cases(db_session):
    _case(db_session)
    _case(db_session, case_id="C-2")  # same suspect wallet
    _hops(db_session, "C-1", [("W0", 1000, 0, None, None)])
    db_session.add_all([
        MemoryEvent(address=SUSPECT, case_id="C-3", unit="Cyber PS", event="linked"),
        MemoryEvent(address=SUSPECT, case_id="C-3", unit="Cyber PS", event="submitted"),  # dup case
        MemoryEvent(address=SUSPECT, case_id="C-1", unit="Cyber PS", event="submitted"),  # self
    ])
    db_session.commit()
    assert _get(db_session, "C-1")["victim_complaints"] == 0.75  # C-2 + C-3
