import type { AccentColour } from '../utils/constants'

/** Confidence/severity band for a risk score — mirrors `DEMO.risk.band` and `recentCases[].risk`. */
export type RiskBand = 'HIGH' | 'MEDIUM' | 'LOW'

/** Status pill values used on the dashboard's recent-cases table. */
export type CaseStatus = 'New' | 'Traced' | 'Notice sent' | 'Closed'

/**
 * A small, honest signal for whether a case's stolen funds are still recoverable right now —
 * mirrors `backend/app/api/v1/cases.py`'s `RecoverabilityState` exactly (see that module's
 * `_compute_recoverability` docstring for what each value means and how it's detected):
 * - `at_rest` — the trace stopped at a wallet with no further outgoing activity.
 * - `at_exchange` — same, but that wallet is one our label table identifies as an exchange.
 * - `moving` — the money is still actively hopping, or we only stopped following it
 *   artificially (hop cap) — no confirmed resting point yet.
 * - `unknown` — the trail went cold or unreliable (read failure, mixer, unconfirmed bridge
 *   crossing) — we honestly cannot tell whether this money is still recoverable.
 */
export type RecoverabilityState = 'at_rest' | 'at_exchange' | 'moving' | 'unknown'

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

/** One row of the dashboard's recent-cases table — mirrors `DEMO.dashboard.recentCases[]`.
 *
 * `recoverabilityState`/`recoverabilityDeadlineMinutes` are additive (optional) so this type's
 * pre-existing consumers (e.g. Dashboard.tsx's recent-cases mini-table, and `mock.ts`'s
 * `DEMO.dashboard.recentCases` literal) keep working unchanged — only the Cases screen
 * (`api.listCases()`) is guaranteed to populate them, from the real backend's
 * `GET /api/v1/cases` in live mode or `mock.ts`'s own `listCases()` in mock mode. */
export interface RecentCase {
  id: string
  who: string
  amt: number
  chain: string
  status: CaseStatus
  risk: RiskBand | null
  /** Omitted (not just `undefined`-valued) where a source honestly doesn't compute it. */
  recoverabilityState?: RecoverabilityState
  /** `null` means "state is known but no fixed deadline applies" (e.g. `moving`/`unknown`);
   * omitted entirely means the source didn't compute a recoverability signal at all. */
  recoverabilityDeadlineMinutes?: number | null
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
