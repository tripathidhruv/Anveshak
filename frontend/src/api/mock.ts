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
// Type-only imports of the real endpoints' response shapes -- these three functions
// (getSimilarOperators/getSanctionsMatches/getAuditLog+verifyAuditChain) are standalone
// `httpApi.ts` exports, not part of `KaizenApi`, so their mock counterparts below are also
// standalone exports rather than additions to `mockApi`. No runtime dependency on httpApi.ts
// is introduced -- `import type` is erased at build time.
import type { AuditLogEntryOut, AuditVerifyOut, SanctionsMatchOut, SimilarOperatorsOut } from './httpApi'
import type { DepositIndexEntryOut } from './httpApi'
// Campaign-list/-detail real shapes (Campaigns.tsx / Campaign.tsx) -- mirrored here rather than
// re-declared, so this mock never silently drifts from what `httpApi.ts`'s real
// `getCampaignsList`/`getCampaignDetail` actually return. Type-only import; does not touch
// `httpApi.ts`'s runtime code.
import type { CampaignDetailOut, CampaignOut } from './httpApi'
import type { EvidencePackOut, EvidenceVerifyOut } from './httpApi'

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
    // Mirrors what the real backend's compute_innocence() (app/detectors/innocence.py) would
    // actually find for this exact demo scenario -- a wallet with no activity before the
    // incident has exactly one factor fire (no_pre_incident_history, against innocence), so the
    // real formula (score = 0.1 when no *supporting* factor exists) lands here too. This was
    // previously missing entirely (mock mode never populated `innocence` on any route), so
    // ExchangeAttribution's innocence section silently rendered nothing in the default demo mode.
    innocence: {
      innocenceScore: 0.1,
      factors: [
        {
          check: 'no_pre_incident_history',
          description:
            "We found no activity for this wallet from before the date of the incident. That fits a wallet that was set up just for this scam.",
          supportsInnocence: false,
          weight: 0.2,
        },
      ],
    },
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
    // Backfills the same real bridge-link data the graph/hop UI (FundFlowGraph/NodeDrawer,
    // commit 2d2cf91) expects to pair with the BRIDGE IN/BRIDGE OUT hops above -- was previously
    // missing entirely in mock mode, so clicking the bridge node showed no confidence/disclaimer.
    bridgeLinks: [
      {
        sideATxHash: 'a1b2c3d4e5f60000000000000000000000000000000000000000000000ab',
        sideAChain: 'TRON',
        sideBTxHash: '0xa1b2c3d4e5f60000000000000000000000000000000000000000000000cd',
        sideBChain: 'Ethereum',
        confidence: 0.82,
        disclaimer:
          "This is a suggested cross-chain link based on timing and amount correlation, not proof of a bridge transaction -- a bridge does not publish a 1:1 deposit-to-withdrawal mapping, so an officer must independently verify this connection before acting on it.",
      },
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

/** Deterministic (no `Date.now()`/`Math.random()`) synthetic manifest for the evidence pack --
 * same shape/spirit as `httpApi.ts`'s real `EvidencePackOut.manifestEntries` (per that file's own
 * doc comment: source, wallet address, chain, fetched-at, free-form otherwise), built from the
 * rest of `DEMO` so it's recognisably the same case rather than unrelated filler. Kept
 * deterministic on purpose -- `getEvidencePack`'s hash and `verifyEvidencePack`'s recomputed hash
 * must actually match for a believable "valid" demo result, which a timestamped/random manifest
 * would break. */
function buildMockManifestEntries(): Record<string, unknown>[] {
  return [
    {
      source: 'chain-rpc:suspect-wallet',
      walletAddress: DEMO.case.suspectWallet,
      chain: DEMO.case.chain,
      rawResponseHash: 'a11ce0000000000000000000000000000000000000000000000000000000f1',
      fetchedAt: '2026-09-04T11:06:00.000Z',
    },
    {
      source: 'chain-rpc:exchange-deposit',
      walletAddress: DEMO.exchange.depositAddr,
      chain: DEMO.case.chain,
      rawResponseHash: 'b0b0000000000000000000000000000000000000000000000000000000ba5',
      fetchedAt: '2026-09-04T20:14:27.000Z',
    },
    {
      source: 'bridge-link:route-b',
      walletAddress: DEMO.routeB.trail[2].addr,
      chain: DEMO.routeB.trail[2].chain ?? DEMO.case.chain,
      rawResponseHash: 'c0ffee00000000000000000000000000000000000000000000000000000ff',
      fetchedAt: '2026-09-04T19:58:41.000Z',
    },
  ]
}

/** Mock counterpart to `httpApi.ts`'s real `getRiskScore` -- this call isn't part of `KaizenApi`
 * (no mock/real switch in `api/index.ts` covers it), so `RiskScore.tsx` picks between this and
 * the real `httpApi.ts` function directly on `VITE_USE_MOCK`, same pattern as `getEvidencePack`
 * below. Reuses `DEMO.risk`'s existing plain-English factor narrative, rescaled onto the real
 * backend's 0-100 point scale (this file's old pre-real-backend shape used 0-1). */
export async function getRiskScore(caseId: string): Promise<import('./httpApi').RiskScoreOut> {
  await delay(400)
  const ruleScore = Math.round(DEMO.risk.score * 78 * 100) / 100
  const mlScore = Math.round(DEMO.risk.score * 100 * 100) / 100
  const combinedScore = Math.round(((ruleScore + mlScore) / 2) * 100) / 100
  const breakdown: Record<string, number> = {}
  const shapBreakdown: Record<string, number> = {}
  for (const factor of DEMO.risk.factors) {
    breakdown[factor.tech] = Math.round(factor.w * 78 * 100) / 100
    shapBreakdown[factor.tech] = Math.round(factor.w * 100) / 100
  }
  return {
    caseId,
    walletAddress: DEMO.case.suspectWallet,
    chain: DEMO.case.chain,
    ruleBasedScore: {
      score: ruleScore,
      breakdown,
      reasoning: DEMO.risk.factors.map((f) => f.plain).join('; '),
    },
    dataQualitySufficientForMl: true,
    dataQualityReasons: [],
    mlScore: { score: mlScore, shapBreakdown },
    combinedScore,
    syntheticDataDisclosure:
      'This machine-learning score was produced by a model trained on synthetic demo data, not real fraud cases -- treat it as illustrative, not a certified risk assessment.',
  }
}

/** Mock counterpart to `httpApi.ts`'s real `getEvidencePack` -- these two calls aren't part of
 * `KaizenApi` (no mock/real switch in `api/index.ts` covers them, same as `getRiskScore`/
 * `getCampaignsList`/etc.), so `Evidence.tsx` picks between this pair and the real `httpApi.ts`
 * pair directly on `VITE_USE_MOCK`, the same one-env-var-switch spirit as `index.ts`'s own
 * `USE_MOCK`, just resolved locally since these calls sit outside the `KaizenApi` surface. */
export async function getEvidencePack(caseId: string): Promise<EvidencePackOut> {
  await delay(500)
  const manifestEntries = buildMockManifestEntries()
  const packHash = await sha256Hex(JSON.stringify({ caseId, manifestEntries }))
  return {
    caseId,
    packHash,
    manifestEntries,
    createdAt: new Date().toISOString(),
  }
}

/** Mock counterpart to `httpApi.ts`'s real `verifyEvidencePack`. The real endpoint re-fetches
 * every source live and recomputes the hash; the mock instead recomputes over the same
 * deterministic manifest `getEvidencePack` above used, which always matches -- there is no live
 * chain to actually re-fetch in mock mode, and a demo should show the success path by default.
 *
 * The real endpoint's `valid` collapses two very different failure modes into one boolean
 * (`packHashMatches` false = actual tampering, vs. `packHashMatches` true but
 * `sourcesReproduced < sourcesChecked` = a live re-fetch just didn't reproduce, e.g. chain data
 * legitimately moved on -- see `Evidence.tsx`'s verify-result badges). Both are otherwise
 * unreachable in mock mode since there's no live chain here to actually fail against, so an
 * optional `?verifyScenario=` query param (read directly off the URL rather than threaded through
 * this function's signature, to avoid touching the one real/mock switch in `Evidence.tsx`) lets
 * either be exercised visually: `tampered` for a real hash mismatch, `partial` for a
 * hash-still-matches-but-not-fully-reproduced result. Anything else (the default, and the normal
 * demo path) returns the fully-reproduced success case. */
export async function verifyEvidencePack(caseId: string): Promise<EvidenceVerifyOut> {
  await delay(700)
  const manifestEntries = buildMockManifestEntries()
  const scenario = new URLSearchParams(window.location.search).get('verifyScenario')

  if (scenario === 'tampered') {
    return {
      caseId,
      valid: false,
      packHashMatches: false,
      sourcesChecked: manifestEntries.length,
      sourcesReproduced: manifestEntries.length,
      dataUnavailable: false,
      details: manifestEntries.map((entry) => ({ ...entry, reproduced: true })),
    }
  }

  if (scenario === 'partial') {
    const sourcesReproduced = Math.max(0, manifestEntries.length - 1)
    return {
      caseId,
      valid: false,
      packHashMatches: true,
      sourcesChecked: manifestEntries.length,
      sourcesReproduced,
      dataUnavailable: false,
      details: manifestEntries.map((entry, i) => ({ ...entry, reproduced: i < sourcesReproduced })),
    }
  }

  return {
    caseId,
    valid: true,
    packHashMatches: true,
    sourcesChecked: manifestEntries.length,
    sourcesReproduced: manifestEntries.length,
    dataUnavailable: false,
    details: manifestEntries.map((entry) => ({ ...entry, reproduced: true })),
  }
}

/** Synthetic multi-campaign dataset for `getCampaignsList`/`getCampaignDetail` below -- mirrors
 * the real backend's `CampaignOut`/`CampaignDetailOut` shape field-for-field (see `httpApi.ts`),
 * kept separate from `DEMO.campaign` (the older single-campaign `CampaignSummary` shape still
 * consumed by `Dashboard.tsx`/`CaseClosed.tsx`/`Exchanges.tsx`/`LawfulActionTab.tsx` via
 * `api.getCampaign()` -- out of scope here, left untouched). The first entry restates
 * `DEMO.campaign`'s own numbers (38 victims, ₹4.7 Cr, hub `TNh8yW5vC2mQ7fL4xK9pR`) so the two
 * don't visibly disagree in mock mode; `caseIds`/`statesTouched` are synthetic filler in the same
 * `KZN-2026-####` / Indian-state style as the rest of `DEMO` (CLAUDE.md rule 1: synthetic only).
 * A second, smaller campaign is included so the list page has more than one row to render. */
const DEMO_CAMPAIGNS: CampaignDetailOut[] = [
  {
    id: 'CAMP-2026-01',
    hubAddress: DEMO.campaign.sharedWallet,
    chain: 'TRON',
    caseIds: Array.from({ length: DEMO.campaign.cases }, (_, i) => `KZN-2026-${String(417 - i).padStart(4, '0')}`),
    totalAmountINR: DEMO.campaign.totalINR,
    statesTouched: [
      'Rajasthan', 'Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'West Bengal',
      'Gujarat', 'Uttar Pradesh', 'Telangana', 'Kerala', 'Punjab',
    ],
  },
  {
    id: 'CAMP-2026-02',
    hubAddress: '0x9e4b8f07a2c6d13e5b4a1',
    chain: 'Ethereum',
    caseIds: ['KZN-2026-0512', 'KZN-2026-0509', 'KZN-2026-0503', 'KZN-2026-0498', 'KZN-2026-0491', 'KZN-2026-0487'],
    totalAmountINR: 3850000,
    statesTouched: ['Maharashtra', 'Karnataka', 'Delhi'],
  },
]

/** `GET /api/v1/campaigns` mock. Real list items never carry `statesTouched` (only the detail
 * endpoint does -- see `CampaignOut` vs `CampaignDetailOut` in `httpApi.ts`), so this strips it
 * rather than leaking the detail-only field into the list shape. */
export async function getCampaignsList(): Promise<CampaignOut[]> {
  await delay(300)
  return DEMO_CAMPAIGNS.map((c) => ({
    id: c.id,
    hubAddress: c.hubAddress,
    chain: c.chain,
    caseIds: [...c.caseIds],
    totalAmountINR: c.totalAmountINR,
  }))
}

/** `GET /api/v1/campaigns/{id}` mock. Throws on an unknown id, mirroring the real endpoint's 404
 * (`ApiError`) rather than silently falling back to the first campaign. Matches on `hubAddress`
 * too, not just `id` -- `Dashboard.tsx`/`CaseClosed.tsx` (out of this task's file scope) still
 * navigate to `/campaign/:id` via the older `api.getCampaign()`/`CampaignSummary.sharedWallet`
 * path and pass the shared wallet address as the route param, not a `CAMP-2026-##` id; accepting
 * either keeps that existing mock-mode navigation working unchanged alongside the new
 * `Campaigns.tsx` list, which links here with the real `CampaignOut.id`. */
export async function getCampaignDetail(campaignId: string): Promise<CampaignDetailOut> {
  await delay(300)
  const found = DEMO_CAMPAIGNS.find((c) => c.id === campaignId || c.hubAddress === campaignId)
  if (!found) throw new Error(`No campaign found with id "${campaignId}"`)
  return { ...found, caseIds: [...found.caseIds], statesTouched: [...found.statesTouched] }
}

/** Plain-English disclaimer shown alongside every operator-fingerprint result -- mirrors
 * `backend/app/api/v1/operator_fingerprint.py`'s `SIMILARITY_DISCLAIMER` in spirit (this mock
 * has no access to that Python string, so it's restated here rather than imported). Kept as one
 * named constant so `OperatorFingerprint.tsx` renders identical wording in mock and real mode. */
const SIMILARITY_DISCLAIMER =
  'Unsupervised cosine-similarity clustering over behavioural features (sweep timing, hop count, consolidation pattern) — not a labelled match confirmed by a human, and not proof that the same person or group is behind both cases.'

/** `GET /api/v1/cases/{id}/similar-operators` mock. Only the one real DEMO case has any
 * clustered siblings -- any other case id gets the same honest empty result the real endpoint
 * would return for a case with no fingerprint yet, rather than fabricating matches for it. */
export async function getSimilarOperators(caseId: string): Promise<SimilarOperatorsOut> {
  await delay(500)
  if (caseId !== DEMO.case.id) {
    return { caseId, results: [], disclaimer: SIMILARITY_DISCLAIMER }
  }
  return {
    caseId,
    results: [
      {
        caseId: 'KZN-2026-0402',
        similarityScore: 0.91,
        featureBreakdown: { sweepLatencySec: 38, hopCount: 5, consolidationHub: true, valuePreservedPct: 99.4 },
      },
      {
        caseId: 'KZN-2026-0388',
        similarityScore: 0.77,
        featureBreakdown: { sweepLatencySec: 51, hopCount: 4, consolidationHub: true, valuePreservedPct: 98.1 },
      },
      {
        caseId: 'KZN-2026-0371',
        similarityScore: 0.62,
        featureBreakdown: { sweepLatencySec: 65, hopCount: 6, consolidationHub: false, valuePreservedPct: 94.7 },
      },
    ],
    disclaimer: SIMILARITY_DISCLAIMER,
  }
}

/** `GET /api/v1/sanctions/matches/{case_id}` mock. The DEMO suspect wallet is not a real
 * sanctioned address (CLAUDE.md rule 1 — no real wallet address ever goes in this repo); this
 * synthetic hit exists purely so `SanctionsScreening.tsx`'s high-visibility match treatment has
 * something to render in mock mode. Any other case id gets the honest empty "no matches" result. */
export async function getSanctionsMatches(caseId: string): Promise<SanctionsMatchOut[]> {
  await delay(500)
  if (caseId !== DEMO.case.id) return []
  return [
    {
      walletAddress: DEMO.case.suspectWallet,
      chain: DEMO.case.chain,
      listSource: 'OFAC SDN (demo seed list)',
      matchedAt: '2026-09-04T11:07:00.000Z',
      listVersion: 'DEMO-2026-09',
    },
  ]
}

/** One event in the synthetic audit trail `buildMockAuditLog` below chains together. Deliberately
 * generic actor names ("officer:demo") rather than a specific invented person, on top of the
 * fictional-data floor CLAUDE.md rule 1 already sets. */
interface MockAuditEvent {
  actor: string
  action: string
  objectType: string
  objectId: string
}

const MOCK_AUDIT_EVENTS: MockAuditEvent[] = [
  { actor: 'officer:demo', action: 'case.created', objectType: 'case', objectId: DEMO.case.id },
  { actor: 'system', action: 'trace.completed', objectType: 'trace', objectId: DEMO.case.id },
  { actor: 'system', action: 'risk.scored', objectType: 'risk_score', objectId: DEMO.case.id },
  { actor: 'officer:demo', action: 'evidence_pack.generated', objectType: 'evidence_pack', objectId: DEMO.case.id },
  { actor: 'officer:demo', action: 'legal_notice.drafted', objectType: 'legal_notice', objectId: `${DEMO.case.id}-N1` },
  { actor: 'officer:demo', action: 'legal_notice.sent', objectType: 'legal_notice', objectId: `${DEMO.case.id}-N1` },
]

let cachedAuditLog: AuditLogEntryOut[] | null = null

/** Builds a genuinely hash-chained mock audit trail — each entry's hash folds in the previous
 * entry's hash (same idea as the real `app/audit/chain.py`), computed once with the existing
 * `sha256Hex` helper and cached so `getAuditLog`/`verifyAuditChain` see the same chain across
 * calls instead of a fresh one each time (`verifyAuditChain` re-derives every hash from scratch
 * below, so a real corruption would still be caught — this isn't a hard-coded `valid: true`). */
async function buildMockAuditLog(): Promise<AuditLogEntryOut[]> {
  if (cachedAuditLog) return cachedAuditLog
  const entries: AuditLogEntryOut[] = []
  let prevHash = '0'.repeat(64)
  const baseTime = new Date('2026-09-04T11:05:00.000Z').getTime()
  for (let i = 0; i < MOCK_AUDIT_EVENTS.length; i++) {
    const event = MOCK_AUDIT_EVENTS[i]
    const createdAt = new Date(baseTime + i * 45 * 60 * 1000).toISOString()
    const hash = await sha256Hex(`${prevHash}|${event.actor}|${event.action}|${event.objectType}|${event.objectId}|${createdAt}`)
    entries.push({ ...event, hash, createdAt })
    prevHash = hash
  }
  cachedAuditLog = entries
  return entries
}

/** `GET /api/v1/audit` mock — system-wide, not case-scoped (matches the real endpoint's own
 * signature exactly), oldest first. */
export async function getAuditLog(): Promise<AuditLogEntryOut[]> {
  await delay(400)
  return buildMockAuditLog()
}

/** `GET /api/v1/audit/verify` mock — walks the same chain `buildMockAuditLog` built and
 * re-derives each hash rather than always returning `valid: true` unconditionally. */
export async function verifyAuditChain(): Promise<AuditVerifyOut> {
  await delay(400)
  const entries = await buildMockAuditLog()
  let prevHash = '0'.repeat(64)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const expected = await sha256Hex(
      `${prevHash}|${entry.actor}|${entry.action}|${entry.objectType}|${entry.objectId}|${entry.createdAt}`,
    )
    if (expected !== entry.hash) {
      return { valid: false, brokenAtEntryId: i + 1, checkedEntries: i + 1 }
    }
    prevHash = entry.hash
  }
  return { valid: true, brokenAtEntryId: null, checkedEntries: entries.length }
}

