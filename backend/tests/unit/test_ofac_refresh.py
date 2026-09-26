from datetime import datetime, timezone

from app.sanctions.ofac_refresh import diff_and_merge

NOW = datetime(2026, 9, 26, tzinfo=timezone.utc)


def _entry(uid, address, chain="bitcoin", **overrides):
    base = {
        "uid": uid,
        "entity_name": f"Entity {uid}",
        "program": "TEST",
        "chain": chain,
        "asset_symbol": "XBT" if chain == "bitcoin" else "ETH",
        "address": address,
        "designated_at": "2020-01-01",
        "source_url": "https://example.gov/test",
        "status": "active",
    }
    base.update(overrides)
    return base


def test_unchanged_address_stays_active():
    current = [_entry("U1", "1AAA")]
    pulled = [_entry("U1", "1AAA")]
    result = diff_and_merge(current, pulled, now=NOW)
    assert result.flagged_for_review == []
    assert result.added == []
    assert result.unchanged_uids == ["U1"]
    assert len(result.merged_entries) == 1
    assert result.merged_entries[0]["status"] == "active"


def test_new_address_in_fresh_pull_is_added():
    current = [_entry("U1", "1AAA")]
    pulled = [_entry("U1", "1AAA"), _entry("U2", "1BBB")]
    result = diff_and_merge(current, pulled, now=NOW)
    assert [e["uid"] for e in result.added] == ["U2"]
    assert len(result.merged_entries) == 2


def test_address_missing_from_fresh_pull_is_flagged_not_dropped():
    # Synthetic "list shrank" scenario: U1 was on the old list, the fresh pull no longer
    # contains it. It must NOT silently vanish from the merged list.
    current = [_entry("U1", "1AAA"), _entry("U2", "1BBB")]
    pulled = [_entry("U2", "1BBB")]  # U1 dropped out of the "fresh pull"

    result = diff_and_merge(current, pulled, now=NOW)

    flagged_uids = [e["uid"] for e in result.flagged_for_review]
    assert flagged_uids == ["U1"]

    merged_uids = {e["uid"] for e in result.merged_entries}
    assert "U1" in merged_uids, "removed-looking address must still be present in the merged list"

    flagged_entry = next(e for e in result.merged_entries if e["uid"] == "U1")
    assert flagged_entry["status"] == "flagged_for_review"
    assert "review_reason" in flagged_entry
    assert "2026-09-26" in flagged_entry["review_reason"]


def test_flagged_entry_keeps_its_original_address_and_chain():
    current = [_entry("U1", "1AAA", chain="bitcoin")]
    pulled: list[dict] = []
    result = diff_and_merge(current, pulled, now=NOW)
    flagged = result.flagged_for_review[0]
    assert flagged["address"] == "1AAA"
    assert flagged["chain"] == "bitcoin"


def test_case_insensitive_ethereum_key_prevents_false_removal_flag():
    # An entry stored lowercase and re-pulled mixed-case (or vice versa) is the same address
    # on ethereum and must be treated as unchanged, not flagged for review.
    current = [_entry("U1", "0xabc123", chain="ethereum")]
    pulled = [_entry("U1", "0xABC123", chain="ethereum")]
    result = diff_and_merge(current, pulled, now=NOW)
    assert result.flagged_for_review == []
    assert result.unchanged_uids == ["U1"]
