"""Address / hash validation for smart intake (app/intake/validators.py).

All addresses here are either the synthetic demo address, published spec test vectors
(BIP-173/350, EIP-55), or addresses built in-test from synthetic payload bytes.
"""
import hashlib

import pytest

from app.intake import validators as v

DEMO_TRON = "TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm"


# --- keccak-256 -------------------------------------------------------------------------

def test_keccak256_empty_vector():
    assert v.keccak256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"


def test_keccak256_abc_vector():
    assert v.keccak256(b"abc").hex() == "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"


@pytest.mark.parametrize("length", [0, 1, 55, 135, 136, 137, 272, 500])
def test_sponge_matches_hashlib_sha3_when_given_sha3_padding(length):
    # Keccak-256 and SHA3-256 share the permutation and rate; only the domain padding byte
    # differs (0x01 vs 0x06). Checking the sponge against hashlib with SHA3 padding proves the
    # permutation and multi-block absorption are right for every length class.
    data = bytes((i * 7 + 3) % 256 for i in range(length))
    assert v._keccak_sponge(data, pad=0x06) == hashlib.sha3_256(data).digest()


# --- Ethereum / EIP-55 ------------------------------------------------------------------

EIP55_VECTORS = [
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
]


@pytest.mark.parametrize("addr", EIP55_VECTORS)
def test_eip55_vectors_pass(addr):
    r = v.validate_address(addr)
    assert r.chain == "ethereum"
    assert r.valid is True
    assert r.checksum == "pass"
    assert r.normalized == addr


@pytest.mark.parametrize("addr", EIP55_VECTORS)
def test_to_checksum_address_reproduces_vectors(addr):
    assert v.to_checksum_address(addr.lower()) == addr


def test_eth_all_lower_is_valid_without_checksum():
    r = v.validate_address(EIP55_VECTORS[0].lower())
    assert r.valid is True
    assert r.checksum == "none"
    assert r.normalized == EIP55_VECTORS[0]
    assert r.warnings  # tells the officer there was nothing to verify


def test_eth_bad_mixed_case_fails_checksum():
    bad = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD"  # last char case flipped
    r = v.validate_address(bad)
    assert r.chain == "ethereum"
    assert r.valid is False
    assert r.checksum == "fail"


def test_eth_wrong_length_rejected():
    r = v.validate_address("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeA")
    assert r.valid is False


# --- TRON -------------------------------------------------------------------------------

def test_demo_tron_address_is_valid():
    r = v.validate_address(DEMO_TRON)
    assert r.chain == "tron"
    assert r.valid is True
    assert r.checksum == "pass"
    assert "TRON" in r.reason


def test_tron_typo_fails_checksum():
    typo = DEMO_TRON[:-1] + ("n" if DEMO_TRON[-1] != "n" else "o")
    r = v.validate_address(typo)
    assert r.chain == "tron"
    assert r.valid is False
    assert r.checksum == "fail"


def test_tron_21_chars_is_candidate_with_warning():
    r = v.validate_address("TNh8yW5vC2mQ7fL4xK9pR")
    assert r.chain == "tron"
    assert r.valid is False
    assert any("21 characters" in w and "34" in w and "complainant" in w for w in r.warnings)


def test_tron_built_from_synthetic_payload_validates():
    payload = b"\x41" + bytes(range(1, 21))
    addr = v.b58check_encode(payload)
    assert addr.startswith("T") and len(addr) == 34
    assert v.validate_address(addr).valid is True


# --- Bitcoin ----------------------------------------------------------------------------

def test_btc_legacy_p2pkh_zero_hash():
    # Base58Check of version 0x00 + 20 zero bytes -- a standard textbook vector.
    assert v.b58check_encode(b"\x00" * 21) == "1111111111111111111114oLvT2"
    r = v.validate_address("1111111111111111111114oLvT2")
    assert r.chain == "bitcoin" and r.valid is True and r.checksum == "pass"


def test_btc_p2sh_synthetic():
    addr = v.b58check_encode(b"\x05" + bytes(range(20)))
    assert addr.startswith("3")
    r = v.validate_address(addr)
    assert r.chain == "bitcoin" and r.valid is True


def test_btc_legacy_bad_checksum():
    r = v.validate_address("1111111111111111111114oLvT3")
    assert r.chain == "bitcoin" and r.valid is False and r.checksum == "fail"


def test_bip173_p2wpkh_vector():
    # BIP-173 example: witness v0, program 751e76e8199196d454941c45d1b3a323f1433bd6
    addr = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
    assert v.encode_segwit("bc", 0, bytes.fromhex("751e76e8199196d454941c45d1b3a323f1433bd6")) == addr
    r = v.validate_address(addr)
    assert r.chain == "bitcoin" and r.valid is True and r.checksum == "pass"
    # Uppercase form is also valid per BIP-173.
    assert v.validate_address(addr.upper()).valid is True


def test_bip350_taproot_vector():
    addr = "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0"
    r = v.validate_address(addr)
    assert r.chain == "bitcoin" and r.valid is True


def test_bech32_mixed_case_rejected():
    r = v.validate_address("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3T4")
    assert r.valid is False


def test_bech32_bad_checksum_rejected():
    r = v.validate_address("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5")
    assert r.chain == "bitcoin" and r.valid is False and r.checksum == "fail"


def test_v1_with_bech32_not_bech32m_rejected():
    # Witness v1 must use bech32m (BIP-350); encode v1 with the old constant and expect a fail.
    bad = v._encode_segwit_with_const("bc", 1, bytes(32), v.BECH32_CONST)
    assert v.validate_address(bad).valid is False


# --- garbage / tx hashes ----------------------------------------------------------------

@pytest.mark.parametrize("token", ["", "hello", "0xZZ", "Telegram", "1234"])
def test_garbage_is_not_an_address(token):
    r = v.validate_address(token)
    assert r.chain is None and r.valid is False


def test_tx_hash_plain_64_hex():
    h = "7f3a9c2e41b8d06f5e1a72c94d3b8e06a5f21c7d9e4b30a8f61c2d75e9a4b318"
    r = v.validate_tx_hash(h)
    assert r.valid is True and r.chain is None  # TRON or Bitcoin style, can't tell which


def test_tx_hash_eth_style():
    r = v.validate_tx_hash("0x" + "ab" * 32)
    assert r.valid is True and r.chain == "ethereum"


def test_tx_hash_rejects_address():
    assert v.validate_tx_hash(EIP55_VECTORS[0]).valid is False
    assert v.validate_tx_hash("ab" * 31).valid is False
