"""Rule-based entity extraction over complaint text (app/intake/extract.py)."""
import pytest

from app.intake import validators as v
from app.intake.extract import detect_language, extract_entities

HINGLISH = (
    "Namaste sir, main Rekha Sharma, Jaipur se likh rahi hoon. 28 Aug ko Telegram pe ek \"part-time task job\" "
    "ka message aaya, @saffron_tasks_hr naam ke HR se. Bola YouTube videos like karo aur roz ₹3,000 kamao. "
    "Pehle registration fee ₹1,500 UPI pe maanga — tasks.pay••••@konark pe bhej diya. Uske baad \"bada task\" "
    "ke naam pe bola USDT mein paisa lagao, double milega. Maine total 14,850 USDT is wallet pe transfer kiya: "
    "TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm. Last payment 02 Sep 2026, shaam 7:42 pm ko gaya. Transaction hash: "
    "7f3a9c2e41b8d06f5e1a72c94d3b8e06a5f21c7d9e4b30a8f61c2d75e9a4b318. Total mera ₹12.4 lakh chala gaya, sab "
    "savings thi. Ab unhone group se nikaal diya aur unka number +91 98XXXX4821 band aa raha hai. Kripya madad karein."
)
TX = "7f3a9c2e41b8d06f5e1a72c94d3b8e06a5f21c7d9e4b30a8f61c2d75e9a4b318"
SUSPECT = "TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm"


def _by_text(entities, text):
    matches = [e for e in entities if e.text == text]
    assert matches, f"no entity with text {text!r}; got {[e.text for e in entities]}"
    return matches[0]


def test_hinglish_entities_in_order_with_exact_spans():
    ents = extract_entities(HINGLISH)
    expected = [
        ("date", "28 Aug"),
        ("handle", "Telegram"),
        ("handle", "@saffron_tasks_hr"),
        ("handle", "YouTube"),
        ("amount", "₹3,000"),
        ("amount", "₹1,500"),
        ("pii", "ta•••••@konark"),
        ("amount", "14,850 USDT"),
        ("wallet", SUSPECT),
        ("date", "02 Sep 2026, shaam 7:42 pm"),
        ("hash", TX),
        ("amount", "₹12.4 lakh"),
        ("pii", "+91 XXXXXX4821"),
    ]
    assert [(e.type, e.text) for e in ents] == expected
    assert [e.id for e in ents] == [f"e{i}" for i in range(1, len(expected) + 1)]
    for e in ents:
        if e.type != "pii":  # pii text is masked; its span still points at the original
            assert HINGLISH[e.start:e.end] == e.text
        assert 0 < e.confidence <= 1
        assert e.reason


def test_hinglish_normalisation():
    ents = extract_entities(HINGLISH)
    assert _by_text(ents, "28 Aug").normalized == "2026-08-28"
    assert "assumed" in _by_text(ents, "28 Aug").reason
    assert _by_text(ents, "28 Aug").confidence < _by_text(ents, "02 Sep 2026, shaam 7:42 pm").confidence
    assert _by_text(ents, "02 Sep 2026, shaam 7:42 pm").normalized == "2026-09-02T19:42:00+05:30"
    assert _by_text(ents, "₹3,000").normalized == "3000 INR"
    assert _by_text(ents, "14,850 USDT").normalized == "14850 USDT"
    assert _by_text(ents, "₹12.4 lakh").normalized == "1240000 INR"
    w = _by_text(ents, SUSPECT)
    assert w.chain == "tron" and w.normalized == SUSPECT and w.confidence >= 0.95
    assert "TRON" in w.reason
    h = _by_text(ents, TX)
    assert h.chain == "tron" and h.normalized == TX
    assert _by_text(ents, "@saffron_tasks_hr").normalized == "telegram:@saffron_tasks_hr"


def test_hinglish_pii_masked_with_original_spans():
    ents = extract_entities(HINGLISH)
    upi = _by_text(ents, "ta•••••@konark")
    assert upi.normalized == "ta•••••@konark"
    assert HINGLISH[upi.start:upi.end] == "tasks.pay••••@konark"
    phone = _by_text(ents, "+91 XXXXXX4821")
    assert phone.normalized == "+91 XXXXXX4821"
    assert HINGLISH[phone.start:phone.end] == "+91 98XXXX4821"


