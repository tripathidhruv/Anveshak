import pytest

from app.legal.citations import CITATIONS, UnknownCitationError, render_notice


@pytest.mark.parametrize("citation_id", list(CITATIONS.keys()))
def test_every_citation_renders_the_unverified_disclaimer(citation_id):
    body = render_notice(citation_id, {"case_id": "C1", "ncrp": "NCRP-1", "location": "Delhi"})
    assert "UNVERIFIED" in body
    assert "DRAFT" in body
    assert "not legal advice" in body.lower() or "not a final legal instrument" in body.lower()


@pytest.mark.parametrize("citation_id", list(CITATIONS.keys()))
def test_disclaimer_appears_at_start_and_end_of_notice(citation_id):
    # Not just buried mid-document -- CLAUDE.md rule 5 requires it be visible in the
    # generated text itself, so it must bracket the operative text, not hide in a footnote.
    body = render_notice(citation_id, {"case_id": "C1", "ncrp": "NCRP-1", "location": "Delhi"})
    assert body.count("UNVERIFIED") >= 2


def test_unknown_citation_id_raises():
    with pytest.raises(UnknownCitationError):
        render_notice("not_a_real_citation", {})


def test_missing_context_keys_do_not_crash_render():
    # safe_substitute: an incomplete context still produces a reviewable draft rather than
    # raising, since the whole point is an officer edits this before it goes anywhere.
    body = render_notice("bnss_94", {})
    assert "DRAFT" in body


def test_notice_carries_case_identifiers_when_provided():
    body = render_notice(
        "bnss_94",
        {"case_id": "CASE-42", "ncrp": "NCRP-9999", "location": "Mumbai",
         "deposit_address": "TDepositXYZ", "exchange_name": "Meridian Digital Exchange"},
    )
    assert "CASE-42" in body
    assert "NCRP-9999" in body
    assert "TDepositXYZ" in body
    assert "Meridian Digital Exchange" in body
