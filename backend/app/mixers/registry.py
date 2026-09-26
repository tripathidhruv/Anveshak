"""Known cryptocurrency mixer contracts (real, on-chain addresses, independently
verified -- see this module's own verification note below).

This module deliberately does NOT attempt to see through a mixer -- that is not an
engineering gap this codebase can close with more code. Tornado Cash's whole design
goal is breaking the on-chain link between a deposit and a withdrawal via a zk-SNARK
anonymity set; unlike a bridge (which publishes real 1:1 deposit/withdrawal
correlation signals that make app.bridge.linker.find_bridge_links() a legitimate
heuristic), there is no legitimate timing/amount heuristic that reliably
de-anonymizes a mixer. This module only says WHERE a known mixer's deposit contract
lives, so a trace can honestly stop and say "entered a mixer here" -- see
docs/superpowers/specs/2026-09-26-mixer-entry-detection-design.md.

VERIFICATION NOTE (2026-09-26): all four addresses below were independently verified
via direct Etherscan fetch (not a search-summary or doc-site prose, per this project's
own established "primary source, not aggregator claims" discipline):
  - 0.1 ETH pool (0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc): Etherscan public name
    tag "Tornado.Cash: 0.1 ETH".
  - 1 ETH pool (0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936): confirmed directly --
    verified contract, name tag "Tornado.Cash: 1 ETH".
  - 10 ETH pool (0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF): Etherscan public name
    tag "Tornado.Cash: 10 ETH".
  - 100 ETH pool (0xA160cdAB225685dA1d56aa342Ad8841c3b53f291): confirmed directly --
    verified contract, name tag "Tornado.Cash: 100 ETH", holds ~236,600 ETH.

CURRENT FACT, NOT ASSUMED FROM TRAINING DATA (verified via WebSearch against
Treasury/legal press sources, 2026-09-26): Tornado Cash was OFAC-sanctioned in August
2022, then delisted in March 2025 following a federal appeals court ruling (Van Loon v.
Treasury). As of this writing these addresses are NOT currently OFAC-sanctioned. They
are listed here purely as known, real, verified mixer protocol contracts -- this
feature does not claim or depend on current sanctions status (that is a separate,
already-existing concern handled by app.sanctions.screen, not this module).

Ethereum only. No TRON-native equivalent with a comparable single-contract-address
anonymity pool exists at this project's verification bar; Bitcoin mixing services are
typically off-chain custodial services with no canonical contract address to
register. This mirrors the same honest per-chain scoping already established for
bridge detection (app/bridge/registry.py).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class MixerContract:
    name: str
    chain: str
    contract_address: str
    source_url: str


KNOWN_MIXERS: list[MixerContract] = [
    MixerContract(
        name="Tornado.Cash: 0.1 ETH",
        chain="ethereum",
        contract_address="0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
        source_url="https://etherscan.io/address/0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
    ),
    MixerContract(
        name="Tornado.Cash: 1 ETH",
        chain="ethereum",
        contract_address="0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936",
        source_url="https://etherscan.io/address/0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936",
    ),
    MixerContract(
        name="Tornado.Cash: 10 ETH",
        chain="ethereum",
        contract_address="0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF",
        source_url="https://etherscan.io/address/0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF",
    ),
    MixerContract(
        name="Tornado.Cash: 100 ETH",
        chain="ethereum",
        contract_address="0xA160cdAB225685dA1d56aa342Ad8841c3b53f291",
        source_url="https://etherscan.io/address/0xA160cdAB225685dA1d56aa342Ad8841c3b53f291",
    ),
]


def is_mixer_contract(address: str, chain: str) -> MixerContract | None:
    """Case-appropriate lookup per chain, mirroring app.bridge.registry.is_bridge_contract:
    Ethereum addresses are compared lowercase (Etherscan's own transfer records always come
    back lowercase, matching the normalization already applied at case-creation time in
    app/api/v1/cases.py -- see that file's own comment for why). Every KNOWN_MIXERS entry is
    Ethereum-only today, but this still checks `chain` explicitly rather than assuming, so a
    same-looking address on a different chain is never mismatched onto a Tornado Cash pool."""
    for mixer in KNOWN_MIXERS:
        if mixer.chain != chain:
            continue
        if chain == "ethereum":
            if mixer.contract_address.lower() == address.lower():
                return mixer
        else:
            if mixer.contract_address == address:
                return mixer
    return None
