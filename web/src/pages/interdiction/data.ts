/**
 * Pre-emptive freeze — page-local synthetic data.
 * All wallets, cases and exchanges are fabricated (exchange names are the fictional set in data/demo).
 */
import type { Tone } from '@/components/kit'
import type { Chain } from '@/data/demo'

export type PredKind = 'exchange' | 'p2p' | 'mixer' | 'bridge'

export type Prediction = {
  id: string
  title: string
  sub: string
  p: number
  tone: Tone
  kind: PredKind
  addr?: string
  exchangeId?: string
}

export type PathNode = { id: string; title: string; addr: string; tone: Tone; kind: 'victim' | 'wallet'; gapLabel?: string }

export type Scenario = {
  caseId: string
  movingINR: number
  movingCrypto: string
  chain: Chain
  path: PathNode[]
  /** seconds until predicted arrival at page load */
  etaSec: number
  /** seconds funds have already sat on the current wallet at page load */
  elapsedSec: number
  syndicate: string
  priorTraces: number
  routeReuse: number
  confidence: { label: 'High' | 'Medium' | 'Low'; tone: Tone }
  preds: Prediction[]
  /** historical minutes from the last pass-through wallet to the deposit, 2-minute bins */
  hist: number[]
  medianMin: number
  factors: { plain: string; tech: string; w: number; tone: Tone }[]
}

export const HIST_BINS = ['0–2', '2–4', '4–6', '6–8', '8–10', '10–12', '12–14', '14+']

