"""Rule-based entity extraction for complaint text in Hindi, English or Hinglish.

Why rules and not a model: complaints arrive in mixed script and mixed language ("shaam 7:42 pm",
"₹12.4 lakh", "is wallet pe transfer kiya"), there is no labelled corpus of Indian crypto-fraud
complaints to train on, and every extraction must be explainable to an officer. So each entity
carries its exact character span in the ORIGINAL text (the UI highlights it in place), a confidence,
and one plain-English sentence saying why it was read that way.

Privacy: phone numbers and UPI IDs are masked here, at ingest. For `pii` entities the `text` field
is the masked value (never the raw digits or name), while `start`/`end` still point at the original
characters so the UI can highlight them in the officer's own copy.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from app.intake.validators import validate_address, validate_tx_hash

IST = timezone(timedelta(hours=5, minutes=30))


@dataclass
class Entity:
    id: str
    type: str  # wallet | amount | hash | handle | date | pii
    text: str
    start: int
    end: int
    confidence: float
    reason: str
    normalized: str | None = None
    chain: str | None = None
    warnings: list[str] = field(default_factory=list)
    # Internal extras (not on the wire): handle platform, pii kind, amount value/unit, datetime.
    meta: dict = field(default_factory=dict)


# --- language ---------------------------------------------------------------------------

_HINDI_FUNCTION_WORDS = {
    "hai", "hain", "ko", "se", "kiya", "kiye", "maine", "mera", "meri", "mere", "bhej", "bheja", "bheje",
    "paisa", "paise", "nahi", "nahin", "kripya", "ji", "ka", "ki", "ke", "pe", "par", "aur", "hoon", "hu",
    "raha", "rahi", "diya", "gaya", "gayi", "unka", "unhone", "mein", "bola", "baad", "sir",
}


def detect_language(text: str) -> tuple[str, list[str]]:
    deva = sum(1 for c in text if "ऀ" <= c <= "ॿ")
    latin = sum(1 for c in text if c.isascii() and c.isalpha())
    scripts = (["latin"] if latin else []) + (["devanagari"] if deva else [])
    if deva and deva >= latin:
        return "hindi", scripts
    words = set(re.findall(r"[a-z]+", text.lower()))
    hits = words & _HINDI_FUNCTION_WORDS
    # "sir" alone is common in English complaints too, so it never decides on its own.
    if len(hits - {"sir"}) >= 2:
        return "hinglish", scripts
    return "english", scripts


# --- helpers ----------------------------------------------------------------------------

def _num(s: str) -> Decimal | None:
    try:
        return Decimal(s.replace(",", ""))
    except InvalidOperation:
        return None


def fmt_decimal(d: Decimal) -> str:
    if d == d.to_integral_value():
        return str(int(d))
    return format(d.normalize(), "f")


def mask_phone(digits: str) -> str:
    return f"+91 XXXXXX{digits[-4:]}"


def mask_upi(local: str, bank: str) -> str:
    return f"{local[:2]}•••••@{bank}"


# --- patterns ---------------------------------------------------------------------------

_NUM = r"\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?"
_MULT = r"lakhs?|lacs?|crores?|cr|लाख|करोड़|करोड"
_CRYPTO = r"USDT|USDC|BTC|ETH|TRX"

_AMOUNT_RE = re.compile(
    rf"(?:(?P<pcur>₹|(?<![A-Za-z])Rs\.?|(?<![A-Za-z])INR|रु\.?)\s*(?P<pnum>{_NUM})(?:\s*(?P<pmult>{_MULT})(?![A-Za-z]))?)"
    rf"|(?:(?<![\w.])(?P<cnum>{_NUM})\s*(?P<cunit>{_CRYPTO})(?![A-Za-z]))"
    rf"|(?:(?<![\w.])(?P<mnum>{_NUM})\s*(?P<mmult>{_MULT})(?![A-Za-z])(?:\s*(?P<mcur>rupees?|rs\.?|रुपये|रुपए))?)"
    rf"|(?:(?<![\w.])(?P<rnum>{_NUM})\s*(?P<rcur>rupees|rupee|रुपये|रुपए)(?![A-Za-z]))",
    re.IGNORECASE,
)

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
_MONTH_RE = (r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
             r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?")
_DAYPART = r"subah|dopahar|shaam|sham|raat|morning|afternoon|evening|night"
_TIME = (rf"(?:,?\s*(?:at\s+)?(?:(?P<dp>{_DAYPART})\s+)?(?P<hh>\d{{1,2}})[:.](?P<mi>\d{{2}})"
         rf"(?::(?P<ss>\d{{2}}))?(?:\s*(?P<ampm>[ap]\.?m\.?)(?![a-z]))?)?")
_DATE_TEXT_RE = re.compile(
    rf"(?<!\d)(?P<d>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<mon>{_MONTH_RE})\.?(?![a-z])(?:,?\s+(?P<y>\d{{4}}))?" + _TIME,
    re.IGNORECASE,
)
_DATE_NUM_RE = re.compile(
    r"(?<![\d/.-])(?P<d>\d{1,2})[/.-](?P<m>\d{1,2})[/.-](?P<y>\d{4})(?![\d/])"
    + _TIME.replace(r",?\s*(?:at\s+)?", r",?\s+(?:at\s+)?"),
    re.IGNORECASE,
)

_HASH_RE = re.compile(r"(?<![0-9A-Za-z])(?:0x[0-9a-fA-F]{64}|[0-9a-fA-F]{64})(?![0-9A-Za-z])")
_WALLET_RE = re.compile(
    r"(?<![0-9A-Za-z])(?:0x[0-9a-fA-F]{30,50}|bc1[0-9A-Za-z]{8,87}|BC1[0-9A-Z]{8,87}"
    r"|T[1-9A-HJ-NP-Za-km-z]{20,40}|[13][1-9A-HJ-NP-Za-km-z]{24,34})(?![0-9A-Za-z])"
)
_UPI_RE = re.compile(
    r"(?<![\w.•*@])(?P<local>[A-Za-z0-9][A-Za-z0-9._\-•*]{1,40})@(?P<bank>[A-Za-z][A-Za-z0-9]{1,20})"
    r"(?!\.[A-Za-z])(?![\w@])"
)
_HANDLE_RE = re.compile(r"(?<![\w.•*@])@(?P<h>[A-Za-z0-9_](?:[A-Za-z0-9_.]{1,30}[A-Za-z0-9_]))")
_PHONE_RE = re.compile(
    r"(?<![\w+])(?P<prefix>\+\s?91[\s-]?|0091[\s-]?|91[\s-]|0)?"
    # 10 characters, last four always real digits; the rest may already be masked (X, *, •).
    r"(?P<num>[6-9Xx*•][0-9Xx*•]{4}[\s-]?[0-9Xx*•]\d{4})(?!\w)"
)
_PLATFORMS = {
    "telegram": "Telegram", "whatsapp": "WhatsApp", "instagram": "Instagram", "insta": "Instagram",
    "facebook": "Facebook", "youtube": "YouTube", "twitter": "Twitter", "signal": "Signal",
}
_PLATFORM_RE = re.compile(
    r"(?<![\w@])(?P<p>(?i:telegram|whatsapp|instagram|insta|facebook|youtube|twitter|signal))(?![\w])"
    # A bare "X" is only the platform in context ("on X", "X pe") -- never inside "98XXXX4821".
    r"|(?<=\bon )(?P<x>X)(?![\w])|(?<![\w@])(?P<x2>X)(?= (?:pe|par|handle)\b)",
)


# --- per-type finders --------------------------------------------------------------------
# Each returns (start, end, Entity-without-id, priority). Higher priority wins on overlap.

def _find_hashes(text: str) -> list[tuple[int, Entity]]:
    out = []
    for m in _HASH_RE.finditer(text):
        tok = m.group(0)
        chk = validate_tx_hash(tok)
        if not chk.valid:
            continue
        out.append((100, Entity("", "hash", tok, m.start(), m.end(), 0.97, chk.reason,
                                normalized=tok.lower() if chk.chain == "ethereum" else tok, chain=chk.chain)))
    return out


def _find_wallets(text: str) -> list[tuple[int, Entity]]:
    out = []
    for m in _WALLET_RE.finditer(text):
        tok = m.group(0)
        if tok[:2].lower() == "0x" and len(tok) == 66:
            continue  # a tx hash, handled above
        if tok[0] in "13" and not any(c.isalpha() for c in tok):
            continue
        chk = validate_address(tok)
        if chk.chain is None:
            continue
        if chk.valid:
            conf = 0.98 if chk.checksum == "pass" else 0.88
        else:
            conf = 0.45 if chk.checksum == "none" else 0.4
        out.append((90, Entity("", "wallet", tok, m.start(), m.end(), conf, chk.reason,
                               normalized=chk.normalized, chain=chk.chain, warnings=list(chk.warnings),
                               meta={"valid": chk.valid})))
    return out


def _find_upi(text: str) -> list[tuple[int, Entity]]:
    out = []
    for m in _UPI_RE.finditer(text):
        local, bank = m.group("local"), m.group("bank")
        masked = mask_upi(local, bank)
        already = any(c in local for c in "•*")
        reason = ("Pattern “name@bank” with no dot after the “@” — a UPI ID, not an email. "
                  + ("It was already partly masked in the complaint; kept masked." if already else "Masked at intake."))
        out.append((80, Entity("", "pii", masked, m.start(), m.end(), 0.88 if already else 0.9, reason,
                               normalized=masked, meta={"kind": "upi"})))
    return out


def _find_phones(text: str) -> list[tuple[int, Entity]]:
    out = []
    for m in _PHONE_RE.finditer(text):
        raw = m.group("num")
        compact = re.sub(r"[\s-]", "", raw)
        if len(compact) != 10:
            continue
        masked = mask_phone(compact)
        prefix = (m.group("prefix") or "").strip()
        already = any(c in compact for c in "Xx*•")
        if prefix.startswith("+") or prefix.startswith("0091") or prefix.startswith("91"):
            why = "“+91” followed by a 10-digit mobile number."
        elif prefix == "0":
            why = "“0” followed by a 10-digit mobile number."
        else:
            why = "A 10-digit number starting with 6–9 — the Indian mobile format."
        why += " Already partly masked in the complaint; kept masked." if already else " Masked at intake — last 4 digits kept."
        out.append((60, Entity("", "pii", masked, m.start(), m.end(), 0.9 if prefix else 0.8, why,
                               normalized=masked, meta={"kind": "phone"})))
    return out


def _platform_before(text: str, pos: int, window: int = 80) -> tuple[str | None, int | None]:
    best = None
    for m in _PLATFORM_RE.finditer(text, max(0, pos - window), pos):
        best = m
    if best is None:
        return None, None
    key = (best.group("p") or "x").lower()
    return _PLATFORMS.get(key, "X"), best.start()


def _find_handles(text: str) -> list[tuple[int, Entity]]:
    out = []
    for m in _HANDLE_RE.finditer(text):
        tok = m.group(0)
        platform, ppos = _platform_before(text, m.start())
        if platform:
            reason = f"“@” handle written shortly after the word “{platform}”."
            normalized = f"{platform.lower()}:{tok}"
            conf = 0.96 if m.start() - ppos <= 40 else 0.9
        else:
            reason = "“@” handle with no platform named nearby."
            normalized = tok
            conf = 0.8
        out.append((70, Entity("", "handle", tok, m.start(), m.end(), conf, reason, normalized=normalized,
                               meta={"platform": platform, "handle": tok})))
    for m in _PLATFORM_RE.finditer(text):
        key = (m.group("p") or "x").lower()
        name = _PLATFORMS.get(key, "X")
        out.append((20, Entity("", "handle", m.group(0), m.start(), m.end(), 0.6,
                               f"Names the platform {name} — may be where the scammer made contact.",
                               normalized=name.lower(), meta={"platform": name, "mention": True})))
    return out


def _find_amounts(text: str) -> list[tuple[int, Entity]]:
    out = []
    for m in _AMOUNT_RE.finditer(text):
        g = m.groupdict()
        if g["pnum"]:
            n, mult, unit = _num(g["pnum"]), g["pmult"], "INR"
            why = "Rupee sign or “Rs/INR” followed by a number"
            conf = 0.93
        elif g["cnum"]:
            n, mult, unit = _num(g["cnum"]), None, g["cunit"].upper()
            why = f"Number followed by “{g['cunit']}”"
            conf = 0.97
        elif g["mnum"]:
            n, mult, unit = _num(g["mnum"]), g["mmult"], "INR"
            why = "Number followed by an Indian unit (lakh/crore)"
            conf = 0.9 if g["mcur"] else 0.8
            if not g["mcur"]:
                why += ", read as rupees"
        else:
            n, mult, unit = _num(g["rnum"]), None, "INR"
            why = "Number followed by “rupees”"
            conf = 0.9
        if n is None:
            continue
        if mult:
            ml = mult.lower()
            factor = Decimal(100000) if ml.startswith(("lakh", "lac", "लाख")) else Decimal(10000000)
            n = n * factor
            why += f" with “{mult}”"
        value = fmt_decimal(n)
        if unit == "INR" and mult:
            why += f" → ₹{indian_grouping(n)}."
        else:
            why += "."
        out.append((50, Entity("", "amount", m.group(0), m.start(), m.end(), conf, why,
                               normalized=f"{value} {unit}", meta={"value": n, "unit": unit})))
    return out


def indian_grouping(n: Decimal) -> str:
    whole = int(n)
    frac = n - whole
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts + [tail])
    if frac:
        s += format(frac.normalize(), "f")[1:]
    return s


def _resolve_time(hh: int, dp: str | None, ampm: str | None) -> int | None:
    if ampm:
        a = ampm.lower().replace(".", "")
        if not 1 <= hh <= 12:
            return None
        return (hh % 12) + (12 if a == "pm" else 0)
    if dp:
        d = dp.lower()
        if d in ("shaam", "sham", "evening", "afternoon", "dopahar") and 1 <= hh <= 11:
            return hh + 12 if not (d in ("dopahar", "afternoon") and hh == 12) else hh
        if d in ("raat", "night"):
            if 5 <= hh <= 11:
                return hh + 12
            return 0 if hh == 12 else hh
        if d in ("subah", "morning"):
            return 0 if hh == 12 else hh
    return hh if 0 <= hh <= 23 else None


_DAYPART_EN = {"subah": "morning", "dopahar": "afternoon", "shaam": "evening", "sham": "evening",
               "raat": "night"}


def _find_dates(text: str) -> list[tuple[int, Entity]]:
    raw = []
    for rx, numeric in ((_DATE_TEXT_RE, False), (_DATE_NUM_RE, True)):
        for m in rx.finditer(text):
            g = m.groupdict()
            day = int(g["d"])
            month = int(g["m"]) if numeric else _MONTHS[g["mon"][:3].lower()]
            year = int(g["y"]) if g.get("y") else None
            if not (1 <= day <= 31 and 1 <= month <= 12):
                continue
            raw.append((m, day, month, year, g))
    full_years = [r[3] for r in raw if r[3]]
    assumed_year = max(full_years) if full_years else datetime.now(IST).year
    out = []
    for m, day, month, year, g in raw:
        reason_bits = []
        conf = 0.93
        y = year
        if y is None:
            y = assumed_year
            conf = 0.72
            reason_bits.append(
                f"Day and month with no year — {y} assumed from "
                + ("the later full date in the complaint." if full_years else "the current year."))
        try:
            hour = minute = second = None
            if g.get("hh"):
                hour = _resolve_time(int(g["hh"]), g.get("dp"), g.get("ampm"))
                minute, second = int(g["mi"]), int(g["ss"] or 0)
                if hour is None or minute > 59 or second > 59:
                    continue
                dt = datetime(y, month, day, hour, minute, second, tzinfo=IST)
                normalized = dt.isoformat()
                bits = []
                if g.get("dp"):
                    dp = g["dp"].lower()
                    bits.append(f"“{g['dp']}” ({_DAYPART_EN.get(dp, dp)})")
                bits.append(f"{g['hh']}:{g['mi']}" + (f" {g['ampm']}" if g.get("ampm") else ""))
                reason_bits.append(" + ".join(bits) + f" → {hour:02d}:{minute:02d} IST.")
            else:
                dt = datetime(y, month, day, tzinfo=IST)
                normalized = dt.date().isoformat()
                if year is not None:
                    reason_bits.append("A full date with no time of day.")
                conf -= 0.05
            if g.get("m"):
                reason_bits.insert(0, "Numeric date read day-first (DD/MM/YYYY, the Indian convention).")
        except ValueError:
            continue
        out.append((40, Entity("", "date", m.group(0), m.start(), m.end(), round(conf, 2), " ".join(reason_bits),
                               normalized=normalized, meta={"dt": dt, "has_time": hour is not None})))
    return out


# --- public -----------------------------------------------------------------------------

def extract_entities(text: str) -> list[Entity]:
    candidates: list[tuple[int, Entity]] = []
    for finder in (_find_hashes, _find_wallets, _find_upi, _find_handles, _find_dates, _find_amounts,
                   _find_phones):
        candidates.extend(finder(text))

    # Overlap resolution: higher priority first, then longer span; keep non-overlapping winners.
    candidates.sort(key=lambda c: (-c[0], -(c[1].end - c[1].start), c[1].start))
    taken: list[Entity] = []
    for _, ent in candidates:
        if any(ent.start < t.end and t.start < ent.end for t in taken):
            continue
        taken.append(ent)
    taken.sort(key=lambda e: e.start)

    # A plain 64-hex hash has no chain marker of its own; if the complaint names exactly one
    # non-Ethereum chain through a valid wallet, the hash belongs to that chain.
    chains = {e.chain for e in taken if e.type == "wallet" and e.meta.get("valid") and e.chain != "ethereum"}
    for e in taken:
        if e.type == "hash" and e.chain is None and len(chains) == 1:
            e.chain = next(iter(chains))
            e.reason = (f"64 hexadecimal characters with no “0x” — the {e.chain.upper() if e.chain == 'tron' else 'Bitcoin'}"
                        " transaction-ID format (the wallet in this complaint is on that network).")

    for i, e in enumerate(taken, start=1):
        e.id = f"e{i}"
    return taken
