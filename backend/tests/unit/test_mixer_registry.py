from app.mixers.registry import KNOWN_MIXERS, is_mixer_contract

# The exact 4 real, independently-verified Tornado Cash pool addresses from
# docs/superpowers/specs/2026-09-26-mixer-entry-detection-design.md -- this test locks in
# that nobody quietly swaps in a guessed/fabricated address later.
EXPECTED_ADDRESSES = {
    "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",  # 0.1 ETH
    "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936",  # 1 ETH
    "0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF",  # 10 ETH
    "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291",  # 100 ETH
}


def test_known_mixers_are_exactly_the_four_verified_tornado_cash_pools():
    assert len(KNOWN_MIXERS) == 4
    assert {m.contract_address for m in KNOWN_MIXERS} == EXPECTED_ADDRESSES
    assert all(m.chain == "ethereum" for m in KNOWN_MIXERS)


def test_is_mixer_contract_matches_known_address_case_insensitively():
    addr = "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc"
    assert is_mixer_contract(addr, "ethereum") is not None
    assert is_mixer_contract(addr.lower(), "ethereum") is not None
    assert is_mixer_contract(addr.upper().replace("0X", "0x"), "ethereum") is not None


def test_is_mixer_contract_returns_none_for_unknown_address():
    assert is_mixer_contract("0xnotamixeraddress000000000000000000000", "ethereum") is None


def test_is_mixer_contract_returns_none_when_chain_does_not_match():
    # A same-looking address on a different chain must never be mismatched onto a
    # Tornado Cash pool -- these registries are all Ethereum-only per the design doc.
    addr = "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936"
    assert is_mixer_contract(addr, "tron") is None
    assert is_mixer_contract(addr, "bitcoin") is None


def test_is_mixer_contract_returns_the_matching_mixer_contract_object():
    addr = "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291"
    mixer = is_mixer_contract(addr, "ethereum")
    assert mixer is not None
    assert mixer.name == "Tornado.Cash: 100 ETH"
    assert mixer.contract_address == addr
