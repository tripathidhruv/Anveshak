/**
 * SAHYOG National Memory page data — ALL SYNTHETIC and ILLUSTRATIVE.
 * Units, wallets, dates and counts are fabricated demo data; platform KPIs are not measured figures.
 */
import type { FlowEdge, FlowNode, Tone } from '@/components/kit'
import { ROUTE_A, ROUTE_B, SYNDICATES } from '@/data/demo'

export const MEMORY = {
  wallets: 241860,
  resolved: 112400,
  units: 612,
  states: 36,
  hitRate: 0.38,
  edges: 1384200,
  monthSubmissions: 10400,
}

export const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
/** thousands of wallets, cumulative */
export const GROWTH_WALLETS = [38, 52, 67, 81, 98, 117, 136, 154, 175, 196, 219, 241.9]
export const GROWTH_RESOLVED = [14, 20, 27, 34, 42, 51, 61, 70, 80, 91, 101, 112.4]
/** % of new submissions that touch a wallet already in memory */
export const HIT_RATE = [9, 12, 15, 17, 20, 23, 26, 28, 31, 33, 36, 38]

/* ───────────── Lookup results ───────────── */
export type ProvEvent = { date: string; unit: string; state: string; what: string; tone: Tone; you?: boolean }

export type Lookup = {
  addr: string
  chip: string
  match: 'direct' | 'connected' | 'unknown'
  headline: string
  knownSince?: string
  firstUnit?: string
  exchange?: string
  syndicate?: string
  related?: number
  states?: number
  lastOutcome?: string
  outcomeTone?: Tone
  hops?: number
  via?: string
  prov: ProvEvent[]
  nodes: FlowNode[]
  edges: FlowEdge[]
}

const HUB = ROUTE_A.trail[4].addr
const SCAM = ROUTE_A.trail[1].addr
const W2 = ROUTE_A.trail[2].addr
const DEP_T = ROUTE_A.trail[5].addr
const DEP_E = ROUTE_B.trail[5].addr
const BRIDGE = ROUTE_B.trail[2].addr
const W4 = ROUTE_B.trail[4].addr
const LOTUS = SYNDICATES[1].hub
export const UNKNOWN = 'TJr3kV8wN1pQ6sM4hX2dZ'

const s = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const SAFFRON_PROV: ProvEvent[] = [
  { date: '14 Mar 2026', unit: 'Cyber PS Kochi', state: 'Kerala', what: `Submitted collection wallet ${s(HUB)} from a single complaint`, tone: 'sky' },
  { date: '16 Mar 2026', unit: 'Cyber PS Kochi', state: 'Kerala', what: 'Resolved to Meridian Digital Exchange (deposit TBx1eM…W2kL)', tone: 'gold' },
  { date: '22 Mar 2026', unit: 'Meridian Digital Exchange', state: 'Seychelles', what: 'Account frozen after notice — operators opened a new deposit account later', tone: 'moss' },
  { date: '09 Jun 2026', unit: 'Cyber Crime PS Lucknow', state: 'Uttar Pradesh', what: `Submitted Ethereum deposit ${s(DEP_E)} — memory linked it via a bridge`, tone: 'violet' },
  { date: '11 Aug 2026', unit: 'KAIZEN entity resolution', state: 'National', what: '9 complaints clustered → syndicate SYN-07 “Saffron Desk”', tone: 'crimson' },
  { date: '31 Aug 2026', unit: 'Cyber PS Hyderabad', state: 'Telangana', what: 'Freeze confirmed at Kestrel Exchange on a linked mule account', tone: 'moss' },
]

