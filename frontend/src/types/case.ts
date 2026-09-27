import type { AccentColour } from '../utils/constants'

/** Confidence/severity band for a risk score — mirrors `DEMO.risk.band` and `recentCases[].risk`. */
export type RiskBand = 'HIGH' | 'MEDIUM' | 'LOW'

/** Status pill values used on the dashboard's recent-cases table. */
export type CaseStatus = 'New' | 'Traced' | 'Notice sent' | 'Closed'

/** The real, persisted case-workflow status (unified role-based portal, Task 3) -- mirrors
 * `backend/app/schemas.py`'s `CaseStatus` / `app.api.v1.cases.VALID_STATUS_TRANSITIONS` keys
 * exactly. Deliberately a separate type from the `CaseStatus` display enum above (which
 * predates real status persistence and still backs the Dashboard mini-table / mock data) --
 * the officer Tickets page (`pages/Cases.tsx`) is the one screen wired to the real, three-value
 * lifecycle, so it gets its own type rather than overloading the older one everywhere else. */
export type TicketStatus = 'new' | 'in_progress' | 'handled'

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
  /** Additive (Task 13, officer Tickets page) -- mirrors `backend/app/schemas.py`'s `CaseOut`,
   * which has carried these since the unified role-based portal's Task 3/5, but no frontend
   * consumer needed them until the citizen "my cases" screens and the officer Tickets page.
   * Optional so `mock.ts`'s literal `Case` objects (which predate these fields) keep
   * type-checking unchanged. */
  status?: TicketStatus
  /** Who filed this case -- 'officer' | 'citizen' | 'guest' (mirrors the backend's plain `str`;
   * kept as `string` here rather than a narrower union since no frontend consumer branches on
   * this beyond a straight display value). */
  filedByRole?: string
  /** Present only for a guest-filed case (`null`/absent for officer/citizen-filed ones). */
  guestTicketToken?: string | null
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
  /** The real, persisted workflow status (Task 13) -- only `httpApi.ts`'s `listCases()`
   * populates this (from the backend's real `status` column); `mock.ts` leaves it `undefined`
   * since the mock dataset has no persisted workflow to report (matches the honest-provenance
   * rule this file's other optional fields already follow). The officer Tickets page treats a
   * missing value as `'new'` for display purposes only -- see `Cases.tsx`. */
  ticketStatus?: TicketStatus
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
