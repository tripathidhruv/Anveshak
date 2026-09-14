import { useEffect, useRef, useState } from 'react'

/** cubic-bezier-ish ease-out curve for the count-up (matches the KPI/score number spec: 700ms ease-out). */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Animates a number from 0 to `target` over `durationMs` via `requestAnimationFrame`.
 * Re-triggers only when `target` actually changes — not on every re-render — so a parent
 * re-rendering for an unrelated reason doesn't restart the count-up.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0)
  const frameRef = useRef(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setValue(target)
      return
    }

    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)
      setValue(target * easeOut(progress))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- durationMs intentionally excluded, only `target` re-triggers
  }, [target])

  return value
}
