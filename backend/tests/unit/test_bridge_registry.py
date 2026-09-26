from app.bridge.registry import is_bridge_contract, KNOWN_BRIDGES, MIN_BRIDGE_LINK_CONFIDENCE

def test_known_bridges_list_is_not_empty():
    assert len(KNOWN_BRIDGES) >= 2  # at least one TRON entry, one Ethereum entry

def test_every_bridge_entry_has_a_reverse_pairing():
    # Every entry's (paired_chain, paired_contract_address) must match some OTHER entry's
    # own (chain, contract_address) -- the pairing must be genuinely bidirectional, not a
    # one-way pointer to an address nothing else declares.
    by_chain_and_address = {(b.chain, b.contract_address) for b in KNOWN_BRIDGES}
    for b in KNOWN_BRIDGES:
        assert (b.paired_chain, b.paired_contract_address) in by_chain_and_address

def test_is_bridge_contract_finds_tron_side_exact_case():
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")
    assert is_bridge_contract(tron_bridge.contract_address, "tron") == tron_bridge

def test_is_bridge_contract_tron_is_case_sensitive():
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")
    assert is_bridge_contract(tron_bridge.contract_address.lower(), "tron") is None

def test_is_bridge_contract_finds_ethereum_side_lowercase_normalized():
    eth_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "ethereum")
    assert is_bridge_contract(eth_bridge.contract_address.upper(), "ethereum") == eth_bridge

def test_is_bridge_contract_returns_none_for_unknown_address():
    assert is_bridge_contract("not-a-bridge-address", "tron") is None

def test_is_bridge_contract_respects_chain_even_if_address_reused():
    tron_bridge = next(b for b in KNOWN_BRIDGES if b.chain == "tron")
    assert is_bridge_contract(tron_bridge.contract_address, "ethereum") is None

def test_min_bridge_link_confidence_is_a_real_fraction():
    assert 0.0 < MIN_BRIDGE_LINK_CONFIDENCE < 1.0