const saffronGraph = (start: { id: string; addr: string; label: string }): { nodes: FlowNode[]; edges: FlowEdge[] } => ({
  nodes: [
    { id: start.id, col: 0, y: 0.35, title: start.label, sub: `${s(start.addr)} · just submitted`, tone: 'ember', live: true },
    { id: 'w2', col: 1, y: 0.15, title: 'Pass-through wallet', sub: `${s(W2)} · Jaipur, Sep`, tone: 'teal' },
    { id: 'bridge', col: 1, y: 0.75, title: 'Bridge to Ethereum', sub: `${s(BRIDGE)} · Lucknow, Jun`, tone: 'violet' },
    { id: 'hub', col: 2, y: 0.15, title: 'Collection hub', sub: `${s(HUB)} · Kochi, Mar`, tone: 'crimson' },
    { id: 'w4', col: 2, y: 0.75, title: 'Pass-through · ETH', sub: `${s(W4)} · Lucknow, Jun`, tone: 'teal' },
    { id: 'depT', col: 3, y: 0.15, title: 'Meridian · TRON', sub: `${s(DEP_T)} · resolved Mar`, tone: 'gold' },
    { id: 'depE', col: 3, y: 0.75, title: 'Meridian · ETH', sub: `${s(DEP_E)} · resolved Jun`, tone: 'gold' },
  ],
  edges: [
    { from: start.id, to: 'w2', weight: 0.6, animated: true },
    { from: start.id, to: 'bridge', weight: 0.3, tone: 'violet' },
    { from: 'w2', to: 'hub', weight: 0.6, animated: true },
    { from: 'bridge', to: 'w4', weight: 0.3, tone: 'violet', dashed: true },
    { from: 'hub', to: 'depT', weight: 0.8, tone: 'gold' },
    { from: 'w4', to: 'depE', weight: 0.35, tone: 'gold' },
  ],
})