export const SCENARIOS: Scenario[] = [
  {
    caseId: 'KZN-2026-0417',
    movingINR: 410000,
    movingCrypto: '4,910 USDT',
    chain: 'TRON',
    path: [
      { id: 'v', title: "Victim's wallet", addr: 'TVc2hL8sN4dR7gY1mX5wQ', tone: 'sky', kind: 'victim' },
      { id: 's', title: "Scammer's wallet", addr: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', tone: 'crimson', kind: 'wallet', gapLabel: 'out in 7 s' },
      { id: 'c', title: 'Pass-through wallet 3', addr: 'TPd4wS8cM1kR5tY9nB3gH', tone: 'crimson', kind: 'wallet', gapLabel: 'out in 45 s' },
    ],
    etaSec: 372,
    elapsedSec: 236,
    syndicate: 'SYN-07 · Saffron Desk',
    priorTraces: 38,
    routeReuse: 0.84,
    confidence: { label: 'High', tone: 'moss' },
    preds: [
      { id: 'p1', title: 'Meridian deposit', sub: 'Meridian Digital Exchange', p: 0.71, tone: 'gold', kind: 'exchange', addr: 'TBx1eM9nT7hG3sV5cW2kL', exchangeId: 'meridian' },
      { id: 'p2', title: 'Kestrel deposit', sub: 'Kestrel Exchange', p: 0.18, tone: 'gold', kind: 'exchange', addr: 'TMk2rV7nD4sH9wB1cQ5pX', exchangeId: 'kestrel' },
      { id: 'p3', title: 'P2P cash desk', sub: 'over-the-counter seller', p: 0.08, tone: 'neutral', kind: 'p2p' },
      { id: 'p4', title: 'Mixer', sub: 'coin-mixing service', p: 0.03, tone: 'neutral', kind: 'mixer' },
    ],
    hist: [1, 3, 5, 8, 10, 6, 3, 2],
    medianMin: 9.4,
    factors: [
      { plain: 'Took this exact route in 32 of 38 past cases', tech: 'route reuse 84% · SYN-07 trace history', w: 0.38, tone: 'crimson' },
      { plain: 'Passes the same collection wallet (38 victims)', tech: 'hub TNh8yW…K9pR · in-degree 38', w: 0.24, tone: 'crimson' },
      { plain: 'This Meridian deposit address was used 12 times before', tech: 'deposit-address reuse · 12 prior deposits', w: 0.21, tone: 'gold' },
      { plain: "Moving at the syndicate's usual hour (6–10 pm)", tech: 'time-of-day pattern · 71% of sweeps after 18:00 IST', w: 0.11, tone: 'ember' },
      { plain: 'Amount sits just under an enhanced-check limit', tech: 'structuring below ₹5 L review threshold', w: 0.06, tone: 'neutral' },
    ],
  },
  {
    caseId: 'KZN-2026-0411',
    movingINR: 312000,
    movingCrypto: '3,740 USDT',
    chain: 'Ethereum',
    path: [
      { id: 'v', title: "Victim's wallet", addr: '0x31c7e0a94b2f58d16c', tone: 'sky', kind: 'victim' },
      { id: 's', title: "Scammer's wallet", addr: '0x6af20b3e19d4c78e05', tone: 'crimson', kind: 'wallet', gapLabel: 'out in 19 s' },
      { id: 'c', title: 'Pass-through wallet 2', addr: '0xd47e1a8c35b902f6ea', tone: 'crimson', kind: 'wallet', gapLabel: 'out in 2 m' },
    ],
    etaSec: 880,
    elapsedSec: 300,
    syndicate: 'No syndicate yet · resembles SYN-02',
    priorTraces: 14,
    routeReuse: 0.61,
    confidence: { label: 'Medium', tone: 'gold' },
    preds: [
      { id: 'p1', title: 'Arcadia deposit', sub: 'Arcadia Markets', p: 0.58, tone: 'gold', kind: 'exchange', addr: '0xa83c5f17e2d940b6c1', exchangeId: 'arcadia' },
      { id: 'p2', title: 'Northwind deposit', sub: 'Northwind Coin', p: 0.24, tone: 'gold', kind: 'exchange', addr: '0x5e09b4d2c871af3e60', exchangeId: 'northwind' },
      { id: 'p3', title: 'Bridge to TRON', sub: 'cross-chain bridge', p: 0.12, tone: 'violet', kind: 'bridge' },
      { id: 'p4', title: 'Mixer', sub: 'coin-mixing service', p: 0.06, tone: 'neutral', kind: 'mixer' },
    ],
    hist: [0, 1, 1, 2, 3, 3, 2, 2],
    medianMin: 11.2,
    factors: [
      { plain: 'Similar digital-arrest cases went to Arcadia 8 of 14 times', tech: 'route reuse 61% · nearest-cluster history', w: 0.34, tone: 'crimson' },
      { plain: 'Arcadia deposit address seen in 5 earlier complaints', tech: 'deposit-address reuse · 5 prior deposits', w: 0.27, tone: 'gold' },
      { plain: 'Same two-step pass-through pattern', tech: 'path shape match · 2 hops, ~99% kept', w: 0.22, tone: 'ember' },
      { plain: 'Gas paid from a wallet linked to the group', tech: 'fee-funder overlap', w: 0.17, tone: 'neutral' },
    ],
  },
  {
    caseId: 'KZN-2026-0409',
    movingINR: 198000,
    movingCrypto: '0.038 BTC',
    chain: 'Bitcoin',
    path: [
      { id: 'v', title: "Victim's wallet", addr: 'bc1q8f3kz0w9d2m5r7t4v6', tone: 'sky', kind: 'victim' },
      { id: 's', title: "Scammer's wallet", addr: 'bc1qx4n7p2r9w5k3t8m1s6', tone: 'crimson', kind: 'wallet', gapLabel: 'out in 4 m' },
      { id: 'c', title: 'Pass-through wallet 2', addr: 'bc1qm2v9d4k7r1x8z3p6w5', tone: 'crimson', kind: 'wallet', gapLabel: 'out in 6 m' },
    ],
    etaSec: 1385,
    elapsedSec: 120,
    syndicate: 'No syndicate match yet',
    priorTraces: 9,
    routeReuse: 0.44,
    confidence: { label: 'Low', tone: 'crimson' },
    preds: [
      { id: 'p1', title: 'Northwind deposit', sub: 'Northwind Coin', p: 0.44, tone: 'gold', kind: 'exchange', addr: 'bc1qn7w4d1x8k2m5r9t3v0', exchangeId: 'northwind' },
      { id: 'p2', title: 'P2P cash desk', sub: 'over-the-counter seller', p: 0.33, tone: 'neutral', kind: 'p2p' },
      { id: 'p3', title: 'Halcyon deposit', sub: 'Halcyon Pay', p: 0.15, tone: 'gold', kind: 'exchange', addr: 'bc1qh5c2t8w1m4k7x9r3d6', exchangeId: 'halcyon' },
      { id: 'p4', title: 'Mixer', sub: 'coin-mixing service', p: 0.08, tone: 'neutral', kind: 'mixer' },
    ],
    hist: [0, 0, 1, 1, 1, 2, 1, 3],
    medianMin: 13.5,
    factors: [
      { plain: 'Only 9 similar sextortion traces to learn from', tech: 'small sample · wide uncertainty', w: 0.3, tone: 'neutral' },
      { plain: '4 of 9 similar cases cashed out at Northwind', tech: 'route reuse 44%', w: 0.3, tone: 'gold' },
      { plain: 'Funds split into two equal parts', tech: 'peel-chain shape · common before P2P sale', w: 0.24, tone: 'ember' },
      { plain: 'Slow, human-paced hops (minutes, not seconds)', tech: 'no sweep signature · manual movement', w: 0.16, tone: 'neutral' },
    ],
  },
]

export type AlertOutcome = 'held' | 'missed' | 'pending'

export const PAST_ALERTS: { caseId: string; exchangeId: string; amt: number; outcome: AlertOutcome; when: string; note: string }[] = [
  { caseId: 'KZN-2026-0406', exchangeId: 'meridian', amt: 380000, outcome: 'held', when: 'Today, 13:12', note: 'held 4m 50s after alert' },
  { caseId: 'KZN-2026-0408', exchangeId: 'kestrel', amt: 1120000, outcome: 'held', when: 'Yesterday, 21:47', note: 'held 7m 12s after alert' },
  { caseId: 'KZN-2026-0403', exchangeId: 'arcadia', amt: 190000, outcome: 'pending', when: 'Yesterday, 18:05', note: 'exchange has not replied' },
  { caseId: 'KZN-2026-0402', exchangeId: 'northwind', amt: 245000, outcome: 'missed', when: '30 Sep, 22:31', note: 'deposit landed 1 min before alert' },
  { caseId: 'KZN-2026-0399', exchangeId: 'meridian', amt: 610000, outcome: 'held', when: '29 Sep, 19:58', note: 'held 3m 05s after alert' },
  { caseId: 'KZN-2026-0396', exchangeId: 'kestrel', amt: 275000, outcome: 'held', when: '28 Sep, 20:14', note: 'held 9m 40s after alert' },
]

/** last-30-day totals before this session */
export const ALERT_TOTALS = { held: 23, missed: 6, pending: 3 }
