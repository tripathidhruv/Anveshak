import hashlib
from decimal import Decimal

import httpx
import pytest

from app.freeze import tether

# --- Test-only helpers to build genuinely valid, deterministic Tron addresses ---
# `tether._tron_base58check_decode` verifies a real Base58Check checksum, so fixture wallet
# addresses (unlike the freeform placeholder strings other test suites in this project use for
# Tron wallets, e.g. "TScamWalletBBBB...") must be genuinely valid or every call would fail at
# the address-encoding step before ever reaching the network. This encoder is test-only (not
# shipped in tether.py) and deliberately mirrors the same checksum algorithm the production
# decoder verifies, so a round trip through both proves the production decoder is correct
# without hardcoding any real-world address's exact byte value from memory.

_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _b58encode(data: bytes) -> str:
    num = int.from_bytes(data, "big")
    encoded = ""
    while num > 0:
        num, rem = divmod(num, 58)
        encoded = _ALPHABET[rem] + encoded
    n_pad = len(data) - len(data.lstrip(b"\x00"))
    return "1" * n_pad + encoded


def make_tron_address(seed_byte: int) -> str:
    payload = b"\x41" + bytes([seed_byte]) * 20
    checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    return _b58encode(payload + checksum)


TRON_WALLET = make_tron_address(0xAB)
ETH_WALLET = "0x" + "0" * 38 + "aa"


# --- Address encoding ---

def test_tron_address_roundtrip_via_test_encoder():
    payload = tether._tron_base58check_decode(TRON_WALLET)
    assert payload[0] == 0x41
    assert payload[1:] == bytes([0xAB]) * 20


def test_real_usdt_trc20_contract_address_decodes_without_error():
    # Sanity check against the genuine, real USDT-TRC20 contract address (not a fabricated
    # placeholder) -- confirms the decoder accepts a real-world checksummed address.
    payload = tether._tron_base58check_decode(tether.USDT_TRC20_CONTRACT)
    assert len(payload) == 21
    assert payload[0] == 0x41


def test_tron_address_bad_checksum_rejected():
    tampered = TRON_WALLET[:-1] + ("A" if TRON_WALLET[-1] != "A" else "B")
    with pytest.raises(ValueError):
        tether._tron_base58check_decode(tampered)


def test_tron_address_param_is_64_hex_chars_no_chain_prefix():
    param = tether._tron_address_param(TRON_WALLET)
    assert len(param) == 64
    assert param == ("ab" * 20).rjust(64, "0")


def test_eth_address_param_padded_to_64_hex_chars():
    param = tether._eth_address_param(ETH_WALLET)
    assert len(param) == 64
    assert param.endswith("aa")


def test_eth_address_param_rejects_wrong_length():
    with pytest.raises(ValueError):
        tether._eth_address_param("0x1234")


# --- Tron: isBlackListed / balanceOf via triggerconstantcontract ---

def _tron_client(constant_result_hex: str, expect_selector: str | None = None) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        body = request.read()
        import json
        payload = json.loads(body)
        assert payload["contract_address"] == tether.USDT_TRC20_CONTRACT
        assert payload["visible"] is True
        if expect_selector is not None:
            assert payload["function_selector"] == expect_selector
        return httpx.Response(200, json={
            "result": {"result": True},
            "constant_result": [constant_result_hex],
        })
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_tron_blacklisted_address_returns_true():
    client = _tron_client("0000000000000000000000000000000000000000000000000000000000000001",
                           expect_selector="isBlackListed(address)")
    check = tether.check_tether_wallet("tron", TRON_WALLET, http_client=client)
    assert check.is_blacklisted is True
    assert check.is_blacklisted_error is None


def test_tron_non_blacklisted_address_returns_false():
    client = _tron_client("0000000000000000000000000000000000000000000000000000000000000000")
    check = tether.check_tether_wallet("tron", TRON_WALLET, http_client=client)
    assert check.is_blacklisted is False


