/**
 * Officer Feedback Loop — page-local synthetic data.
 * Every case, wallet and verdict is fabricated demo data.
 */
import type { Tone } from '@/components/kit'

export type FactorKey = 'sweep' | 'consolidation' | 'value' | 'vasp' | 'age'

export const FACTORS: { key: FactorKey; plain: string; tech: string; tone: Tone }[] = [
  { key: 'sweep', plain: 'How fast money leaves a wallet', tech: 'sweep latency', tone: 'crimson' },
  { key: 'consolidation', plain: "Many victims' money in one wallet", tech: 'consolidation in-degree', tone: 'ember' },
  { key: 'value', plain: 'Amount kept at every hop', tech: 'value preservation ratio', tone: 'white' },
  { key: 'vasp', plain: 'Exchange not registered in India', tech: 'VASP compliance · FIU-IND', tone: 'gold' },
  { key: 'age', plain: 'Wallet created just before the scam', tech: 'wallet age', tone: 'neutral' },
]

/** v14 — the weights running in production today */
export const BEFORE: Record<FactorKey, number> = { sweep: 0.29, consolidation: 0.23, value: 0.16, vasp: 0.12, age: 0.1 }
/** v15 candidate — built from officer verdicts so far */
export const AFTER_START: Record<FactorKey, number> = { sweep: 0.31, consolidation: 0.24, value: 0.15, vasp: 0.12, age: 0.08 }
export const WEIGHT_SUM = 0.9

export type ReviewKind = 'Exchange attribution' | 'Risk call' | 'Bridge link' | 'Syndicate link'

export type ReviewItem = {
  id: string
  caseId: string
  kind: ReviewKind
  claim: string
  addr?: string
  chain?: 'TRON' | 'Ethereum'
  confidence: number
  evidence: string[]
  /** alternatives offered when the officer picks "Correct" */
  alts: string[]
  /** which factor weights an "accept" reinforces (+) or weakens (−) */
  nudge: Partial<Record<FactorKey, number>>
}

const EXCHANGE_ALTS = ['Kestrel Exchange', 'Northwind Coin', 'Arcadia Markets', 'Halcyon Pay', 'Orbita Exchange', 'Not an exchange — OTC desk']

