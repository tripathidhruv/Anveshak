/**
 * The only door screens use to get data. `VITE_USE_MOCK=false` switches every call to the
 * FastAPI backend; anything else (including unset) serves the synthetic mock. No screen changes.
 */
import type { CaseSummary, TypologyOut, IntakeCaseIn, IntakeCaseOut, IntakeParseIn, IntakeParseOut, MemoryLookup, MemoryStats } from './types'
import { mockApi } from './mock'
import { httpApi } from './http'

export type AnveshakApi = {
  parseComplaint: (body: IntakeParseIn, signal?: AbortSignal) => Promise<IntakeParseOut>
  createCaseFromIntake: (body: IntakeCaseIn) => Promise<IntakeCaseOut>
  lookupWallet: (address: string, signal?: AbortSignal) => Promise<MemoryLookup>
  memoryStats: () => Promise<MemoryStats>
  listCases: () => Promise<CaseSummary[]>
  caseTypology: (caseId: string, signal?: AbortSignal) => Promise<TypologyOut>
}

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
export const api: AnveshakApi = USE_MOCK ? mockApi : httpApi
export * from './types'
export { ApiError, errorText } from './client'
