"""Canonical hashing for reproducible evidence (Task H5).

This is where the project fixes the exact bug a rival, FineX, shipped and this project's
own competitive-review docs call out by name: FineX computed its evidence hashes over a
payload that included the server's generation-time wall-clock timestamp INSIDE the bytes
being hashed. Because that timestamp is different every time the report is regenerated
(or every time a hash is "re-verified"), the same underlying on-chain data never hashed
to the same value twice -- so FineX's own "verify this hash" feature could never actually
succeed on genuinely unchanged data. It only ever demonstrated that time had passed.

The fix here is a hard rule for every caller in this package: `content_hash` (and its
`canonical_json` helper) must ONLY ever be handed canonical, sorted, CONTENT-derived
data -- transfer amounts, addresses, on-chain transaction timestamps (a property of the
transfer itself, not of when we looked at it), and finding/attribution fields. Anything
about *when this hash was computed* (a "generated_at"/"fetched_at"/request-time value)
must live alongside the hash (e.g. in a manifest entry or an API response field) and
must never be passed into these functions as part of the hashed payload.

`canonical_json` is deterministic (`sort_keys=True`, fixed separators, no whitespace) so
structurally identical content always serializes to the same bytes regardless of dict
insertion order or caller-side formatting choices.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(payload: Any) -> str:
    """Deterministic JSON serialization: sorted keys, fixed (no-whitespace) separators,
    `default=str` so Decimal/datetime/etc. serialize predictably if one ever slips in
    unconverted. Callers should still pre-convert Decimals/datetimes to strings
    themselves (see raw_store.py / pack.py) so the exact string form is under their own
    control rather than left to `str()`'s default repr."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def content_hash(payload: Any) -> str:
    """SHA-256 hex digest of `payload`'s canonical JSON form.

    CONTRACT: `payload` must be canonical, sorted, content-only data -- never a value
    that includes a generation-time/request-time timestamp. See module docstring.
    """
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()