export const QUEUE: ReviewItem[] = [
  {
    id: 'RV-1184',
    caseId: 'KZN-2026-0417',
    kind: 'Exchange attribution',
    claim: 'TBx1…2kL is a Meridian Digital Exchange deposit address',
    addr: 'TBx1eM9nT7hG3sV5cW2kL',
    chain: 'TRON',
    confidence: 0.91,
    evidence: ['340 deposit-like transfers in, swept out in batches', 'Same sweep target as 112 other Meridian deposits'],
    alts: EXCHANGE_ALTS,
    nudge: { vasp: 1, consolidation: 0.5 },
  },
  {
    id: 'RV-1183',
    caseId: 'KZN-2026-0416',
    kind: 'Risk call',
    claim: 'TNh8…9pR is a collection wallet run by a scam ring — risk HIGH',
    addr: 'TNh8yW5vC2mQ7fL4xK9pR',
    chain: 'TRON',
    confidence: 0.93,
    evidence: ["38 victims' money arrives here within 9 days", 'Nothing ever flows back out to victims'],
    alts: ['Risk MEDIUM', 'Risk LOW', 'Legitimate merchant wallet'],
    nudge: { consolidation: 1, sweep: 0.3 },
  },
  {
    id: 'RV-1181',
    caseId: 'KZN-2026-0415',
    kind: 'Bridge link',
    claim: 'Money crossing the bridge to 0x7a3f…2071 is the same stolen money',
    addr: '0x7a3fd21c9b4e8a5f2071',
    chain: 'Ethereum',
    confidence: 0.82,
    evidence: ['Left TRON and arrived on Ethereum 4 min 38 s apart', 'Amount matches to 99.3% after bridge fee'],
    alts: ['Unrelated transfer — coincidental timing', 'Same money, different exit wallet'],
    nudge: { value: 1, sweep: -0.3 },
  },
  {
    id: 'RV-1179',
    caseId: 'KZN-2026-0412',
    kind: 'Risk call',
    claim: 'TPd4…3gH is an automated sweeper, not a person — risk HIGH',
    addr: 'TPd4wS8cM1kR5tY9nB3gH',
    chain: 'TRON',
    confidence: 0.88,
    evidence: ['Every deposit leaves within 45 s', 'Created 3 hours before the first victim paid'],
    alts: ['Risk MEDIUM', 'Human-operated wallet'],
    nudge: { sweep: 1, age: 0.6 },
  },
  {
    id: 'RV-1176',
    caseId: 'KZN-2026-0411',
    kind: 'Exchange attribution',
    claim: '0x9e4b…3e5b is an Arcadia Markets deposit address',
    addr: '0x9e4b8f07a2c6d13e5b',
    chain: 'Ethereum',
    confidence: 0.74,
    evidence: ['Batch sweeps to a wallet tagged Arcadia hot wallet', 'Only 41 deposits seen — thin history'],
    alts: ['Meridian Digital Exchange', ...EXCHANGE_ALTS.filter((x) => x !== 'Arcadia Markets')],
    nudge: { vasp: 0.8 },
  },
  {
    id: 'RV-1172',
    caseId: 'KZN-2026-0410',
    kind: 'Exchange attribution',
    claim: 'TRw2…1qL deposits into Orbita Exchange',
    addr: 'TRw2pD9kH5sM3nV8cF1qL',
    chain: 'TRON',
    confidence: 0.69,
    evidence: ['Timing matches Orbita withdrawal batches', 'No public tag — inferred from sweep pattern only'],
    alts: ['Meridian Digital Exchange', ...EXCHANGE_ALTS.filter((x) => x !== 'Orbita Exchange')],
    nudge: { vasp: 0.6, value: -0.3 },
  },
  {
    id: 'RV-1169',
    caseId: 'KZN-2026-0409',
    kind: 'Syndicate link',
    claim: 'This case belongs to SYN-02, the digital-arrest impersonation group',
    confidence: 0.61,
    evidence: ['Shares one pass-through wallet with 2 SYN-02 cases', 'Different scam script and time-of-day pattern'],
    alts: ['SYN-07 “Saffron Desk”', 'SYN-11 loan-app network', 'No syndicate — isolated case'],
    nudge: { consolidation: 0.6, age: -0.4 },
  },
]

export const DRIFT_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
export const DRIFT: Record<FactorKey, number[]> = {
  sweep: [26, 27, 27, 28, 29, 29, 30, 31],
  consolidation: [20, 21, 21, 22, 22, 23, 23, 24],
  value: [19, 19, 18, 18, 17, 16, 16, 15],
  vasp: [12, 12, 13, 12, 12, 12, 12, 12],
  age: [13, 12, 12, 11, 11, 10, 9, 8],
}

export const AGREEMENT_BY_KIND: { kind: ReviewKind; rate: number; n: number }[] = [
  { kind: 'Exchange attribution', rate: 0.92, n: 61 },
  { kind: 'Risk call', rate: 0.88, n: 74 },
  { kind: 'Syndicate link', rate: 0.79, n: 19 },
  { kind: 'Bridge link', rate: 0.71, n: 24 },
]

export const VERSIONS: { v: string; date: string; state: 'retired' | 'live' | 'candidate'; lines: string[]; signed: string }[] = [
  { v: 'v12', date: '14 Jul 2026', state: 'retired', lines: ['Added “wallet created just before the scam” factor', 'Triggered by 9 officer corrections on brand-new wallets'], signed: 'SI K. Rathore · Insp. A. Bhatia' },
  { v: 'v13', date: '05 Aug 2026', state: 'retired', lines: ['Bridge-link confidence capped at 0.85', 'Officers rejected 6 over-confident cross-chain links'], signed: 'SI M. Pillai · Insp. A. Bhatia' },
  { v: 'v14', date: '29 Aug 2026', state: 'live', lines: ['Sweep speed +2 pts, amount kept −1 pt', 'Based on 31 verdicts across 4 states'], signed: 'SI K. Rathore · SI R. Chauhan' },
  { v: 'v15', date: 'pending', state: 'candidate', lines: ['Sweep speed +2, many-victims +1, wallet age −2', 'Needs a second officer before it can be promoted'], signed: '1 of 2 sign-offs' },
]
