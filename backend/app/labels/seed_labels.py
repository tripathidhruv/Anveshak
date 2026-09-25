from dataclasses import dataclass
from datetime import datetime, timezone

@dataclass(frozen=True)
class VaspLabelSeed:
    address: str
    chain: str
    entity_name: str
    source_url: str
    verified_at: datetime
    vetting_status: str  # "vetted" | "unvetted"

# A small, deliberately short seed list of publicly documented exchange hot wallets —
# per docs/superpowers/specs/2026-09-25-backend-v2-competitive-design.md #4: "our bar is a
# smaller but correctly vetted set over a larger unvetted one." Every entry must carry a
# real source_url before it can be trusted for attribution (vetting_status="vetted").
# Extend this list only with addresses that have a real, checkable public source.
SEED_LABELS: list[VaspLabelSeed] = [
    VaspLabelSeed(
        address="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",  # example placeholder — replace with a
        chain="tron",                                    # real Tronscan-labelled hot wallet
        entity_name="UNVERIFIED — seed placeholder",
        source_url="https://tronscan.org/#/tools/blacklist",
        verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
        vetting_status="unvetted",
    ),
]

def lookup_label(address: str, chain: str) -> VaspLabelSeed | None:
    for label in SEED_LABELS:
        if label.address == address and label.chain == chain:
            return label
    return None
