/**
 * ANVESHAK prototype dataset — ALL SYNTHETIC.
 * Every person, wallet, transaction and exchange below is fabricated demo data.
 * Exchange names are fictional; never substitute a real exchange name.
 * Values are shared across screens so the story stays consistent everywhere.
 */
import type { Tone } from '@/components/kit/tone'

export type Chain = 'TRON' | 'Ethereum' | 'Bitcoin'

/* ───────────── Primary case ───────────── */
export const CASE = {
  id: 'ANV-2026-0417',
  ncrp: '31402260041789',
  fir: 'FIR 0312/2026 · Cyber PS Jaipur',
  complainant: 'Rekha Sharma',
  location: 'Jaipur, Rajasthan',
  incidentAt: '02 Sep 2026, 19:42 IST',
  reportedAt: '04 Sep 2026, 11:05 IST',
  fraudType: 'Task-based job scam (Telegram)',
  amountINR: 1240000,
  amountCrypto: 14850,
  asset: 'USDT (TRC-20)',
  chain: 'TRON' as Chain,
  suspectWallet: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm',
  officer: 'SI Kavita Rathore',
  traceSeconds: 41,
}

/* ───────────── Fictional exchanges (VASPs) ───────────── */
export type Exchange = {
  id: string
  name: string
  monogram: string
  jurisdiction: string
  fiuRegistered: boolean
  tone: Tone
  indianUsers: string
  avgResponseHrs: number
  slaHitRate: number
  freezesHonoured: number
  noticesReceived: number
}

export const EXCHANGES: Exchange[] = [
  { id: 'meridian', name: 'Meridian Digital Exchange', monogram: 'MD', jurisdiction: 'Seychelles', fiuRegistered: false, tone: 'gold', indianUsers: '~2.1 lakh', avgResponseHrs: 61, slaHitRate: 0.42, freezesHonoured: 9, noticesReceived: 31 },
  { id: 'kestrel', name: 'Kestrel Exchange', monogram: 'KX', jurisdiction: 'India', fiuRegistered: true, tone: 'moss', indianUsers: '~38 lakh', avgResponseHrs: 9, slaHitRate: 0.94, freezesHonoured: 47, noticesReceived: 52 },
  { id: 'northwind', name: 'Northwind Coin', monogram: 'NW', jurisdiction: 'Singapore', fiuRegistered: true, tone: 'sky', indianUsers: '~6.4 lakh', avgResponseHrs: 22, slaHitRate: 0.78, freezesHonoured: 18, noticesReceived: 26 },
  { id: 'arcadia', name: 'Arcadia Markets', monogram: 'AM', jurisdiction: 'UAE', fiuRegistered: false, tone: 'violet', indianUsers: '~1.2 lakh', avgResponseHrs: 96, slaHitRate: 0.21, freezesHonoured: 2, noticesReceived: 14 },
  { id: 'halcyon', name: 'Halcyon Pay', monogram: 'HP', jurisdiction: 'India', fiuRegistered: true, tone: 'teal', indianUsers: '~11 lakh', avgResponseHrs: 14, slaHitRate: 0.88, freezesHonoured: 23, noticesReceived: 29 },
  { id: 'orbita', name: 'Orbita Exchange', monogram: 'OX', jurisdiction: 'Estonia', fiuRegistered: false, tone: 'crimson', indianUsers: '~0.8 lakh', avgResponseHrs: 120, slaHitRate: 0.12, freezesHonoured: 1, noticesReceived: 9 },
]
export const EXCHANGE = EXCHANGES[0]

/* ───────────── Trace trails ───────────── */
export type Hop = {
  n: number
  addr: string
  role: string
  amt: number
  at: string
  chain: Chain
  flag: 'VICTIM' | 'SUSPECT' | 'SWEPT' | 'HUB' | 'EXCHANGE' | 'BRIDGE IN' | 'BRIDGE OUT' | 'MIXER'
  gapSec?: number
}

