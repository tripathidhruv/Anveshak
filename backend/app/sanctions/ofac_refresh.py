"""Refresh script for the OFAC sanctions digital-currency-address list.

Real source/format citations (see also `data/sdn_seed.json`'s header):
- OFAC publishes the full SDN list, including digital-currency-address entries, at
  https://sanctionslist.ofac.treas.gov/Home/SdnList as `sdn_advanced.xml` (also available in
  fixed-field and delimited formats). Each digital-currency address is a per-SDN-entry
  "feature" literally named ``"Digital Currency Address - <SYMBOL>"`` (e.g. ``"- XBT"`` for
  Bitcoin, ``"- ETH"`` for Ethereum), per OFAC's own FAQ 559/563
  (https://ofac.treasury.gov/faqs/563) and WilmerHale's Nov 30 2018 client alert
  (https://www.wilmerhale.com/en/insights/client-alerts/20181130-ofac-identifies-digital-currency-addresses-in-sanctions-designations-and-provides-faqs-on-digital-currency-compliance).
- The three seed entries in `data/sdn_seed.json` are real, publicly reported addresses: two
  Bitcoin addresses from OFAC's Nov 28 2018 SamSam-ransomware designation of Ali
  Khorashadizadeh and Mohammad Ghorbaniyan (Treasury press release
  https://home.treasury.gov/news/press-releases/sm577), and one Ethereum address from OFAC's
  Apr 14 2022 Lazarus Group / Ronin Bridge designation
  (https://home.treasury.gov/news/press-releases/jy0714).

Hackathon scope: this project's deployment target is single-host, offline-capable (see
CLAUDE.md), so this script does not call the live OFAC endpoint from a test or from app
startup. `refresh()` takes a "freshly pulled" entry list (in production, that would be the
output of a real HTTP GET + XML parse of `sdn_advanced.xml`, filtered to `Digital Currency
Address - *` features -- not built here since that network call has nothing to do with this
task's actual correctness requirement) and diffs it against the currently stored list.

The one hard rule (per the approved spec, and the task brief): a re-pull must never silently
drop an address that was previously on the list. If a previously-active address is missing
from a fresh pull, it is marked `flagged_for_review` (kept in the merged list, screening still
matches against it -- see screen.py) rather than removed outright. A human confirms an actual
delisting; this script does not have the authority to.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.sanctions.screen import SEED_PATH, normalize_address


@dataclass
class RefreshResult:
    merged_entries: list[dict[str, Any]]
    added: list[dict[str, Any]] = field(default_factory=list)
    flagged_for_review: list[dict[str, Any]] = field(default_factory=list)
    unchanged_uids: list[str] = field(default_factory=list)


def _key(entry: dict[str, Any]) -> tuple[str, str]:
    return (entry["chain"], normalize_address(entry["address"], entry["chain"]))


def diff_and_merge(
    current_entries: list[dict[str, Any]],
    freshly_pulled_entries: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> RefreshResult:
    """Pure diff/merge, no file I/O -- takes and returns entry lists so it's directly
    unit-testable against a synthetic "list shrank" scenario without needing a real network
    pull or a real seed file on disk."""
    now = now or datetime.now(timezone.utc)
    pulled_by_key = {_key(e): e for e in freshly_pulled_entries}
    current_by_key = {_key(e): e for e in current_entries}

    merged: list[dict[str, Any]] = []
    added: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []
    unchanged: list[str] = []

    for key, entry in current_by_key.items():
        if key in pulled_by_key:
            # Still present in the fresh pull -- carry it forward as active, refreshed.
            merged_entry = dict(pulled_by_key[key])
            merged_entry["status"] = "active"
            merged.append(merged_entry)
            unchanged.append(entry["uid"])
        else:
            # Present before, missing now: refuse to silently drop it. Keep it in the
            # merged list under review rather than deleting -- screening still treats it
            # as a match (screen.py) until a human confirms the removal is genuine.
            flagged_entry = dict(entry)
            flagged_entry["status"] = "flagged_for_review"
            flagged_entry["review_reason"] = (
                f"present in prior list (uid={entry['uid']}) but absent from the "
                f"{now.date().isoformat()} re-pull -- verify manually before removing"
            )
            merged.append(flagged_entry)
            flagged.append(flagged_entry)

    for key, entry in pulled_by_key.items():
        if key not in current_by_key:
            new_entry = dict(entry)
            new_entry["status"] = "active"
            merged.append(new_entry)
            added.append(new_entry)

    return RefreshResult(
        merged_entries=merged, added=added, flagged_for_review=flagged, unchanged_uids=unchanged
    )


def refresh_from_disk(
    freshly_pulled_entries: list[dict[str, Any]],
    *,
    list_version: str,
    path: Path = SEED_PATH,
) -> RefreshResult:
    """Loads the currently stored list from `path`, merges in `freshly_pulled_entries`, writes
    the merged list back, and returns the same RefreshResult `diff_and_merge` would. This is
    the function an actual scheduled refresh job would call once a real OFAC pull is wired up;
    tests exercise `diff_and_merge` directly instead, to stay independent of disk state."""
    with open(path, "r", encoding="utf-8") as f:
        current = json.load(f)

    result = diff_and_merge(current["entries"], freshly_pulled_entries)

    current["entries"] = result.merged_entries
    current["list_version"] = list_version
    with open(path, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)

    return result
