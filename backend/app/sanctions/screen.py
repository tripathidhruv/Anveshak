"""Sanctions screening against the seeded OFAC SDN digital-currency-address subset.

Real source and field format (see `data/sdn_seed.json`'s own header comment for the full
citation trail): OFAC's `sdn_advanced.xml` encodes each sanctioned digital-currency address
as a per-SDN-entry feature literally named ``"Digital Currency Address - <SYMBOL>"`` (OFAC
FAQ 559/563, https://ofac.treasury.gov/faqs/563), e.g. ``"- XBT"`` for Bitcoin or ``"- ETH"``
for Ethereum. This module screens hop wallet addresses against that same shape: a chain, an
address, and the SDN entry it came from.

Hackathon scope: `data/sdn_seed.json` ships a small, real, publicly-sourced subset (three
addresses from two well-documented 2018/2022 OFAC designations), not a full mirror of the
live list -- see that file for citations of each address. `ofac_refresh.py` (same package)
is the script that would re-pull and merge a fresher copy of this list; this module only
consumes whatever list is handed to it (or the seed file, by default).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

SEED_PATH = Path(__file__).parent / "data" / "sdn_seed.json"

# Hop.chain values already in use elsewhere in this codebase (app/chains/registry.py) are
# lowercase chain names ("bitcoin", "ethereum", "tron", ...) -- this module screens against
# that same convention, not the OFAC asset symbol (XBT/ETH/...), which is carried in the seed
# data purely for citation/display fidelity to the real SDN format.


@dataclass(frozen=True)
class SanctionsHit:
    wallet_address: str
    chain: str
    list_source: str
    list_version: str
    entity_name: str
    program: str
    uid: str


def load_sdn_list(path: Path = SEED_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_address(address: str, chain: str) -> str:
    # Same convention as app/api/v1/cases.py's suspect-wallet normalization: Ethereum
    # addresses are hex and case-insensitive (checksum casing aside), everything else in
    # this codebase (TRON base58, Bitcoin base58/bech32) is genuinely case-sensitive.
    return address.lower() if chain == "ethereum" else address


def screen_address(address: str, chain: str, sdn_list: dict | None = None) -> SanctionsHit | None:
    """Returns a SanctionsHit if `address` (on `chain`) matches any entry in the SDN list,
    active or flagged-for-review. A `flagged_for_review` entry (see ofac_refresh.py) still
    matches -- a pending manual-review flag on a possible removal is not a reason to stop
    protecting against it; it only means a human should confirm the removal is genuine before
    anyone deletes the entry outright."""
    sdn_list = sdn_list if sdn_list is not None else load_sdn_list()
    target = normalize_address(address, chain)
    for entry in sdn_list["entries"]:
        if entry["chain"] != chain:
            continue
        if normalize_address(entry["address"], chain) != target:
            continue
        return SanctionsHit(
            wallet_address=address,
            chain=chain,
            list_source="OFAC_SDN",
            list_version=sdn_list.get("list_version", "unknown"),
            entity_name=entry["entity_name"],
            program=entry["program"],
            uid=entry["uid"],
        )
    return None


def screen_hops(hops: list[tuple[str, str]], sdn_list: dict | None = None) -> list[SanctionsHit]:
    """Screens a list of (wallet_address, chain) pairs -- e.g. every hop in a trace, not just
    the terminal wallet, per the task brief. Returns one SanctionsHit per matching hop, in the
    order given (a wallet appearing at multiple hops is reported once per hop, since each hop
    is itself a fact the investigator needs flagged, not merely each unique address)."""
    sdn_list = sdn_list if sdn_list is not None else load_sdn_list()
    hits: list[SanctionsHit] = []
    for address, chain in hops:
        hit = screen_address(address, chain, sdn_list)
        if hit is not None:
            hits.append(hit)
    return hits
