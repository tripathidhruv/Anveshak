"""Task H5: reproducible evidence hashing.

The core correctness property this whole task exists to protect: hashing the same
logical (transfer/finding) content twice, wrapped in a different generation-time
timestamp each time, must produce the IDENTICAL hash. A rival project (FineX, per this
project's own competitive-review docs) hashed a payload that included the server's
wall-clock generation timestamp INSIDE the hashed bytes -- so re-verifying the same
on-chain data later never reproduced the same hash. `content_hash` here must only ever
be called on canonical, sorted, content-only data; these tests prove the function itself
is immune to a generation-time value smuggled in around it, and that genuinely different
content still changes the hash (the hash isn't trivially constant).
"""
from datetime import datetime, timezone
from app.evidence.manifest import canonical_json, content_hash


def test_identical_content_hashes_the_same_regardless_of_outer_generation_timestamp():
    content = {
        "hops": [
            {"wallet_address": "TSuspect", "chain": "tron", "tx_hash": "tx1", "amount": "150.0",
             "at": "2026-01-01T00:00:00+00:00", "stop_reason": None},
            {"wallet_address": "TTerminal", "chain": "tron", "tx_hash": "tx2", "amount": "148.5",
             "at": "2026-01-01T00:00:30+00:00", "stop_reason": "no_outgoing_activity"},
        ],
        "attribution_candidates": [
            {"wallet_address": "TTerminal", "chain": "tron", "gate_passed": True,
             "entity_name": "DEMO DATA Exchange"},
        ],
    }

    # Two "reports" generated at very different wall-clock times, wrapping the SAME
    # logical content -- exactly the shape of the FineX bug (a generation timestamp
    # living beside/around the content that gets hashed).
    report_a = {"generated_at": datetime(2026, 1, 1, 0, 5, 0, tzinfo=timezone.utc).isoformat(),
                "content": content}
    report_b = {"generated_at": datetime(2026, 9, 26, 18, 45, 12, tzinfo=timezone.utc).isoformat(),
                "content": content}

    # The correct call site only ever hashes the inner content, never the wrapper --
    # that's the actual fix. Confirm both reports' content hashes identically.
    assert content_hash(report_a["content"]) == content_hash(report_b["content"])

    # And confirm hashing the two full wrappers (which DO differ, only in
    # `generated_at`) would NOT match -- proving this hash function is content-sensitive
    # in general, not just always-equal, and that the bug is specifically about what you
    # choose to feed it, not a broken hash function.
    assert content_hash(report_a) != content_hash(report_b)


def test_genuinely_different_content_produces_a_different_hash():
    content_a = {"hops": [{"wallet_address": "TSuspect", "amount": "150.0"}]}
    content_b = {"hops": [{"wallet_address": "TSuspect", "amount": "150.01"}]}
    assert content_hash(content_a) != content_hash(content_b)


def test_canonical_json_is_key_order_independent():
    # Dict key order must not affect the hash -- otherwise two structurally identical
    # payloads built by different code paths (or serialized differently) could produce
    # different hashes despite carrying the same logical content.
    a = {"b": 2, "a": 1}
    b = {"a": 1, "b": 2}
    assert canonical_json(a) == canonical_json(b)
    assert content_hash(a) == content_hash(b)


def test_content_hash_is_deterministic_across_repeated_calls():
    content = {"x": 1, "y": [1, 2, 3]}
    assert content_hash(content) == content_hash(content)
