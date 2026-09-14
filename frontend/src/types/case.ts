import type { AccentColour } from '../utils/constants'

/** Confidence/severity band for a risk score — mirrors `DEMO.risk.band` and `recentCases[].risk`. */
export type RiskBand = 'HIGH' | 'MEDIUM' | 'LOW'

/** Status pill values used on the dashboard's recent-cases table. */
export type CaseStatus = 'New' | 'Traced' | 'Notice sent' | 'Closed'

/**
 * A fraud complaint case — field names mirror `DEMO.case` in
 * `docs/plans/prototype-plan.md` (Task 1) exactly.
 */
export interface Case {
  id: string
  ncrp: string
  complainant: string
  location: string
  phone: string
  incidentAt: string
  reportedAt: string
  fraudType: string
  amountINR: number
  amountCrypto: number
  asset: string
  chain: string
  suspectWallet: string
}

/** Editable subset of `Case` collected by the New Case intake form. */
export type CaseInput = Partial<Omit<Case, 'id' | 'reportedAt'>>

/** One KPI tile on the dashboard — mirrors `DEMO.dashboard.kpis[]`. */
export interface DashboardKpi {
  label: string
  value: string
  delta: string
  dir: 'up' | 'down'
}

/** One row of the dashboard's recent-cases table — mirrors `DEMO.dashboard.recentCases[]`. */
export interface RecentCase {
  id: string
  who: string
  amt: number
  chain: string
  status: CaseStatus
  risk: RiskBand | null
}

/** Full dashboard payload — mirrors `DEMO.dashboard`. */
export interface DashboardData {
  kpis: DashboardKpi[]
  recentCases: RecentCase[]
}

/** Cross-case campaign summary — mirrors `DEMO.campaign`. */
export interface CampaignSummary {
  cases: number
  totalINR: number
  states: number
  sharedWallet: string
}

/** Re-exported here so callers building graph nodes don't need a separate import for accent colours. */
export type { AccentColour }
