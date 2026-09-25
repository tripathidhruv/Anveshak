from app.chains.known_assets import resolve_asset_contract
from app.chains.registry import get_chain_client
from app.chains.tron import TronChainClient
from app.chains.evm import EvmChainClient


def test_resolves_tron_usdt_display_label_to_genuine_contract():
    assert resolve_asset_contract("tron", "USDT (TRC-20)") == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"


def test_resolves_ethereum_usdt_asset_label_to_genuine_contract():
    # The frontend's CRYPTO_OPTIONS has no ERC-20 display label today (an Ethereum case
    # is always native "ETH") -- but the lookup table itself supports "USDT-ERC20"
    # directly, for any future display label that maps to it.
    assert resolve_asset_contract("ethereum", "USDT-ERC20") == "0xdAC17F958D2ee523a2206206994597C13D831ec7"


def test_native_asset_labels_have_no_known_contract():
    assert resolve_asset_contract("bitcoin", "BTC") is None
    assert resolve_asset_contract("ethereum", "ETH") is None


def test_unknown_display_label_has_no_known_contract():
    assert resolve_asset_contract("tron", "some-unrecognized-label") is None


def test_none_display_label_has_no_known_contract():
    assert resolve_asset_contract("tron", None) is None


def test_get_chain_client_wires_resolved_contract_into_tron_adapter():
    client = get_chain_client("tron", "USDT (TRC-20)")
    assert isinstance(client, TronChainClient)
    assert client._asset_contract == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"


def test_get_chain_client_with_no_known_contract_leaves_adapter_unfiltered():
    client = get_chain_client("ethereum", "ETH")
    assert isinstance(client, EvmChainClient)
    assert client._asset_contract is None


def test_get_chain_client_with_no_asset_arg_defaults_to_unfiltered():
    client = get_chain_client("tron")
    assert isinstance(client, TronChainClient)
    assert client._asset_contract is None
