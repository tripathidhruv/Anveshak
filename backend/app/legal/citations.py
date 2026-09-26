"""Legal citation templates for lawful-action notices.

Per CLAUDE.md's "Known gaps" section, the exact section numbers/wording used by this
project (BNSS S94/S106, BNS S223, BSA S63) are UNVERIFIED -- nobody with legal training has
confirmed them against the current statute text. That caveat is not just an internal note:
every rendered notice carries it directly in the generated text (see DISCLAIMER below,
rendered both above and below the operative text of every template), per CLAUDE.md rule 5
("Legal text is a draft for an officer to review, never presented as auto-generated legal
advice").

Templates live as plain-text files under templates/ (not scattered Python string literals)
so a legal reviewer can diff/edit them without touching code, and so future citations can be
added by dropping in a new .txt file plus one registry entry below.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from string import Template

_TEMPLATES_DIR = Path(__file__).parent / "templates"

DISCLAIMER = (
    "[DRAFT -- for an officer's review and signature before issue. This is NOT legal advice "
    "and is NOT a final legal instrument. The section number and wording cited below are "
    "UNVERIFIED against the current statute text (see CLAUDE.md \"Known gaps\") -- confirm "
    "with a legal professional before any round where a judge may have a legal background, "
    "and before real-world use.]"
)


@dataclass(frozen=True)
class CitationMeta:
    id: str
    statute: str
    section: str
    title: str
    template_file: str
    unverified: bool = True  # every citation in this project is currently unverified


CITATIONS: dict[str, CitationMeta] = {
    "bnss_94": CitationMeta(
        id="bnss_94",
        statute="Bharatiya Nagarik Suraksha Sanhita, 2023",
        section="Section 94",
        title="Summons to produce documents (formerly Section 91 CrPC)",
        template_file="bnss_94.txt",
    ),
    "bnss_106": CitationMeta(
        id="bnss_106",
        statute="Bharatiya Nagarik Suraksha Sanhita, 2023",
        section="Section 106",
        title="Attachment/preservation of suspected proceeds of crime",
        template_file="bnss_106.txt",
    ),
    "bns_223": CitationMeta(
        id="bns_223",
        statute="Bharatiya Nyaya Sanhita, 2023",
        section="Section 223",
        title="Disobedience to an order duly promulgated by a public servant",
        template_file="bns_223.txt",
    ),
    "bsa_63": CitationMeta(
        id="bsa_63",
        statute="Bharatiya Sakshya Adhiniyam, 2023",
        section="Section 63",
        title="Admissibility of electronic records (formerly Section 65B, Evidence Act)",
        template_file="bsa_63.txt",
    ),
}


class UnknownCitationError(KeyError):
    pass


def _load_template(template_file: str) -> Template:
    text = (_TEMPLATES_DIR / template_file).read_text(encoding="utf-8")
    return Template(text)


def render_notice(citation_id: str, context: dict) -> str:
    """Render a notice body for the given citation id.

    `context` is used with Template.safe_substitute -- missing keys are left as literal
    `$placeholder` text rather than raising, so a caller with partial case data still gets a
    reviewable draft (which is the point: an officer edits this before it goes anywhere).
    The disclaimer and generation timestamp are always injected here, not left to the caller,
    so it can never be accidentally omitted.
    """
    if citation_id not in CITATIONS:
        raise UnknownCitationError(citation_id)
    meta = CITATIONS[citation_id]
    template = _load_template(meta.template_file)
    full_context = {
        "disclaimer": DISCLAIMER,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **context,
    }
    return template.safe_substitute(full_context)


def list_citations() -> list[CitationMeta]:
    return list(CITATIONS.values())