export const ROUTE_A = {
  label: 'Same blockchain',
  chain: 'TRON' as Chain,
  valueINR: 1090000,
  valueCrypto: 13050,
  durationMin: 32,
  trail: [
    { n: 1, addr: 'TVc2hL8sN4dR7gY1mX5wQ', role: "Victim's wallet", amt: 14850, at: '19:42:04', chain: 'TRON', flag: 'VICTIM' },
    { n: 2, addr: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', role: "Scammer's wallet", amt: 14850, at: '19:42:11', chain: 'TRON', flag: 'SUSPECT' },
    { n: 3, addr: 'TQm7bK3xF9jH2nL6pV4sD', role: 'Pass-through wallet 2', amt: 14835, at: '19:42:53', chain: 'TRON', flag: 'SWEPT', gapSec: 42 },
    { n: 4, addr: 'TPd4wS8cM1kR5tY9nB3gH', role: 'Pass-through wallet 3', amt: 14820, at: '19:43:38', chain: 'TRON', flag: 'SWEPT', gapSec: 45 },
    { n: 5, addr: 'TNh8yW5vC2mQ7fL4xK9pR', role: 'Collection wallet', amt: 412900, at: '19:51:02', chain: 'TRON', flag: 'HUB' },
    { n: 6, addr: 'TBx1eM9nT7hG3sV5cW2kL', role: 'Exchange deposit', amt: 412900, at: '20:14:27', chain: 'TRON', flag: 'EXCHANGE' },
  ] as Hop[],
}

export const ROUTE_B = {
  label: 'Through a bridge',
  valueINR: 150000,
  valueCrypto: 1800,
  durationMin: 49,
  trail: [
    { n: 1, addr: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', role: "Scammer's wallet", amt: 1800, at: '19:42:11', chain: 'TRON', flag: 'SUSPECT' },
    { n: 2, addr: 'TQm7bK3xF9jH2nL6pV4sD', role: 'Pass-through wallet 2', amt: 1795, at: '19:44:20', chain: 'TRON', flag: 'SWEPT', gapSec: 129 },
    { n: 3, addr: 'TKb5nP6rJ8dF2mX7qL4wC', role: 'Bridge contract', amt: 1795, at: '19:58:41', chain: 'TRON', flag: 'BRIDGE IN' },
    { n: 4, addr: '0x7a3fd21c9b4e8a5f2071', role: 'Emerges on Ethereum', amt: 1782, at: '20:03:19', chain: 'Ethereum', flag: 'BRIDGE OUT' },
    { n: 5, addr: '0x9e4b8f07a2c6d13e5b', role: 'Pass-through wallet 4', amt: 1776, at: '20:09:55', chain: 'Ethereum', flag: 'SWEPT', gapSec: 396 },
    { n: 6, addr: '0x2c8da154fe37b09c42', role: 'Exchange deposit', amt: 1776, at: '20:31:08', chain: 'Ethereum', flag: 'EXCHANGE' },
  ] as Hop[],
  bridgeConfidence: 0.82,
}

/* ───────────── Explainable risk ───────────── */
export const RISK = {
  score: 0.87,
  band: 'HIGH' as const,
  mlScore: 0.83,
  factors: [
    { plain: 'Money moved out in 42 seconds', tech: 'sweep latency · p99 human = 14 min', w: 0.31, tone: 'crimson' as Tone },
    { plain: "38 victims' money in one wallet", tech: 'consolidation hub · in-degree 38', w: 0.24, tone: 'crimson' as Tone },
    { plain: '99.9% of the amount kept at each hop', tech: 'value preservation ratio 0.999', w: 0.15, tone: 'ember' as Tone },
    { plain: 'Exchange not registered in India', tech: 'VASP compliance · FIU-IND', w: 0.12, tone: 'gold' as Tone },
    { plain: 'Wallet created 3 hours before the scam', tech: 'no pre-incident history', w: 0.08, tone: 'ember' as Tone },
    { plain: 'No money ever came back', tech: 'zero counter-flow', w: 0.05, tone: 'neutral' as Tone },
  ],
}

export const ATTRIBUTION_EVIDENCE = [
  { label: 'Address appears in 340 deposit-like transactions', tech: 'deposit-address heuristic', conf: 0.94 },
  { label: 'Matches known exchange hot-wallet sweep pattern', tech: 'hot-wallet consolidation', conf: 0.89 },
  { label: 'Inverted deposit index hit — same sweep target as 112 other deposits', tech: 'inverted index', conf: 0.86 },
  { label: 'Public blockchain-explorer tag', tech: 'third-party label', conf: 0.81 },
]

/* ───────────── Cases ───────────── */
export type CaseStatus = 'Intake' | 'Tracing' | 'Traced' | 'Notice sent' | 'Frozen' | 'Closed'
export type Recoverability = 'moving' | 'at_rest' | 'at_exchange' | 'frozen' | 'lost'

export const CASES: {
  id: string
  who: string
  city: string
  state: string
  amt: number
  chain: Chain
  status: CaseStatus
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | null
  recover: Recoverability
  goldenMin: number | null
  syndicate?: string
  exchange?: string
  type: string
  filed: string
}[] = [
  { id: 'ANV-2026-0417', who: 'Rekha Sharma', city: 'Jaipur', state: 'RJ', amt: 1240000, chain: 'TRON', status: 'Tracing', risk: 'HIGH', recover: 'moving', goldenMin: 38, syndicate: 'SYN-07', exchange: 'meridian', type: 'Task-based job scam', filed: '04 Sep' },
  { id: 'ANV-2026-0416', who: 'Arun Menon', city: 'Kochi', state: 'KL', amt: 860000, chain: 'TRON', status: 'Traced', risk: 'HIGH', recover: 'at_rest', goldenMin: 45, syndicate: 'SYN-07', exchange: 'meridian', type: 'Investment app scam', filed: '04 Sep' },
  { id: 'ANV-2026-0415', who: 'Fatima Qureshi', city: 'Lucknow', state: 'UP', amt: 2150000, chain: 'Ethereum', status: 'Notice sent', risk: 'HIGH', recover: 'at_exchange', goldenMin: 180, syndicate: 'SYN-07', exchange: 'northwind', type: 'Pig-butchering (romance)', filed: '03 Sep' },
  { id: 'ANV-2026-0414', who: 'S. Balaji', city: 'Chennai', state: 'TN', amt: 430000, chain: 'Bitcoin', status: 'Frozen', risk: 'MEDIUM', recover: 'frozen', goldenMin: null, exchange: 'kestrel', type: 'Fake customs parcel', filed: '03 Sep' },
  { id: 'ANV-2026-0413', who: 'Priya Nair', city: 'Bengaluru', state: 'KA', amt: 1780000, chain: 'TRON', status: 'Closed', risk: 'HIGH', recover: 'frozen', goldenMin: null, syndicate: 'SYN-03', exchange: 'halcyon', type: 'Task-based job scam', filed: '02 Sep' },
  { id: 'ANV-2026-0412', who: 'Harpreet Gill', city: 'Ludhiana', state: 'PB', amt: 655000, chain: 'TRON', status: 'Traced', risk: 'HIGH', recover: 'at_exchange', goldenMin: 92, syndicate: 'SYN-07', exchange: 'meridian', type: 'Investment app scam', filed: '02 Sep' },
  { id: 'ANV-2026-0411', who: 'Ankit Verma', city: 'Indore', state: 'MP', amt: 312000, chain: 'Ethereum', status: 'Tracing', risk: 'MEDIUM', recover: 'moving', goldenMin: 21, exchange: 'arcadia', type: 'Digital arrest', filed: '02 Sep' },
  { id: 'ANV-2026-0410', who: 'Meera Joshi', city: 'Pune', state: 'MH', amt: 2890000, chain: 'TRON', status: 'Notice sent', risk: 'HIGH', recover: 'at_exchange', goldenMin: 240, syndicate: 'SYN-03', exchange: 'orbita', type: 'Pig-butchering (romance)', filed: '01 Sep' },
  { id: 'ANV-2026-0409', who: 'Imran Shaikh', city: 'Ahmedabad', state: 'GJ', amt: 198000, chain: 'Bitcoin', status: 'Intake', risk: null, recover: 'moving', goldenMin: 12, type: 'Sextortion', filed: '01 Sep' },
  { id: 'ANV-2026-0408', who: 'Deepa Rao', city: 'Hyderabad', state: 'TG', amt: 1120000, chain: 'TRON', status: 'Frozen', risk: 'HIGH', recover: 'frozen', goldenMin: null, syndicate: 'SYN-07', exchange: 'kestrel', type: 'Task-based job scam', filed: '31 Aug' },
  { id: 'ANV-2026-0407', who: 'Rohit Das', city: 'Kolkata', state: 'WB', amt: 540000, chain: 'TRON', status: 'Traced', risk: 'MEDIUM', recover: 'lost', goldenMin: null, exchange: 'orbita', type: 'Loan app extortion', filed: '31 Aug' },
  { id: 'ANV-2026-0406', who: 'Sunita Yadav', city: 'Patna', state: 'BR', amt: 760000, chain: 'TRON', status: 'Traced', risk: 'HIGH', recover: 'at_exchange', goldenMin: 130, syndicate: 'SYN-07', exchange: 'meridian', type: 'Task-based job scam', filed: '30 Aug' },
]

/* ───────────── Dashboard series ───────────── */
export const KPIS = {
  valueTracedINR: 184200000,
  valueTracedDelta: 24,
  frozenINR: 61800000,
  atRiskINR: 23700000,
  activeCases: 147,
  tracedToExchange: 112,
  medianTraceSec: 41,
  syndicatesOpen: 9,
}

/** 21-day trace activity: value traced (₹ lakh) vs value frozen (₹ lakh) */
export const DAYS21 = Array.from({ length: 21 }, (_, i) => String(i + 1))
export const TRACED_SERIES = [38, 42, 35, 47, 61, 58, 66, 59, 72, 69, 84, 78, 90, 86, 97, 92, 104, 99, 112, 118, 124]
export const FROZEN_SERIES = [12, 14, 20, 18, 25, 31, 27, 36, 33, 41, 38, 47, 52, 49, 58, 63, 60, 71, 69, 78, 83]

export const WEEKDAY_SWEEPS = [
  { label: 'Sun', value: 38 },
  { label: 'Mon', value: 22 },
  { label: 'Tue', value: 51 },
  { label: 'Wed', value: 74, highlight: true },
  { label: 'Thu', value: 26 },
  { label: 'Fri', value: 44 },
  { label: 'Sat', value: 58 },
]

/* ───────────── Syndicates (cross-case clusters) ───────────── */
export const SYNDICATES = [
  { id: 'SYN-07', name: 'Telegram task-scam ring "Saffron Desk"', cases: 38, states: 11, valueINR: 47000000, hub: 'TNh8yW5vC2mQ7fL4xK9pR', exchanges: ['meridian', 'kestrel', 'northwind'], firstSeen: '11 Aug 2026', confidence: 0.93, tone: 'crimson' as Tone, active: true },
  { id: 'SYN-03', name: 'Romance / pig-butchering cell "Lotus"', cases: 17, states: 6, valueINR: 31200000, hub: 'TRw2pD9kH5sM3nV8cF1qL', exchanges: ['orbita', 'halcyon'], firstSeen: '02 Jul 2026', confidence: 0.88, tone: 'violet' as Tone, active: true },
  { id: 'SYN-11', name: 'Loan-app extortion network', cases: 9, states: 4, valueINR: 6400000, hub: '0x4f1c92ad07be33e5a8', exchanges: ['arcadia'], firstSeen: '21 Aug 2026', confidence: 0.74, tone: 'gold' as Tone, active: true },
  { id: 'SYN-02', name: 'Digital-arrest impersonation group', cases: 6, states: 3, valueINR: 9800000, hub: 'TGm6vB2nQ8xK4hR7pL3wD', exchanges: ['northwind'], firstSeen: '14 Jun 2026', confidence: 0.69, tone: 'sky' as Tone, active: false },
]

/* ───────────── Live activity feed ───────────── */
export const ACTIVITY = [
  { icon: 'snow', title: 'Freeze confirmed · Kestrel Exchange', sub: 'ANV-2026-0408 · 2 min ago', value: '+₹11.2 L', tone: 'moss' as Tone },
  { icon: 'route', title: 'Trace completed in 41 s', sub: 'ANV-2026-0417 · 6 min ago', value: '6 hops', tone: 'teal' as Tone },
  { icon: 'link', title: 'Case linked to syndicate SYN-07', sub: 'ANV-2026-0412 · 14 min ago', value: '38 cases', tone: 'crimson' as Tone },
  { icon: 'alert', title: 'Pre-emptive freeze alert sent', sub: 'Meridian · ETA 06m · 22 min ago', value: '₹4.1 L', tone: 'ember' as Tone },
  { icon: 'clock', title: 'Notice SLA breached — escalated', sub: 'Orbita Exchange · 1 h ago', value: 'FIU-IND', tone: 'gold' as Tone },
]

/* ───────────── Navigation-visible counts ───────────── */
export const COUNTS = { cases: 12, interdiction: 3, compliance: 4, learning: 7 }
