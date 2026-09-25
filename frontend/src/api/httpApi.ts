import { request } from './client'
import type { Case, CaseInput, KaizenApi, Route, TraceResult } from '../types'

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
  getRoutes: (caseId: string) => (httpApiPartial.startTrace as (id: string) => Promise<TraceResult>)(caseId),
}
