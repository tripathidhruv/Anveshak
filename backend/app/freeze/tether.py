"""Tether (USDT) on-chain blacklist + balance checks.

Task H3 (docs/superpowers/plans/2026-09-26-backend-sprint2-3-completion.md). This project has
twice already been burned by an implementer GUESSING an external API contract instead of
verifying it -- both times caught in review. Every mechanism this module relies on was
verified via WebFetch/WebSearch against primary or corroborating sources before this code was
written (cited below and in this task's own report, docs/superpowers/sdd/task-H3-report.md).

Verified mechanism (both chains use the SAME contract-level pattern -- there is no separate
"Tether API" for this; it's a read of the token contract's own public state):

- USDT-ERC20 (Ethereum), contract 0xdAC17F958D2ee523a2206206994597C13D831ec7, exposes a public
  view function `isBlackListed(address) -> bool`. Confirmed directly from the contract's own
  verified ABI on Etherscan (fetched via WebFetch):
      {"constant":true,"inputs":[{"name":"","type":"address"}],"name":"isBlackListed",
       "outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"}
  Its 4-byte selector (keccak256("isBlackListed(address)")[:4]) is 0xe47d6060 -- confirmed via
  multiple independent third-party contract-binding sources (Go bindings, block-explorer
  writeups) that all report the identical value for the identical signature, and consistent
  with the contract's own verified ABI/name above. It is called the same way this project's
  own EvmChainClient already talks to Ethereum: through Etherscan's `module=proxy&
  action=eth_call` JSON-RPC proxy, passing ABI-encoded calldata and reading back the
  hex-encoded `result` field.
- USDT-TRC20 (Tron), contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t, exposes the SAME
  `isBlackListed(address) -> bool` view function. Called via TronGrid's
  `/wallet/triggerconstantcontract` endpoint (confirmed via TRON's own developer docs and a
  TronGrid `triggerconstantcontract` reference: request fields owner_address/contract_address/
  function_selector/parameter/visible; response fields result.result + constant_result, an
  array of ABI-encoded hex return values) with `function_selector: "isBlackListed(address)"`.
  The address argument is ABI-encoded into the `parameter` field as its raw 20-byte account
  hash, zero-padded on the left to 32 bytes -- confirmed against a real worked
  `balanceOf(address)` TronGrid example in TRON's own TRC-20 contract-interaction docs (which
  showed the exact same encoding shape for the same argument type).
- The "unfrozen balance" query uses each chain's own standard `balanceOf(address) -> uint256`
  view function on the same USDT contract: selector 0x70a08231 for the ERC-20 side (the
  universally standard, independently-corroborated ERC-20 `balanceOf` selector), and the
  literal function-signature string "balanceOf(address)" for the TRC-20 side (TronGrid's
  `function_selector` field takes the literal signature string, not a numeric selector, per
  its own docs).

Neither `isBlackListed` nor `balanceOf` is guessed here -- both are real, publicly documented
functions on Tether's actual deployed contracts, called through each chain's real public query
mechanism (TronGrid / Etherscan's proxy), the same infrastructure this project's existing chain
adapters already use for everything else.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from decimal import Decimal
from typing import Callable, TypeVar

import httpx

USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
USDT_ERC20_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"

# Both USDT-TRC20 and USDT-ERC20 use 6 decimals -- already established elsewhere in this
# codebase (app/chains/tron.py's and app/chains/evm.py's own normalization comments make the
# same claim for the same two contracts).
USDT_DECIMALS = 6

# keccak256("isBlackListed(address)")[:4] -- see module docstring for how this was verified.
_ISBLACKLISTED_SELECTOR = "e47d6060"
# keccak256("balanceOf(address)")[:4] -- the standard, universally-documented ERC-20 selector.
_BALANCEOF_SELECTOR = "70a08231"

TRONGRID_BASE = "https://api.trongrid.io"
ETHERSCAN_BASE = "https://api.etherscan.io/v2/api"
ETHERSCAN_MAINNET_CHAIN_ID = "1"

_TRON_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

T = TypeVar("T")


def _tron_base58check_decode(address: str) -> bytes:
    """Decodes a Tron base58check address (e.g. 'TR7NHq...') into its raw 21-byte payload
    (0x41 mainnet-prefix byte + 20-byte account hash), verifying the checksum.

    Hand-rolled with stdlib `hashlib` only, rather than adding a `base58` dependency: this
    project's parallel task split (7 sibling agents touching this same repo right now) makes
    adding a new top-level dependency to requirements.txt a likely collision point, and this is
    a small, standard, well-defined algorithm (Bitcoin-style Base58Check) -- not a guessed one.
    """
    num = 0
    for char in address:
        idx = _TRON_BASE58_ALPHABET.find(char)
        if idx < 0:
            raise ValueError(f"invalid base58 character in Tron address: {address!r}")
        num = num * 58 + idx
    n_leading_ones = len(address) - len(address.lstrip("1"))
    body = num.to_bytes((num.bit_length() + 7) // 8, "big") if num else b""
    raw = b"\x00" * n_leading_ones + body
    if len(raw) < 5:
        raise ValueError(f"invalid Tron address (too short): {address!r}")
    payload, checksum = raw[:-4], raw[-4:]
    expected = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    if expected != checksum:
        raise ValueError(f"invalid Tron address checksum: {address!r}")
    if len(payload) != 21 or payload[0] != 0x41:
        raise ValueError(f"unexpected Tron address payload shape: {address!r}")
    return payload


def _tron_address_param(address: str) -> str:
    """ABI-encodes a Tron address as a 32-byte (64 hex char) call parameter: the raw 20-byte
    account hash (the 0x41-prefixed payload with that prefix byte stripped), left-padded with
    zero bytes -- the same shape TRON's own documented `balanceOf(address)` example uses."""
    payload = _tron_base58check_decode(address)
    return payload[1:].hex().rjust(64, "0")


