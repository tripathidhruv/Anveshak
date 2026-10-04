import type { Tone } from '@/components/kit'
import { CASES, ROUTE_A } from '@/data/demo'

/* All banks, desks, VPAs, account numbers and people below are fictional. */

export const HUB = ROUTE_A.trail.find((h) => h.flag === 'HUB')!.addr // TNh8yW5vC2mQ7fL4xK9pR

export const FIAT_STATS = {
  tracedINR: 3860000,
  muleAccounts: 14,
  ordersMatched: 23,
  ordersTotal: 26,
  medianGapSec: 160,
  sharedCases: 9,
}

/* ───────────── Flow graph ───────────── */
export type FiatNodeInfo = {
  kind: string
  tech: string
  rows: [string, string][]
  note?: string
}

export const FLOW_INFO: Record<string, FiatNodeInfo> = {
  hub: {
    kind: 'Collection wallet',
    tech: 'consolidation hub · 38 victims',
    rows: [
      ['Address', HUB],
      ['USDT sold on P2P', '31,850 USDT'],
      ['Sell orders', '26 in 3 h 12 min'],
      ['Seller handle', 'SaffronTrade_77 (desk alias)'],
    ],
    note: 'The scammer advertises USDT for sale on P2P desks instead of withdrawing to a bank — so the exchange never sends rupees to them directly.',
  },
  o1: {
    kind: 'P2P sell order',
    tech: 'escrow release · Meridian P2P',
    rows: [
      ['Order', 'Meridian P2P #88214'],
      ['Sold', '11,200 USDT @ ₹88.00'],
      ['Buyer pays', '₹9,85,600 by UPI'],
      ['Escrow released', '20:01:03 IST'],
    ],
  },
  o2: {
    kind: 'P2P sell order',
    tech: 'escrow release · Meridian P2P',
    rows: [
      ['Order', 'Meridian P2P #88231'],
      ['Sold', '8,450 USDT @ ₹88.00'],
      ['Buyer pays', '₹7,43,600 by IMPS'],
      ['Escrow released', '20:09:20 IST'],
    ],
  },
  o3: {
    kind: 'P2P sell order',
    tech: 'escrow release · Arcadia P2P',
    rows: [
      ['Order', 'Arcadia P2P #4417'],
      ['Sold', '6,900 USDT @ ₹88.00'],
      ['Buyer pays', '₹6,07,200 by UPI'],
      ['Escrow released', '20:24:58 IST'],
    ],
  },
  o4: {
    kind: 'P2P sell order',
    tech: 'OTC desk · Orbita',
    rows: [
      ['Order', 'Orbita OTC #2209'],
      ['Sold', '5,300 USDT @ ₹88.00'],
      ['Buyer pays', '₹4,66,400 by UPI'],
      ['Escrow released', '20:35:30 IST'],
    ],
  },
  p1: {
    kind: 'Rupee payment',
    tech: 'UPI credit · VPA masked',
    rows: [
      ['Paid to VPA', 'ra****@okv'],
      ['Amount', '₹9,85,600'],
      ['UTR', '4021••••8812'],
      ['Narration', '"P2P 88214"'],
    ],
  },
  p2: {
    kind: 'Rupee payment',
    tech: 'IMPS credit',
    rows: [
      ['Paid to', 'A/c XXXX0937'],
      ['Amount', '₹7,43,600'],
      ['UTR', '4021••••9047'],
      ['Narration', '"payment"'],
    ],
  },
  p3: {
    kind: 'Rupee payment',
    tech: 'UPI credit · VPA masked',
    rows: [
      ['Paid to VPA', 'sm****@knk'],
      ['Amount', '₹6,07,200'],
      ['UTR', '4021••••1130'],
      ['Narration', '"order 4417"'],
    ],
  },
  p4: {
    kind: 'Rupee payment',
    tech: 'UPI credit · VPA masked',
    rows: [
      ['Paid to VPA', 'an****@nrm'],
      ['Amount', '₹4,66,390 (₹10 fee)'],
      ['UTR', '4021••••2268'],
      ['Narration', '"USDT"'],
    ],
  },
  m1: {
    kind: 'Mule bank account',
    tech: 'shared across 6 cases',
    rows: [
      ['Bank', 'Sahyadri Co-operative Bank'],
      ['Account', 'XXXX4821 · savings'],
      ['Holder', 'R. K***** (KYC via bank)'],
      ['Opened', '19 Jul 2026'],
      ['Credits in 30 days', '₹14.6 L from 11 payers'],
    ],
    note: 'Freshly opened, receives large one-off credits from strangers, empties within hours — a classic mule pattern.',
  },
  m2: {
    kind: 'Mule bank account',
    tech: 'shared across 4 cases',
    rows: [
      ['Bank', 'Vindhya Bank'],
      ['Account', 'XXXX0937 · current'],
      ['Holder', 'S. Traders (proprietor)'],
      ['Opened', '02 Aug 2026'],
      ['Credits in 30 days', '₹9.1 L from 7 payers'],
    ],
  },
  m3: {
    kind: 'Mule bank account',
    tech: 'shared across 5 cases',
    rows: [
      ['Bank', 'Konark Small Finance Bank'],
      ['Account', 'XXXX5562 · savings'],
      ['Holder', 'M. D*** (KYC via bank)'],
      ['Opened', '27 Jul 2026'],
      ['Credits in 30 days', '₹10.4 L from 9 payers'],
    ],
  },
  m4: {
    kind: 'Mule bank account',
    tech: 'first seen in this case',
    rows: [
      ['Bank', 'Narmada Gramin Bank'],
      ['Account', 'XXXX7714 · savings'],
      ['Holder', 'P. Y**** (KYC via bank)'],
      ['Opened', '29 Aug 2026'],
      ['Credits in 30 days', '₹4.7 L from 2 payers'],
    ],
  },
  c1: {
    kind: 'Cash-out point',
    tech: 'ATM withdrawals · from bank statement',
    rows: [
      ['Where', 'ATM, Deoghar district'],
      ['Withdrawn', '₹8.2 L in 41 withdrawals'],
      ['Window', '02 Sep 21:10 → 03 Sep 02:40'],
      ['Cards used', '3 debit cards'],
    ],
    note: 'Location comes from the ATM ID on the statement. CCTV can be requested from the bank for these timestamps.',
  },
  c2: {
    kind: 'Cash-out point',
    tech: 'ATM withdrawals · from bank statement',
    rows: [
      ['Where', 'ATM, Alwar district'],
      ['Withdrawn', '₹5.9 L in 30 withdrawals'],
      ['Window', '02 Sep 22:05 → 03 Sep 01:15'],
      ['Cards used', '2 debit cards'],
    ],
  },
  c3: {
    kind: 'Onward transfer',
    tech: 'NEFT to second-layer accounts',
    rows: [
      ['To', '3 accounts, 2 banks'],
      ['Moved', '₹6.1 L'],
      ['Status', 'Statements requested'],
    ],
    note: 'Not yet traced — needs the next bank statements.',
  },
}

