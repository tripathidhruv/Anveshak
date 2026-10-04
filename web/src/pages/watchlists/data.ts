/**
 * Watchlists & Broadcast — page-local synthetic data.
 * Every wallet, score and delivery figure is fabricated demo data.
 */
import type { Tone } from '@/components/kit'

export type Reason = 'Sweep signature' | 'Collection hub' | 'Sanctions list' | 'Predicted next hop'

export const REASON_TONE: Record<Reason, Tone> = {
  'Sweep signature': 'crimson',
  'Collection hub': 'crimson',
  'Sanctions list': 'violet',
  'Predicted next hop': 'ember',
}

export const REASON_TECH: Record<Reason, string> = {
  'Sweep signature': 'out < 60 s, > 99% kept',
  'Collection hub': 'in-degree from victims',
  'Sanctions list': 'OFAC SDN / UN match',
  'Predicted next hop': 'graph model forecast',
}

export type PoolWallet = {
  addr: string
  chain: 'TRON' | 'Ethereum' | 'Bitcoin'
  risk: number
  reason: Reason
  caseRef: string
  factors: { plain: string; w: number }[]
}

export const POOL: PoolWallet[] = [
  { addr: 'TFr3kW8mN2xQ7dL5vB9pH', chain: 'TRON', risk: 0.93, reason: 'Sweep signature', caseRef: 'ANV-2026-0418', factors: [{ plain: 'Money out in 38 s', w: 0.34 }, { plain: '99.8% kept', w: 0.18 }, { plain: 'Wallet 2 h old', w: 0.1 }] },
  { addr: 'TLp6sD1nK9vR4mY8cX2wE', chain: 'TRON', risk: 0.89, reason: 'Collection hub', caseRef: 'ANV-2026-0412', factors: [{ plain: '21 victims pay in', w: 0.3 }, { plain: 'Feeds Meridian deposits', w: 0.16 }, { plain: 'No outflow to people', w: 0.08 }] },
  { addr: '0x5b2e91c4d07fa38e61', chain: 'Ethereum', risk: 0.86, reason: 'Predicted next hop', caseRef: 'ANV-2026-0417', factors: [{ plain: 'Same bridge as route B', w: 0.28 }, { plain: 'Pre-funded 4 min before', w: 0.2 }, { plain: 'Same fee setting', w: 0.12 }] },
  { addr: 'TWq8vH3cM6nB1kP7sR4dJ', chain: 'TRON', risk: 0.95, reason: 'Sweep signature', caseRef: 'ANV-2026-0419', factors: [{ plain: 'Money out in 21 s', w: 0.36 }, { plain: '99.9% kept', w: 0.17 }, { plain: '4,950 USDT chunks', w: 0.12 }] },
  { addr: '0x8d3fa0b6e14c72d953', chain: 'Ethereum', risk: 0.97, reason: 'Sanctions list', caseRef: 'Screening', factors: [{ plain: 'Exact list match', w: 0.6 }, { plain: 'Mixer exposure', w: 0.14 }, { plain: 'Bridge exit', w: 0.08 }] },
  { addr: 'TCz2gF7jL4wN9xQ5mV1bK', chain: 'TRON', risk: 0.84, reason: 'Predicted next hop', caseRef: 'ANV-2026-0416', factors: [{ plain: 'Hub sends here 4 of 5 times', w: 0.3 }, { plain: 'Created same minute', w: 0.14 }, { plain: 'Same fee setting', w: 0.1 }] },
  { addr: 'bc1q7xk4m9rp2v8wd3nz', chain: 'Bitcoin', risk: 0.82, reason: 'Sweep signature', caseRef: 'ANV-2026-0414', factors: [{ plain: 'Money out in 3 min', w: 0.26 }, { plain: '98.9% kept', w: 0.16 }, { plain: 'Peel-chain shape', w: 0.14 }] },
  { addr: 'TMx5yR2pK8dW3vL6nC9hG', chain: 'TRON', risk: 0.91, reason: 'Collection hub', caseRef: 'ANV-2026-0406', factors: [{ plain: '14 victims pay in', w: 0.28 }, { plain: 'Linked to SYN-07', w: 0.2 }, { plain: 'Feeds Meridian deposits', w: 0.12 }] },
  { addr: 'TGd9bN4sQ1mH7kF3wX6pL', chain: 'TRON', risk: 0.88, reason: 'Sweep signature', caseRef: 'ANV-2026-0420', factors: [{ plain: 'Money out in 47 s', w: 0.31 }, { plain: '99.7% kept', w: 0.16 }, { plain: 'No history before scam', w: 0.1 }] },
  { addr: '0x3e7c05ab92d1f84b06', chain: 'Ethereum', risk: 0.87, reason: 'Collection hub', caseRef: 'ANV-2026-0415', factors: [{ plain: '9 victims pay in', w: 0.26 }, { plain: 'Linked to SYN-07', w: 0.2 }, { plain: 'Feeds Northwind deposits', w: 0.1 }] },
]

/** per-exchange ack delay in seconds (simulated) */
export const ACK_DELAY: Record<string, number> = { meridian: 2, kestrel: 1, northwind: 2, arcadia: 4, halcyon: 1, orbita: 5 }

export const WEBHOOKS: { id: string; p50: number; success: number; last: string; fails: number; status: 'healthy' | 'degraded' | 'retrying'; spark: number[] }[] = [
  { id: 'kestrel', p50: 0.9, success: 0.999, last: '2 s ago', fails: 1, status: 'healthy', spark: [0.9, 1.0, 0.8, 0.9, 1.1, 0.9, 0.8, 0.9, 1.0, 0.9] },
  { id: 'halcyon', p50: 1.1, success: 0.998, last: '3 s ago', fails: 2, status: 'healthy', spark: [1.2, 1.1, 1.0, 1.3, 1.1, 1.0, 1.2, 1.1, 1.0, 1.1] },
  { id: 'meridian', p50: 1.4, success: 0.992, last: '3 s ago', fails: 4, status: 'healthy', spark: [1.6, 1.4, 1.5, 1.3, 1.7, 1.4, 1.3, 1.5, 1.4, 1.4] },
  { id: 'northwind', p50: 1.7, success: 0.994, last: '5 s ago', fails: 3, status: 'healthy', spark: [1.5, 1.8, 1.7, 1.6, 1.9, 1.7, 1.8, 1.6, 1.7, 1.7] },
  { id: 'arcadia', p50: 3.8, success: 0.961, last: '41 s ago', fails: 14, status: 'degraded', spark: [2.4, 2.9, 3.1, 3.6, 3.2, 4.1, 3.7, 4.4, 3.9, 3.8] },
  { id: 'orbita', p50: 6.2, success: 0.884, last: '4 min ago', fails: 41, status: 'retrying', spark: [3.8, 4.6, 5.1, 4.9, 6.3, 5.8, 7.1, 6.4, 6.9, 6.2] },
]

/** deterministic risk-score distribution for wallets ANVESHAK scored today */
function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}
const rnd = lcg(42)
export const SCORED_TODAY: number[] = Array.from({ length: 260 }, () => {
  const u = rnd()
  return Math.round((0.5 + 0.5 * Math.pow(u, 1.7)) * 1000) / 1000
})
const rnd2 = lcg(7)
export const PREDICTED_TODAY: number[] = Array.from({ length: 48 }, () => Math.round((0.5 + 0.48 * Math.pow(rnd2(), 1.2)) * 1000) / 1000)
export const SANCTIONS_TODAY = 3

export const SANCTION_MATCH_ADDR = '0x7a3fd21c9b4e8a5f2071'
