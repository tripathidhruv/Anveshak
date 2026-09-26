"""Known-good token contract addresses, used to filter fetched transfers against a
case's own declared asset.

A spam / address-poisoning token contract can freely spoof its own `symbol` string (e.g.
name itself "USDT" with 6 decimals, indistinguishable by symbol alone) but it cannot BE
the real token's contract address. Filtering by contract address, not symbol, is what
actually defeats that attack. See Task F8 in
docs/superpowers/plans/2026-09-26-backend-whole-branch-review-fixes.md.
"""

from dataclasses import dataclass
from typing import Literal

# The three real cases a case's declared asset can resolve to, once we know which chain
# and which display label it is:
#   "native"  -- the asset IS known, and IS the chain's native coin (e.g. native ETH).
#                There is no contract to filter token transfers against; instead, EVERY
#                token-contract transfer must be excluded from this trace entirely, since
#                the declared asset is specifically the native coin, not any ERC-20/TRC-20
#                token.
#   "contract" -- the asset IS known and IS a specific token contract. Token transfers
#                should be filtered down to that exact contract address (defeats a spoofed
#                spam token sharing the same symbol), AND native-coin transfers must be
#                excluded entirely -- the declared asset is a token, never the native coin.
#   "unknown"  -- the asset label didn't map to anything this module recognizes (or no
#                label was given at all). Apply no filter -- the current permissive
#                behavior, and a documented gap for an asset this system doesn't yet know
#                how to reason about, not a silent narrowing.
#
# A single `contract: str | None` return value cannot distinguish "native" from "unknown"
# -- both would return None -- so this type carries `kind` explicitly rather than relying
# on the caller to infer it from an absent contract.
AssetContractKind = Literal["native", "contract", "unknown"]


@dataclass(frozen=True)
class AssetContractResolution:
    """Result of resolving a case's declared asset against this module's known-asset
    tables. See `AssetContractKind` above for what each `kind` means. `contract` is only
    ever set when `kind == "contract"`."""

    kind: AssetContractKind
    contract: str | None = None


# Maps (chain, canonical asset label) -> the real token contract address to filter
# transfers against. A missing entry here means "not a specific known token contract" --
# check NATIVE_ASSET_LABELS next before concluding the asset is unrecognized.
KNOWN_ASSET_CONTRACTS: dict[tuple[str, str], str] = {
    ("tron", "USDT-TRC20"): "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    ("ethereum", "USDT-ERC20"): "0xdAC17F958D2ee523a2206206994597C13D831ec7",
}

# Canonical (chain, asset label) pairs whose asset is that chain's native coin -- no
# smart-contract token behind it, so there is no analogous fake-token attack surface for
# them at the contract-matching layer. This does NOT mean "no filter" -- it means "known,
# and known to be native," which must exclude every token-contract transfer from a trace
# declared against this asset (see AssetContractKind above).
NATIVE_ASSET_LABELS: set[tuple[str, str]] = {
    ("bitcoin", "BTC"),
    ("ethereum", "ETH"),
}

# Bridges the frontend's case-creation display labels (CRYPTO_OPTIONS in
# frontend/src/pages/NewCase.tsx) to this module's canonical asset-label vocabulary
# above. Kept right next to KNOWN_ASSET_CONTRACTS on purpose -- these are two different
# string vocabularies for the same real-world assets and should stay visible together
# rather than scattered across files.
DISPLAY_LABEL_TO_ASSET_LABEL: dict[str, str] = {
    "USDT (TRC-20)": "USDT-TRC20",
    "BTC": "BTC",
    "ETH": "ETH",
}


def resolve_asset_contract(chain: str, display_label: str | None) -> AssetContractResolution:
    """Resolves a case's frontend display label (`case.asset`, e.g. `"USDT (TRC-20)"`)
    to how this chain's adapter should filter its fetched transfers.

    Returns an `AssetContractResolution`:
    - `kind="contract"`, `contract=<address>` when the label maps to a known token
      contract (filter token transfers to this address, exclude native-coin transfers).
    - `kind="native"` when the label maps to this chain's native coin (exclude every
      token-contract transfer; there is nothing to filter token transfers against).
    - `kind="unknown"` when there's no label, or the label doesn't map to anything this
      module recognizes -- apply no filter, the current permissive behavior.
    """
    if display_label is None:
        return AssetContractResolution(kind="unknown")
    asset_label = DISPLAY_LABEL_TO_ASSET_LABEL.get(display_label, display_label)
    contract = KNOWN_ASSET_CONTRACTS.get((chain, asset_label))
    if contract is not None:
        return AssetContractResolution(kind="contract", contract=contract)
    if (chain, asset_label) in NATIVE_ASSET_LABELS:
        return AssetContractResolution(kind="native")
    return AssetContractResolution(kind="unknown")