/* ───────────── Match engine ───────────── */
export type MatchRow = {
  id: string
  desk: string
  order: string
  usdt: number
  orderINR: number
  orderAt: string // HH:MM:SS
  releaseAt: string
  channel: 'UPI' | 'IMPS'
  bank: string | null
  acct: string | null
  vpa: string | null
  creditINR: number | null
  creditAt: string | null
  reuseCases: number
  utr: string | null
  narration: string | null
}

export const MATCHES: MatchRow[] = [
  { id: 'r1', desk: 'Meridian P2P', order: '#88214', usdt: 11200, orderINR: 985600, orderAt: '19:58:12', releaseAt: '20:01:03', channel: 'UPI', bank: 'Sahyadri Co-operative Bank', acct: 'XXXX4821', vpa: 'ra****@okv', creditINR: 985600, creditAt: '20:00:47', reuseCases: 6, utr: '4021••••8812', narration: 'P2P 88214' },
  { id: 'r2', desk: 'Meridian P2P', order: '#88231', usdt: 8450, orderINR: 743600, orderAt: '20:06:40', releaseAt: '20:09:20', channel: 'IMPS', bank: 'Vindhya Bank', acct: 'XXXX0937', vpa: null, creditINR: 743600, creditAt: '20:08:58', reuseCases: 4, utr: '4021••••9047', narration: 'payment' },
  { id: 'r3', desk: 'Arcadia P2P', order: '#4417', usdt: 6900, orderINR: 607200, orderAt: '20:21:05', releaseAt: '20:24:58', channel: 'UPI', bank: 'Konark Small Finance Bank', acct: 'XXXX5562', vpa: 'sm****@knk', creditINR: 607200, creditAt: '20:24:31', reuseCases: 5, utr: '4021••••1130', narration: 'order 4417' },
  { id: 'r4', desk: 'Orbita OTC', order: '#2209', usdt: 5300, orderINR: 466400, orderAt: '20:33:50', releaseAt: '20:35:30', channel: 'UPI', bank: 'Narmada Gramin Bank', acct: 'XXXX7714', vpa: 'an****@nrm', creditINR: 466390, creditAt: '20:35:02', reuseCases: 0, utr: '4021••••2268', narration: 'USDT' },
  { id: 'r5', desk: 'Meridian P2P', order: '#88247', usdt: 3300, orderINR: 290400, orderAt: '20:41:18', releaseAt: '20:44:22', channel: 'UPI', bank: 'Sahyadri Co-operative Bank', acct: 'XXXX4821', vpa: 'ra****@okv', creditINR: 290400, creditAt: '20:43:59', reuseCases: 6, utr: '4021••••3391', narration: 'P2P 88247' },
  { id: 'r6', desk: 'Meridian P2P', order: '#88252', usdt: 2000, orderINR: 176000, orderAt: '20:52:44', releaseAt: '20:55:31', channel: 'IMPS', bank: 'Vindhya Bank', acct: 'XXXX3306', vpa: null, creditINR: 176000, creditAt: '20:55:10', reuseCases: 0, utr: '4021••••4472', narration: 'goods' },
  { id: 'r7', desk: 'Arcadia P2P', order: '#4431', usdt: 4000, orderINR: 352000, orderAt: '21:04:09', releaseAt: '21:06:12', channel: 'UPI', bank: 'Konark Small Finance Bank', acct: 'XXXX5562', vpa: 'sm****@knk', creditINR: 352000, creditAt: '21:06:01', reuseCases: 5, utr: '4021••••5518', narration: 'order 4431' },
  { id: 'r8', desk: 'Meridian P2P', order: '#88260', usdt: 2400, orderINR: 211200, orderAt: '21:18:30', releaseAt: '21:22:40', channel: 'UPI', bank: 'Sahyadri Co-operative Bank', acct: 'XXXX9152', vpa: 'kt****@shy', creditINR: 211150, creditAt: '21:22:05', reuseCases: 0, utr: '4021••••6604', narration: 'rent' },
  { id: 'r9', desk: 'Orbita OTC', order: '#2216', usdt: 1600, orderINR: 140800, orderAt: '21:30:02', releaseAt: '21:33:47', channel: 'UPI', bank: null, acct: null, vpa: 'vj****@vnd', creditINR: null, creditAt: null, reuseCases: 0, utr: null, narration: null },
]

