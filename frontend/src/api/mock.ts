import type {
  Case,
  CaseInput,
  CampaignSummary,
  DashboardData,
  Exchange,
  GraphData,
  GraphNode,
  KaizenApi,
  NoticeResult,
  NoticeType,
  RecentCase,
  ReportData,
  RiskScore,
  Route,
  TraceResult,
} from '../types'

/** Resolves after `ms` milliseconds — every mock endpoint uses this to simulate network/processing latency. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The full demo dataset, ported verbatim (every address, amount, timestamp, name) from the
 * `DEMO` object in `docs/plans/prototype-plan.md` (Task 1's fenced ```js DEMO = {...}``` block),
 * reshaped only in *structure* (split across typed sub-objects) — no value was changed,
 * invented, or paraphrased. See `.superpowers/sdd/task-3-report.md` for the field-by-field
 * cross-check.
 */
const DEMO = {
  case: {
    id: 'KZN-2026-0417',
    ncrp: '31402260041789',
    complainant: 'Rekha Sharma',
    location: 'Jaipur, Rajasthan',
    phone: '+91 98XXX XXX41',
    incidentAt: '02 Sep 2026, 19:42 IST',
    reportedAt: '04 Sep 2026, 11:05 IST',
    fraudType: 'Task-based job scam (Telegram)',
    amountINR: 1240000,
    amountCrypto: 14850,
    asset: 'USDT (TRC-20)',
    chain: 'TRON',
    suspectWallet: 'TXk9mR4pQ2vL8nW3sD6fH',
  } satisfies Case,

  routeA: {
    label: 'Same blockchain',
    chain: 'TRON',
    accent: 'teal',
    valueINR: 1090000,
    valueCrypto: 13050,
    durationMin: 32,
    hops: 5,
    trail: [
      { n: 1, addr: 'TVc2hL8sN4dR7gY1mX5wQ', role: "Victim's wallet", amt: 14850, at: '19:42:04', flag: null },
      { n: 2, addr: 'TXk9mR4pQ2vL8nW3sD6fH', role: "Scammer's wallet", amt: 14850, at: '19:42:11', flag: 'SUSPECT' },
      { n: 3, addr: 'TQm7bK3xF9jH2nL6pV4sD', role: 'Wallet 2', amt: 14835, at: '19:42:53', flag: 'SWEPT', gapSec: 42 },
      { n: 4, addr: 'TPd4wS8cM1kR5tY9nB3gH', role: 'Wallet 3', amt: 14820, at: '19:43:38', flag: 'SWEPT', gapSec: 45 },
      { n: 5, addr: 'TNh8yW5vC2mQ7fL4xK9pR', role: 'Collection wallet', amt: 412900, at: '19:51:02', flag: 'HUB · 38 victims' },
      { n: 6, addr: 'TBx1eM9nT7hG3sV5cW2kL', role: 'Exchange deposit', amt: 412900, at: '20:14:27', flag: 'EXCHANGE' },
    ],
  } satisfies Route,

  routeB: {
    label: 'Through a bridge',
    chainFrom: 'TRON',
    chainTo: 'Ethereum',
    accent: 'violet',
    valueINR: 150000,
    valueCrypto: 1800,
    durationMin: 49,
    hops: 6,
    trail: [
      { n: 1, addr: 'TXk9mR4pQ2vL8nW3sD6fH', role: "Scammer's wallet", amt: 1800, at: '19:42:11', chain: 'TRON', flag: 'SUSPECT' },
      { n: 2, addr: 'TQm7bK3xF9jH2nL6pV4sD', role: 'Wallet 2', amt: 1795, at: '19:44:20', chain: 'TRON', flag: 'SWEPT', gapSec: 129 },
      { n: 3, addr: 'TKb5nP6rJ8dF2mX7qL4wC', role: 'Bridge contract', amt: 1795, at: '19:58:41', chain: 'TRON', flag: 'BRIDGE IN' },
      { n: 4, addr: '0x7a3fd21c9b4e8a5f2071', role: 'Emerges here', amt: 1782, at: '20:03:19', chain: 'Ethereum', flag: 'BRIDGE OUT' },
      { n: 5, addr: '0x9e4b8f07a2c6d13e5b', role: 'Wallet 4', amt: 1776, at: '20:09:55', chain: 'Ethereum', flag: 'SWEPT', gapSec: 396 },
      { n: 6, addr: '0x2c8da154fe37b09c42', role: 'Exchange deposit', amt: 1776, at: '20:31:08', chain: 'Ethereum', flag: 'EXCHANGE' },
    ],
  } satisfies Route,

  exchange: {
    name: 'Meridian Digital Exchange',
    monogram: 'MD',
    depositAddr: 'TBx1eM9nT7hG3sV5cW2kL',
    jurisdiction: 'Seychelles',
    fiuRegistered: false,
    indianUsers: '~2.1 lakh',
    evidence: [
      { label: 'Address appears in 340 deposit-like transactions', conf: 0.94 },
      { label: 'Matches known exchange wallet pattern', conf: 0.89 },
      { label: 'Public blockchain-explorer tag', conf: 0.81 },
      { label: 'Consolidation behaviour typical of hot wallets', conf: 0.77 },
    ],
  } satisfies Exchange,

  risk: {
    score: 0.87,
    band: 'HIGH',
    factors: [
      { plain: 'Money moved out in 42 seconds', tech: 'sweep latency', w: 0.31 },
      { plain: "38 victims' money in one wallet", tech: 'consolidation hub', w: 0.24 },
      { plain: '99.9% of the amount kept', tech: 'value preservation', w: 0.15 },
      { plain: 'Exchange not registered in India', tech: 'VASP compliance', w: 0.12 },
      { plain: 'No money ever came back', tech: 'no counter-flow', w: 0.05 },
    ],
  } satisfies RiskScore,

  campaign: {
    cases: 38,
    totalINR: 47000000,
    states: 11,
    sharedWallet: 'TNh8yW5vC2mQ7fL4xK9pR',
  } satisfies CampaignSummary,

  dashboard: {
    kpis: [
      { label: 'Active cases', value: '147', delta: '+12 this week', dir: 'up' },
      { label: 'Traced to an exchange', value: '112', delta: '76% success rate', dir: 'up' },
      { label: 'Value traced', value: '₹18.4 Cr', delta: '+₹3.1 Cr this quarter', dir: 'up' },
      { label: 'Median trace time', value: '41 s', delta: 'was 4-6 weeks', dir: 'down' },
    ],
    // `recoverabilityState`/`recoverabilityDeadlineMinutes` below are additive placeholder
    // demo values (same synthetic-data status as the rest of DEMO — see CLAUDE.md rule 1),
    // added only so the Cases screen's recoverability sort/badges have something varied to
    // render in mock mode. They mirror the real backend's small honest enum
    // (`backend/app/api/v1/cases.py`'s `RecoverabilityState`) in shape only, not in how they
    // were computed -- a live trace never actually ran for this demo data.
    recentCases: [
      { id: 'KZN-2026-0417', who: 'Rekha Sharma', amt: 1240000, chain: 'TRON', status: 'New', risk: null, recoverabilityState: 'moving', recoverabilityDeadlineMinutes: null },
      { id: 'KZN-2026-0416', who: 'Arun Menon', amt: 860000, chain: 'TRON', status: 'Traced', risk: 'HIGH', recoverabilityState: 'at_rest', recoverabilityDeadlineMinutes: 45 },
      { id: 'KZN-2026-0415', who: 'Fatima Qureshi', amt: 2150000, chain: 'Ethereum', status: 'Traced', risk: 'HIGH', recoverabilityState: 'at_exchange', recoverabilityDeadlineMinutes: 180 },
      { id: 'KZN-2026-0414', who: 'S. Balaji', amt: 430000, chain: 'Bitcoin', status: 'Notice sent', risk: 'MEDIUM', recoverabilityState: 'at_exchange', recoverabilityDeadlineMinutes: 600 },
      { id: 'KZN-2026-0413', who: 'Priya Nair', amt: 1780000, chain: 'TRON', status: 'Closed', risk: 'HIGH', recoverabilityState: 'unknown', recoverabilityDeadlineMinutes: null },
    ],
  } satisfies DashboardData,
}

