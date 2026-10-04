"""SAHYOG-shaped export payload.

Research note (done for this task via WebSearch, 2026-09-26): SAHYOG is I4C's real portal
for routing law-enforcement legal-process requests (e.g. BNSS S94 notices) to intermediaries
and, per recent coverage, onboarding VASPs such as Bitget for cybercrime cooperation. No
public technical integration spec (request/response JSON shape, field names, auth scheme,
endpoint URLs) was findable via public web search -- press coverage and the I4C site describe
the portal's *purpose*, not its API contract. That is plausible on its own terms: an internal
law-enforcement <-> intermediary integration is not the kind of thing that gets published as
open API docs.

Given that, this payload is NOT a confirmed-compatible SAHYOG export. It is a reasonably
shaped export built from this project's own Case/AttributionCandidate/LegalNotice schema,
clearly labelled below as "shaped for a future real SAHYOG integration, not verified against
SAHYOG's actual API". Anyone wiring a real SAHYOG submission must confirm field names, auth,
and transport against I4C's actual current spec first -- this payload only saves them from
inventing the shape from a blank page.
"""
from datetime import datetime, timezone
from typing import Any

from app.legal.notice_fsm import LegalNotice

SHAPE_VERSION = "anveshak-sahyog-draft-v1"

DATA_SHAPE_DISCLAIMER = (
    "Shaped for a future real SAHYOG/I4C integration, based on this project's own case and "
    "attribution schema. NOT verified against SAHYOG's actual published API -- no public "
    "technical integration spec was found via web search as of 2026-09-26. Confirm field "
    "names, authentication, and transport against I4C's real current spec before any real "
    "submission."
)


def build_sahyog_payload(
    case: Any,
    attribution: Any | None,
    notice: LegalNotice,
) -> dict:
    """Build a SAHYOG-shaped JSON export for one case + attributed wallet + legal notice.

    `case` is an `app.models.Case` instance, `attribution` an
    `app.models.AttributionCandidate` instance or None (no confirmed attribution yet),
    `notice` a `LegalNotice` from notice_fsm. Callers pass ORM objects directly rather than
    this module importing `app.models` itself, keeping this module usable/testable without a
    DB session.
    """
    return {
        "_meta": {
            "shape_version": SHAPE_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "disclaimer": DATA_SHAPE_DISCLAIMER,
            "data_is_synthetic": True,
        },
        "case_reference": {
            "case_id": case.id,
            "ncrp_number": case.ncrp,
            "reporting_location": case.location,
            "fraud_type": case.fraud_type,
            "incident_at": case.incident_at.isoformat() if case.incident_at else None,
            "reported_at": case.reported_at.isoformat() if case.reported_at else None,
        },
        "financial_loss": {
            "amount_inr": case.amount_inr,
            "amount_crypto": case.amount_crypto,
            "asset": case.asset,
            "chain": case.chain,
        },
        "wallet_attribution": (
            {
                "wallet_address": attribution.wallet_address,
                "chain": attribution.chain,
                "gate_passed": attribution.gate_passed,
                "entity_name": attribution.entity_name,
                "reasoning": attribution.reasoning,
                "limitations": attribution.limitations,
            }
            if attribution is not None
            else {
                "wallet_address": None,
                "note": "no confirmed (gate_passed=True) attribution candidate for this case yet",
            }
        ),
        "legal_notice": {
            "notice_id": notice.id,
            "citation_id": notice.citation_id,
            "state": notice.state.value,
            "approved_by": notice.approved_by,
            "approved_at": notice.approved_at.isoformat() if notice.approved_at else None,
            "sent_at": notice.sent_at.isoformat() if notice.sent_at else None,
            "body": notice.body,
        },
    }
