"""Synthetic demo content for the national memory, matching the web console's demo story.

Everything here is invented: syndicate names, case ids, amounts and addresses. The hub addresses
are short placeholders that are deliberately NOT valid wallet addresses, so they can never be
mistaken for a live case. `seed_demo` is idempotent -- it adds only what is missing -- so it is
safe to call on every startup.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.memory.store import canonical, record_submission
from app.models import MemorySyndicate, MemoryWallet

IST = timezone(timedelta(hours=5, minutes=30))


def _t(y: int, mo: int, d: int, h: int, mi: int) -> datetime:
    return datetime(y, mo, d, h, mi, tzinfo=IST)


SYNDICATES = [
    ("SYN-07", "Telegram task-scam ring “Saffron Desk”", "TNh8yW5vC2mQ7fL4xK9pR", 38, 11, 47000000, 0.93),
    ("SYN-03", "Romance / pig-butchering cell “Lotus”", "TRw2pD9kH5sM3nV8cF1qL", 17, 6, 31200000, 0.88),
    ("SYN-11", "Loan-app extortion network", "0x4f1c92ad07be33e5a8", 9, 4, 6400000, 0.74),
    ("SYN-02", "Digital-arrest impersonation group", "TGm6vB2nQ8xK4hR7pL3wD", 6, 3, 9800000, 0.69),
]

# (address, chain, syndicate, [(case_id, relation, unit, city, state, amount_inr, at, event)])
WALLETS = [
    ("TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm", "tron", "SYN-07", [
        ("ANV-2026-0406", "one_hop", "Cyber PS Patna", "Patna", "Bihar", 760000, _t(2026, 8, 21, 16, 5), "linked"),
        ("ANV-2026-0412", "same_wallet", "Cyber PS Ludhiana", "Ludhiana", "Punjab", 655000, _t(2026, 8, 29, 14, 40), "submitted"),
        ("ANV-2026-0416", "same_wallet", "Cyber PS Kochi", "Kochi", "Kerala", 860000, _t(2026, 9, 3, 9, 18), "submitted"),
    ]),
    ("TNh8yW5vC2mQ7fL4xK9pR", "tron", "SYN-07", [
        ("ANV-2026-0398", "shared_hub", "Cyber PS Indore", "Indore", "Madhya Pradesh", 540000, _t(2026, 8, 12, 11, 30), "linked"),
        ("ANV-2026-0406", "shared_hub", "Cyber PS Patna", "Patna", "Bihar", 760000, _t(2026, 8, 21, 16, 20), "linked"),
    ]),
    ("TRw2pD9kH5sM3nV8cF1qL", "tron", "SYN-03", [
        ("ANV-2026-0371", "same_wallet", "Cyber PS Bengaluru", "Bengaluru", "Karnataka", 2350000, _t(2026, 7, 30, 10, 0), "submitted"),
        ("ANV-2026-0402", "shared_hub", "Cyber PS Hyderabad", "Hyderabad", "Telangana", 1800000, _t(2026, 8, 17, 18, 45), "linked"),
    ]),
    ("0x4f1c92ad07be33e5a8", "ethereum", "SYN-11", [
        ("ANV-2026-0385", "same_wallet", "Cyber PS Lucknow", "Lucknow", "Uttar Pradesh", 420000, _t(2026, 8, 5, 13, 10), "submitted"),
    ]),
    ("TGm6vB2nQ8xK4hR7pL3wD", "tron", "SYN-02", [
        ("ANV-2026-0390", "same_wallet", "Cyber PS Pune", "Pune", "Maharashtra", 3100000, _t(2026, 8, 9, 15, 25), "submitted"),
        ("ANV-2026-0409", "one_hop", "Cyber PS Chennai", "Chennai", "Tamil Nadu", 1450000, _t(2026, 8, 25, 12, 0), "linked"),
    ]),
    ("TLp4cV9xN2mQ6rT8kH3sY", "tron", "SYN-03", [
        ("ANV-2026-0393", "one_hop", "Cyber PS Ahmedabad", "Ahmedabad", "Gujarat", 980000, _t(2026, 8, 10, 9, 40), "linked"),
    ]),
]


def seed_demo(db: Session) -> None:
    for sid, name, hub, cases, states, value, conf in SYNDICATES:
        if db.get(MemorySyndicate, sid) is None:
            db.add(MemorySyndicate(id=sid, name=name, hub=hub, case_count=cases, state_count=states,
                                   value_inr=value, confidence=conf))
    db.commit()
    for address, chain, syn, events in WALLETS:
        if db.query(MemoryWallet).filter(MemoryWallet.address == canonical(address)).first() is not None:
            continue
        for case_id, relation, unit, city, state, amount, at, event in events:
            record_submission(db, address=address, chain=chain, case_id=case_id, unit=unit, city=city, state=state,
                              amount_inr=amount, at=at, relation=relation, event=event, syndicate_id=syn)
