"""AI narrative summary: a plain-English paragraph narrating a case's already-computed,
already-persisted findings (Hop rows, AttributionCandidate rows, Case.innocence_score/
innocence_factors) via an OpenAI chat-completions call. This module NEVER makes a detection,
attribution, risk, or innocence decision -- it only narrates what app.tracing.tracer,
app.graph.* and app.detectors.innocence have already decided and written to the DB. Same
"don't triple-compute" discipline already established by app.graph.operator_fingerprint's
build_fingerprint(): read already-persisted rows, zero new chain-API reads, zero re-trace.

See docs/superpowers/specs/2026-09-27-ai-narrative-summary-design.md for the full design
rationale and the exact disclosure text below.

Deliberately excluded from the prompt sent to OpenAI: complainant name, phone, location, NCRP
number. None of that identity data is part of the "already-computed structured findings" this
feature narrates, and there is no reason to hand personally-identifying data to a third-party
API just to describe on-chain behaviour -- CLAUDE.md's "no real complainant PII" rule is about
the repo, but the same caution applies to what leaves this process for a third-party call."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AttributionCandidate, Case, Hop

NARRATIVE_DISCLOSURE = (
    "This summary was written by an AI language model narrating the structured findings above "
    "into plain English. It makes no independent findings of its own and must never be treated "
    "as verified fact beyond what the structured data it was built from already states."
)

# gpt-5-mini: the small, non-reasoning tier of the current GPT-5 model family -- cheap enough
# for a per-case summarization call, and materially better at producing a coherent, readable
# paragraph than the nano tier, while still far short of a reasoning-heavy model this task does
# not need (this is prose narration of facts already decided elsewhere, not a task requiring
# multi-step reasoning). `reasoning_effort="minimal"` keeps the call fast/cheap and steers the
# model away from spending effort "reasoning" about a decision it must not be making.
_MODEL = "gpt-5-mini"
_REASONING_EFFORT = "minimal"


def _build_prompt(case: Case, hops: list[Hop], candidates: list[AttributionCandidate]) -> str:
    hop_lines = [
        f"  hop {h.hop_index} ({h.route_label}): {h.wallet_address} on {h.chain}, "
        f"amount={h.amount}, at={h.at.isoformat()}"
        + (f", stop_reason={h.stop_reason}" if h.stop_reason else "")
        + (f", flag={h.flag}" if h.flag else "")
        for h in sorted(hops, key=lambda h: (h.route_label, h.hop_index))
    ]

    candidate_lines = [
        f"  candidate: {c.wallet_address} on {c.chain}, gate_passed={c.gate_passed}, "
        f"entity_name={c.entity_name or 'unknown'}, reasoning={c.reasoning}, "
        f"limitations={c.limitations}"
        for c in candidates
    ]

    innocence_lines: list[str] = []
    if case.innocence_score is not None:
        innocence_lines.append(f"  innocence_score: {case.innocence_score}")
        for factor in (case.innocence_factors or []):
            innocence_lines.append(f"  innocence_factor: {factor}")

    return (
        "You are narrating an already-completed cryptocurrency fraud trace for a police "
        "officer. Every fact below was already computed and decided by a rule-based tracing "
        "engine -- your only job is to describe these facts in one plain-English paragraph a "
        "non-technical reader can follow. Do not add any finding, conclusion, probability, or "
        "recommendation that is not already stated below. Do not decide whether this is fraud, "
        "whether any wallet belongs to an exchange, or how risky anything is -- only narrate "
        "what is already given.\n\n"
        f"Case: fraud_type={case.fraud_type}, chain={case.chain}, asset={case.asset}, "
        f"amount_crypto={case.amount_crypto}, amount_inr={case.amount_inr}, "
        f"suspect_wallet={case.suspect_wallet}\n\n"
        "Hops (the traced path of funds):\n" + ("\n".join(hop_lines) or "  (none)") + "\n\n"
        "Attribution candidates (already gate-checked exchange attributions):\n"
        + ("\n".join(candidate_lines) or "  (none)") + "\n\n"
        "Innocence assessment (already computed):\n"
        + ("\n".join(innocence_lines) or "  (not computed)")
    )


def generate_case_narrative(db: Session, case_id: str) -> tuple[str | None, bool, str | None]:
    """Returns (narrative, available, reason). `narrative` is only ever non-None when
    `available` is True. Never raises -- every failure mode returns an honest `reason` instead,
    matching this project's own "None + reason, never a silently-substituted guess" convention
    (see app.graph.operator_fingerprint.build_fingerprint's own docstring)."""
    if not settings.openai_api_key:
        return None, False, "OpenAI API key not configured"

    case = db.get(Case, case_id)
    if case is None:
        return None, False, "case not found"

    hops = db.execute(
        select(Hop).where(Hop.case_id == case_id)
    ).scalars().all()
    if not hops:
        return None, False, "case has not been traced yet"

    candidates = db.execute(
        select(AttributionCandidate).where(AttributionCandidate.case_id == case_id)
    ).scalars().all()

    prompt = _build_prompt(case, hops, candidates)

    try:
        # Imported lazily so importing this module never requires the `openai` package to be
        # importable in an environment where the feature is simply unconfigured (mirrors this
        # project's existing lazy-import style for optional chain clients).
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=_MODEL,
            reasoning_effort=_REASONING_EFFORT,
            messages=[{"role": "user", "content": prompt}],
        )
        narrative = response.choices[0].message.content
        if not narrative:
            return None, False, "OpenAI returned an empty response"
        return narrative.strip(), True, None
    except Exception as exc:  # noqa: BLE001 -- any SDK/network failure must degrade honestly
        return None, False, f"OpenAI call failed: {type(exc).__name__}"
