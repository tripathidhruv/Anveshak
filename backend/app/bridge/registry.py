"""Known bridge contracts for cross-chain fund-flow correlation (real, on-chain addresses
where independently verified -- see this module's own verification note below for which
path was taken). Paired with `app/bridge/linker.py`'s find_bridge_links(), which is the
correlation heuristic itself; this module only says WHERE to look for the other side.

VERIFICATION NOTE (Task 1, 2026-09-26): Real addresses were used, not the fictional
fallback. Allbridge Core's own docs site prose was treated with the suspicion the task
brief called for -- one fetch of its "Allbridge Core contracts" page turned up nothing
(rendered as a 404), and a separate web-search summary confidently attributed an address
(0x409fea77e184add514d0c49406b239115d2100cf) to the bridge that turned out, on direct
Etherscan lookup, to be a plain EOA with no contract code at all, merely "Funded By:
Allbridge: Core Bridge" -- exactly the kind of doc-site-prose fabrication the brief warned
about. The pair below was instead cross-confirmed on each chain's own primary data source,
not the docs site:
  - Ethereum side (0x7DBF07Ad92Ed4e26D5511b4F285508eBF174135D): Etherscan shows this
    contract's source code as Verified (Solidity 0.8.18, MIT), created by "Allbridge:
    Deployer 1", carrying Etherscan's own public name tag "Allbridge: LP-USDT Token".
  - Tron side (TAC21biCBL9agjuUyzd4gZr356zRgJq61b): TronScan's own contract API
    (apilist.tronscanapi.com/api/contract) reports `verify_status: 2` (verified),
    `accountType: 2` (contract), name "Pool", and an issued TRC-20 token
    `tokenAbbr: "LP-USDT"` / `tokenName: "Allbridge LP"` -- plus a method map
    (`swapToVUsd`, `swapFromVUsd`, `deposit`, `withdraw`, `setRouter`, ...) matching
    Allbridge Core's documented vUSD virtual-bridging design.
  Both are Allbridge Core's native USDT liquidity-pool contracts (not the USDT token
  contract itself) on their respective chains, linked via Allbridge's vUSD messaging
  layer -- this is the real pairing a TRON<->Ethereum USDT bridge hop through Allbridge
  Core would show on-chain.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class BridgeContract:
    name: str
    chain: str                    # "tron" | "ethereum"
    contract_address: str
    source_url: str
    paired_chain: str              # the chain on the OTHER side of this bridge
    paired_contract_address: str   # that side's own contract address
    paired_asset_label: str        # canonical asset label on the paired chain (known_assets.py
                                    # vocabulary, e.g. "USDT-ERC20") -- passed straight to
                                    # get_chain_client(paired_chain, paired_asset_label)

KNOWN_BRIDGES: list[BridgeContract] = [
    BridgeContract(
        name="Allbridge Core USDT Pool",
        chain="tron",
        contract_address="TAC21biCBL9agjuUyzd4gZr356zRgJq61b",
        source_url="https://tronscan.org/#/contract/TAC21biCBL9agjuUyzd4gZr356zRgJq61b",
        paired_chain="ethereum",
        paired_contract_address="0x7DBF07Ad92Ed4e26D5511b4F285508eBF174135D",
        paired_asset_label="USDT-ERC20",
    ),
    BridgeContract(
        name="Allbridge Core USDT Pool",
        chain="ethereum",
        contract_address="0x7DBF07Ad92Ed4e26D5511b4F285508eBF174135D",
        source_url="https://etherscan.io/address/0x7DBF07Ad92Ed4e26D5511b4F285508eBF174135D",
        paired_chain="tron",
        paired_contract_address="TAC21biCBL9agjuUyzd4gZr356zRgJq61b",
        paired_asset_label="USDT-TRC20",
    ),
]

# A confidence bar for treating a find_bridge_links() result as a confirmed crossing to
# continue the trace onto, not just a candidate to note. find_bridge_links's own confidence
# is (time_confidence + amount_confidence) / 2, each already in [0, 1] -- 0.6 means the pair
# is, on average, meaningfully closer to "clearly matching" than "borderline" on both
# dimensions, while still tolerant of realistic bridge latency/fee variance. This is a real,
# adjustable threshold, not a magic number kept only by convention -- revisit if real bridge
# data shows this bar is too strict or too loose.
MIN_BRIDGE_LINK_CONFIDENCE = 0.6

def is_bridge_contract(address: str, chain: str) -> BridgeContract | None:
    """Case-appropriate lookup per chain: TRON (base58) is case-sensitive exact match;
    Ethereum addresses are compared lowercase (Etherscan's own transfer records always come
    back lowercase, matching the normalization already applied at case-creation time in
    app/api/v1/cases.py -- see that file's own comment for why)."""
    for bridge in KNOWN_BRIDGES:
        if bridge.chain != chain:
            continue
        if chain == "ethereum":
            if bridge.contract_address.lower() == address.lower():
                return bridge
        else:
            if bridge.contract_address == address:
                return bridge
    return None
