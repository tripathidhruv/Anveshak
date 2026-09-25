"""Known-good token contract addresses, used to filter fetched transfers against a
case's own declared asset.

A spam / address-poisoning token contract can freely spoof its own `symbol` string (e.g.
name itself "USDT" with 6 decimals, indistinguishable by symbol alone) but it cannot BE
the real token's contract address. Filtering by contract address, not symbol, is what
actually defeats that attack. See Task F8 in
docs/superpowers/plans/2026-09-26-backend-whole-branch-review-fixes.md.
"""

# Maps (chain, canonical asset label) -> the real token contract address to filter
# transfers against. A missing entry means "no contract filter to apply" -- native
# assets (BTC, native ETH) have no smart-contract token behind them, so there is no
# analogous fake-token attack surface for them at this layer.
KNOWN_ASSET_CONTRACTS: dict[tuple[str, str], str] = {
    ("tron", "USDT-TRC20"): "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    ("ethereum", "USDT-ERC20"): "0xdAC17F958D2ee523a2206206994597C13D831ec7",
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


def resolve_asset_contract(chain: str, display_label: str | None) -> str | None:
    """Resolves a case's frontend display label (`case.asset`, e.g. `"USDT (TRC-20)"`)
    to the known-good contract address to filter that chain's transfers against.

    Returns None when there's nothing to filter on -- no display label given, the label
    doesn't map to a known asset, or the asset is a native asset with no contract
    (e.g. `"BTC"`, native `"ETH"`). None means "apply no contract filter," not an error.
    """
    if display_label is None:
        return None
    asset_label = DISPLAY_LABEL_TO_ASSET_LABEL.get(display_label, display_label)
    return KNOWN_ASSET_CONTRACTS.get((chain, asset_label))
