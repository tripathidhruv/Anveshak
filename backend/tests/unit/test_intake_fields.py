"""Entities → the 13 case fields (app/intake/fields.py)."""
from app.intake import validators as v
from app.intake.classify import classify
from app.intake.extract import extract_entities
from app.intake.fields import FIELD_IDS, build_fields
from tests.unit.test_intake_extract import HINGLISH, SUSPECT, TX


def _fields(text):
    ents = extract_entities(text)
    return {f.id: f for f in build_fields(text, ents, classify(text))}, ents


def test_field_order_and_shape():
    ents = extract_entities(HINGLISH)
    fields = build_fields(HINGLISH, ents, classify(HINGLISH))
    assert [f.id for f in fields] == FIELD_IDS
    assert FIELD_IDS == ["suspectWallet", "network", "amountCrypto", "amountInr", "txHash", "incidentAt",
                         "platform", "upi", "phone", "complainant", "location", "typology", "victimWallet"]


def test_hinglish_fields():
    f, ents = _fields(HINGLISH)
    ids = {e.text: e.id for e in ents}
    assert f["suspectWallet"].value == SUSPECT and f["suspectWallet"].entityIds == [ids[SUSPECT]]
    assert f["network"].value == "TRON · USDT (TRC-20)" and f["network"].normalized == "tron"
    assert f["amountCrypto"].value == "14,850 USDT" and f["amountCrypto"].normalized == "14850"
    assert f["amountInr"].value == "₹12,40,000" and f["amountInr"].normalized == "1240000"
    assert f["txHash"].value == TX
    assert f["incidentAt"].normalized == "2026-09-02T19:42:00+05:30"
    assert f["platform"].value == "Telegram · @saffron_tasks_hr"
    assert f["platform"].normalized == "telegram:@saffron_tasks_hr"
    assert f["upi"].value == "ta•••••@konark"
    assert f["phone"].value == "+91 XXXXXX4821"
    assert f["complainant"].value == "Rekha Sharma"
    assert f["location"].value == "Jaipur, Rajasthan"
    assert f["typology"].normalized == "task_job" and f["typology"].value == "Task-based job scam"
    assert f["victimWallet"].value == "" and f["victimWallet"].confidence == 0
    assert f["victimWallet"].sources == [] and f["victimWallet"].reason
    for fld in f.values():
        if fld.value:
            assert fld.sources == ["text"] and fld.confidence > 0


def test_english_victim_and_suspect_wallets():
    victim = v.to_checksum_address("0x" + "51be" * 10)
    suspect = v.to_checksum_address("0x" + "9a3c" * 10)
    text = (f"Dear Sir, my name is Arjun Mehta from Pune. On 2 September 2026 19:42 I sent 2 ETH from my wallet "
            f"{victim} to {suspect} after an investment app on WhatsApp promised 40% returns. "
            f"I lost Rs. 6,40,000 in total.")
    f, _ = _fields(text)
    assert f["suspectWallet"].value == suspect
    assert f["victimWallet"].value == victim
    assert f["network"].value == "Ethereum · ETH"
    assert f["amountInr"].value == "₹6,40,000"
    assert f["complainant"].value == "Arjun Mehta"
    assert f["location"].value == "Pune, Maharashtra"
    assert f["typology"].normalized == "investment"
    assert f["platform"].value.startswith("WhatsApp")


def test_missing_fields_say_what_to_do():
    f, _ = _fields("kuch samajh nahi aa raha")
    for fid in FIELD_IDS:
        if fid == "typology":
            continue
        assert f[fid].value == "" and f[fid].normalized is None and f[fid].confidence == 0
        assert f[fid].reason
    assert "Ask the complainant" in f["txHash"].reason
    assert f["typology"].normalized == "other"
