import type { KaizenApi } from '../types'
import { mockApi } from './mock'
import { httpApiPartial } from './httpApi'

/** `VITE_USE_MOCK` defaults to mock unless explicitly set to the string `'false'`. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function notImplemented(method: string): never {
  throw new Error(`httpApi.${method} is not implemented yet — see docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md Task 12.`)
}

/** Real HTTP implementation. Methods not yet backed by a real endpoint throw clearly
 * instead of silently falling back to mock data (per CLAUDE.md's honest-provenance rule). */
const httpApi: KaizenApi = {
  createCase: httpApiPartial.createCase!,
  getCase: httpApiPartial.getCase!,
  listCases: () => notImplemented('listCases'),
  startTrace: httpApiPartial.startTrace!,
  getRoutes: httpApiPartial.getRoutes!,
  getExchange: () => notImplemented('getExchange'),
  getRisk: () => notImplemented('getRisk'),
  getGraph: () => notImplemented('getGraph'),
  generateReport: () => notImplemented('generateReport'),
  sendNotice: () => notImplemented('sendNotice'),
  getDashboard: () => notImplemented('getDashboard'),
  getCampaign: () => notImplemented('getCampaign'),
}

export const api: KaizenApi = USE_MOCK ? mockApi : httpApi
