import { create } from 'zustand'
import type { Case, Route } from '../types'

interface CaseState {
  activeCase: Case | null
  routeA: Route | null
  routeB: Route | null
  /** Index into `RAIL_STEPS` (utils/constants.ts) for the workflow's current step. */
  currentStep: number
  setActiveCase: (activeCase: Case) => void
  setTraceResult: (routeA: Route, routeB: Route) => void
  setCurrentStep: (step: number) => void
  reset: () => void
}

const initialState = {
  activeCase: null,
  routeA: null,
  routeB: null,
  currentStep: 0,
} satisfies Omit<CaseState, 'setActiveCase' | 'setTraceResult' | 'setCurrentStep' | 'reset'>

/** Active-case workflow state: the case under investigation, its trace results once fetched, and the current step. */
export const useCaseStore = create<CaseState>((set) => ({
  ...initialState,
  setActiveCase: (activeCase) => set({ activeCase }),
  setTraceResult: (routeA, routeB) => set({ routeA, routeB }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  reset: () => set({ ...initialState }),
}))
