"""Smart intake: turns a free-text (Hindi / English / Hinglish) complaint into the structured
fields a case needs, with every extracted value pointing back at the exact characters it came
from and a plain-English reason. Rule-based on purpose: every decision is explainable to an
officer and a judge, and nothing here needs labelled training data or a network call.
"""