/** Builds the fund-flow graph (Evidence screen, tab 1) from the rest of DEMO — not a separate DEMO field in the source doc. */
function buildGraph(): GraphData {
  const victim = DEMO.routeA.trail[0]
  const scammer = DEMO.routeA.trail[1]
  const bridge = DEMO.routeB.trail[2]
  const hub = DEMO.routeA.trail[4]

  const nodes: GraphNode[] = [
    { id: 'victim', label: "Victim's wallet", sublabel: 'Where the money started', kind: 'victim', accent: 'sky', addr: victim.addr, amt: victim.amt, at: victim.at },
    { id: 'scammer', label: "Scammer's wallet", sublabel: 'First stop after the transfer', kind: 'scammer', accent: 'vermillion', addr: scammer.addr, amt: scammer.amt, at: scammer.at },
    ...DEMO.routeA.trail.slice(2, 4).map((hop) => ({
      id: `a-${hop.n}`,
      label: hop.role,
      sublabel: 'Money passed through here',
      kind: 'wallet' as const,
      accent: 'teal' as const,
      addr: hop.addr,
      amt: hop.amt,
      at: hop.at,
    })),
    {
      id: 'b-2',
      label: DEMO.routeB.trail[1].role,
      sublabel: 'Money passed through here',
      kind: 'wallet',
      accent: 'teal',
      addr: DEMO.routeB.trail[1].addr,
      amt: DEMO.routeB.trail[1].amt,
      at: DEMO.routeB.trail[1].at,
    },
    // Verified 2026-09-26 (SDD Task 4): this is the frontend-visible shape that exercises the
    // backend's real cross-chain bridge-hop linking feature — node kind 'bridge' renders as a
    // violet diamond in FundFlowGraph (shape-diamond + --node-accent: var(--color-violet)),
    // matches GraphLegend's "Bridge (cross-chain)" entry, and graphLayout's computeRoutePaths
    // correctly flags any path through it as crossesBridge (Route B). Confirmed by running the
    // mock-mode demo case (KZN-2026-0417) end to end in a browser: the bridge node renders,
    // clicking it opens the node-detail panel with the label "Bridge contract" (matching the
    // backend's new role string from Task 3), and "Show Route A" / "Show Route B" correctly
    // dim/highlight the two paths. No rendering bug found — no other code change was needed.
    { id: 'bridge', label: 'Bridge contract', sublabel: 'Currency exchange between blockchains', kind: 'bridge', accent: 'violet', addr: bridge.addr, amt: bridge.amt, at: bridge.at },
    ...DEMO.routeB.trail.slice(3, 5).map((hop) => ({
      id: `b-${hop.n}`,
      label: hop.role,
      sublabel: 'Money passed through here',
      kind: 'wallet' as const,
      accent: 'teal' as const,
      addr: hop.addr,
      amt: hop.amt,
      at: hop.at,
    })),
    {
      id: 'hub',
      label: 'Collection wallet',
      sublabel: `Collection wallet · ${DEMO.campaign.cases} victims`,
      kind: 'hub',
      accent: 'vermillion',
      addr: hub.addr,
      amt: hub.amt,
      at: hub.at,
    },
    {
      id: 'exchange',
      label: DEMO.exchange.name,
      sublabel: 'Where the money can be recovered',
      kind: 'exchange',
      accent: 'gold',
      addr: DEMO.exchange.depositAddr,
    },
  ]

  const edges: GraphData['edges'] = [
    { id: 'e-victim-scammer', source: 'victim', target: 'scammer', amt: DEMO.routeA.trail[1].amt, criminal: true },
    { id: 'e-scammer-a3', source: 'scammer', target: 'a-3', amt: DEMO.routeA.trail[2].amt, criminal: true },
    { id: 'e-a3-a4', source: 'a-3', target: 'a-4', amt: DEMO.routeA.trail[3].amt, criminal: true },
    { id: 'e-a4-hub', source: 'a-4', target: 'hub', amt: hub.amt, criminal: true },
    { id: 'e-hub-exchange', source: 'hub', target: 'exchange', amt: hub.amt, criminal: true },
    { id: 'e-scammer-b2', source: 'scammer', target: 'b-2', amt: DEMO.routeB.trail[1].amt, criminal: true },
    { id: 'e-b2-bridge', source: 'b-2', target: 'bridge', amt: bridge.amt, criminal: true },
    { id: 'e-bridge-b4', source: 'bridge', target: 'b-4', amt: DEMO.routeB.trail[3].amt, criminal: true },
    { id: 'e-b4-b5', source: 'b-4', target: 'b-5', amt: DEMO.routeB.trail[4].amt, criminal: true },
    { id: 'e-b5-exchange', source: 'b-5', target: 'exchange', amt: DEMO.routeB.trail[5].amt, criminal: true },
  ]

  return { nodes, edges }
}