def _eth_address_param(address: str) -> str:
    hex_addr = address.lower()
    if hex_addr.startswith("0x"):
        hex_addr = hex_addr[2:]
    if len(hex_addr) != 40:
        raise ValueError(f"invalid Ethereum address: {address!r}")
    int(hex_addr, 16)  # raises ValueError if not valid hex
    return hex_addr.rjust(64, "0")


def _tron_trigger_constant_contract(client: httpx.Client, contract_address: str,
                                     function_selector: str, parameter: str) -> str:
    """POSTs to TronGrid's /wallet/triggerconstantcontract (the standard way to call any
    read-only TRC-20 view function) and returns the first ABI-encoded hex return value.

    `owner_address` is required by the endpoint but has no effect on a view call's result (the
    function doesn't read msg.sender) -- the contract's own address is passed, which is always
    a valid, already-known-good address, rather than fabricating an unrelated one."""
    response = client.post(
        f"{TRONGRID_BASE}/wallet/triggerconstantcontract",
        json={
            "owner_address": contract_address,
            "contract_address": contract_address,
            "function_selector": function_selector,
            "parameter": parameter,
            "visible": True,
        },
    )
    response.raise_for_status()
    body = response.json()
    result_meta = body.get("result") or {}
    if result_meta.get("result") is not True:
        raise ValueError(f"TronGrid triggerconstantcontract failed: {body}")
    constant_result = body.get("constant_result") or []
    if not constant_result:
        raise ValueError(f"TronGrid triggerconstantcontract returned no constant_result: {body}")
    return constant_result[0]


def _eth_call(client: httpx.Client, to: str, data: str, api_key: str | None) -> str:
    response = client.get(
        ETHERSCAN_BASE,
        params={
            "chainid": ETHERSCAN_MAINNET_CHAIN_ID,
            "module": "proxy",
            "action": "eth_call",
            "to": to,
            "data": data,
            "tag": "latest",
            "apikey": api_key or "",
        },
    )
    response.raise_for_status()
    body = response.json()
    if body.get("error"):
        raise ValueError(f"Etherscan eth_call failed: {body['error']}")
    result = body.get("result")
    if not result:
        raise ValueError(f"Etherscan eth_call returned no result: {body}")
    return result


def _tron_is_blacklisted(client: httpx.Client, address: str) -> bool:
    param = _tron_address_param(address)
    hex_result = _tron_trigger_constant_contract(client, USDT_TRC20_CONTRACT,
                                                  "isBlackListed(address)", param)
    return int(hex_result, 16) != 0


def _tron_balance(client: httpx.Client, address: str) -> Decimal:
    param = _tron_address_param(address)
    hex_result = _tron_trigger_constant_contract(client, USDT_TRC20_CONTRACT,
                                                  "balanceOf(address)", param)
    return Decimal(int(hex_result, 16)) / (Decimal(10) ** USDT_DECIMALS)


def _eth_is_blacklisted(client: httpx.Client, address: str, api_key: str | None) -> bool:
    data = "0x" + _ISBLACKLISTED_SELECTOR + _eth_address_param(address)
    hex_result = _eth_call(client, USDT_ERC20_CONTRACT, data, api_key)
    return int(hex_result, 16) != 0


def _eth_balance(client: httpx.Client, address: str, api_key: str | None) -> Decimal:
    data = "0x" + _BALANCEOF_SELECTOR + _eth_address_param(address)
    hex_result = _eth_call(client, USDT_ERC20_CONTRACT, data, api_key)
    return Decimal(int(hex_result, 16)) / (Decimal(10) ** USDT_DECIMALS)


