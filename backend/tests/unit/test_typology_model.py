import pytest

from app.typology.model import (
    CLASSES, DISCLAIMER, INDICATOR_IDS, band_for, score_typology,
)

DEMO_SIGNALS = {
    "sweep_signature": 1, "consolidation": 1, "fresh_wallet": 0.9, "victim_complaints": 1,
    "fast_cashout": 0.8, "round_usd_inbound": 0.2, "new_payer_wallets": 0.4, "mixer_exposure": 0.4,
    "many_small_purchases": 0.1, "donation_pattern": 0.1, "cross_border_stablecoin": 0.7,
    "bridge_hop": 1, "mixer_entry": 1, "peel_chain": 0.6, "structuring": 0.2,
}


def test_class_ids_and_weights_sum_to_one():
    assert [c.id for c in CLASSES] == ["scam", "ransomware", "darknet", "terror_financing", "laundering"]
    for c in CLASSES:
        assert sum(i.weight for i in c.indicators) == pytest.approx(1.0)
        for i in c.indicators:
            assert i.plain and i.tech
    assert len(INDICATOR_IDS) == 22


def test_demo_fixture_scores_bands_and_order():
    result = score_typology(DEMO_SIGNALS)
    scores = {c.id: c.score for c in result.classes}
    assert scores == {"scam": 0.965, "laundering": 0.65, "ransomware": 0.12,
                      "darknet": 0.095, "terror_financing": 0.095}
    assert result.primary == "scam"
    # Sorted desc; the darknet/terror tie keeps list order.
    assert [c.id for c in result.classes] == ["scam", "laundering", "ransomware", "darknet", "terror_financing"]
    bands = {c.id: c.band for c in result.classes}
    assert bands == {"scam": "strong", "laundering": "present", "ransomware": "not_indicated",
                     "darknet": "not_indicated", "terror_financing": "not_indicated"}
    assert result.signals_used == 15
    assert result.disclaimer == DISCLAIMER


def test_every_contribution_is_weight_times_value():
    result = score_typology(DEMO_SIGNALS)
    scam = next(c for c in result.classes if c.id == "scam")
    fresh = next(i for i in scam.indicators if i.id == "fresh_wallet")
    assert (fresh.weight, fresh.value, fresh.contribution) == (0.15, 0.9, 0.135)
    for c in result.classes:
        assert [i.id for i in c.indicators] == [i.id for i in next(k for k in CLASSES if k.id == c.id).indicators]


def test_missing_signals_default_to_zero_and_empty_gives_first_class_primary():
    result = score_typology({})
    assert all(c.score == 0 for c in result.classes)
    assert result.primary == "scam"
    assert result.signals_used == 0
    assert all(c.band == "not_indicated" for c in result.classes)


def test_unknown_indicator_rejected():
    with pytest.raises(ValueError, match="unknown"):
        score_typology({"not_a_signal": 0.5})


@pytest.mark.parametrize("bad", [-0.01, 1.01, float("nan")])
def test_out_of_range_rejected(bad):
    with pytest.raises(ValueError):
        score_typology({"bridge_hop": bad})


def test_tie_breaks_by_list_order():
    # ransomware_list_match (0.40) vs ... use equal scores in two classes.
    result = score_typology({"ransomware_list_match": 1.0, "sanctions_proximity": 0.0,
                             "market_exposure": 0.0, "bridge_hop": 1.0, "mixer_entry": 0.6})
    # ransomware 0.40, laundering 0.25+0.15 = 0.40 -> ransomware listed first.
    assert result.primary == "ransomware"
    assert [c.id for c in result.classes][:2] == ["ransomware", "laundering"]


@pytest.mark.parametrize("score,band", [(0.70, "strong"), (0.69, "present"), (0.40, "present"),
                                        (0.399, "not_indicated"), (1.0, "strong"), (0.0, "not_indicated")])
def test_bands(score, band):
    assert band_for(score) == band