/** `GET /api/v1/deposit-index/{chain}/{address}` mock. The one seeded hit reuses `DEMO`'s own
 * consolidation-hub -> exchange-deposit pair (`DEMO.routeA.trail`'s hop 5 -> hop 6): in the real
 * pipeline this is exactly the kind of (depositor, vetted hot wallet) relationship
 * `scripts/build_deposit_index.py` would have backward-crawled and stored, so looking it up
 * here tells the same DEMO story the rest of this file already does, just from a different
 * angle (a direct reverse lookup instead of a live trace). Any other (chain, address) gets the
 * honest empty result the real endpoint would give for an address it has never indexed.
 * Chain-appropriate case handling mirrors the real `lookup_indexed_deposit`'s own docstring
 * (ethereum lowercase, everything else -- TRON included -- case-sensitive exact). */
const DEMO_DEPOSIT_INDEX_ENTRIES: DepositIndexEntryOut[] = [
  {
    address: 'TNh8yW5vC2mQ7fL4xK9pR',
    chain: 'tron',
    hotWalletAddress: DEMO.exchange.depositAddr,
    entityName: DEMO.exchange.name,
    indexedAt: '2026-09-20T06:30:00.000Z',
  },
]

export async function getDepositIndexMatches(chain: string, address: string): Promise<DepositIndexEntryOut[]> {
  await delay(500)
  const normalize = (c: string, a: string) => (c === 'ethereum' ? a.toLowerCase() : a)
  const queryAddress = normalize(chain, address)
  return DEMO_DEPOSIT_INDEX_ENTRIES.filter(
    (entry) => entry.chain === chain && normalize(entry.chain, entry.address) === queryAddress,
  )
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