export const LOOKUPS: Lookup[] = [
  {
    addr: SCAM,
    chip: "Rekha's scammer wallet",
    match: 'connected',
    headline: 'New wallet — but 3 hops from a wallet Kerala resolved in March',
    knownSince: '14 Mar 2026',
    firstUnit: 'Cyber PS Kochi (Kerala)',
    exchange: 'Meridian Digital Exchange',
    syndicate: 'SYN-07 · Saffron Desk',
    related: 37,
    states: 11,
    lastOutcome: 'Account frozen 22 Mar',
    outcomeTone: 'moss',
    hops: 3,
    via: `collection hub ${s(HUB)}`,
    prov: [...SAFFRON_PROV, { date: '04 Sep 2026', unit: 'Cyber PS Jaipur', state: 'Rajasthan', what: `Submitted ${s(SCAM)} — instant hit, no fresh trace needed`, tone: 'ember', you: true }],
    ...saffronGraph({ id: 'sub', addr: SCAM, label: "Scammer's wallet" }),
  },
  {
    addr: HUB,
    chip: 'Collection hub',
    match: 'direct',
    headline: 'Known wallet — already in national memory',
    knownSince: '14 Mar 2026',
    firstUnit: 'Cyber PS Kochi (Kerala)',
    exchange: 'Meridian Digital Exchange',
    syndicate: 'SYN-07 · Saffron Desk',
    related: 37,
    states: 11,
    lastOutcome: 'Account frozen 22 Mar',
    outcomeTone: 'moss',
    prov: [...SAFFRON_PROV, { date: '04 Sep 2026', unit: 'Cyber PS Jaipur', state: 'Rajasthan', what: 'Looked up this wallet', tone: 'ember', you: true }],
    nodes: [
      { id: 'v1', col: 0, y: 0.1, title: 'Kochi complaint', sub: 'Mar 2026 · Kerala', tone: 'sky' },
      { id: 'v2', col: 0, y: 0.5, title: 'Lucknow complaints', sub: 'Jun 2026 · 4 cases', tone: 'sky' },
      { id: 'v3', col: 0, y: 0.9, title: '+32 more victims', sub: '9 other states', tone: 'sky', ghost: true },
      { id: 'hub', col: 1, y: 0.5, title: 'Collection hub', sub: `${s(HUB)} · you`, tone: 'ember', live: true },
      { id: 'depT', col: 2, y: 0.3, title: 'Meridian · TRON', sub: `${s(DEP_T)}`, tone: 'gold' },
      { id: 'kx', col: 2, y: 0.85, title: 'Kestrel mule account', sub: 'frozen 31 Aug', tone: 'moss' },
    ],
    edges: [
      { from: 'v1', to: 'hub', weight: 0.3 },
      { from: 'v2', to: 'hub', weight: 0.45 },
      { from: 'v3', to: 'hub', weight: 0.8, dashed: true },
      { from: 'hub', to: 'depT', weight: 0.85, tone: 'gold', animated: true },
      { from: 'hub', to: 'kx', weight: 0.3, tone: 'moss' },
    ],
  },
  {
    addr: DEP_E,
    chip: 'Meridian ETH deposit',
    match: 'direct',
    headline: 'Known exchange deposit address',
    knownSince: '09 Jun 2026',
    firstUnit: 'Cyber Crime PS Lucknow (Uttar Pradesh)',
    exchange: 'Meridian Digital Exchange',
    syndicate: 'SYN-07 · Saffron Desk',
    related: 12,
    states: 5,
    lastOutcome: 'Notice pending — reply SLA breached',
    outcomeTone: 'gold',
    prov: [
      { date: '09 Jun 2026', unit: 'Cyber Crime PS Lucknow', state: 'Uttar Pradesh', what: `Submitted ${s(DEP_E)} as cash-out point`, tone: 'sky' },
      { date: '10 Jun 2026', unit: 'Cyber Crime PS Lucknow', state: 'Uttar Pradesh', what: 'Resolved to Meridian Digital Exchange (deposit pattern, 340 txs)', tone: 'gold' },
      { date: '12 Jun 2026', unit: 'KAIZEN memory', state: 'National', what: 'Linked to Kerala’s collection hub through a TRON → Ethereum bridge', tone: 'violet' },
      { date: '03 Sep 2026', unit: 'Cyber PS Lucknow', state: 'Uttar Pradesh', what: 'Notice sent to Meridian for KZN-2026-0415', tone: 'gold' },
      { date: '04 Sep 2026', unit: 'Cyber PS Jaipur', state: 'Rajasthan', what: 'Route B of Rekha’s trace ended here — reused Lucknow’s resolution', tone: 'ember', you: true },
    ],
    nodes: [
      { id: 'w4', col: 0, y: 0.25, title: 'Rekha · route B', sub: `${s(W4)} · Jaipur`, tone: 'teal' },
      { id: 'lk', col: 0, y: 0.75, title: 'Lucknow cases', sub: '12 complaints · 5 states', tone: 'sky' },
      { id: 'dep', col: 1, y: 0.5, title: 'Meridian · ETH deposit', sub: `${s(DEP_E)} · you`, tone: 'ember', live: true },
      { id: 'md', col: 2, y: 0.5, title: 'Meridian Digital Exchange', sub: 'resolved 10 Jun · 0.91', tone: 'gold' },
    ],
    edges: [
      { from: 'w4', to: 'dep', weight: 0.35, animated: true },
      { from: 'lk', to: 'dep', weight: 0.6 },
      { from: 'dep', to: 'md', weight: 0.8, tone: 'gold' },
    ],
  },
  {
    addr: LOTUS,
    chip: 'SYN-03 hub (other ring)',
    match: 'direct',
    headline: 'Known wallet — different syndicate',
    knownSince: '02 Jul 2026',
    firstUnit: 'Cyber PS Pune (Maharashtra)',
    exchange: 'Orbita Exchange',
    syndicate: 'SYN-03 · Lotus',
    related: 16,
    states: 6,
    lastOutcome: 'Notice sent 01 Sep — awaiting reply',
    outcomeTone: 'gold',
    prov: [
      { date: '02 Jul 2026', unit: 'Cyber PS Pune', state: 'Maharashtra', what: `Submitted ${s(LOTUS)} (romance scam)`, tone: 'sky' },
      { date: '05 Jul 2026', unit: 'CEN PS Bengaluru', state: 'Karnataka', what: 'Resolved to Orbita Exchange', tone: 'gold' },
      { date: '20 Jul 2026', unit: 'KAIZEN entity resolution', state: 'National', what: '6 complaints clustered → SYN-03 “Lotus”', tone: 'crimson' },
      { date: '01 Sep 2026', unit: 'Cyber PS Pune', state: 'Maharashtra', what: 'Notice sent to Orbita Exchange', tone: 'gold' },
    ],
    nodes: [
      { id: 'pn', col: 0, y: 0.25, title: 'Pune complaint', sub: 'Jul 2026', tone: 'sky' },
      { id: 'bl', col: 0, y: 0.75, title: 'Bengaluru cases', sub: '5 complaints', tone: 'sky' },
      { id: 'hub', col: 1, y: 0.5, title: 'SYN-03 hub', sub: `${s(LOTUS)} · you`, tone: 'ember', live: true },
      { id: 'ox', col: 2, y: 0.5, title: 'Orbita Exchange', sub: 'resolved 05 Jul', tone: 'gold' },
    ],
    edges: [
      { from: 'pn', to: 'hub', weight: 0.35 },
      { from: 'bl', to: 'hub', weight: 0.6 },
      { from: 'hub', to: 'ox', weight: 0.8, tone: 'gold', animated: true },
    ],
  },
  {
    addr: UNKNOWN,
    chip: 'Unseen wallet',
    match: 'unknown',
    headline: 'Not seen before — this submission now seeds the memory',
    prov: [{ date: 'Just now', unit: 'Cyber PS Jaipur', state: 'Rajasthan', what: 'First submission — stored as a new wallet node', tone: 'ember', you: true }],
    nodes: [],
    edges: [],
  },
]

