import { Check } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { RAIL_STEPS } from '../../utils/constants'
import { getCurrentRailStepKey } from './routeMeta'

/**
 * The 7-step workflow progress rail (UX law 4). Only rendered by `PageShell` when
 * `isRailVisible(pathname)` is true — see `routeMeta.ts` for the allowlist.
 */
export function StepRail() {
  const location = useLocation()
  const currentKey = getCurrentRailStepKey(location.pathname)
  const currentIndex = RAIL_STEPS.findIndex((step) => step.key === currentKey)

  return (
    <ol className="mb-6 flex items-center gap-2">
      {RAIL_STEPS.map((step, index) => {
        const isCompleted = currentIndex !== -1 && index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === RAIL_STEPS.length - 1

        return (
          <li key={step.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  isCompleted && 'bg-moss/12 text-moss',
                  isCurrent && 'bg-sky/12 text-sky',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                )}
              >
                {isCompleted ? <Check size={14} /> : index + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-xs font-medium',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && <span className="mb-5 h-px flex-1 bg-border" />}
          </li>
        )
      })}
    </ol>
  )
}
