from datetime import datetime, timezone
from types import SimpleNamespace

from app.legal import notice_fsm
from app.legal.sahyog_payload import DATA_SHAPE_DISCLAIMER, build_sahyog_payload


def _fake_case():
    return SimpleNamespace(
        id="C1", ncrp="NCRP-1", location="Delhi", fraud_type="investment_scam",
        incident_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        reported_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        amount_inr=150000.0, amount_crypto=150.0, asset="USDT-TRC20", chain="tron",
    )


def _fake_attribution():
    return SimpleNamespace(
        wallet_address="TWalletXYZ", chain="tron", gate_passed=True,
        entity_name="Meridian Digital Exchange", reasoning="sweep + consolidation",
        limitations="synthetic demo data",
    )


def test_payload_carries_its_own_unverified_shape_disclaimer():
    notice = notice_fsm.create_notice(case_id="C1", citation_id="bnss_94", body="draft body")
    payload = build_sahyog_payload(_fake_case(), _fake_attribution(), notice)
    assert payload["_meta"]["disclaimer"] == DATA_SHAPE_DISCLAIMER
    assert payload["_meta"]["data_is_synthetic"] is True
    assert payload["case_reference"]["case_id"] == "C1"
    assert payload["wallet_attribution"]["wallet_address"] == "TWalletXYZ"
    assert payload["legal_notice"]["notice_id"] == notice.id
    assert payload["legal_notice"]["state"] == "draft"
    notice_fsm.reset_store()


def test_payload_handles_no_confirmed_attribution_honestly():
    notice = notice_fsm.create_notice(case_id="C2", citation_id="bns_223", body="draft body")
    payload = build_sahyog_payload(_fake_case(), None, notice)
    assert payload["wallet_attribution"]["wallet_address"] is None
    assert "no confirmed" in payload["wallet_attribution"]["note"]
    notice_fsm.reset_store()