export const LOOKUP_STEPS = ['Checking the address format', 'Searching 2,41,860 known wallets', 'Walking connected wallets (up to 3 hops)', 'Collecting who submitted what, and when']

/* ───────────── Knowledge reused (illustrative) ───────────── */
export const REUSE = {
  directHits: 2180,
  connectedHits: 1772,
  hrsPerTrace: 6.5,
  hrsPerConnected: 2.5,
}

/* ───────────── State contributions (wallets submitted, normalised 0..1) ───────────── */
export const STATE_ROWS = ['Maharashtra', 'Karnataka', 'Telangana', 'Uttar Pradesh', 'Rajasthan', 'Kerala', 'Tamil Nadu', 'Delhi', 'Gujarat', 'West Bengal']
export const STATE_HEAT: number[][] = [
  [0.4, 0.45, 0.5, 0.55, 0.6, 0.62, 0.7, 0.72, 0.8, 0.85, 0.92, 1],
  [0.35, 0.4, 0.42, 0.5, 0.52, 0.58, 0.62, 0.7, 0.72, 0.78, 0.84, 0.9],
  [0.3, 0.32, 0.4, 0.42, 0.48, 0.5, 0.56, 0.6, 0.66, 0.7, 0.76, 0.82],
  [0.15, 0.2, 0.22, 0.3, 0.34, 0.4, 0.45, 0.5, 0.62, 0.66, 0.72, 0.8],
  [0.1, 0.12, 0.16, 0.2, 0.24, 0.28, 0.34, 0.4, 0.46, 0.52, 0.6, 0.7],
  [0.2, 0.22, 0.25, 0.3, 0.32, 0.45, 0.4, 0.44, 0.48, 0.5, 0.55, 0.6],
  [0.18, 0.2, 0.24, 0.26, 0.3, 0.34, 0.36, 0.42, 0.44, 0.5, 0.52, 0.58],
  [0.25, 0.28, 0.3, 0.32, 0.36, 0.38, 0.42, 0.46, 0.5, 0.52, 0.56, 0.6],
  [0.12, 0.14, 0.18, 0.2, 0.22, 0.26, 0.3, 0.32, 0.36, 0.4, 0.44, 0.5],
  [0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.24, 0.28, 0.3, 0.34, 0.38, 0.42],
]

/** whose submissions helped other states most */
export const REUSED_BY: { state: string; wallets: number; reusedBy: number; tone: Tone }[] = [
  { state: 'Maharashtra', wallets: 38400, reusedBy: 29, tone: 'ember' },
  { state: 'Karnataka', wallets: 31200, reusedBy: 26, tone: 'ember' },
  { state: 'Telangana', wallets: 27900, reusedBy: 24, tone: 'ember' },
  { state: 'Kerala', wallets: 14800, reusedBy: 21, tone: 'ember' },
  { state: 'Uttar Pradesh', wallets: 22600, reusedBy: 18, tone: 'ember' },
]

/* ───────────── Governance ───────────── */
export const AUDIT_LINES = [
  { at: '11:06:42', who: 'SI K. R██████', unit: 'Cyber PS Jaipur', what: 'lookup', ref: 'KZN-2026-0417' },
  { at: '10:58:13', who: 'Insp. S. N████', unit: 'Cyber PS Kochi', what: 'lookup', ref: 'KZN-2026-0416' },
  { at: '10:41:55', who: 'SI R. T██████', unit: 'Cyber Crime PS Lucknow', what: 'submit', ref: 'KZN-2026-0415' },
]
