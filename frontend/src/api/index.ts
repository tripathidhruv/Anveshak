import type { KaizenApi } from '../types'
import { mockApi } from './mock'

/** `VITE_USE_MOCK` defaults to mock unless explicitly set to the string `'false'`. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function notImplemented(method: string): never {
  throw new Error(`httpApi.${method} is not implemented yet — Phase 2 wires this up against the real backend.`)
}

/** Real HTTP implementation — stubbed until Phase 2 (see `frontend/src/api/client.ts`). */
const httpApi: KaizenApi = {
  createCase: () => notImplemented('createCase'),
  getCase: () => notImplemented('getCase'),
  listCases: () => notImplemented('listCases'),
  startTrace: () => notImplemented('startTrace'),
  getRoutes: () => notImplemented('getRoutes'),
  getExchange: () => notImplemented('getExchange'),
  getRisk: () => notImplemented('getRisk'),
  getGraph: () => notImplemented('getGraph'),
  generateReport: () => notImplemented('generateReport'),
  sendNotice: () => notImplemented('sendNotice'),
  getDashboard: () => notImplemented('getDashboard'),
  getCampaign: () => notImplemented('getCampaign'),
}

export const api: KaizenApi = USE_MOCK ? mockApi : httpApi
