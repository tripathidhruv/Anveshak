"""The data-quality gate for KAIZEN's ML risk score (Task H8).

This is the single most important piece of Task H8 (per its brief): it must genuinely and
correctly DISABLE the ML score -- falling back to the rule-based score alone -- whenever the
real input data for a given trace is too thin to responsibly support a machine-learning
number. A well-gated simple model is a correct deliverable; an ungated impressive-looking
model is not.

Three independent thin-data signals, any one of which disables ML scoring:
  1. Too few hops -- the trace never actually followed the money anywhere past the suspect's
     own wallet, so there is no downstream evidence for the model to score.
  2. No vetted label match anywhere in the trace -- without at least one wallet whose name we
     checked against a real source, there's nothing confirmed to anchor an ML number to; every
     signal feeding the model would be unattributed circumstantial behaviour only.
  3. A read-failure-heavy trace -- too much of the underlying chain data used to build this
     trace's features could not actually be read, so the features themselves are unreliable.
"""
from dataclasses import dataclass, field
from app.risk.features import TraceFeatures

MIN_HOPS_FOR_ML = 2
MAX_READ_FAILURE_RATIO_FOR_ML = 0.34  # a third or more of attempted reads failing is "heavy"


@dataclass(frozen=True)
class DataQualityResult:
    sufficient: bool
    reasons: list[str] = field(default_factory=list)  # plain-English; empty when sufficient


def assess_data_quality(features: TraceFeatures) -> DataQualityResult:
    """Decides whether `features` is well-evidenced enough to responsibly carry an ML score.
    Returns `sufficient=False` with plain-English reasons the moment ANY thin-data signal
    fires -- this is a gate, not a weighted score, on purpose: a single serious data gap
    should be enough to withhold the ML number, not get averaged away by other signals looking
    fine."""
    reasons: list[str] = []

    if features.hop_count < MIN_HOPS_FOR_ML:
        reasons.append(
            "This trace only reached the suspect's own wallet and did not follow the money "
            "any further, so there isn't enough of a trail yet for a machine-learning score."
        )

    if not features.label_vetted:
        reasons.append(
            "No wallet in this trace matched a name we have checked against a real, public "
            "source, so there is no confirmed exchange to anchor a machine-learning score on."
        )

    read_failure_ratio = features.read_failure_ratio
    if read_failure_ratio > MAX_READ_FAILURE_RATIO_FOR_ML:
        reasons.append(
            f"We could not read about {read_failure_ratio:.0%} of this trace's wallet "
            "histories just now, so too much of the underlying data is missing to trust a "
            "machine-learning score."
        )

    return DataQualityResult(sufficient=len(reasons) == 0, reasons=reasons)
