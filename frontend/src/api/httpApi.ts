import { request } from './client'
import { createKeyedPromiseCache } from './traceCache'
import type { Role } from '../store/authStore'
import type { Case, CaseInput, KaizenApi, RecentCase, RecoverabilityState, Route, TraceResult } from '../types'

export interface MeResponse {
  email: string
  role: Role
}

/** `GET /api/v1/me` (Task 2, `backend/app/api/v1/me.py`) -- resolves the verified JWT's email
 * to its KAIZEN role. Called directly from `pages/Login.tsx` right after `verifyOtp` stores
 * the token, and again by `RequireRole` to rehydrate `useAuthStore` after a hard refresh
 * (the zustand store is in-memory only and doesn't survive a reload, unlike the token itself).
 * Not routed through the mock/real `api` switch in `api/index.ts` -- that switch is for the
 * case/trace data layer (`KaizenApi`), which stays mockable independent of identity, and this
 * only exists against the real backend either way (no mock identity concept). Matches the
 * bearer-attachment pattern `VaspReplies.tsx` already established for the one other endpoint
 * that needs `Authorization: Bearer <token>` today. */
export function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/api/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

interface BackendHop {
  n: number
  addr: string
  role: string
  amt: number
  at: string
  flag: string | null
  chain: string
  stopReason: string | null
}

/** Mirrors `backend/app/api/v1/cases.py`'s `CaseListItemOut` (the `CaseOut` fields plus the
 * two recoverability additions) exactly. */
interface BackendCaseListItem {
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
  recoverabilityState: RecoverabilityState
  recoverabilityDeadlineMinutes: number | null
}

function toRecentCase(item: BackendCaseListItem): RecentCase {
  return {
    id: item.id,
    who: item.complainant,
    amt: item.amountINR,
    chain: item.chain,
    // The backend has no persisted case-workflow-status column at all (see CaseListItemOut's
    // own module docstring) -- nothing in this codebase currently transitions a case away from
    // "New" once created, so reporting anything else here would be inventing data this system
    // doesn't actually track yet. Known gap, not an oversight (CLAUDE.md's "Known gaps" rule).
    status: 'New',
    // Real per-case risk scoring is a separate, expensive live trace + ML call
    // (GET /api/v1/risk/{caseId}/score) this list endpoint deliberately does not also run for
    // every case on every request -- `null` here is honest "not computed here", matching the
    // mock data's own `null` for cases that haven't been scored yet.
    risk: null,
    recoverabilityState: item.recoverabilityState,
    recoverabilityDeadlineMinutes: item.recoverabilityDeadlineMinutes,
  }
}

interface BackendTraceOut {
  hops: BackendHop[]
  conservation: { incomingTotal: number; outgoingTotal: number; fees: number; remainder: number; reconciled: boolean }
  attribution: { walletAddress: string; chain: string; gatePassed: boolean; entityName: string; reasoning: string; limitations: string }
  innocence: { innocenceScore: number; factors: { check: string; description: string; supportsInnocence: boolean; weight: number }[] }
  unreportedVictims: { payerAddress: string; chain: string; totalAmount: number; transferCount: number; firstSeenAt: string }[]
  bridgeLinks: { sideATxHash: string; sideAChain: string; sideBTxHash: string; sideBChain: string; confidence: number }[]
}

function toRoute(trace: BackendTraceOut): Route {
  return {
    label: trace.attribution.gatePassed ? trace.attribution.entityName : 'Unresolved',
    chain: trace.hops[0]?.chain,
    accent: trace.attribution.gatePassed ? 'moss' : 'gold',
    valueINR: 0, // provenance: live trace doesn't compute INR conversion yet — known gap, not hidden
    // The victim's originally reported amount — not a max over hop amounts, which could
    // pick up a consolidation-hub hop aggregating other victims' funds (see CLAUDE.md's
    // "Consolidation" thesis and the hub hop in api/mock.ts).
    valueCrypto: trace.conservation.incomingTotal,
    durationMin: 0,
    hops: trace.hops.length,
    trail: trace.hops.map((h) => ({
      n: h.n, addr: h.addr, role: h.role, amt: h.amt, at: h.at, flag: h.flag, chain: h.chain,
    })),
  }
}

/** Real HTTP implementation — covers what backend/ Sprint 1 (amended) actually serves.
 * Everything else stays `notImplemented` until the VASP feed / freeze / evidence-hash
 * sprints land (see docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md). */
export const httpApiPartial: Partial<KaizenApi> = {
  createCase: (input: CaseInput) => request<Case>('/api/v1/cases', { method: 'POST', body: input }),
  getCase: (id: string) => request<Case>(`/api/v1/cases/${id}`),
  listCases: async (): Promise<RecentCase[]> => {
    const items = await request<BackendCaseListItem[]>('/api/v1/cases')
    // The backend already returns these sorted by recoverability (most urgent/actionable
    // first) -- see cases.py's `list_cases` -- so this is a straight field mapping, no
    // client-side re-sort here.
    return items.map(toRecentCase)
  },
  startTrace: async (caseId: string): Promise<TraceResult> => {
    const trace = await request<BackendTraceOut>(`/api/v1/cases/${caseId}/trace`, { method: 'POST' })
    // routeB is an honest "not computed" placeholder — an independent literal, never a spread
    // of the real trace, so no real hop count/value ever sits next to the "Not yet computed"
    // label (see CLAUDE.md's "nothing is a black box" / honest-provenance rule).
    const routeB: Route = {
      label: 'Not yet computed',
      accent: 'sky',
      valueINR: 0,
      valueCrypto: 0,
      durationMin: 0,
      hops: 0,
      trail: [],
    }
    return { routeA: toRoute(trace), routeB }
  },
  getRoutes: (caseId: string) =>
    routesCache.get(caseId, () => (httpApiPartial.startTrace as (id: string) => Promise<TraceResult>)(caseId)),
}

// `getRoutes` is called independently from up to 4 screens per case (Route Choice, Evidence,
// Case Closed, Reports — see task-G6-report.md) — each re-running the ENTIRE live backend trace
// from scratch for identical inputs otherwise. Cache the in-flight/most-recent promise per
// `caseId` so repeated screen loads for the SAME case within a session reuse one real request.
// Keyed by `caseId` (never global) so a different case, or a post-"Reset demo" new case (always
// a fresh backend-issued uuid — see backend/app/api/v1/cases.py's `create_case`), never reuses
// another case's cached result.
const routesCache = createKeyedPromiseCache<TraceResult>()