def test_hinglish_language():
    lang, scripts = detect_language(HINGLISH)
    assert lang == "hinglish" and scripts == ["latin"]


def test_unmasked_phone_and_upi_are_masked():
    text = "Scammer ka number 9876543210 hai aur UPI rahul.k99@okaxis pe paise bheje. Email help@example.com"
    ents = extract_entities(text)
    pii = [e for e in ents if e.type == "pii"]
    assert [e.normalized for e in pii] == ["+91 XXXXXX3210", "ra•••••@okaxis"]
    for e in pii:
        assert "9876543210" not in e.text and "rahul" not in e.text
        assert "9876543210" not in e.reason and "rahul" not in e.reason
    # The email is not a UPI ID and the handle regex must not fire inside it.
    assert not any("example" in e.text for e in ents)


@pytest.mark.parametrize("text,normalized", [
    ("₹1,500", "1500 INR"), ("Rs 1500", "1500 INR"), ("Rs. 1,500", "1500 INR"), ("INR 2,000", "2000 INR"),
    ("₹12.4 lakh", "1240000 INR"), ("12 lakh rupees", "1200000 INR"), ("1.2 crore", "12000000 INR"),
    ("14,850 USDT", "14850 USDT"), ("0.5 BTC", "0.5 BTC"), ("2 ETH", "2 ETH"), ("500 TRX", "500 TRX"),
    ("₹1,50,000", "150000 INR"),
])
def test_amount_forms(text, normalized):
    ents = extract_entities(f"maine {text} bheje the")
    amounts = [e for e in ents if e.type == "amount"]
    assert len(amounts) == 1
    assert amounts[0].text == text
    assert amounts[0].normalized == normalized


@pytest.mark.parametrize("text,normalized", [
    ("2 September 2026 19:42", "2026-09-02T19:42:00+05:30"),
    ("02/09/2026 19:42:11", "2026-09-02T19:42:11+05:30"),
    ("02 Sep 2026, shaam 7:42 pm", "2026-09-02T19:42:00+05:30"),
    ("5 Sep 2026 raat 9:15", "2026-09-05T21:15:00+05:30"),
    ("5 Sep 2026 subah 9:15", "2026-09-05T09:15:00+05:30"),
    ("5 Sep 2026", "2026-09-05"),
])
def test_date_forms(text, normalized):
    ents = [e for e in extract_entities(f"payment {text} ko hua") if e.type == "date"]
    assert len(ents) == 1
    assert ents[0].text == text
    assert ents[0].normalized == normalized


def test_tx_hash_is_not_read_as_wallet():
    eth_tx = "0x" + "ab12" * 16
    ents = extract_entities(f"Transaction {eth_tx} and {TX}")
    assert [(e.type, e.chain) for e in ents] == [("hash", "ethereum"), ("hash", None)]


def test_short_tron_lookalike_is_flagged():
    ents = extract_entities("is wallet pe bheja TNh8yW5vC2mQ7fL4xK9pR")
    w = [e for e in ents if e.type == "wallet"]
    assert len(w) == 1 and w[0].chain == "tron"
    assert any("21 characters" in x for x in w[0].warnings)
    assert w[0].confidence < 0.6


def test_english_with_ethereum_wallets():
    victim = v.to_checksum_address("0x" + "51be" * 10)
    suspect = v.to_checksum_address("0x" + "9a3c" * 10)
    text = (f"Dear Sir, my name is Arjun Mehta from Pune. On 2 September 2026 19:42 I sent 2 ETH from my wallet "
            f"{victim} to {suspect} after an investment app on WhatsApp promised 40% returns. "
            f"I lost Rs. 6,40,000 in total.")
    ents = extract_entities(text)
    wallets = [e for e in ents if e.type == "wallet"]
    assert [w.normalized for w in wallets] == [victim, suspect]
    assert all(w.chain == "ethereum" for w in wallets)
    assert detect_language(text)[0] == "english"


def test_devanagari_language_and_scripts():
    lang, scripts = detect_language("मेरे साथ धोखा हुआ है, मैंने 500 USDT भेजे")
    assert lang == "hindi"
    assert scripts == ["latin", "devanagari"]


@pytest.mark.parametrize("text", ["", "   ", "asdf qwer zxcv 12345 !!!", "x" * 5000])
def test_noise_does_not_crash(text):
    assert extract_entities(text) == [] or all(e.type for e in extract_entities(text))
