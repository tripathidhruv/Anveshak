"""Scam-typology suggestion from complaint text.

Why weighted phrases instead of a trained classifier: there is no labelled set of Indian
crypto-fraud complaints, and the officer must see WHY a category was suggested. Each class has a
small list of English / Hinglish / Devanagari phrases with hand-set weights; a phrase found in the
text adds its weight once. Scores plus a small prior are normalised into probabilities, and the
prior on "other" is the largest, so empty or irrelevant text falls back to "Other / unclear"
instead of a confident guess. The result is always a suggestion -- the officer picks the category
that goes into the FIR.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

DISCLAIMER = "A suggestion only — the officer confirms the category in the FIR."

CLASSES: list[tuple[str, str]] = [
    ("task_job", "Task-based job scam"),
    ("investment", "Investment app scam"),
    ("pig_butchering", "Pig-butchering (romance)"),
    ("digital_arrest", "Digital-arrest impersonation"),
    ("loan_app", "Loan-app extortion"),
    ("sextortion", "Sextortion"),
    ("lottery", "Lottery / prize scam"),
    ("impersonation", "Customer-support impersonation"),
    ("phishing", "Wallet phishing / fake airdrop"),
    ("other", "Other / unclear"),
]
_NAMES = dict(CLASSES)

_PRIOR = {cid: 0.15 for cid, _ in CLASSES}
_PRIOR["other"] = 1.0

# phrase -> weight, per class. Longer phrases are listed before their sub-phrases so the trigger
# shown to the officer is the most specific one (a sub-phrase inside an already-matched phrase
# is not counted again).
_KEYWORDS: dict[str, list[tuple[str, float]]] = {
    "task_job": [
        ("part-time task job", 4.0), ("part time job", 3.0), ("part-time job", 3.0), ("part-time", 2.0),
        ("part time", 2.0), ("work from home", 2.5), ("youtube videos like", 3.0), ("like karo", 2.0),
        ("like videos", 2.0), ("rating task", 3.0), ("review task", 3.0), ("prepaid task", 3.5),
        ("registration fee", 2.0), ("bada task", 2.5), ("task", 1.5), ("tasks", 1.5), ("commission", 1.0),
        ("daily income", 1.5), ("roz", 0.5), ("kamao", 1.0), ("hr", 0.8), ("घर बैठे", 2.0), ("टास्क", 2.0),
    ],
    "investment": [
        ("investment app", 3.5), ("guaranteed returns", 3.0), ("guaranteed return", 3.0), ("double milega", 2.0),
        ("double", 1.0), ("returns", 1.0), ("profit", 1.0), ("trading platform", 2.0), ("ipo", 1.5),
        ("stock tips", 2.0), ("withdrawal", 1.0), ("invest", 1.0), ("investment", 1.0), ("munafa", 1.5),
        ("निवेश", 2.0), ("मुनाफा", 1.5),
    ],
    "pig_butchering": [
        ("dating app", 3.5), ("matrimonial", 3.0), ("girlfriend", 2.0), ("boyfriend", 2.0), ("romance", 2.5),
        ("she taught me", 2.5), ("he taught me", 2.5), ("met her", 2.0), ("met him", 2.0), ("love", 1.0),
        ("crypto trading", 1.5), ("shaadi", 1.5), ("dosti", 1.5), ("दोस्ती", 1.5),
    ],
    "digital_arrest": [
        ("digital arrest", 5.0), ("cbi officer", 3.0), ("cbi", 2.0), ("ed officer", 2.5), ("customs", 2.0),
        ("narcotics", 2.0), ("parcel", 1.5), ("money laundering", 2.0), ("arrest warrant", 3.0),
        ("video call", 0.8), ("police officer", 1.5), ("rbi account", 2.5), ("supreme court", 2.0),
        ("डिजिटल अरेस्ट", 5.0), ("गिरफ्तार", 2.0),
    ],
    "loan_app": [
        ("loan app", 4.0), ("instant loan", 3.0), ("recovery agent", 3.0), ("morphed", 3.0), ("contacts ko", 1.5),
        ("contacts", 1.0), ("loan", 1.5), ("emi", 1.0), ("dhamki", 1.5), ("लोन", 2.0),
    ],
    "sextortion": [
        ("sextortion", 5.0), ("nude", 3.5), ("intimate video", 3.5), ("obscene video", 3.5), ("blackmail", 2.5),
        ("viral kar denge", 3.0), ("video call pe", 1.0), ("record karke", 1.5), ("अश्लील", 3.5),
    ],
    "lottery": [
        ("lottery", 4.0), ("lucky draw", 3.5), ("you have won", 3.0), ("prize", 2.5), ("kbc", 3.0),
        ("processing fee", 1.5), ("inaam", 2.5), ("लॉटरी", 4.0), ("इनाम", 2.5),
    ],
    "impersonation": [
        ("customer care", 3.5), ("customer support", 3.0), ("helpline", 2.0), ("anydesk", 3.5),
        ("teamviewer", 3.5), ("refund", 2.0), ("kyc update", 3.0), ("kyc", 1.5), ("screen share", 2.5),
        ("bank officer", 2.0),
    ],
    "phishing": [
        ("airdrop", 4.0), ("seed phrase", 4.0), ("recovery phrase", 4.0), ("private key", 3.5),
        ("connect wallet", 3.0), ("connected my wallet", 3.0), ("wallet connect", 3.0), ("fake site", 2.5),
        ("approve", 1.0), ("metamask", 1.5), ("claim", 1.0), ("phishing", 3.0),
    ],
    "other": [],
}

_PATTERNS = {
    cid: [(phrase, w, re.compile(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", re.IGNORECASE))
          for phrase, w in sorted(kws, key=lambda kw: -len(kw[0]))]
    for cid, kws in _KEYWORDS.items()
}


@dataclass
class ClassProb:
    id: str
    name: str
    p: float


@dataclass
class Trigger:
    phrase: str
    weight: float
    classId: str


@dataclass
class TypologyResult:
    top: str
    classes: list[ClassProb]
    triggers: list[Trigger]
    disclaimer: str
    all_probabilities: dict[str, float]


def class_name(cid: str) -> str:
    return _NAMES.get(cid, _NAMES["other"])


def classify(text: str) -> TypologyResult:
    scores = dict(_PRIOR)
    raw_triggers: list[tuple[str, float, str]] = []
    for cid, patterns in _PATTERNS.items():
        spans: list[tuple[int, int]] = []
        for _phrase, w, rx in patterns:
            m = next((m for m in rx.finditer(text)
                      if not any(m.start() >= s and m.end() <= e for s, e in spans)), None)
            if m is None:
                continue
            spans.append((m.start(), m.end()))
            scores[cid] += w
            raw_triggers.append((m.group(0), w, cid))

    total = sum(scores.values())
    probs = {cid: s / total for cid, s in scores.items()}
    ranked = sorted(probs.items(), key=lambda kv: -kv[1])
    matched_weight = sum(w for _, w, _ in raw_triggers) or 1.0
    # Weights on the wire are each phrase's share of all evidence found, so they read as
    # "how much of this suggestion came from this phrase".
    triggers = sorted(
        (Trigger(phrase, round(w / matched_weight, 2), cid) for phrase, w, cid in raw_triggers),
        key=lambda t: -t.weight,
    )[:6]
    return TypologyResult(
        top=ranked[0][0],
        classes=[ClassProb(cid, class_name(cid), round(p, 3)) for cid, p in ranked[:3]],
        triggers=triggers,
        disclaimer=DISCLAIMER,
        all_probabilities=probs,
    )
