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
    assert found is not None
    assert found.entity_name == "Binance 14"
    assert found.hot_wallet_address == "0x28c6c06298d514db089934071355e5743bf21d60"


def test_lookup_indexed_deposit_returns_none_for_unindexed_address(db_session):
    _seed_entry(db_session, "0xdepositor1")
    assert lookup_indexed_deposit(db_session, "0xnotindexed", "ethereum") is None


def test_lookup_indexed_deposit_ethereum_is_case_insensitive(db_session):
    _seed_entry(db_session, "0xdepositor1")
    assert lookup_indexed_deposit(db_session, "0XDEPOSITOR1", "ethereum") is not None


def test_lookup_indexed_deposit_tron_is_case_sensitive(db_session):
    _seed_entry(db_session, "TDepositorAddress1111111111111111", chain="tron",
                hot_wallet_address="THotWallet00000000000000000000000",
                entity_name="Some Exchange")
    assert lookup_indexed_deposit(db_session, "TDepositorAddress1111111111111111", "tron") is not None
    assert lookup_indexed_deposit(db_session, "tdepositoraddress1111111111111111", "tron") is None


def test_lookup_indexed_deposit_respects_chain_even_if_address_reused(db_session):
    _seed_entry(db_session, "0xdepositor1", chain="ethereum")
    assert lookup_indexed_deposit(db_session, "0xdepositor1", "tron") is None
