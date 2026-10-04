"""Wallet-address and transaction-hash validation for smart intake.

Why this exists: a single mistyped character in a complaint sends a trace to the wrong wallet,
and an officer has no way to notice. Every chain we trace has a built-in checksum (Base58Check
for TRON and legacy Bitcoin, bech32/bech32m for SegWit Bitcoin, EIP-55 mixed case for Ethereum),
so we can tell "this is a real, well-formed address" from "this looks like one but has a typo"
before any money is chased.

Everything is pure Python on purpose -- no new dependency, fully offline. That includes a small
Keccak-256 (Ethereum's hash, which is NOT hashlib's sha3_256: same permutation, different
padding byte) and the BIP-173/350 bech32 reference algorithm.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Literal

Chain = Literal["tron", "bitcoin", "ethereum"]
ChecksumState = Literal["pass", "fail", "none"]


@dataclass
class AddressCheck:
    chain: Chain | None
    valid: bool
    checksum: ChecksumState
    reason: str
    warnings: list[str] = field(default_factory=list)
    # The canonical spelling to store/trace with (EIP-55 casing for Ethereum, lowercase
    # bech32), or None when the token isn't a usable address.
    normalized: str | None = None


@dataclass
class TxHashCheck:
    valid: bool
    chain: Chain | None  # "ethereum" for 0x-prefixed; None = TRON or Bitcoin style (can't tell)
    reason: str


# --- Keccak-256 -------------------------------------------------------------------------

_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]
_ROT = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
]
_MASK = (1 << 64) - 1


def _rol(x: int, n: int) -> int:
    n %= 64
    return ((x << n) | (x >> (64 - n))) & _MASK if n else x


def _keccak_f(a: list[list[int]]) -> None:
    """Keccak-f[1600] permutation, in place. `a[x][y]` is one 64-bit lane."""
    for rc in _RC:
        c = [a[x][0] ^ a[x][1] ^ a[x][2] ^ a[x][3] ^ a[x][4] for x in range(5)]
        d = [c[(x - 1) % 5] ^ _rol(c[(x + 1) % 5], 1) for x in range(5)]
        for x in range(5):
            for y in range(5):
                a[x][y] ^= d[x]
        b = [[0] * 5 for _ in range(5)]
        for x in range(5):
            for y in range(5):
                b[y][(2 * x + 3 * y) % 5] = _rol(a[x][y], _ROT[x][y])
        for x in range(5):
            for y in range(5):
                a[x][y] = b[x][y] ^ ((~b[(x + 1) % 5][y]) & b[(x + 2) % 5][y])
        a[0][0] ^= rc


def _keccak_sponge(data: bytes, pad: int = 0x01, rate: int = 136, out_len: int = 32) -> bytes:
    """Sponge construction. pad=0x01 is original Keccak (Ethereum); pad=0x06 is NIST SHA3 --
    exposed only so tests can cross-check this permutation against hashlib.sha3_256."""
    msg = bytearray(data)
    msg.append(pad)
    while len(msg) % rate:
        msg.append(0)
    msg[-1] |= 0x80
    a = [[0] * 5 for _ in range(5)]
    for off in range(0, len(msg), rate):
        block = msg[off:off + rate]
        for i in range(rate // 8):
            a[i % 5][i // 5] ^= int.from_bytes(block[8 * i:8 * i + 8], "little")
        _keccak_f(a)
    out = b"".join(a[i % 5][i // 5].to_bytes(8, "little") for i in range(rate // 8))
    return out[:out_len]


def keccak256(data: bytes) -> bytes:
    return _keccak_sponge(data, pad=0x01)


# --- Base58Check ------------------------------------------------------------------------

B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_B58_INDEX = {c: i for i, c in enumerate(B58_ALPHABET)}


def _dsha256(b: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()


def b58_decode(s: str) -> bytes | None:
    n = 0
    for ch in s:
        if ch not in _B58_INDEX:
            return None
        n = n * 58 + _B58_INDEX[ch]
    body = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    leading = len(s) - len(s.lstrip("1"))
    return b"\x00" * leading + body


def b58check_encode(payload: bytes) -> str:
    raw = payload + _dsha256(payload)[:4]
    n = int.from_bytes(raw, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = B58_ALPHABET[r] + out
    leading = len(raw) - len(raw.lstrip(b"\x00"))
    return "1" * leading + out


def _b58check_ok(raw: bytes) -> bool:
    return len(raw) > 4 and _dsha256(raw[:-4])[:4] == raw[-4:]


# --- bech32 / bech32m (BIP-173 / BIP-350 reference algorithm) ---------------------------

BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
BECH32_CONST = 1
BECH32M_CONST = 0x2BC830A3


def _polymod(values: list[int]) -> int:
    gen = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for v in values:
        top = chk >> 25
        chk = (chk & 0x1FFFFFF) << 5 ^ v
        for i in range(5):
            chk ^= gen[i] if ((top >> i) & 1) else 0
    return chk


def _hrp_expand(hrp: str) -> list[int]:
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]


def _bech32_decode(bech: str) -> tuple[str | None, list[int] | None, int | None]:
    """Returns (hrp, data-without-checksum, const) or (None, None, None)."""
    if any(ord(x) < 33 or ord(x) > 126 for x in bech):
        return None, None, None
    if bech.lower() != bech and bech.upper() != bech:
        return None, None, None
    bech = bech.lower()
    pos = bech.rfind("1")
    if pos < 1 or pos + 7 > len(bech) or len(bech) > 90:
        return None, None, None
    if not all(x in BECH32_CHARSET for x in bech[pos + 1:]):
        return None, None, None
    hrp = bech[:pos]
    data = [BECH32_CHARSET.find(x) for x in bech[pos + 1:]]
    const = _polymod(_hrp_expand(hrp) + data)
    if const not in (BECH32_CONST, BECH32M_CONST):
        return hrp, None, None
    return hrp, data[:-6], const


def _convertbits(data, frombits: int, tobits: int, pad: bool = True) -> list[int] | None:
    acc = bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for value in data:
        if value < 0 or (value >> frombits):
            return None
        acc = (acc << frombits) | value
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad:
        if bits:
            ret.append((acc << (tobits - bits)) & maxv)
    elif bits >= frombits or ((acc << (tobits - bits)) & maxv):
        return None
    return ret


def decode_segwit(hrp: str, addr: str) -> tuple[int | None, bytes | None, bool]:
    """Returns (witness_version, program, checksum_ok). checksum_ok distinguishes a typo
    (well-formed but wrong checksum) from structurally broken input."""
    hrpgot, data, const = _bech32_decode(addr)
    if hrpgot != hrp:
        return None, None, False
    if data is None:
        return None, None, False
    if not data:
        return None, None, True
    decoded = _convertbits(data[1:], 5, 8, False)
    if decoded is None or not (2 <= len(decoded) <= 40):
        return None, None, True
    ver = data[0]
    if ver > 16:
        return None, None, True
    if ver == 0 and len(decoded) not in (20, 32):
        return None, None, True
    if (ver == 0 and const != BECH32_CONST) or (ver != 0 and const != BECH32M_CONST):
        return None, None, True
    return ver, bytes(decoded), True


def _encode_segwit_with_const(hrp: str, witver: int, witprog: bytes, const: int) -> str:
    data = [witver] + (_convertbits(witprog, 8, 5) or [])
    values = _hrp_expand(hrp) + data
    pm = _polymod(values + [0] * 6) ^ const
    checksum = [(pm >> 5 * (5 - i)) & 31 for i in range(6)]
    return hrp + "1" + "".join(BECH32_CHARSET[d] for d in data + checksum)


def encode_segwit(hrp: str, witver: int, witprog: bytes) -> str:
    return _encode_segwit_with_const(hrp, witver, witprog, BECH32_CONST if witver == 0 else BECH32M_CONST)


# --- EIP-55 -----------------------------------------------------------------------------

def to_checksum_address(addr: str) -> str:
    hex_part = addr[2:].lower() if addr[:2].lower() == "0x" else addr.lower()
    digest = keccak256(hex_part.encode("ascii")).hex()
    return "0x" + "".join(
        ch.upper() if ch.isalpha() and int(digest[i], 16) >= 8 else ch for i, ch in enumerate(hex_part)
    )


# --- public validation ------------------------------------------------------------------

_ETH_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_HEX_RE = re.compile(r"^[0-9a-fA-F]+$")
TRON_LEN = 34


def _validate_eth(token: str) -> AddressCheck:
    body = token[2:]
    if body == body.lower() or body == body.upper():
        return AddressCheck(
            "ethereum", True, "none",
            "Starts with “0x” and has 40 hex characters → Ethereum network. "
            "Written in a single case, so there is no checksum to verify.",
            ["All one case — the address carries no checksum, so a typo cannot be detected. "
             "Double-check it against the complainant's screenshot."],
            to_checksum_address(token),
        )
    expected = to_checksum_address(token)
    if expected == token:
        return AddressCheck("ethereum", True, "pass",
                            "Starts with “0x”, 40 hex characters, mixed-case checksum (EIP-55) passes "
                            "→ Ethereum network.", [], token)
    return AddressCheck("ethereum", False, "fail",
                        "Looks like an Ethereum address but its mixed-case checksum does not match — "
                        "probably a typo.",
                        ["Checksum fails. Ask the complainant to copy-paste the address again."], None)


def _validate_tron(token: str) -> AddressCheck:
    if len(token) != TRON_LEN:
        return AddressCheck(
            "tron", False, "none",
            "Starts like a TRON address but is the wrong length.",
            [f"Starts like a TRON address but has {len(token)} characters — a TRON address has "
             f"{TRON_LEN}. Confirm with the complainant."],
            None,
        )
    raw = b58_decode(token)
    if raw is None or len(raw) != 25 or raw[0] != 0x41:
        return AddressCheck("tron", False, "fail",
                            "Starts with “T” but does not decode to a TRON address.",
                            ["Does not decode as a TRON address. Confirm with the complainant."], None)
    if not _b58check_ok(raw):
        return AddressCheck("tron", False, "fail",
                            "Looks like a TRON address but its checksum fails — probably a typo.",
                            ["Checksum fails. Ask the complainant to copy-paste the address again."], None)
    return AddressCheck("tron", True, "pass",
                        "Starts with “T”, Base58 only, 34 characters, checksum passes → TRON network.",
                        [], token)


def _validate_btc_legacy(token: str) -> AddressCheck:
    raw = b58_decode(token)
    if raw is None or len(raw) != 25 or raw[0] not in (0x00, 0x05):
        return AddressCheck(None, False, "none", "Not a recognised wallet address.", [], None)
    kind = "legacy (P2PKH)" if raw[0] == 0x00 else "script (P2SH)"
    if not _b58check_ok(raw):
        return AddressCheck("bitcoin", False, "fail",
                            f"Looks like a Bitcoin {kind} address but its checksum fails — probably a typo.",
                            ["Checksum fails. Ask the complainant to copy-paste the address again."], None)
    return AddressCheck("bitcoin", True, "pass",
                        f"Starts with “{token[0]}”, Base58, checksum passes → Bitcoin {kind} address.",
                        [], token)


def _validate_bech32(token: str) -> AddressCheck:
    ver, prog, checksum_ok = decode_segwit("bc", token)
    if ver is not None:
        kind = "SegWit" if ver == 0 else "Taproot" if ver == 1 else f"SegWit v{ver}"
        return AddressCheck("bitcoin", True, "pass",
                            f"Starts with “bc1”, bech32 characters only, checksum passes → Bitcoin {kind} address.",
                            [], token.lower())
    if not checksum_ok and (token.lower() == token or token.upper() == token) and \
            all(c in BECH32_CHARSET for c in token.lower()[3:]):
        return AddressCheck("bitcoin", False, "fail",
                            "Looks like a Bitcoin “bc1” address but its checksum fails — probably a typo.",
                            ["Checksum fails. Ask the complainant to copy-paste the address again."], None)
    return AddressCheck("bitcoin", False, "fail" if checksum_ok else "none",
                        "Starts with “bc1” but is not a well-formed Bitcoin address.",
                        ["Malformed Bitcoin address (mixed case or invalid structure). Confirm with the complainant."],
                        None)


def validate_address(token: str) -> AddressCheck:
    token = token.strip()
    if _ETH_RE.match(token):
        return _validate_eth(token)
    if token[:2].lower() == "0x" and _HEX_RE.match(token[2:] or "z"):
        return AddressCheck("ethereum" if 30 <= len(token) - 2 <= 50 else None, False, "none",
                            "Starts like an Ethereum address but is not 40 hex characters long.",
                            [f"Has {len(token) - 2} hex characters after “0x” — an Ethereum address has 40. "
                             "Confirm with the complainant."] if 30 <= len(token) - 2 <= 50 else [],
                            None)
    if token[:3].lower() == "bc1" and len(token) >= 14:
        return _validate_bech32(token)
    if token.startswith("T") and 21 <= len(token) <= 40 and all(c in _B58_INDEX for c in token) \
            and any(c.isdigit() for c in token):
        return _validate_tron(token)
    if token[:1] in ("1", "3") and 25 <= len(token) <= 35 and all(c in _B58_INDEX for c in token):
        return _validate_btc_legacy(token)
    return AddressCheck(None, False, "none", "Not a recognised wallet address.", [], None)


def validate_tx_hash(token: str) -> TxHashCheck:
    token = token.strip()
    if token[:2].lower() == "0x":
        body = token[2:]
        if len(body) == 64 and _HEX_RE.match(body):
            return TxHashCheck(True, "ethereum",
                               "“0x” followed by 64 hex characters → an Ethereum-style transaction ID.")
        return TxHashCheck(False, None, "Not a transaction ID.")
    if len(token) == 64 and _HEX_RE.match(token):
        return TxHashCheck(True, None,
                           "64 hex characters → a transaction ID (TRON or Bitcoin style).")
    return TxHashCheck(False, None, "Not a transaction ID.")