export const secOf = (t: string) => {
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

export const MATCH_WEIGHTS = { amount: 0.45, time: 0.35, reuse: 0.2 }

export function scoreMatch(r: MatchRow) {
  if (r.creditINR === null || r.creditAt === null) {
    return { amount: 0, time: 0, reuse: 0, total: 0, dAmt: null as number | null, dSec: null as number | null }
  }
  const dAmt = r.creditINR - r.orderINR
  const dSec = secOf(r.creditAt) - secOf(r.orderAt)
  const amount = dAmt === 0 ? 1 : Math.max(0, 1 - Math.abs(dAmt) / 100)
  const time = dSec <= 180 ? 1 : Math.max(0, 1 - (dSec - 180) / 720)
  const reuse = r.reuseCases > 0 ? 1 : 0
  const total = MATCH_WEIGHTS.amount * amount + MATCH_WEIGHTS.time * time + MATCH_WEIGHTS.reuse * reuse
  return { amount, time, reuse, total, dAmt, dSec }
}

export function verdict(total: number, hasCredit: boolean): { label: string; tone: Tone } {
  if (!hasCredit) return { label: 'Awaiting statement', tone: 'neutral' }
  if (total >= 0.7) return { label: 'Matched', tone: 'moss' }
  if (total >= 0.5) return { label: 'Needs review', tone: 'gold' }
  return { label: 'No match', tone: 'neutral' }
}

/* ───────────── Mule network (cases × accounts) ───────────── */
export const MULE_ACCOUNTS = [
  { acct: '4821', bank: 'Sahyadri' },
  { acct: '5562', bank: 'Konark' },
  { acct: '0937', bank: 'Vindhya' },
  { acct: '7714', bank: 'Narmada' },
  { acct: '3306', bank: 'Vindhya' },
  { acct: '9152', bank: 'Sahyadri' },
  { acct: '2045', bank: 'Konark' },
  { acct: '6618', bank: 'Narmada' },
  { acct: '1190', bank: 'Sahyadri' },
  { acct: '8873', bank: 'Vindhya' },
  { acct: '4402', bank: 'Konark' },
  { acct: '5129', bank: 'Narmada' },
  { acct: '7350', bank: 'Sahyadri' },
  { acct: '0264', bank: 'Vindhya' },
]

const SYN = CASES.filter((c) => c.syndicate === 'SYN-07').map((c) => c.id)
export const MULE_CASES = [...SYN, 'ANV-2026-0398', 'ANV-2026-0391', 'ANV-2026-0386'].slice(0, 9)

/** value = share of that case's fiat exit that landed in that account (0..1) */
export const MULE_MATRIX: number[][] = [
  [0.9, 0.6, 0.75, 0.45, 0.2, 0.25, 0, 0, 0, 0, 0, 0, 0, 0], // 0417 (this case)
  [0.7, 0.4, 0.5, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0],
  [0.55, 0, 0.35, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0],
  [0.6, 0.5, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0],
  [0, 0.45, 0.4, 0, 0, 0, 0, 0, 0, 0.35, 0, 0, 0, 0],
  [0.5, 0, 0, 0, 0, 0, 0.25, 0, 0, 0, 0.4, 0, 0, 0],
  [0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0],
  [0, 0.35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.45, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.6],
]

export const SHARED_TOP = MULE_ACCOUNTS.map((a, c) => ({
  ...a,
  cases: MULE_MATRIX.filter((row) => row[c] > 0).length,
  inr: Math.round(MULE_MATRIX.reduce((s, row) => s + row[c], 0) * 248000),
}))
  .filter((a) => a.cases >= 4)
  .sort((a, b) => b.cases - a.cases)
