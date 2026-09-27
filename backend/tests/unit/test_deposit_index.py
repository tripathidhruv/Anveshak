from datetime import datetime, timezone

from app.index.deposit_index import lookup_indexed_deposit
from app.models import DepositIndexEntry


def _seed_entry(db, address: str, chain: str = "ethereum",
                 hot_wallet_address: str = "0x28c6c06298d514db089934071355e5743bf21d60",
                 entity_name: str = "Binance 14") -> DepositIndexEntry:
    entry = DepositIndexEntry(
        address=address, chain=chain, hot_wallet_address=hot_wallet_address,
        entity_name=entity_name, indexed_at=datetime(2026, 9, 27, tzinfo=timezone.utc),
    )
    db.add(entry)
    db.commit()
    return entry


def test_lookup_indexed_deposit_finds_a_seeded_row(db_session):
    _seed_entry(db_session, "0xdepositor1")
    found = lookup_indexed_deposit(db_session, "0xdepositor1", "ethereum")
    assert len(found) == 1
    assert found[0].entity_name == "Binance 14"
    assert found[0].hot_wallet_address == "0x28c6c06298d514db089934071355e5743bf21d60"


def test_lookup_indexed_deposit_returns_empty_list_for_unindexed_address(db_session):
    _seed_entry(db_session, "0xdepositor1")
    assert lookup_indexed_deposit(db_session, "0xnotindexed", "ethereum") == []


def test_lookup_indexed_deposit_ethereum_is_case_insensitive(db_session):
    _seed_entry(db_session, "0xdepositor1")
    assert len(lookup_indexed_deposit(db_session, "0XDEPOSITOR1", "ethereum")) == 1


def test_lookup_indexed_deposit_tron_is_case_sensitive(db_session):
    _seed_entry(db_session, "TDepositorAddress1111111111111111", chain="tron",
                hot_wallet_address="THotWallet00000000000000000000000",
                entity_name="Some Exchange")
    assert len(lookup_indexed_deposit(db_session, "TDepositorAddress1111111111111111", "tron")) == 1
    assert lookup_indexed_deposit(db_session, "tdepositoraddress1111111111111111", "tron") == []


def test_lookup_indexed_deposit_respects_chain_even_if_address_reused(db_session):
    _seed_entry(db_session, "0xdepositor1", chain="ethereum")
    assert lookup_indexed_deposit(db_session, "0xdepositor1", "tron") == []


def test_lookup_indexed_deposit_returns_all_hot_wallets_for_a_multi_exchange_depositor(db_session):
    """The exact bug this fix closes: the SAME depositor address can genuinely feed TWO
    DIFFERENT vetted hot wallets (e.g. it is a customer of both Kraken and Coinbase). Both
    deposit relationships are real and must both surface -- collapsing to a single row/None
    would silently misattribute the depositor to whichever exchange was indexed first."""
    _seed_entry(db_session, "0xsharedpayer",
                hot_wallet_address="0xkrakenhotwallet00000000000000000000000",
                entity_name="Kraken")
    _seed_entry(db_session, "0xsharedpayer",
                hot_wallet_address="0xcoinbasehotwallet0000000000000000000000",
                entity_name="Coinbase")

    found = lookup_indexed_deposit(db_session, "0xsharedpayer", "ethereum")

    assert len(found) == 2
    entity_names = {row.entity_name for row in found}
    hot_wallets = {row.hot_wallet_address for row in found}
    assert entity_names == {"Kraken", "Coinbase"}
    assert hot_wallets == {"0xkrakenhotwallet00000000000000000000000",
                           "0xcoinbasehotwallet0000000000000000000000"}
