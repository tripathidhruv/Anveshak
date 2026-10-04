import { request } from './client'
import type { AnveshakApi } from './index'
import type { CaseListItemWire, CaseStage, CaseSummary } from './types'

const STAGE: Record<string, CaseStage> = { new: 'Intake', in_progress: 'Tracing', handled: 'Closed' }
const CHAIN: Record<string, CaseSummary['chain']> = { tron: 'TRON', ethereum: 'Ethereum', bitcoin: 'Bitcoin' }

/** The backend's case row → the queue's view shape. Fields the backend doesn't track yet (risk, syndicate, exchange) stay empty, never invented. */
function toSummary(c: CaseListItemWire): CaseSummary {
  const [city, state = ''] = c.location.split(',').map((s) => s.trim())
  return {
    id: c.id,
    who: c.complainant,
    city,
    state,
    amt: c.amountINR,
    chain: CHAIN[c.chain] ?? 'TRON',
    status: STAGE[c.status] ?? 'Intake',
    risk: null,
    recover: c.recoverabilityState === 'unknown' ? 'moving' : c.recoverabilityState,
    goldenMin: c.recoverabilityDeadlineMinutes === null ? null : Math.round(c.recoverabilityDeadlineMinutes),
    type: c.fraudType,
    wallet: c.suspectWallet,
    filed: new Date(c.reportedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }
}

export const httpApi: AnveshakApi = {
  parseComplaint: (body, signal) => request('/api/v1/intake/parse', { method: 'POST', body, signal }),
  createCaseFromIntake: (body) => request('/api/v1/intake/cases', { method: 'POST', body }),
  lookupWallet: (address, signal) => request(`/api/v1/memory/wallets/${encodeURIComponent(address)}`, { signal }),
  memoryStats: () => request('/api/v1/memory/stats'),
  listCases: async () => (await request<CaseListItemWire[]>('/api/v1/cases')).map(toSummary),
}
