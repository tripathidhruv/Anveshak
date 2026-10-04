"""Maps extracted entities onto the 13 fields of a case form.

Why a separate step: extraction answers "what is in the text", this answers "which of those
things is the scammer's wallet, the total loss, the time of the last payment". Those are judgement
calls (a complaint often names several amounts and dates), so each field records which entities
it came from and a plain-English reason, and a missing field tells the officer what to do next
instead of silently staying blank.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal

from app.intake.classify import TypologyResult, class_name
from app.intake.extract import Entity, indian_grouping

FIELD_IDS = [
    "suspectWallet", "network", "amountCrypto", "amountInr", "txHash", "incidentAt", "platform", "upi",
    "phone", "complainant", "location", "typology", "victimWallet",
]

_LABELS = {
    "suspectWallet": "Scammer's wallet",
    "network": "Network and coin",
    "amountCrypto": "Amount sent (crypto)",
    "amountInr": "Amount lost (rupees)",
    "txHash": "Transaction ID",
    "incidentAt": "When the money was sent",
    "platform": "Where the scammer made contact",
    "upi": "UPI ID used",
    "phone": "Scammer's phone number",
    "complainant": "Complainant",
    "location": "Location",
    "typology": "Type of scam",
    "victimWallet": "Victim's own wallet",
}

_MISSING = {
    "suspectWallet": "No wallet address found. Ask the complainant for the address they sent money to "
                     "(a screenshot of the transfer works).",
    "network": "Unknown until a wallet address is found — the address format tells the network.",
    "amountCrypto": "No crypto amount found. Ask the complainant, or KAIZEN reads it from the transaction "
                    "during the trace.",
    "amountInr": "No rupee amount found. Ask the complainant how much they lost in total.",
    "txHash": "Not in the complaint. Ask the complainant, or KAIZEN reads it from the transaction during the trace.",
    "incidentAt": "No date found. Ask the complainant when the last payment was made.",
    "platform": "No platform or handle found. Ask where the scammer first made contact.",
    "upi": "No UPI ID found. Ask whether any money was paid by UPI.",
    "phone": "No phone number found. Ask whether the scammer called or messaged from a number.",
    "complainant": "Name not found. Fill in the complainant's name.",
    "location": "No known city found. Fill in where the complainant lives.",
    "typology": "",
    "victimWallet": "Not in the complaint. Ask the complainant, or KAIZEN reads it from the transaction "
                    "during the trace.",
}


@dataclass
class Field:
    id: str
    label: str
    value: str = ""
    normalized: str | None = None
    confidence: float = 0.0
    reason: str = ""
    sources: list[str] = field(default_factory=list)
    entityIds: list[str] = field(default_factory=list)


CITIES: dict[str, tuple[str, str]] = {k.lower(): v for k, v in {
    "Delhi": ("Delhi", "Delhi"), "New Delhi": ("New Delhi", "Delhi"), "Mumbai": ("Mumbai", "Maharashtra"),
    "Bombay": ("Mumbai", "Maharashtra"), "Pune": ("Pune", "Maharashtra"), "Nagpur": ("Nagpur", "Maharashtra"),
    "Nashik": ("Nashik", "Maharashtra"), "Thane": ("Thane", "Maharashtra"), "Aurangabad": ("Aurangabad", "Maharashtra"),
    "Bengaluru": ("Bengaluru", "Karnataka"), "Bangalore": ("Bengaluru", "Karnataka"), "Mysuru": ("Mysuru", "Karnataka"),
    "Mysore": ("Mysuru", "Karnataka"), "Mangaluru": ("Mangaluru", "Karnataka"), "Hubli": ("Hubballi", "Karnataka"),
    "Chennai": ("Chennai", "Tamil Nadu"), "Coimbatore": ("Coimbatore", "Tamil Nadu"), "Madurai": ("Madurai", "Tamil Nadu"),
    "Hyderabad": ("Hyderabad", "Telangana"), "Warangal": ("Warangal", "Telangana"),
    "Visakhapatnam": ("Visakhapatnam", "Andhra Pradesh"), "Vijayawada": ("Vijayawada", "Andhra Pradesh"),
    "Kolkata": ("Kolkata", "West Bengal"), "Howrah": ("Howrah", "West Bengal"), "Siliguri": ("Siliguri", "West Bengal"),
    "Jaipur": ("Jaipur", "Rajasthan"), "Jodhpur": ("Jodhpur", "Rajasthan"), "Udaipur": ("Udaipur", "Rajasthan"),
    "Kota": ("Kota", "Rajasthan"), "Ajmer": ("Ajmer", "Rajasthan"), "Bikaner": ("Bikaner", "Rajasthan"),
    "Ahmedabad": ("Ahmedabad", "Gujarat"), "Surat": ("Surat", "Gujarat"), "Vadodara": ("Vadodara", "Gujarat"),
    "Rajkot": ("Rajkot", "Gujarat"), "Lucknow": ("Lucknow", "Uttar Pradesh"), "Kanpur": ("Kanpur", "Uttar Pradesh"),
    "Varanasi": ("Varanasi", "Uttar Pradesh"), "Agra": ("Agra", "Uttar Pradesh"), "Prayagraj": ("Prayagraj", "Uttar Pradesh"),
    "Noida": ("Noida", "Uttar Pradesh"), "Ghaziabad": ("Ghaziabad", "Uttar Pradesh"), "Meerut": ("Meerut", "Uttar Pradesh"),
    "Gurugram": ("Gurugram", "Haryana"), "Gurgaon": ("Gurugram", "Haryana"), "Faridabad": ("Faridabad", "Haryana"),
    "Chandigarh": ("Chandigarh", "Chandigarh"), "Ludhiana": ("Ludhiana", "Punjab"), "Amritsar": ("Amritsar", "Punjab"),
    "Jalandhar": ("Jalandhar", "Punjab"), "Patna": ("Patna", "Bihar"), "Gaya": ("Gaya", "Bihar"),
    "Ranchi": ("Ranchi", "Jharkhand"), "Jamshedpur": ("Jamshedpur", "Jharkhand"), "Bhubaneswar": ("Bhubaneswar", "Odisha"),
    "Cuttack": ("Cuttack", "Odisha"), "Bhopal": ("Bhopal", "Madhya Pradesh"), "Indore": ("Indore", "Madhya Pradesh"),
    "Gwalior": ("Gwalior", "Madhya Pradesh"), "Jabalpur": ("Jabalpur", "Madhya Pradesh"), "Raipur": ("Raipur", "Chhattisgarh"),
    "Kochi": ("Kochi", "Kerala"), "Thiruvananthapuram": ("Thiruvananthapuram", "Kerala"), "Kozhikode": ("Kozhikode", "Kerala"),
    "Guwahati": ("Guwahati", "Assam"), "Dehradun": ("Dehradun", "Uttarakhand"), "Shimla": ("Shimla", "Himachal Pradesh"),
    "Srinagar": ("Srinagar", "Jammu and Kashmir"), "Jammu": ("Jammu", "Jammu and Kashmir"), "Panaji": ("Panaji", "Goa"),
    "Imphal": ("Imphal", "Manipur"), "Shillong": ("Shillong", "Meghalaya"), "Agartala": ("Agartala", "Tripura"),
    "जयपुर": ("Jaipur", "Rajasthan"), "दिल्ली": ("Delhi", "Delhi"), "मुंबई": ("Mumbai", "Maharashtra"),
    "लखनऊ": ("Lucknow", "Uttar Pradesh"), "पटना": ("Patna", "Bihar"), "भोपाल": ("Bhopal", "Madhya Pradesh"),
}.items()}
_CITY_RE = re.compile(
    r"(?<!\w)(" + "|".join(re.escape(c) for c in sorted(CITIES, key=len, reverse=True)) + r")(?!\w)", re.IGNORECASE
)

_NAME = r"([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,2})"
_NAME_RE = re.compile(r"(?:(?i:\bmera naam|\bmy name is|\bi am|\bi'm|\bthis is|\bmain))[ \t]+" + _NAME)
_NOT_NAMES = {"Road", "Street", "Market", "Branch", "Office", "Issue", "Sir", "Madam", "Very", "Not", "Writing",
              "Telegram", "WhatsApp", "Instagram", "Facebook", "YouTube", "Signal", "Twitter"}

_RECEIVE_CUE = re.compile(
    r"(?i)\b(to|into|pe|par|sent|send|transfer\w*|bhej\w*|receiv\w*|scammer\w*|unka|unke|unki|their|"
    r"is wallet|this wallet|deposit\w*)\b"
)
_VICTIM_CUE = re.compile(r"(?i)\b(from|my wallet|my own|mere wallet|mera wallet|meri wallet|apne wallet|own wallet)\b")
_VICTIM_AFTER = re.compile(r"^\W{0,3}(se|से)\b", re.IGNORECASE)

_CHAIN_LABEL = {"tron": "TRON", "ethereum": "Ethereum", "bitcoin": "Bitcoin"}
_TOKEN_STD = {("tron", "USDT"): "USDT (TRC-20)", ("tron", "USDC"): "USDC (TRC-20)",
              ("ethereum", "USDT"): "USDT (ERC-20)", ("ethereum", "USDC"): "USDC (ERC-20)"}
_NATIVE = {"tron": "TRX", "ethereum": "ETH", "bitcoin": "BTC"}
_UNIT_CHAINS = {"USDT": {"tron", "ethereum"}, "USDC": {"tron", "ethereum"}, "TRX": {"tron"}, "ETH": {"ethereum"},
                "BTC": {"bitcoin"}}


def _found(fid: str, value: str, normalized: str | None, conf: float, reason: str, ids: list[str]) -> Field:
    return Field(fid, _LABELS[fid], value, normalized, round(conf, 2), reason, ["text"], ids)


def _western(n: Decimal) -> str:
    whole = int(n)
    frac = n - whole
    s = f"{whole:,}"
    if frac:
        s += format(frac.normalize(), "f")[1:]
    return s


def _wallet_roles(text: str, wallets: list[Entity]) -> tuple[Entity | None, Entity | None, str]:
    """Score each wallet by cue words between it and the previous wallet (max 60 chars back).
    Returns (suspect, victim, reason-for-suspect)."""
    scored = []
    prev_end = 0
    for w in wallets:
        before = text[max(prev_end, w.start - 60):w.start]
        after = text[w.end:w.end + 12]
        recv = _RECEIVE_CUE.findall(before)
        vict = _VICTIM_CUE.findall(before) + (["se"] if _VICTIM_AFTER.search(after) else [])
        scored.append((w, len(recv) - 2 * len(vict), recv, vict))
        prev_end = w.end
    distinct = []
    for item in scored:
        if all(item[0].normalized != d[0].normalized or item[0].text != d[0].text for d in distinct):
            distinct.append(item)
    victim = next((d for d in distinct if d[3]), None)
    candidates = [d for d in distinct if d is not victim]
    if not candidates:
        # A single wallet described only as the victim's own: no suspect wallet.
        return None, victim[0] if victim else None, ""
    best = max(candidates, key=lambda d: (d[0].meta.get("valid", False), d[1]))
    if best[2]:
        cue = best[2][-1]
        reason = f"{best[0].reason} Named as where the money went (“{cue}” just before it)."
    else:
        reason = best[0].reason
    return best[0], victim[0] if victim and victim[0] is not best[0] else None, reason


def build_fields(text: str, entities: list[Entity], typology: TypologyResult) -> list[Field]:
    by = lambda t: [e for e in entities if e.type == t]  # noqa: E731
    out: dict[str, Field] = {}

    wallets = by("wallet")
    suspect, victim, suspect_reason = _wallet_roles(text, wallets)
    if suspect:
        out["suspectWallet"] = _found("suspectWallet", suspect.normalized or suspect.text,
                                      suspect.normalized if suspect.meta.get("valid") else None,
                                      suspect.confidence, suspect_reason, [suspect.id])
    if victim:
        out["victimWallet"] = _found("victimWallet", victim.normalized or victim.text, victim.normalized,
                                     round(victim.confidence * 0.85, 2),
                                     "A second wallet described as the complainant's own (“from / mere wallet se”).",
                                     [victim.id])

    amounts = by("amount")
    crypto = [a for a in amounts if a.meta["unit"] != "INR"]
    chain = suspect.chain if suspect else None
    if chain:
        compatible = [a for a in crypto if chain in _UNIT_CHAINS.get(a.meta["unit"], set())]
        crypto = compatible or crypto
    if crypto:
        top = max(crypto, key=lambda a: a.meta["value"])
        unit = top.meta["unit"]
        out["amountCrypto"] = _found("amountCrypto", f"{_western(top.meta['value'])} {unit}",
                                     top.normalized.split()[0], top.confidence,
                                     f"Number followed by “{unit}” in the text."
                                     + (" The largest crypto amount, read as the total sent." if len(crypto) > 1 else ""),
                                     [top.id])
    inr = [a for a in amounts if a.meta["unit"] == "INR"]
    if inr:
        top = max(inr, key=lambda a: a.meta["value"])
        reason = f"“{top.text}” → ₹{indian_grouping(top.meta['value'])}."
        if len(inr) > 1:
            reason += " The largest rupee amount, read as the total loss."
        out["amountInr"] = _found("amountInr", f"₹{indian_grouping(top.meta['value'])}", top.normalized.split()[0],
                                  top.confidence, reason, [top.id])

    if chain:
        unit = crypto and max(crypto, key=lambda a: a.meta["value"]).meta["unit"]
        label = _CHAIN_LABEL[chain]
        if unit and chain in _UNIT_CHAINS.get(unit, set()):
            value = f"{label} · {_TOKEN_STD.get((chain, unit), unit)}"
            reason = f"Wallet format says {label}" + (
                f"; the word “{unit}” on {label} means the {_TOKEN_STD[(chain, unit)].split('(')[1][:-1]} token."
                if (chain, unit) in _TOKEN_STD else f"; the amount is in {unit}, its native coin.")
            ids = [crypto[0].id if len(crypto) == 1 else max(crypto, key=lambda a: a.meta["value"]).id, suspect.id]
        else:
            value = label
            reason = f"Wallet format says {label}. The coin is not named in the complaint."
            ids = [suspect.id]
        out["network"] = _found("network", value, chain, min(suspect.confidence, 0.97), reason, ids)

    hashes = by("hash")
    if hashes:
        h = hashes[0]
        out["txHash"] = _found("txHash", h.normalized or h.text, h.normalized, h.confidence, h.reason, [h.id])

    dates = by("date")
    if dates:
        latest = max(dates, key=lambda d: (d.meta["dt"], d.meta["has_time"]))
        dt = latest.meta["dt"]
        value = dt.strftime("%d %b %Y, %H:%M IST") if latest.meta["has_time"] else dt.strftime("%d %b %Y")
        reason = latest.reason + (" The latest date in the complaint." if len(dates) > 1 else "")
        out["incidentAt"] = _found("incidentAt", value, latest.normalized, latest.confidence, reason, [latest.id])

    handles = [h for h in by("handle") if not h.meta.get("mention")]
    mentions = [h for h in by("handle") if h.meta.get("mention")]
    if handles:
        h = next((x for x in handles if x.meta.get("platform")), handles[0])
        platform = h.meta.get("platform")
        ids = [h.id]
        if platform:
            m = next((x for x in reversed(mentions) if x.start < h.start and x.meta["platform"] == platform), None)
            if m:
                ids = [m.id, h.id]
            out["platform"] = _found("platform", f"{platform} · {h.text}", h.normalized, h.confidence, h.reason, ids)
        else:
            out["platform"] = _found("platform", h.text, h.normalized, h.confidence, h.reason, ids)
    elif mentions:
        m = mentions[0]
        out["platform"] = _found("platform", m.meta["platform"], m.normalized, m.confidence,
                                 f"The complaint names {m.meta['platform']}, but no handle or username.", [m.id])

    for fid, kind in (("upi", "upi"), ("phone", "phone")):
        pii = [e for e in by("pii") if e.meta.get("kind") == kind]
        if pii:
            e = pii[0]
            out[fid] = _found(fid, e.normalized, e.normalized, e.confidence, e.reason, [e.id])

    for m in _NAME_RE.finditer(text):
        words = m.group(1).split()
        while words and (words[-1] in _NOT_NAMES or words[-1].lower() in CITIES):
            words.pop()
        if not words or words[0] in _NOT_NAMES or words[0].lower() in CITIES:
            continue
        name = " ".join(words)
        intro = m.group(0)[: m.group(0).find(m.group(1))].strip()
        out["complainant"] = _found("complainant", name, name, 0.9 if len(words) > 1 else 0.75,
                                    f"Self-introduction “{intro} {name}”.", [])
        break

    cm = _CITY_RE.search(text)
    if cm:
        city, state = CITIES[cm.group(1).lower()]
        loc = f"{city}, {state}"
        out["location"] = _found("location", loc, loc, 0.9,
                                 f"“{cm.group(1)}” — a known city, mapped to its state.", [])

    top = typology.classes[0]
    if typology.triggers:
        reason = "Triggered by " + ", ".join(f"“{t.phrase}”" for t in typology.triggers[:4]) + "."
    else:
        reason = "No scam-type phrases recognised. The officer picks the category."
    out["typology"] = _found("typology", class_name(typology.top), typology.top, top.p, reason, [])

    return [out.get(fid) or Field(fid, _LABELS[fid], reason=_MISSING[fid]) for fid in FIELD_IDS]
