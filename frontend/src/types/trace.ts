import type { AccentColour } from '../utils/constants'
import type { Case, CampaignSummary, RiskBand } from './case'

/**
 * One address a trace passed through — field names mirror `DEMO.routeA.trail[]` /
 * `DEMO.routeB.trail[]` exactly. `flag` carries the free-text badges from the source data
 * (`"SUSPECT"`, `"SWEPT"`, `"HUB · 38 victims"`, `"EXCHANGE"`, `"BRIDGE IN"`, `"BRIDGE OUT"`)
 * — typed as `string | null` rather than a closed union because the hub flag interpolates
 * a victim count from `DEMO.campaign.cases`.
 */
export interface Hop {
  n: number
  addr: string
  role: string
  amt: number
  at: string
  flag: string | null
  /** Only present on hops the source data annotates with a sweep delay (e.g. `gapSec:42`). */
  gapSec?: number
  /** Only present on Route B hops, which cross from TRON to Ethereum. */
  chain?: string
}

/**
 * One of the two paths the money took — mirrors `DEMO.routeA` / `DEMO.routeB`. Route A uses
 * `chain` (single chain throughout); Route B uses `chainFrom`/`chainTo` (crosses a bridge) —
 * both optional here so one interface covers both source shapes.
 */
export interface Route {
  label: string
  chain?: string
  chainFrom?: string
  chainTo?: string
  accent: AccentColour
  valueINR: number
  valueCrypto: number
  durationMin: number
  hops: number
  trail: Hop[]
}

/** Result of a completed trace — the two routes discovered. */
export interface TraceResult {
  routeA: Route
  routeB: Route
}

/** One piece of supporting evidence for the exchange attribution — mirrors `DEMO.exchange.evidence[]`. */
export interface EvidenceItem {
  label: string
  conf: number
}

/** The cash-out exchange — mirrors `DEMO.exchange`. */
export interface Exchange {
  name: string
  monogram: string
  depositAddr: string
  jurisdiction: string
  fiuRegistered: boolean
  indianUsers: string
  evidence: EvidenceItem[]
}

/** One contributing factor to the risk score — mirrors `DEMO.risk.factors[]`. */
export interface RiskFactor {
  plain: string
  tech: string
  w: number
}

/** The computed risk score — mirrors `DEMO.risk`. */
export interface RiskScore {
  score: number
  band: RiskBand
  factors: RiskFactor[]
}

/** Node kinds used to style the fund-flow graph (Evidence screen, tab 1). */
export type GraphNodeKind = 'victim' | 'scammer' | 'wallet' | 'bridge' | 'hub' | 'exchange'

/** One node of the Cytoscape fund-flow graph, built from case/routeA/routeB/exchange. */
export interface GraphNode {
  id: string
  label: string
  /** Plain-English sub-label rendered under the technical label. */
  sublabel: string
  kind: GraphNodeKind
  accent: AccentColour
  addr?: string
  amt?: number
  at?: string
}

/** One edge of the Cytoscape fund-flow graph. */
export interface GraphEdge {
  id: string
  source: string
  target: string
  amt: number
  /** True for edges on the criminal path (dash-offset animation loops on these). */
  criminal: boolean
}

/** Full graph payload for the Evidence screen's fund-flow tab. */
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Compiled investigation report — everything the Evidence screen's report tab renders. */
export interface ReportData {
  generatedAt: string
  case: Case
  routeA: Route
  routeB: Route
  exchange: Exchange
  risk: RiskScore
  campaign: CampaignSummary
  /** SHA-256 hex digest of the evidence set (or a static placeholder if `crypto.subtle` is unavailable). */
  integrityHash: string
}

/** The three lawful-action documents on the Evidence screen's third tab. */
export type NoticeType = 'exchange-request' | 'bnss-notice' | 'fiu-report'

/** Result of sending/generating one of the lawful-action documents. */
export interface NoticeResult {
  type: NoticeType
  sent: true
  sentAt: string
}
