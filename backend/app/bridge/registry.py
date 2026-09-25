from dataclasses import dataclass

@dataclass(frozen=True)
class BridgeContract:
    name: str
    chain: str
    contract_address: str
    source_url: str

# Publicly documented bridge contracts — a starting seed, not exhaustive. Every entry needs
# a real source before it's trusted, same rule as vasp_labels (docs/superpowers/specs/
# 2026-09-25-backend-v2-competitive-design.md #4).
KNOWN_BRIDGES: list[BridgeContract] = [
    BridgeContract(
        name="Multichain (deprecated) TRON<->ETH router",
        chain="tron",
        contract_address="TXBridgeContractPLACEHOLDER0000000",
        source_url="https://tronscan.org/#/contract/TXBridgeContractPLACEHOLDER0000000",
    ),
    BridgeContract(
        name="Multichain (deprecated) TRON<->ETH router",
        chain="ethereum",
        contract_address="0xbridgevault0000000000000000000003",
        source_url="https://etherscan.io/address/0xbridgevault0000000000000000000003",
    ),
]

def bridges_for_chain(chain: str) -> list[BridgeContract]:
    return [b for b in KNOWN_BRIDGES if b.chain == chain]
