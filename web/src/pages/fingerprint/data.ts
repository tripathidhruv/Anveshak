/**
 * Operator Fingerprint — page-local synthetic data.
 * Every operator profile, wallet and value here is fabricated demo data.
 */
import type { Tone } from '@/components/kit'

export type Axis = {
  key: string
  /** short label drawn on the radar */
  short: string
  plain: string
  tech: string
  /** weight in the similarity score (sums to 1) */
  w: number
  /** human-readable raw value for a normalised 0..1 score */
  raw: (v: number) => string
}

export const AXES: Axis[] = [
  { key: 'sweep', short: 'Sweep speed', plain: 'How fast money leaves a wallet', tech: 'median hold time before onward transfer', w: 0.2, raw: (v) => `${Math.round(18 + (1 - v) * 400)} s hold` },
  { key: 'split', short: 'Amount splitting', plain: 'Splits money into equal chunks', tech: 'chunk-size regularity · coefficient of variation', w: 0.18, raw: (v) => `${Math.round(v * 100)}% equal chunks` },
  { key: 'hours', short: 'Working hours', plain: 'Works the same hours of the day', tech: 'active-hour overlap · cosine on 7×12 grid', w: 0.14, raw: (v) => `${Math.round(v * 100)}% in 18–23 h` },
  { key: 'hops', short: 'Hop count', plain: 'Number of wallets used before cashing out', tech: 'median path length to exchange deposit', w: 0.1, raw: (v) => `${Math.round(2 + v * 6)} hops` },
  { key: 'chain', short: 'Chain choice', plain: 'Prefers the same blockchain', tech: 'TRON share of moved value', w: 0.1, raw: (v) => `${Math.round(v * 100)}% on TRON` },
  { key: 'bridge', short: 'Bridge use', plain: 'Moves part of the money to another chain', tech: 'cross-chain bridge hop rate', w: 0.08, raw: (v) => `${Math.round(v * 33)}% bridged` },
  { key: 'fee', short: 'Fee settings', plain: 'Uses the same transaction fee setting', tech: 'energy / fee-limit reuse across transfers', w: 0.12, raw: (v) => `${Math.round(v * 100)}% same fee cap` },
  { key: 'cashout', short: 'Cash-out venue', plain: 'Cashes out at the same kind of exchange', tech: 'share at offshore, non-FIU-registered VASPs', w: 0.08, raw: (v) => `${Math.round(v * 100)}% offshore` },
]

/** Current case behavioural profile (wallet cluster of ANV-2026-0417, last 30 days). */
export const CURRENT = {
  id: 'ANV-2026-0417',
  label: 'This case',
  values: [0.94, 0.9, 0.84, 0.62, 0.88, 0.36, 0.86, 0.8],
}

export type Operator = {
  id: string
  syndicate: string | null
  syndicateName: string
  cases: number
  lastSeen: string
  tone: Tone
  values: number[]
  /** hard links: wallets shared with this case (from the syndicate graph) */
  sharedWallets: string[]
  /** heat-grid parameters for active hours */
  heat: { peak: number; spread: number; weekend: number; seed: number }
  /** outgoing transfer-size histogram (count of transfers per bucket) */
  splits: number[]
  splitNote: string
}

export const SPLIT_BUCKETS = ['<1k', '1–2k', '2–3k', '3–4k', '4–4.9k', '4,950', '5–8k', '>8k']

