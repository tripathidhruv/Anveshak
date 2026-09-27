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
#
# VERIFICATION NOTE (Task A, 2026-09-27, docs/superpowers/specs/2026-09-27-inverted-deposit-
# index-design.md): every "vetted" entry below was independently verified via a DIRECT fetch
# of the address's own Etherscan page (not a search-engine summary, not a documentation
# site's prose, not memory) -- the same "primary source, not aggregator claims" discipline
# established by app/bridge/registry.py and app/mixers/registry.py's own verification notes.
# A first candidate (a TRON address surfaced by web search results mentioning "Binance hot
# wallet") was REJECTED before being added here: TronScan's own account API
# (apilist.tronscanapi.com/api/account) returned an empty `"name"` field (no public tag at
# all) and a balance of roughly $100 -- nowhere near a real exchange hot wallet -- exactly
# the kind of plausible-looking-but-fabricated lead this project's own verification
# discipline exists to catch. Direct TronScan address-page and contract-API fetches were
# also blocked (403/401) in this environment, so every entry below is Ethereum, each
# confirmed by a direct Etherscan fetch of the address's own page:
#   - 0x27fd43babfbe83a81d14665b1a6fb8030a60c9b4: Etherscan public name tag "WazirX 2"
#     (India-relevant). Account type: a GnosisSafeProxy smart-contract wallet ("Smart
#     Account by Safe", Safe Singleton 1.3.0) -- NOT an EOA. Etherscan's own page also
#     displays a live exploit warning ("There are reports that this address has been
#     exploited", citing CyversAlerts) -- this is WazirX's real, well-documented hot wallet
#     from the July 2024 ~$230M hack (Wikipedia: "2024 WazirX hack"); the exploit does not
#     change that Etherscan itself attributes ownership of the address to WazirX, only that
#     any deposit-index hit against it should be read as "WazirX's own wallet", including
#     its compromised period. https://etherscan.io/address/0x27fd43babfbe83a81d14665b1a6fb8030a60c9b4
#   - 0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe: Etherscan public name tag "CoinDCX 2"
#     (India-relevant), category "Exchange", account type EOA.
#     https://etherscan.io/address/0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe
#   - 0x28c6c06298d514db089934071355e5743bf21d60: Etherscan public name tag "Binance 14",
#     account type EOA. https://etherscan.io/address/0x28c6c06298d514db089934071355e5743bf21d60
#   - 0x71660c4005ba85c37ccec55d0c4493e66fe775d3: Etherscan public name tag "Coinbase 1",
#     category "Exchange" / "Fiat Gateway", account type EOA.
#     https://etherscan.io/address/0x71660c4005ba85c37ccec55d0c4493e66fe775d3
#   - 0x2910543af39aba0cd09dbb2d50200b3e800a63d2: Etherscan public name tag "Kraken 1",
#     account type EOA. https://etherscan.io/address/0x2910543af39aba0cd09dbb2d50200b3e800a63d2
# Other India-relevant exchanges searched but NOT added, per this file's own "smaller
# correctly vetted set over a larger unvetted one" bar: ZebPay, CoinSwitch, Mudrex -- no
# direct Etherscan/TronScan-labelled hot wallet address could be found and confirmed for any
# of these at the time of this search; ship what was verified, not padded to a target count.
# Stored lowercase to match app/chains/evm.py's Transfer.from_address/to_address, which come
# straight from Etherscan's own API responses (always lowercase) -- see app/bridge/registry.py
# and app/mixers/registry.py's own comments for why Ethereum addresses are handled lowercase
# throughout this codebase.
SEED_LABELS: list[VaspLabelSeed] = [
    VaspLabelSeed(
        address="TPlaceholderUnvettedSeed0000000001",  # deliberately fake -- CLAUDE.md rule 1:
        chain="tron",                                   # never a real address for an unvetted entry
        entity_name="UNVERIFIED — seed placeholder",
        source_url="https://tronscan.org/#/tools/blacklist",
        verified_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
        vetting_status="unvetted",
    ),
    VaspLabelSeed(
        address="0x27fd43babfbe83a81d14665b1a6fb8030a60c9b4",
        chain="ethereum",
        entity_name="WazirX 2",
        source_url="https://etherscan.io/address/0x27fd43babfbe83a81d14665b1a6fb8030a60c9b4",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        vetting_status="vetted",
    ),
    VaspLabelSeed(
        address="0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe",
        chain="ethereum",
        entity_name="CoinDCX 2",
        source_url="https://etherscan.io/address/0x2407b9b9662d970ece2224a0403d3b15c7e4d1fe",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        vetting_status="vetted",
    ),
    VaspLabelSeed(
        address="0x28c6c06298d514db089934071355e5743bf21d60",
        chain="ethereum",
        entity_name="Binance 14",
        source_url="https://etherscan.io/address/0x28c6c06298d514db089934071355e5743bf21d60",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        vetting_status="vetted",
    ),
    VaspLabelSeed(
        address="0x71660c4005ba85c37ccec55d0c4493e66fe775d3",
        chain="ethereum",
        entity_name="Coinbase 1",
        source_url="https://etherscan.io/address/0x71660c4005ba85c37ccec55d0c4493e66fe775d3",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        vetting_status="vetted",
    ),
    VaspLabelSeed(
        address="0x2910543af39aba0cd09dbb2d50200b3e800a63d2",
        chain="ethereum",
        entity_name="Kraken 1",
        source_url="https://etherscan.io/address/0x2910543af39aba0cd09dbb2d50200b3e800a63d2",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
        vetting_status="vetted",
    ),
]

def lookup_label(address: str, chain: str) -> VaspLabelSeed | None:
    for label in SEED_LABELS:
        if label.address == address and label.chain == chain:
            return label
    return None
