/**
 * Accuracy & Red Team — page-local synthetic data.
 * Backtest figures are from a replay of synthetic closed cases; illustrative until measured on real casework.
 */
import type { Tone } from '@/components/kit'

export const BACKTEST = {
  cases: 214,
  precision: 0.94,
  recall: 0.89,
  f1: 0.91,
  top1: 0.92,
  medianTraceSec: 41,
  ece: 0.031,
}

/** Is this a scam wallet? — 2×2 over 214 replayed cases */
export const CONFUSION_2X2 = { tp: 172, fp: 11, fn: 21, tn: 10 }

/** Reliability diagram: 10 bins of predicted risk vs observed scam rate */
export const RELIABILITY: { p: number; o: number; n: number }[] = [
  { p: 0.05, o: 0.03, n: 6 },
  { p: 0.15, o: 0.12, n: 5 },
  { p: 0.25, o: 0.29, n: 7 },
  { p: 0.35, o: 0.31, n: 9 },
  { p: 0.45, o: 0.49, n: 11 },
  { p: 0.55, o: 0.52, n: 14 },
  { p: 0.65, o: 0.69, n: 19 },
  { p: 0.75, o: 0.72, n: 27 },
  { p: 0.85, o: 0.88, n: 46 },
  { p: 0.95, o: 0.96, n: 70 },
]

/** Which exchange? rows = true exchange, cols = ANVESHAK's top-1 pick (183 attributed cases) */
export const EXCHANGE_ORDER = ['meridian', 'kestrel', 'northwind', 'arcadia', 'halcyon', 'orbita']
export const EXCHANGE_CONFUSION: number[][] = [
  [59, 1, 1, 0, 0, 1],
  [1, 41, 1, 0, 1, 0],
  [1, 1, 28, 0, 1, 0],
  [1, 0, 0, 12, 0, 1],
  [0, 1, 1, 0, 19, 0],
  [1, 0, 0, 1, 0, 9],
]

/** Model trust score — weighted blend; every input is shown on screen. */
export const TRUST_PARTS: { label: string; value: number; w: number; tone: Tone }[] = [
  { label: 'Precision', value: 0.94, w: 0.25, tone: 'moss' },
  { label: 'Recall', value: 0.89, w: 0.25, tone: 'moss' },
  { label: 'Right exchange, first pick', value: 0.92, w: 0.2, tone: 'gold' },
  { label: 'Calibration (1 − error)', value: 0.97, w: 0.15, tone: 'sky' },
  { label: 'Red-team pass rate', value: 0.79, w: 0.15, tone: 'ember' },
]

export const BY_FRAUD_TYPE: { type: string; acc: number; n: number }[] = [
  { type: 'Task-based job scam', acc: 0.96, n: 71 },
  { type: 'Investment app scam', acc: 0.93, n: 48 },
  { type: 'Pig-butchering (romance)', acc: 0.88, n: 39 },
  { type: 'Digital arrest', acc: 0.84, n: 31 },
  { type: 'Loan app extortion', acc: 0.79, n: 25 },
]

export type Outcome = 'pass' | 'partial' | 'fail'
export type Scenario = {
  id: string
  plain: string
  tech: string
  how: string
  baseline: number
  attacks: number
  caught: number
  outcome: Outcome
  did: string
  icon: 'peel' | 'bridge' | 'mixer' | 'dust' | 'timer' | 'wash' | 'split'
}

export const SCENARIOS: Scenario[] = [
  { id: 'peel', plain: 'Peel chain', tech: '30+ hops, small slice peeled off each', how: 'Scammer shaves a little off at every hop so no single transfer looks like the whole amount.', baseline: 0.96, attacks: 40, caught: 39, outcome: 'pass', did: 'Followed the main branch across 34 hops; peeled slices flagged as side-trails.', icon: 'peel' },
  { id: 'bridge', plain: 'Chain-hopping via a bridge', tech: 'TRON → Ethereum bridge', how: 'Money is moved to a different blockchain to break the trail.', baseline: 0.82, attacks: 40, caught: 31, outcome: 'partial', did: 'Linked both sides by timing and amount (82% confidence) — shown as probable, not proven.', icon: 'bridge' },
  { id: 'mixer', plain: 'Mixer layering', tech: 'coin-mixing service, 3 rounds', how: "Funds are pooled with strangers' money and paid out in fresh coins.", baseline: 0.31, attacks: 40, caught: 12, outcome: 'fail', did: 'Trail stops at the mixer, by design. Case flagged and mixer exits put on watch.', icon: 'mixer' },
  { id: 'dust', plain: 'Dust decoys', tech: '200+ tiny decoy transfers', how: 'Hundreds of tiny payments are sprayed out to bury the real one.', baseline: 0.98, attacks: 40, caught: 40, outcome: 'pass', did: 'Ignored 212 transfers under ₹50; real trail kept intact.', icon: 'dust' },
  { id: 'jitter', plain: 'Waiting to dodge the sweep check', tech: 'timing jitter, 3–20 min delays', how: 'Bots wait a random few minutes before moving money, so it looks human.', baseline: 0.74, attacks: 40, caught: 29, outcome: 'partial', did: 'Sweep signal weaker, but many-victims and amount-kept factors still scored HIGH.', icon: 'timer' },
  { id: 'wash', plain: 'Round-trip wash', tech: 'funds loop back to origin cluster', how: 'Money is sent out and back again to fake normal two-way activity.', baseline: 0.91, attacks: 40, caught: 37, outcome: 'pass', did: 'Spotted the loop within 2 h; counter-flow rule fired and the round trip was collapsed.', icon: 'wash' },
  { id: 'split', plain: 'Split and merge', tech: '16-way split, re-merge at hub', how: 'One payment is split into many and recombined later at a collection wallet.', baseline: 0.93, attacks: 40, caught: 38, outcome: 'pass', did: 'Re-joined 16 splits at the collection wallet with 99.4% of the value accounted for.', icon: 'split' },
]

export const OUTCOME_TONE: Record<Outcome, Tone> = { pass: 'moss', partial: 'gold', fail: 'crimson' }
