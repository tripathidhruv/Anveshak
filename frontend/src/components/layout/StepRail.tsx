import { Check } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { RAIL_STEPS } from '../../utils/constants'
import { getCurrentRailStepKey } from './routeMeta'
import styles from './StepRail.module.css'

/**
 * The 7-step workflow progress rail (UX law 4). Only rendered by `PageShell` when
 * `isRailVisible(pathname)` is true — see `routeMeta.ts` for the allowlist.
 */
export function StepRail() {
  const location = useLocation()
  const currentKey = getCurrentRailStepKey(location.pathname)
  const currentIndex = RAIL_STEPS.findIndex((step) => step.key === currentKey)

  return (
    <ol className={styles.rail}>
      {RAIL_STEPS.map((step, index) => {
        const isCompleted = currentIndex !== -1 && index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === RAIL_STEPS.length - 1

        return (
          <li
            key={step.key}
            className={clsx(styles.step, isCompleted && styles.completed, isCurrent && styles.current)}
          >
            <span className={styles.dot}>{isCompleted ? <Check size={14} /> : index + 1}</span>
            <span className={styles.label}>{step.label}</span>
            {!isLast && <span className={styles.connector} />}
          </li>
        )
      })}
    </ol>
  )
}
