# Operator Fingerprinting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `GET /api/v1/cases/{case_id}/similar-operators` — unsupervised behavioral-similarity ranking across cases, computed entirely from already-persisted `Hop`/`AttributionCandidate` rows, zero new chain-API reads, zero ML training.

**Architecture:** One small, additive extension to `traces.py`'s existing `AttributionCandidate.gate_breakdown` dict (3 more numeric keys it already computes but discards), one new module (`app/graph/operator_fingerprint.py`) that builds a feature vector per case from persisted rows and computes cosine similarity, one new router (`app/api/v1/operator_fingerprint.py`) exposing the ranked result.

**Tech Stack:** Python/FastAPI backend, no new dependencies (cosine similarity is ~10 lines of pure Python, no numpy needed given the tiny per-case vector size).

## Global Constraints

- Every subagent dispatch (implementer and reviewer) MUST use `model="sonnet"`, effort medium or high — never opus, no exceptions.
- `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/` must stay green throughout.
- **Do not dispatch this plan's Task 1 until the cross-chain bridge-linking plan's Task 3 (`docs/superpowers/plans/2026-09-26-cross-chain-bridge-linking-plan.md`) has merged** — both touch `backend/app/api/v1/traces.py`; running them concurrently risks a git-index collision on the hottest file in the backend (this project has hit this exact race before, see `docs/PROGRESS.md`'s H2/H4 entry).
- The similarity-score response must carry the disclaimer string verbatim (see spec) on every response — this is a hard requirement, not a suggestion, same seriousness as `SYNTHETIC_DATA_DISCLOSURE`.
- A case with zero `gate_passed=True` `AttributionCandidate` rows has no fingerprint and must be excluded from comparison entirely — never a fabricated all-zero vector.

---

## File Structure

- `backend/app/api/v1/traces.py` (modify — 3-line addition to an existing dict literal, no new logic)
- `backend/app/graph/operator_fingerprint.py` (new) — feature extraction + cosine similarity, pure functions over data the caller provides (no DB session inside the similarity math itself, easier to unit test)
- `backend/app/api/v1/operator_fingerprint.py` (new) — router, DB queries, response shape
- `backend/app/schemas.py` (modify — add 2 new response shapes, matching the existing pattern of `app/api/v1/campaigns.py`'s own file-scoped `CampaignDetailOut` vs. shared `CampaignOut`; these are used by only this one router so they can live in the router file itself instead, per that same precedent — implementer's call, document the choice)
- `backend/tests/unit/test_operator_fingerprint.py` (new)
- `backend/tests/api/test_operator_fingerprint_api.py` (new)

---

## Task 1: `traces.py` extension — persist the raw sweep numbers

**Files:**
- Modify: `backend/app/api/v1/traces.py` (the `_evaluate_candidate_report`-adjacent breakdown construction only — read the function first to find the exact `breakdown = {**gate.breakdown, "sweep_confirmed": sweep_signal.is_sweep}` line)
- Test: `backend/tests/api/test_traces_api.py` (extend — one assertion added to an existing passing test, not a new test file)

**Interfaces:**
- Produces: `AttributionCandidate.gate_breakdown` dict gains 3 more keys on every future write: `"sweep_gap_seconds": float | None`, `"sweep_value_preserved_pct": float | None`, `"distinct_payer_count": int`.

**Do NOT change:** the function's return signature, the existing `"sweep_confirmed"`/`"data_unavailable"` keys, or anything about how `breakdown` is used elsewhere in the same file (the `AttributionOut.breakdown` API field is the same dict, unchanged shape otherwise — additive keys only).

- [ ] **Step 1: Read the current code**

Read `backend/app/api/v1/traces.py`'s `_evaluate_candidate_report` function and its one call site inside the `candidates` loop (where `distinct_payers` and `sweep_signal` are already local variables in scope) in full before editing.

- [ ] **Step 2: Write the failing test**

Add to `backend/tests/api/test_traces_api.py`, inside the existing
`test_trace_endpoint_confirms_attribution_when_payers_and_sweep_both_hold` test (append these
assertions right after the existing `assert body["attribution"]["breakdown"]["sweep_confirmed"] is True` line):

```python
    # Operator-fingerprinting plan: the raw sweep numbers must be persisted in the breakdown
    # dict too, not just the boolean -- they were already computed here, just discarded before.
    assert body["attribution"]["breakdown"]["sweep_gap_seconds"] == pytest.approx(30.0)
    assert body["attribution"]["breakdown"]["sweep_value_preserved_pct"] == pytest.approx(147.0 / 148.5)
    assert body["attribution"]["breakdown"]["distinct_payer_count"] == 4
```

- [ ] **Step 2b: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/api/test_traces_api.py -k confirms_attribution -v` from `backend/`.
Expected: FAIL — `KeyError: 'sweep_gap_seconds'`.

- [ ] **Step 3: Make the change**

In `_evaluate_candidate_report`, the current line building `breakdown` for the confirmed-gate
branch is `breakdown = {**gate.breakdown, "sweep_confirmed": sweep_signal.is_sweep}`. This
function does not currently receive `distinct_payers` as a parameter — check its exact current
signature (it takes `gate`, `sweep_signal`, `final_gate_passed`) and its call site (inside the
`for hop in candidates:` loop, where `distinct_payers` is a local variable already computed a
few lines above `evaluate_deposit_gate(...)`). Thread `distinct_payers: int` through as a new
parameter to `_evaluate_candidate_report` (both its two call sites — the per-candidate loop
building `evaluated`, and the final reported-candidate call after `passed`/`hop` is selected —
already have this value available locally in both places; confirm this yourself by reading
both call sites before assuming it). Change the breakdown line to:

```python
breakdown = {
    **gate.breakdown,
    "sweep_confirmed": sweep_signal.is_sweep,
    "sweep_gap_seconds": sweep_signal.gap_seconds,
    "sweep_value_preserved_pct": sweep_signal.value_preserved_pct,
    "distinct_payer_count": distinct_payers,
}
```

The function's `gate is None` (read-failure) branch already sets `breakdown = {"data_unavailable": True}` and must stay exactly as-is — a failed read has no real sweep numbers to report, and this branch's dict shape is a separate honest signal, not something to force these 3 keys onto.

- [ ] **Step 4: Run tests, verify pass**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/api/test_traces_api.py -v` from `backend/`.
Expected: all PASS.

- [ ] **Step 5: Run full suite**

Run: `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/`.
Expected: all PASS, zero regressions (verify the current baseline count first via `git log --oneline -5` — expect it to already include the cross-chain bridge-linking plan's Task 3, since this task must not start before that merges).

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/traces.py backend/tests/api/test_traces_api.py
git commit -m "feat(backend): persist raw sweep gap/value/payer numbers in AttributionCandidate breakdown"
```

---

## Task 2: Feature extraction + cosine similarity module

**Files:**
- Create: `backend/app/graph/operator_fingerprint.py`
- Test: `backend/tests/unit/test_operator_fingerprint.py`

**Interfaces:**
- Consumes: `app.models.Hop` (`case_id, hop_index, wallet_address, chain, tx_hash, amount, at, stop_reason, flag` — read the model yourself to confirm exact column names), `app.models.AttributionCandidate` (`case_id, wallet_address, chain, gate_passed, gate_breakdown, entity_name, reasoning, limitations` — `gate_breakdown` now includes Task 1's 3 new keys), `app.models.Case` (`chain, asset` fields).
- Produces:
  ```python
  @dataclass(frozen=True)
  class OperatorFingerprint:
      case_id: str
      hop_count: int
      sweep_gap_seconds: float | None
      sweep_value_preserved_pct: float | None
      distinct_payer_count: int
      hour_of_day: int   # 0-23, UTC
      chain: str
      asset: str

  def build_fingerprint(db: Session, case_id: str) -> OperatorFingerprint | None:
      """Returns None when this case has no gate_passed=True AttributionCandidate row --
      never a fabricated all-zero vector."""

  @dataclass(frozen=True)
  class SimilarityResult:
      other_case_id: str
      score: float                    # 0.0-1.0+ (bonus can push slightly over 1.0 before capping)
      feature_breakdown: dict[str, float]

  def rank_similar_cases(target: OperatorFingerprint,
                          candidates: list[OperatorFingerprint],
                          min_similarity: float = 0.7) -> list[SimilarityResult]:
      """Ranked descending by score, only entries clearing min_similarity."""
  ```

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/unit/test_operator_fingerprint.py
from datetime import datetime, timezone
from app.graph.operator_fingerprint import (
    OperatorFingerprint, SimilarityResult, rank_similar_cases,
)

def fp(case_id, hop_count=3, gap=30.0, preserved=0.99, payers=4, hour=14,
       chain="tron", asset="USDT-TRC20"):
    return OperatorFingerprint(
        case_id=case_id, hop_count=hop_count, sweep_gap_seconds=gap,
        sweep_value_preserved_pct=preserved, distinct_payer_count=payers,
        hour_of_day=hour, chain=chain, asset=asset,
    )

def test_identical_fingerprints_score_at_or_above_min_similarity():
    target = fp("case-a")
    same = fp("case-b")
    results = rank_similar_cases(target, [same], min_similarity=0.7)
    assert len(results) == 1
    assert results[0].other_case_id == "case-b"
    assert results[0].score >= 0.7

def test_wildly_different_fingerprint_is_excluded():
    target = fp("case-a", hop_count=2, gap=20.0, preserved=0.99, payers=5, hour=3,
                 chain="tron", asset="USDT-TRC20")
    different = fp("case-b", hop_count=6, gap=250000.0, preserved=0.1, payers=1, hour=16,
                    chain="ethereum", asset="USDT-ERC20")
    results = rank_similar_cases(target, [different], min_similarity=0.7)
    assert results == []

def test_results_ranked_descending_by_score():
    target = fp("case-a")
    close = fp("case-b", gap=32.0)       # very close
    farther_but_still_matching = fp("case-c", gap=90.0, payers=3)  # further, still above bar
    results = rank_similar_cases(target, [farther_but_still_matching, close], min_similarity=0.5)
    assert [r.other_case_id for r in results] == ["case-b", "case-c"]

def test_chain_asset_match_bonus_applied_and_capped_at_one():
    same_chain = fp("case-b", chain="tron", asset="USDT-TRC20")
    diff_chain = fp("case-c", chain="ethereum", asset="USDT-ERC20")
    target = fp("case-a", chain="tron", asset="USDT-TRC20")
    results = rank_similar_cases(target, [same_chain, diff_chain], min_similarity=0.0)
    same_result = next(r for r in results if r.other_case_id == "case-b")
    diff_result = next(r for r in results if r.other_case_id == "case-c")
    assert same_result.score > diff_result.score
    assert same_result.score <= 1.0
    assert diff_result.score <= 1.0

def test_feature_breakdown_present_on_every_result():
    target = fp("case-a")
    other = fp("case-b")
    results = rank_similar_cases(target, [other], min_similarity=0.0)
    assert set(results[0].feature_breakdown.keys()) >= {
        "hop_count", "sweep_gap_seconds", "sweep_value_preserved_pct",
        "distinct_payer_count", "hour_of_day", "chain_asset_match",
    }

def test_self_comparison_is_never_included():
    target = fp("case-a")
    results = rank_similar_cases(target, [target], min_similarity=0.0)
    assert results == []
```

Also add DB-level tests for `build_fingerprint` (same file), using an in-memory sqlite session
(follow the exact pattern in `backend/tests/unit/test_campaign_clustering.py` for constructing
a test DB session and seeding `Hop`/`AttributionCandidate`/`Case` rows directly — read that
file first to copy its fixture setup):

```python
def test_build_fingerprint_returns_none_when_no_gate_passed_candidate(db_session):
    # seed a Case + a Hop + an AttributionCandidate with gate_passed=False only
    ...
    assert build_fingerprint(db_session, "case-x") is None

def test_build_fingerprint_extracts_real_persisted_values(db_session):
    # seed a Case(chain="tron", asset="USDT-TRC20"), 3 Hop rows, one AttributionCandidate with
    # gate_passed=True and gate_breakdown={"sweep_confirmed": True, "sweep_gap_seconds": 45.0,
    # "sweep_value_preserved_pct": 0.97, "distinct_payer_count": 5}
    ...
    result = build_fingerprint(db_session, "case-x")
    assert result.hop_count == 3
    assert result.sweep_gap_seconds == 45.0
    assert result.distinct_payer_count == 5
    assert result.chain == "tron"
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/unit/test_operator_fingerprint.py -v` from `backend/`.
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `operator_fingerprint.py`**

```python
"""Operator fingerprinting: behavioral-similarity ranking across cases, computed entirely
from already-persisted Hop/AttributionCandidate rows -- zero new chain-API reads, zero ML
training. Complementary to app.graph.campaigns' hub-wallet clustering (hard, deterministic
evidence): this module answers "do these cases share a HABIT", not "do these cases share a
wallet". Every result is a suggested lead, never proof -- same epistemic status this project
already gives app.bridge.linker.find_bridge_links()'s cross-chain correlations.

See docs/superpowers/specs/2026-09-26-operator-fingerprinting-design.md for the full design
rationale, including why this is unsupervised cosine similarity over real signals rather than
a trained model (no real labelled fraud dataset exists to train one honestly)."""
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import AttributionCandidate, Case, Hop

SIMILARITY_DISCLAIMER = (
    "This is a suggested behavioral link based on operational patterns, not proof of a shared "
    "operator -- an officer must independently verify any connection before acting on it."
)

# Real, adjustable constants -- not magic numbers kept only by convention. Normalization
# ranges reflect this project's own real data ranges (SWEEP_MAX_GAP_SECONDS=300 is the sweep
# detector's own "fast" bound; hop caps at 6 per tracer.py's max_hops default).
_CHAIN_ASSET_MATCH_BONUS = 0.1
NORMALIZATION_RANGES = {
    "hop_count": (1.0, 6.0),
    "sweep_gap_seconds": (0.0, 300.0),
    "sweep_value_preserved_pct": (0.0, 1.02),
    "distinct_payer_count": (0.0, 20.0),
    "hour_of_day": (0.0, 23.0),
}


@dataclass(frozen=True)
class OperatorFingerprint:
    case_id: str
    hop_count: int
    sweep_gap_seconds: float | None
    sweep_value_preserved_pct: float | None
    distinct_payer_count: int
    hour_of_day: int
    chain: str
    asset: str


@dataclass(frozen=True)
class SimilarityResult:
    other_case_id: str
    score: float
    feature_breakdown: dict[str, float]


def build_fingerprint(db: Session, case_id: str) -> OperatorFingerprint | None:
    case = db.get(Case, case_id)
    if case is None:
        return None

    winning = db.execute(
        select(AttributionCandidate)
        .where(AttributionCandidate.case_id == case_id, AttributionCandidate.gate_passed.is_(True))
        .order_by(AttributionCandidate.id.asc())
    ).scalars().first()
    if winning is None:
        return None

    hop_count = db.execute(
        select(Hop).where(Hop.case_id == case_id)
    ).scalars().all()
    funding_hop = next((h for h in hop_count if h.wallet_address == winning.wallet_address), None)
    hour_of_day = funding_hop.at.hour if funding_hop is not None else 0

    breakdown = winning.gate_breakdown
    return OperatorFingerprint(
        case_id=case_id,
        hop_count=len(hop_count),
        sweep_gap_seconds=breakdown.get("sweep_gap_seconds"),
        sweep_value_preserved_pct=breakdown.get("sweep_value_preserved_pct"),
        distinct_payer_count=breakdown.get("distinct_payer_count", 0),
        hour_of_day=hour_of_day,
        chain=case.chain,
        asset=case.asset,
    )


def _normalize(value: float, feature_name: str) -> float:
    lo, hi = NORMALIZATION_RANGES[feature_name]
    if hi == lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def rank_similar_cases(target: OperatorFingerprint, candidates: list[OperatorFingerprint],
                        min_similarity: float = 0.7) -> list[SimilarityResult]:
    results: list[SimilarityResult] = []
    target_vec = [
        _normalize(target.hop_count, "hop_count"),
        _normalize(target.sweep_gap_seconds or 0.0, "sweep_gap_seconds"),
        _normalize(target.sweep_value_preserved_pct or 0.0, "sweep_value_preserved_pct"),
        _normalize(target.distinct_payer_count, "distinct_payer_count"),
        _normalize(target.hour_of_day, "hour_of_day"),
    ]
    for other in candidates:
        if other.case_id == target.case_id:
            continue
        other_vec = [
            _normalize(other.hop_count, "hop_count"),
            _normalize(other.sweep_gap_seconds or 0.0, "sweep_gap_seconds"),
            _normalize(other.sweep_value_preserved_pct or 0.0, "sweep_value_preserved_pct"),
            _normalize(other.distinct_payer_count, "distinct_payer_count"),
            _normalize(other.hour_of_day, "hour_of_day"),
        ]
        cosine = _cosine_similarity(target_vec, other_vec)
        chain_asset_match = 1.0 if (other.chain == target.chain and other.asset == target.asset) else 0.0
        score = min(1.0, cosine + chain_asset_match * _CHAIN_ASSET_MATCH_BONUS)
        if score < min_similarity:
            continue
        results.append(SimilarityResult(
            other_case_id=other.case_id, score=round(score, 4),
            feature_breakdown={
                "hop_count": other.hop_count,
                "sweep_gap_seconds": other.sweep_gap_seconds,
                "sweep_value_preserved_pct": other.sweep_value_preserved_pct,
                "distinct_payer_count": other.distinct_payer_count,
                "hour_of_day": other.hour_of_day,
                "chain_asset_match": chain_asset_match,
            },
        ))
    results.sort(key=lambda r: r.score, reverse=True)
    return results
```

Note: `hop_count` in `build_fingerprint` shadows the query result variable name with the field
name in the sketch above for brevity — when actually writing this, name the intermediate
query-result list something like `hops` and compute `hop_count=len(hops)` for clarity; this is
a naming cleanup the implementer should make, not a behavior change.

- [ ] **Step 4: Run tests, verify they pass**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/unit/test_operator_fingerprint.py -v` from `backend/`.
Expected: all PASS.

- [ ] **Step 5: Run full suite**

Run: `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/`.
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/graph/operator_fingerprint.py backend/tests/unit/test_operator_fingerprint.py
git commit -m "feat(backend): operator-fingerprint feature extraction + cosine similarity ranking"
```

---

## Task 3: API endpoint + demo fixture

**Files:**
- Create: `backend/app/api/v1/operator_fingerprint.py`
- Modify: `backend/app/main.py` (register the new router — one line, follow the exact pattern of the existing router registrations there)
- Test: `backend/tests/api/test_operator_fingerprint_api.py` (new)

**Interfaces:**
- Consumes: `build_fingerprint(db, case_id) -> OperatorFingerprint | None`, `rank_similar_cases(target, candidates, min_similarity=0.7) -> list[SimilarityResult]`, `SIMILARITY_DISCLAIMER: str` (all from Task 2's `app.graph.operator_fingerprint`).

- [ ] **Step 1: Write the failing integration test**

```python
# backend/tests/api/test_operator_fingerprint_api.py
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.chains.base import Transfer
from app.labels.seed_labels import VaspLabelSeed
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

T0 = datetime(2026, 1, 1, 14, 0, 0, tzinfo=timezone.utc)  # same hour-of-day (14) for both cases

def mk(from_addr, to_addr, amount, ts, tx):
    return Transfer(tx_hash=tx, chain="tron", from_address=from_addr, to_address=to_addr,
                     amount=Decimal(str(amount)), asset="USDT-TRC20", timestamp=ts, fee=Decimal("0"), raw={})

VETTED = VaspLabelSeed(address="TExchangeHotWallet0000000000000000", chain="tron",
                        entity_name="Test Exchange", source_url="https://example.test",
                        verified_at=T0, vetting_status="vetted")

def _make_and_trace_case(suspect, terminal, ncrp):
    payload = {
        "ncrp": ncrp, "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": T0.isoformat(), "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": suspect,
    }
    case_id = client.post("/api/v1/cases", json=payload).json()["id"]

    class FakeClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            data = {
                suspect: [mk(suspect, terminal, 148.5, T0, "tx-deposit")],
                terminal: [
                    mk(f"payer{i}", terminal, 50, T0, f"tx-payer-{i}") for i in range(4)
                ] + [
                    mk(suspect, terminal, 148.5, T0, "tx-deposit"),
                    mk(terminal, "cold", 147.0, T0.fromtimestamp(T0.timestamp() + 30, tz=timezone.utc), "tx-sweep"),
                ],
            }
            return data.get(address, [])

    with patch("app.api.v1.traces.get_chain_client", return_value=FakeClient()), \
         patch("app.api.v1.traces.lookup_label", return_value=VETTED):
        client.post(f"/api/v1/cases/{case_id}/trace")
    return case_id

def test_similar_operators_finds_a_matching_case_and_excludes_itself():
    case_a = _make_and_trace_case("TSuspectA00000000000000000000000001", "TTerminalShared0000000000000000001", "NCRP-FP-A")
    case_b = _make_and_trace_case("TSuspectB00000000000000000000000002", "TTerminalShared0000000000000000002", "NCRP-FP-B")

    response = client.get(f"/api/v1/cases/{case_a}/similar-operators")
    assert response.status_code == 200
    body = response.json()

    assert "disclaimer" in body and "not proof" in body["disclaimer"]
    result_ids = [r["caseId"] for r in body["results"]]
    assert case_a not in result_ids
    assert case_b in result_ids
    matching = next(r for r in body["results"] if r["caseId"] == case_b)
    assert matching["similarityScore"] > 0.7
    assert "featureBreakdown" in matching

def test_similar_operators_returns_empty_for_a_case_with_no_gate_passed_candidate():
    payload = {
        "ncrp": "NCRP-FP-NONE", "complainant": "Test User", "location": "Delhi", "phone": "9999999999",
        "incidentAt": T0.isoformat(), "fraudType": "investment_scam",
        "amountINR": 150000, "amountCrypto": 150.0, "asset": "USDT-TRC20", "chain": "tron",
        "suspectWallet": "TNoActivity0000000000000000000000003",
    }
    case_id = client.post("/api/v1/cases", json=payload).json()["id"]

    class NoActivityClient:
        chain = "tron"
        def get_transfers(self, address, since=None):
            return []

    with patch("app.api.v1.traces.get_chain_client", return_value=NoActivityClient()):
        client.post(f"/api/v1/cases/{case_id}/trace")

    response = client.get(f"/api/v1/cases/{case_id}/similar-operators")
    assert response.status_code == 200
    assert response.json()["results"] == []

def test_similar_operators_404_for_unknown_case():
    response = client.get("/api/v1/cases/does-not-exist/similar-operators")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/api/test_operator_fingerprint_api.py -v` from `backend/`.
Expected: FAIL — 404 (route doesn't exist).

- [ ] **Step 3: Implement the router**

```python
"""GET /api/v1/cases/{case_id}/similar-operators -- behavioral-similarity ranking, see
app.graph.operator_fingerprint's own module docstring for the full rationale."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.graph.operator_fingerprint import (
    SIMILARITY_DISCLAIMER, build_fingerprint, rank_similar_cases,
)
from app.models import Case

router = APIRouter(prefix="/api/v1/cases", tags=["operator-fingerprint"])


class SimilarOperatorResultOut(BaseModel):
    caseId: str
    similarityScore: float
    featureBreakdown: dict


class SimilarOperatorsOut(BaseModel):
    caseId: str
    results: list[SimilarOperatorResultOut]
    disclaimer: str


@router.get("/{case_id}/similar-operators", response_model=SimilarOperatorsOut)
def get_similar_operators(case_id: str, db: Session = Depends(get_db)) -> SimilarOperatorsOut:
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="case not found")

    target = build_fingerprint(db, case_id)
    if target is None:
        return SimilarOperatorsOut(caseId=case_id, results=[], disclaimer=SIMILARITY_DISCLAIMER)

    all_case_ids = db.execute(select(Case.id)).scalars().all()
    candidates = [
        fp for other_id in all_case_ids if other_id != case_id
        for fp in [build_fingerprint(db, other_id)] if fp is not None
    ]

    ranked = rank_similar_cases(target, candidates)
    return SimilarOperatorsOut(
        caseId=case_id,
        results=[
            SimilarOperatorResultOut(caseId=r.other_case_id, similarityScore=r.score,
                                      featureBreakdown=r.feature_breakdown)
            for r in ranked
        ],
        disclaimer=SIMILARITY_DISCLAIMER,
    )
```

Register the router in `app/main.py` — read that file to find where the other Sprint 2/3
routers (`campaigns`, `vasp_feed`, `freeze`, `sanctions`, `evidence`, `audit`, `legal`, `risk`)
are imported and included, and add this one the same way.

- [ ] **Step 4: Run tests, verify they pass**

Run: `backend/.venv/Scripts/python.exe -m pytest -q tests/api/test_operator_fingerprint_api.py -v` from `backend/`.
Expected: all PASS.

- [ ] **Step 5: Run full suite**

Run: `backend/.venv/Scripts/python.exe -m pytest -q` from `backend/`.
Expected: all PASS, zero regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/operator_fingerprint.py backend/app/main.py backend/tests/api/test_operator_fingerprint_api.py
git commit -m "feat(backend): similar-operators endpoint -- behavioral similarity across cases"
```

---

## Self-Review Notes (completed during plan authoring)

1. **Spec coverage:** data model extension (Task 1), feature vector + similarity (Task 2), API surface + demo-proving integration test (Task 3). The design spec's "Demo fixture" section is satisfied by Task 3's integration test using two deliberately-matching fake-chain-client cases plus one deliberately-non-matching case — a dedicated frontend mock-data addition was explicitly scoped OUT (design spec's "Scope / sequencing": "no new frontend screen").
2. **Placeholder scan:** none found — every step has complete, concrete code.
3. **Type consistency:** `OperatorFingerprint`/`SimilarityResult` field names and types are identical across Task 2's implementation and Task 3's consumption. `SIMILARITY_DISCLAIMER` string is defined once in Task 2, imported (not re-declared) in Task 3.
4. **Sequencing:** this plan's Task 1 must not be dispatched until the cross-chain bridge-linking plan's Task 3 has merged (both touch `traces.py`) — see Global Constraints.
