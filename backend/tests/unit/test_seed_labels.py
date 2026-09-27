from app.labels.seed_labels import SEED_LABELS, lookup_label


def test_original_unvetted_placeholder_is_untouched():
    # This task's brief is explicit: fix the zero-vetted-entries gap by ADDING real vetted
    # entries, never by touching or removing the existing unvetted placeholder.
    #
    # The placeholder's ADDRESS itself was later found to be a compliance bug (a later task,
    # "replace real USDT contract address placeholder"): it had been set to the real, live
    # Tether USDT-TRC20 token contract address, which CLAUDE.md rule 1 forbids for anything
    # that isn't a deliberately vetted, sourced label -- this entry is explicitly
    # vetting_status="unvetted", so it should never have carried a real address at all. That
    # fix replaced the address with an obviously-synthetic one; this test was updated to match
    # so it keeps checking the placeholder's shape (chain/vetting_status/entity_name) without
    # re-encoding the real contract address back into the test suite.
    placeholder = next(l for l in SEED_LABELS if l.entity_name == "UNVERIFIED — seed placeholder")
    assert placeholder.address == "TPlaceholderUnvettedSeed0000000001"
    assert placeholder.chain == "tron"
    assert placeholder.vetting_status == "unvetted"


def test_at_least_two_real_vetted_entries_exist():
    vetted = [l for l in SEED_LABELS if l.vetting_status == "vetted"]
    assert len(vetted) >= 2


def test_every_vetted_entry_has_a_real_source_url_and_real_entity_name():
    vetted = [l for l in SEED_LABELS if l.vetting_status == "vetted"]
    for label in vetted:
        assert label.source_url.startswith("https://etherscan.io/address/") or \
            label.source_url.startswith("https://tronscan.org/")
        assert "UNVERIFIED" not in label.entity_name
        assert "placeholder" not in label.entity_name.lower()


def test_vetted_ethereum_addresses_are_lowercase():
    # Matches app/chains/evm.py's Transfer.from_address/to_address, which come straight from
    # Etherscan's own API responses (always lowercase) -- see app/bridge/registry.py's own
    # comment for why Ethereum addresses are handled lowercase throughout this codebase.
    vetted_eth = [l for l in SEED_LABELS if l.vetting_status == "vetted" and l.chain == "ethereum"]
    assert vetted_eth  # at least one real Ethereum vetted entry
    for label in vetted_eth:
        assert label.address == label.address.lower()


def test_lookup_label_finds_a_real_vetted_entry():
    vetted = next(l for l in SEED_LABELS if l.vetting_status == "vetted")
    found = lookup_label(vetted.address, vetted.chain)
    assert found is vetted


def test_india_relevant_exchanges_present():
    # Per the competitive-scoping update to this task: prioritize India-relevant exchanges
    # (WazirX, CoinDCX, ...) ahead of global ones where a real, verified label could be found.
    vetted_names = {l.entity_name for l in SEED_LABELS if l.vetting_status == "vetted"}
    assert any("WazirX" in name for name in vetted_names)
    assert any("CoinDCX" in name for name in vetted_names)
