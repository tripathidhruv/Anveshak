"""Scam-typology suggestion (app/intake/classify.py)."""
import pytest

from app.intake.classify import CLASSES, DISCLAIMER, classify
from tests.unit.test_intake_extract import HINGLISH


def test_at_least_ten_classes_with_plain_names():
    ids = [c[0] for c in CLASSES]
    for cid in ["task_job", "investment", "pig_butchering", "digital_arrest", "loan_app", "sextortion",
                "lottery", "impersonation", "phishing", "other"]:
        assert cid in ids
    assert dict(CLASSES)["task_job"] == "Task-based job scam"


def test_hinglish_sample_is_task_job():
    r = classify(HINGLISH)
    assert r.top == "task_job"
    assert len(r.classes) == 3
    assert r.classes[0].id == "task_job" and r.classes[0].p > 0.5
    assert r.disclaimer == DISCLAIMER
    phrases = [t.phrase for t in r.triggers]
    assert 1 <= len(phrases) <= 6
    assert all(t.phrase in HINGLISH for t in r.triggers)  # as it appears in the text
    weights = [t.weight for t in r.triggers]
    assert weights == sorted(weights, reverse=True)


def test_probabilities_sum_to_one():
    r = classify(HINGLISH)
    assert abs(sum(r.all_probabilities.values()) - 1) < 1e-6


@pytest.mark.parametrize("text", ["", "hello world", "qwerty 12345"])
def test_noise_is_other(text):
    r = classify(text)
    assert r.top == "other"
    assert r.triggers == []


@pytest.mark.parametrize("text,expected", [
    ("A man on video call said he was CBI officer, I was under digital arrest and must transfer money to RBI account",
     "digital_arrest"),
    ("Loan app ne mere contacts ko morphed photos bheje aur recovery agent ne dhamki di", "loan_app"),
    ("I met her on a dating app, she taught me crypto trading on a platform and I kept investing", "pig_butchering"),
    ("You have won a lottery prize, pay processing fee to claim it", "lottery"),
    ("Connected my wallet to claim airdrop on a fake site and the seed phrase was stolen", "phishing"),
    ("Investment app promised guaranteed returns of 40% and showed profit but no withdrawal", "investment"),
    ("Fake customer care number of the bank asked me to install AnyDesk for refund", "impersonation"),
    ("Video call pe nude record karke blackmail kar rahe hain", "sextortion"),
])
def test_other_classes(text, expected):
    assert classify(text).top == expected
