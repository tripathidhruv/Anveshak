import * as React from 'react'
import { LOOKUPS, LOOKUP_STEPS, UNKNOWN, type Lookup } from './data'

export type Phase = 'idle' | 'searching' | 'done'

function resolve(addr: string): Lookup {
  const a = addr.trim()
  const hit = LOOKUPS.find((l) => l.addr.toLowerCase() === a.toLowerCase())
  if (hit) return hit
  const base = LOOKUPS.find((l) => l.addr === UNKNOWN)!
  return { ...base, addr: a }
}

/** Lookup state lives in the page (not the card) so a sub-tab switch doesn't wipe the result. */
export function useMemoryLookup() {
  const [value, setValue] = React.useState(LOOKUPS[0].addr)
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [step, setStep] = React.useState(0)
  const [result, setResult] = React.useState<Lookup | null>(null)
  const timer = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])

  const check = (addr = value) => {
    if (!addr.trim()) return
    if (timer.current) window.clearInterval(timer.current)
    setPhase('searching')
    setStep(0)
    let i = 0
    timer.current = window.setInterval(() => {
      i += 1
      setStep(i)
      if (i >= LOOKUP_STEPS.length) {
        if (timer.current) window.clearInterval(timer.current)
        timer.current = null
        setResult(resolve(addr))
        setPhase('done')
      }
    }, 340)
  }

  return { value, setValue, phase, step, result, check }
}