export const OPERATORS: Operator[] = [
  {
    id: 'OP-114',
    syndicate: 'SYN-07',
    syndicateName: 'Saffron Desk',
    cases: 23,
    lastSeen: '2 h ago',
    tone: 'crimson',
    values: [0.87, 0.94, 0.74, 0.7, 0.92, 0.18, 0.83, 0.62],
    sharedWallets: ['TNh8yW5vC2mQ7fL4xK9pR', 'TQm7bK3xF9jH2nL6pV4sD'],
    heat: { peak: 10, spread: 1.4, weekend: 0.25, seed: 7 },
    splits: [6, 9, 4, 7, 12, 61, 5, 2],
    splitNote: 'Splits almost every payment into 4,950 USDT chunks — the same ladder seen in this case.',
  },
  {
    id: 'OP-089',
    syndicate: 'SYN-07',
    syndicateName: 'Saffron Desk',
    cases: 11,
    lastSeen: '1 d ago',
    tone: 'ember',
    values: [0.9, 0.7, 0.88, 0.48, 0.81, 0.08, 0.58, 0.72],
    sharedWallets: ['TNh8yW5vC2mQ7fL4xK9pR'],
    heat: { peak: 10, spread: 1.1, weekend: 0.1, seed: 13 },
    splits: [8, 12, 10, 14, 22, 26, 9, 5],
    splitNote: 'Often lands near 4,950 USDT but mixes in irregular amounts — a looser habit.',
  },
  {
    id: 'OP-201',
    syndicate: 'SYN-03',
    syndicateName: 'Lotus',
    cases: 9,
    lastSeen: '3 d ago',
    tone: 'violet',
    values: [0.72, 0.62, 0.66, 0.84, 0.64, 0.68, 0.71, 0.9],
    sharedWallets: [],
    heat: { peak: 7, spread: 1.8, weekend: 0.5, seed: 21 },
    splits: [11, 18, 34, 16, 8, 3, 6, 4],
    splitNote: 'Prefers 2,000–3,000 USDT chunks and bridges far more value to Ethereum.',
  },
  {
    id: 'OP-057',
    syndicate: 'SYN-11',
    syndicateName: 'Loan-app network',
    cases: 6,
    lastSeen: '6 d ago',
    tone: 'gold',
    values: [0.58, 0.41, 0.52, 0.36, 0.95, 0.04, 0.64, 0.44],
    sharedWallets: [],
    heat: { peak: 5, spread: 2.2, weekend: 0.6, seed: 5 },
    splits: [28, 22, 14, 9, 5, 1, 3, 2],
    splitNote: 'Moves many small, uneven amounts — no fixed chunk size.',
  },
  {
    id: 'OP-033',
    syndicate: 'SYN-02',
    syndicateName: 'Digital-arrest group',
    cases: 4,
    lastSeen: '19 d ago',
    tone: 'sky',
    values: [0.34, 0.28, 0.4, 0.92, 0.3, 0.74, 0.32, 0.58],
    sharedWallets: [],
    heat: { peak: 4, spread: 2.6, weekend: 0.8, seed: 3 },
    splits: [3, 5, 6, 8, 7, 1, 19, 24],
    splitNote: 'Moves large single amounts slowly, through many hops — a different playbook.',
  },
]

/** Weighted similarity: Σ wᵢ · (1 − |aᵢ − bᵢ|). */
export function similarity(a: number[], b: number[]): number {
  return AXES.reduce((s, ax, i) => s + ax.w * (1 - Math.abs(a[i] - b[i])), 0)
}

/** Deterministic day × 2-hour-block activity grid (7 × 12). */
export function heatGrid({ peak, spread, weekend, seed }: Operator['heat']): number[][] {
  let s = seed * 9301 + 49297
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 12 }, (_, c) => {
      const d = Math.min(Math.abs(c - peak), 12 - Math.abs(c - peak))
      const base = Math.exp(-(d * d) / (2 * spread * spread))
      const wk = r === 0 || r === 6 ? 1 + weekend * 0.4 : 1 - weekend * 0.15
      const v = base * wk * (0.75 + rnd() * 0.4)
      return Math.round(Math.max(0, Math.min(1, v < 0.08 ? 0 : v)) * 100) / 100
    }),
  )
}

export const CURRENT_HEAT = heatGrid({ peak: 10, spread: 1.3, weekend: 0.2, seed: 11 })
export const CURRENT_SPLITS = [2, 1, 0, 1, 2, 9, 1, 0]