def _attempt(fn: Callable[[], T]) -> tuple[T | None, str | None]:
    """Runs `fn`, honestly reporting failure instead of ever substituting a default value for
    it -- the same discipline app/api/v1/traces.py already applies to every chain-API read
    (its `*_read_failed` flags): a failed read must never be silently reported as a checked
    "no" (or, here, a checked balance of 0)."""
    try:
        return fn(), None
    except Exception as exc:  # noqa: BLE001 -- any failure here must be captured, not crash
        return None, str(exc)


@dataclass
class TetherWalletCheck:
    is_blacklisted: bool | None
    is_blacklisted_error: str | None
    unfrozen_balance: Decimal | None
    balance_error: str | None


def check_tether_wallet(chain: str, address: str, *, http_client: httpx.Client,
                         etherscan_api_key: str | None = None) -> TetherWalletCheck:
    """Checks a wallet's real Tether blacklist status and current "unfrozen" balance.

    "Unfrozen balance" means the balance still actually movable by its holder: once
    `isBlackListed` is confirmed True, Tether's contract itself refuses any further outgoing
    transfer from that address, so the ENTIRE balance is frozen in place regardless of the raw
    `balanceOf` number the contract still reports -- unfrozen balance is therefore reported as
    0 once blacklisting is genuinely confirmed, not the raw on-chain figure. When blacklist
    status could not be confirmed either way (read failure), the raw balance read (if it
    itself succeeded) is reported instead, since there's no confirmed freeze to report against.
    """
    if chain == "tron":
        is_blacklisted, is_blacklisted_error = _attempt(lambda: _tron_is_blacklisted(http_client, address))
        raw_balance, balance_error = _attempt(lambda: _tron_balance(http_client, address))
    elif chain == "ethereum":
        is_blacklisted, is_blacklisted_error = _attempt(
            lambda: _eth_is_blacklisted(http_client, address, etherscan_api_key))
        raw_balance, balance_error = _attempt(
            lambda: _eth_balance(http_client, address, etherscan_api_key))
    else:
        raise ValueError(f"Tether freeze checks only support tron/ethereum, got chain={chain!r}")

    unfrozen_balance = Decimal("0") if is_blacklisted is True else raw_balance
    return TetherWalletCheck(is_blacklisted, is_blacklisted_error, unfrozen_balance, balance_error)


# The practical freeze window this project estimates a real freeze request still has a
# meaningful chance of intercepting funds before they scatter further downstream. This is a
# documented HEURISTIC, not measured data -- per CLAUDE.md's "Known gaps" discipline (dashboard
# KPIs/trace timings are illustrative, not measured), this number must be labelled as an
# estimate, not presented as a verified fact, and should be replaced with real figures (or at
# minimum re-validated) before any round where a judge may probe it specifically.
GOLDEN_WINDOW_MINUTES = 24 * 60  # 24 hours


def compute_golden_hour_urgency(minutes_since_last_move: float,
                                 is_blacklisted: bool | None) -> tuple[float, str]:
    """Turns a raw "minutes since this wallet last moved money" number into a plain-English
    statement of how much of the practical freeze window likely remains -- never just the raw
    number with no context, per this task's brief."""
    if is_blacklisted:
        return 0.0, (
            "Tether has already blacklisted this wallet, so its USDT is already frozen in "
            "place. No new freeze request is needed for the funds Tether can already see there."
        )

    uncertainty = "" if is_blacklisted is False else (
        " (we could not confirm this wallet's current blacklist status, so treat this as the "
        "more urgent case)"
    )
    remaining = max(GOLDEN_WINDOW_MINUTES - minutes_since_last_move, 0.0)

    if minutes_since_last_move < 60:
        return remaining, (
            "The money moved into this wallet less than an hour ago" + uncertainty +
            " -- this is the most urgent window to request a freeze. (This 24-hour practical "
            "window is an estimate, not measured data.)"
        )
    if remaining > 0:
        hours_remaining = remaining / 60.0
        return remaining, (
            f"Roughly {hours_remaining:.0f} more hour(s) of the practical freeze window likely "
            "remain, based on how long ago this wallet last moved money" + uncertainty +
            ". Request the freeze soon. (This estimate is illustrative, not measured data.)"
        )
    return 0.0, (
        "This wallet last moved money over a day ago" + uncertainty +
        ". The practical freeze window has likely narrowed a lot -- still worth requesting, but "
        "urgency is lower than for a wallet that moved money recently. (This estimate is "
        "illustrative, not measured data.)"
    )
