from app.sanctions.screen import load_sdn_list, screen_address, screen_hops

SANCTIONED_BTC = "149w62rY42aZBox8fGcmqNsXUzSStKeq8C"  # OFAC SDN, Ali Khorashadizadeh (SamSam)
SANCTIONED_ETH = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96"  # OFAC SDN, Lazarus/Ronin
BENIGN_BTC = "1BenignWalletNeverSanctionedAAAAAA"
BENIGN_ETH = "0x0000000000000000000000000000000000dead"


def test_seed_list_loads_and_has_entries():
    sdn_list = load_sdn_list()
    assert len(sdn_list["entries"]) >= 3
    assert sdn_list["list_version"]


def test_sanctioned_bitcoin_address_matches():
    hit = screen_address(SANCTIONED_BTC, "bitcoin")
    assert hit is not None
    assert hit.wallet_address == SANCTIONED_BTC
    assert hit.list_source == "OFAC_SDN"
    assert "Khorashadizadeh" in hit.entity_name


def test_benign_bitcoin_address_does_not_match():
    assert screen_address(BENIGN_BTC, "bitcoin") is None


def test_ethereum_match_is_case_insensitive():
    hit_lower = screen_address(SANCTIONED_ETH.lower(), "ethereum")
    hit_mixed = screen_address(SANCTIONED_ETH, "ethereum")
    assert hit_lower is not None
    assert hit_mixed is not None
    assert hit_lower.entity_name == hit_mixed.entity_name


def test_wrong_chain_does_not_match_even_if_string_equal():
    # A bitcoin-sanctioned address string screened against the wrong chain must not match --
    # chain is part of the identity, not just a display label.
    assert screen_address(SANCTIONED_BTC, "ethereum") is None


def test_screen_hops_flags_matching_hop_and_skips_benign_hop():
    hops = [
        (BENIGN_BTC, "bitcoin"),
        (SANCTIONED_BTC, "bitcoin"),
        (BENIGN_ETH, "ethereum"),
    ]
    hits = screen_hops(hops)
    assert len(hits) == 1
    assert hits[0].wallet_address == SANCTIONED_BTC


def test_screen_hops_reports_every_matching_hop_not_just_terminal():
    # Per the task brief: screen every hop in a trace, not just the terminal wallet. A
    # sanctioned address appearing at two different hop positions should be reported twice.
    hops = [
        (SANCTIONED_ETH, "ethereum"),
        (BENIGN_BTC, "bitcoin"),
        (SANCTIONED_ETH, "ethereum"),
    ]
    hits = screen_hops(hops)
    assert len(hits) == 2
