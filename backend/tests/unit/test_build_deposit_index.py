import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from app.chains.base import Transfer
from app.labels.seed_labels import VaspLabelSeed
from app.models import DepositIndexEntry

# scripts/ is not itself a package under app/ -- add backend/scripts to sys.path the same way
# tests/test_calibrate.py does for scripts/calibrate.py.
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from build_deposit_index import build_index, index_hot_wallet  # noqa: E402


class FakeChainClient:
    """Same pattern as tests/unit/test_tracer_causality.py's FakeChainClient."""
    def __init__(self, chain: str, transfers: list[Transfer]):
        self.chain = chain
        self._transfers = transfers

    def get_transfers(self, address, since=None):
        transfers = self._transfers
        if since is not None:
            transfers = [t for t in transfers if t.timestamp >= since]
        return transfers


def mk(chain, from_addr, to_addr, amount, ts, tx="tx"):
    return Transfer(tx_hash=tx, chain=chain, from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20" if chain == "tron" else "ETH",
                     timestamp=ts, fee=Decimal("0"), raw={})


def _vetted_label(address="0xhotwallet", chain="ethereum", entity_name="Fake Exchange"):
    return VaspLabelSeed(
        address=address, chain=chain, entity_name=entity_name,
        source_url="https://example.test/fake-label",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc), vetting_status="vetted",
    )


def test_index_hot_wallet_writes_one_row_per_distinct_depositor(db_session):
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    label = _vetted_label()
    transfers = [
        mk("ethereum", "0xpayer1", "0xhotwallet", 100, t0),
        mk("ethereum", "0xpayer2", "0xhotwallet", 50, t0),
        mk("ethereum", "0xpayer1", "0xhotwallet", 25, t0),  # same payer again -- must not duplicate
        mk("ethereum", "0xhotwallet", "0xdownstream", 175, t0),  # outgoing -- must be ignored
    ]
    client = FakeChainClient("ethereum", transfers)

    written = index_hot_wallet(db_session, label, client)

    assert written == 2
    rows = db_session.query(DepositIndexEntry).all()
    addresses = {r.address for r in rows}
    assert addresses == {"0xpayer1", "0xpayer2"}
    for row in rows:
        assert row.hot_wallet_address == "0xhotwallet"
        assert row.entity_name == "Fake Exchange"
        assert row.chain == "ethereum"


def test_index_hot_wallet_rerun_does_not_create_duplicate_rows(db_session):
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    label = _vetted_label()
    transfers = [mk("ethereum", "0xpayer1", "0xhotwallet", 100, t0)]
    client = FakeChainClient("ethereum", transfers)

    first_written = index_hot_wallet(db_session, label, client)
    second_written = index_hot_wallet(db_session, label, client)

    assert first_written == 1
    assert second_written == 0
    rows = db_session.query(DepositIndexEntry).filter_by(address="0xpayer1").all()
    assert len(rows) == 1


def test_index_hot_wallet_normalizes_ethereum_case(db_session):
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    label = _vetted_label(address="0xHotWallet")
    # to_address deliberately differently-cased than the label's own address -- must still match.
    transfers = [mk("ethereum", "0xPayerMixedCase", "0xhotwallet", 10, t0)]
    client = FakeChainClient("ethereum", transfers)

    written = index_hot_wallet(db_session, label, client)

    assert written == 1
    row = db_session.query(DepositIndexEntry).one()
    assert row.address == "0xpayermixedcase"
    assert row.hot_wallet_address == "0xhotwallet"


def test_build_index_only_processes_vetted_labels(db_session, monkeypatch):
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    vetted = _vetted_label(address="0xvetted", entity_name="Vetted Exchange")
    unvetted = VaspLabelSeed(
        address="0xunvetted", chain="ethereum", entity_name="Unvetted Exchange",
        source_url="https://example.test/unvetted",
        verified_at=datetime(2026, 9, 27, tzinfo=timezone.utc), vetting_status="unvetted",
    )
    fake_seed_labels = [vetted, unvetted]
    monkeypatch.setattr("build_deposit_index.SEED_LABELS", fake_seed_labels)

    clients_by_hot_wallet = {
        "0xvetted": FakeChainClient("ethereum", [mk("ethereum", "0xdepositor", "0xvetted", 10, t0)]),
        "0xunvetted": FakeChainClient("ethereum", [mk("ethereum", "0xshouldnotappear", "0xunvetted", 10, t0)]),
    }

    def fake_factory(chain, asset=None):
        # build_index calls this once per label, in order -- return the matching fake client
        # for whichever hot wallet is about to be indexed by inspecting call order isn't
        # possible here, so route via a wrapper that remembers the label being processed.
        return _RoutingClient(clients_by_hot_wallet)

    class _RoutingClient:
        def __init__(self, by_hot_wallet):
            self.chain = "ethereum"
            self._by_hot_wallet = by_hot_wallet

        def get_transfers(self, address, since=None):
            return self._by_hot_wallet[address].get_transfers(address, since)

    hot_wallets_processed, total_written = build_index(db_session, client_factory=fake_factory)

    assert hot_wallets_processed == 1  # only the vetted label
    assert total_written == 1
    rows = db_session.query(DepositIndexEntry).all()
    assert len(rows) == 1
    assert rows[0].address == "0xdepositor"
    assert rows[0].entity_name == "Vetted Exchange"
