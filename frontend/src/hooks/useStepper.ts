import { useLocation } from 'react-router-dom'
import { RAIL_STEPS } from '../utils/constants'
import { getCurrentRailStepKey } from '../components/layout/routeMeta'

export interface StepperState {
  /** Index into `RAIL_STEPS`, or -1 if the current route isn't part of the 7-step workflow. */
  currentIndex: number
  currentKey: string | null
  isFirstStep: boolean
  isLastStep: boolean
  /** True once every step up to (not including) `index` should render as completed. */
  isStepCompleted: (index: number) => boolean
  isStepCurrent: (index: number) => boolean
}

/**
 * Derives the current workflow step from the URL (single source of truth — see
 * `components/layout/routeMeta.ts`), plus simple completed/current guards for rendering
 * the StepRail or gating "next" actions.
 */
export function useStepper(): StepperState {
  const location = useLocation()
  const currentKey = getCurrentRailStepKey(location.pathname)
  const currentIndex = RAIL_STEPS.findIndex((step) => step.key === currentKey)

  return {
    currentIndex,
    currentKey,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === RAIL_STEPS.length - 1,
    isStepCompleted: (index) => currentIndex !== -1 && index < currentIndex,
    isStepCurrent: (index) => index === currentIndex,
  }
}