def test_tron_balance_parsed_with_six_decimals():
    # 150_000000 raw units -> 150.0 USDT at 6 decimals.
    hex_amount = format(150_000000, "x").rjust(64, "0")

    def handler(request: httpx.Request) -> httpx.Response:
        import json
        payload = json.loads(request.read())
        if payload["function_selector"] == "isBlackListed(address)":
            result = "0" * 64
        else:
            result = hex_amount
        return httpx.Response(200, json={"result": {"result": True}, "constant_result": [result]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    check = tether.check_tether_wallet("tron", TRON_WALLET, http_client=client)
    assert check.is_blacklisted is False
    assert check.unfrozen_balance == Decimal("150")


def test_tron_blacklisted_reports_zero_unfrozen_balance_even_if_raw_balance_nonzero():
    hex_amount = format(999_000000, "x").rjust(64, "0")

    def handler(request: httpx.Request) -> httpx.Response:
        import json
        payload = json.loads(request.read())
        if payload["function_selector"] == "isBlackListed(address)":
            result = "0" * 63 + "1"
        else:
            result = hex_amount
        return httpx.Response(200, json={"result": {"result": True}, "constant_result": [result]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    check = tether.check_tether_wallet("tron", TRON_WALLET, http_client=client)
    assert check.is_blacklisted is True
    assert check.unfrozen_balance == Decimal("0")


def test_tron_read_failure_never_reports_false_it_reports_none_plus_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="trongrid unavailable")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    check = tether.check_tether_wallet("tron", TRON_WALLET, http_client=client)
    assert check.is_blacklisted is None
    assert check.is_blacklisted_error is not None
    assert check.unfrozen_balance is None
    assert check.balance_error is not None


# --- Ethereum: isBlackListed / balanceOf via Etherscan eth_call proxy ---

def _eth_client(result_hex: str) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["module"] == "proxy"
        assert request.url.params["action"] == "eth_call"
        assert request.url.params["to"] == tether.USDT_ERC20_CONTRACT
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "result": result_hex})
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_eth_blacklisted_address_returns_true():
    client = _eth_client("0x" + "0" * 63 + "1")
    check = tether.check_tether_wallet("ethereum", ETH_WALLET, http_client=client, etherscan_api_key="k")
    assert check.is_blacklisted is True


def test_eth_non_blacklisted_address_returns_false():
    client = _eth_client("0x" + "0" * 64)
    check = tether.check_tether_wallet("ethereum", ETH_WALLET, http_client=client, etherscan_api_key="k")
    assert check.is_blacklisted is False


def test_eth_call_uses_correct_selectors_for_each_function():
    seen_data: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        data = request.url.params["data"]
        seen_data.append(data)
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "result": "0x" + "0" * 64})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    tether.check_tether_wallet("ethereum", ETH_WALLET, http_client=client, etherscan_api_key="k")

    assert any(d.startswith("0xe47d6060") for d in seen_data), seen_data  # isBlackListed
    assert any(d.startswith("0x70a08231") for d in seen_data), seen_data  # balanceOf


def test_eth_read_failure_never_reports_false_it_reports_none_plus_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="etherscan unavailable")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    check = tether.check_tether_wallet("ethereum", ETH_WALLET, http_client=client, etherscan_api_key="k")
    assert check.is_blacklisted is None
    assert check.is_blacklisted_error is not None
    assert check.unfrozen_balance is None


def test_eth_call_error_field_in_body_is_treated_as_failure():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "error": {"message": "bad api key"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    check = tether.check_tether_wallet("ethereum", ETH_WALLET, http_client=client, etherscan_api_key="bad")
    assert check.is_blacklisted is None
    assert check.is_blacklisted_error is not None


# --- Golden-hour urgency ---

def test_urgency_recently_moved_is_urgent_with_near_full_window_remaining():
    remaining, message = tether.compute_golden_hour_urgency(minutes_since_last_move=10, is_blacklisted=False)
    assert remaining > tether.GOLDEN_WINDOW_MINUTES - 15
    assert "less than an hour" in message


def test_urgency_moved_long_ago_is_less_urgent_with_no_window_remaining():
    remaining, message = tether.compute_golden_hour_urgency(
        minutes_since_last_move=tether.GOLDEN_WINDOW_MINUTES * 5, is_blacklisted=False)
    assert remaining == 0.0
    assert "over a day ago" in message


def test_urgency_recently_moved_more_urgent_than_long_ago():
    recent_remaining, _ = tether.compute_golden_hour_urgency(minutes_since_last_move=5, is_blacklisted=False)
    old_remaining, _ = tether.compute_golden_hour_urgency(
        minutes_since_last_move=tether.GOLDEN_WINDOW_MINUTES * 3, is_blacklisted=False)
    assert recent_remaining > old_remaining


def test_urgency_already_blacklisted_reports_zero_remaining_no_new_request_needed():
    remaining, message = tether.compute_golden_hour_urgency(minutes_since_last_move=5, is_blacklisted=True)
    assert remaining == 0.0
    assert "already" in message.lower()


def test_urgency_unknown_blacklist_status_flagged_as_more_urgent_case():
    _, message = tether.compute_golden_hour_urgency(minutes_since_last_move=5, is_blacklisted=None)
    assert "could not confirm" in message