async function sha256Hex(input: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(input)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // Non-secure context (e.g. plain http:// during the demo) — crypto.subtle is unavailable there.
    return '0'.repeat(64)
  }
}

/**
 * Mock implementation of `KaizenApi`, backed entirely by `DEMO`. Every case-scoped method
 * ignores the `caseId`/`campaignId` argument's actual value and returns the single demo case —
 * there is only one case in the source dataset, which is the point of a hackathon demo.
 */
export const mockApi: KaizenApi = {
  async createCase(input: CaseInput): Promise<Case> {
    await delay(400)
    return { ...DEMO.case, ...input }
  },

  async getCase(_id: string): Promise<Case> {
    await delay(300)
    return { ...DEMO.case }
  },

  async listCases(): Promise<RecentCase[]> {
    await delay(300)
    return DEMO.dashboard.recentCases.map((c) => ({ ...c }))
  },

  async startTrace(_caseId: string): Promise<TraceResult> {
    // 1800ms matches the old Trace screen's ring-fill + status-line animation timing.
    await delay(1800)
    return { routeA: DEMO.routeA, routeB: DEMO.routeB }
  },

  async getRoutes(_caseId: string): Promise<TraceResult> {
    await delay(300)
    return { routeA: DEMO.routeA, routeB: DEMO.routeB }
  },

  async getExchange(_caseId: string): Promise<Exchange> {
    await delay(300)
    return { ...DEMO.exchange }
  },

  async getRisk(_caseId: string): Promise<RiskScore> {
    await delay(300)
    return { ...DEMO.risk }
  },

  async getGraph(_caseId: string): Promise<GraphData> {
    await delay(400)
    return buildGraph()
  },

  async generateReport(_caseId: string): Promise<ReportData> {
    await delay(500)
    const generatedAt = new Date().toISOString()
    const evidenceSet = {
      case: DEMO.case,
      routeA: DEMO.routeA,
      routeB: DEMO.routeB,
      exchange: DEMO.exchange,
      risk: DEMO.risk,
    }
    const integrityHash = await sha256Hex(JSON.stringify(evidenceSet))
    return {
      generatedAt,
      case: DEMO.case,
      routeA: DEMO.routeA,
      routeB: DEMO.routeB,
      exchange: DEMO.exchange,
      risk: DEMO.risk,
      campaign: DEMO.campaign,
      integrityHash,
    }
  },

  async sendNotice(_caseId: string, type: NoticeType): Promise<NoticeResult> {
    await delay(700)
    return { type, sent: true, sentAt: new Date().toISOString() }
  },

  async getDashboard(): Promise<DashboardData> {
    await delay(300)
    return { kpis: DEMO.dashboard.kpis.map((k) => ({ ...k })), recentCases: DEMO.dashboard.recentCases.map((c) => ({ ...c })) }
  },

  async getCampaign(_campaignId?: string): Promise<CampaignSummary> {
    await delay(300)
    return { ...DEMO.campaign }
  },
}
