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
  /** The raw, machine-readable stop-reason code behind `flag`'s plain-English translation
   * (e.g. `"entered_mixer"`, `"hop_cap_reached"`) -- mirrors `backend/app/schemas.py`'s
   * `HopOut.stopReason` exactly (see `backend/app/api/v1/traces.py`'s `_STOP_REASON_PLAIN_ENGLISH`
   * map, which is what produces `flag` from this same code). Optional because `mock.ts`'s
   * synthetic hops have no backing stop-reason code to report -- only a live backend trace
   * populates this. */
  stopReason?: string | null
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
  /** The suspect wallet's innocence assessment -- mirrors `backend/app/schemas.py`'s
   * `InnocenceOut` exactly (`GET /{case_id}/trace`'s `innocence` field, computed by
   * `app/detectors/innocence.py`'s `compute_innocence`). Optional: only a live backend
   * trace (`toRoute()` in `api/httpApi.ts`) populates this -- `mock.ts`'s synthetic routes
   * have no backing innocence computation to report. */
  innocence?: Innocence
  /** Every cross-chain bridge crossing this trace actually confirmed and followed --
   * mirrors `backend/app/schemas.py`'s `BridgeLinkOut` list (`TraceOut.bridgeLinks`)
   * field-for-field, including the disclaimer every entry always carries
   * (`app/bridge/linker.py`'s `BRIDGE_LINK_DISCLAIMER`). Optional for the same
   * live-trace-only reason as `innocence` above. */
  bridgeLinks?: BridgeLink[]
  /** Every hop of this trace that matched the OFAC SDN seed list -- mirrors
   * `backend/app/schemas.py`'s `SanctionsMatchOut` list (`TraceOut.sanctionsMatches`)
   * field-for-field. Optional for the same live-trace-only reason as `innocence` above. */
  sanctionsMatches?: SanctionsMatch[]
}

/** One contributing factor to the suspect wallet's innocence score -- mirrors
 * `backend/app/schemas.py`'s `InnocenceFactorOut` exactly. */
export interface InnocenceFactor {
  check: string
  description: string
  supportsInnocence: boolean
  weight: number
}

/** Mirrors `backend/app/schemas.py`'s `InnocenceOut` exactly. */
export interface Innocence {
  innocenceScore: number
  factors: InnocenceFactor[]
}

/** Mirrors `backend/app/schemas.py`'s `BridgeLinkOut` exactly -- `disclaimer` is mandatory
 * on the wire (every bridge link is a heuristic timing/amount correlation, never proof), not
 * optional here despite the field being new. */
export interface BridgeLink {
  sideATxHash: string
  sideAChain: string
  sideBTxHash: string
  sideBChain: string
  confidence: number
  disclaimer: string
}

/** Mirrors `backend/app/schemas.py`'s `SanctionsMatchOut` exactly. */
export interface SanctionsMatch {
  walletAddress: string
  chain: string
  listSource: string
  matchedAt: string
  listVersion: string
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
