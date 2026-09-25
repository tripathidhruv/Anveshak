import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Spinner } from '../components/ui/spinner'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { ROUTES } from '../utils/constants'

const STATUS_LINES = [
  'Connecting to the TRON blockchain…',
  'Reading transactions from this wallet…',
  'Following the money — hop 3 of 6…',
  'Checking how fast the money moved…',
  'Looking for a cash-out point…',
]

interface ChecklistItem {
  label: string
  sweep?: boolean
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { label: '847 transactions read' },
  { label: '6 wallets in the chain' },
  { label: 'Money moved out in 42 seconds', sweep: true },
  { label: 'Two possible routes found' },
  { label: 'Reached a cryptocurrency exchange' },
]

const RING_DURATION_MS = 1800
const CHECKLIST_INTERVAL_MS = 280
const COMPLETION_PAUSE_MS = 600

export default function Tracing() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const activeCase = useCaseStore((s) => s.activeCase)
  const setTraceResult = useCaseStore((s) => s.setTraceResult)

  const [percent, setPercent] = useState(0)
  const [statusIndex, setStatusIndex] = useState(0)
  const [checklistShown, setChecklistShown] = useState(0)

  const readyRef = useRef(false)
  const visualsDoneRef = useRef(false)
  const skipRef = useRef(false)
  const navigatedRef = useRef(false)
  const rafIdRef = useRef(0)

  useEffect(() => {
    if (!caseId || !activeCase || activeCase.id !== caseId) {
      navigate(ROUTES.newCase, { replace: true })
      return
    }

    const safeCaseId = caseId
    let cancelled = false

    function finishVisuals() {
      setPercent(100)
      setStatusIndex(STATUS_LINES.length - 1)
      setChecklistShown(CHECKLIST_ITEMS.length)
    }

    function maybeNavigate() {
      if (cancelled || navigatedRef.current) return
      if (!readyRef.current || !visualsDoneRef.current) return
      navigatedRef.current = true
      window.setTimeout(() => {
        if (!cancelled) navigate(ROUTES.routes(safeCaseId), { replace: true })
      }, skipRef.current ? 0 : COMPLETION_PAUSE_MS)
    }

    api.startTrace(safeCaseId).then((result) => {
      if (cancelled) return
      setTraceResult(result.routeA, result.routeB)
      readyRef.current = true
      maybeNavigate()
    })

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      finishVisuals()
      visualsDoneRef.current = true
      maybeNavigate()
      return () => {
        cancelled = true
      }
    }

    const startedAt = performance.now()

    function tick(now: number) {
      if (cancelled) return
      const elapsed = now - startedAt
      const progress = Math.min(1, elapsed / RING_DURATION_MS)
      setPercent(progress * 100)
      setStatusIndex(Math.min(STATUS_LINES.length - 1, Math.floor(progress * STATUS_LINES.length)))
      setChecklistShown(Math.min(CHECKLIST_ITEMS.length, Math.floor(elapsed / CHECKLIST_INTERVAL_MS)))

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(tick)
      } else {
        finishVisuals()
        visualsDoneRef.current = true
        maybeNavigate()
      }
    }
    rafIdRef.current = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per case entry, not on every store update
  }, [caseId])

  function handleSkip() {
    if (skipRef.current) return
    skipRef.current = true
    cancelAnimationFrame(rafIdRef.current)
    setPercent(100)
    setStatusIndex(STATUS_LINES.length - 1)
    setChecklistShown(CHECKLIST_ITEMS.length)
    visualsDoneRef.current = true
    if (readyRef.current && !navigatedRef.current && caseId) {
      navigatedRef.current = true
      navigate(ROUTES.routes(caseId), { replace: true })
    }
  }

  return (
    <div className="flex min-h-[560px] flex-col items-center gap-2">
      <Card className="w-full">
        <div className="flex flex-col items-center justify-center gap-14 px-6 pb-6 pt-12 md:flex-row">
          <div className="flex flex-col items-center gap-6">
            <Spinner percent={percent} size={260} strokeWidth={14} />
            <p
              key={statusIndex}
              className="min-h-6 animate-in fade-in slide-in-from-bottom-1 text-center text-base font-semibold text-foreground duration-200"
            >
              {STATUS_LINES[statusIndex]}
            </p>
          </div>

          <div className="flex min-w-85 flex-col gap-1 rounded-2xl border border-border bg-card p-5">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What we&rsquo;ve found so far
            </span>
            {CHECKLIST_ITEMS.slice(0, checklistShown).map((item, index) => (
              <div
                key={item.label}
                style={{ animationDelay: `${index * 20}ms` }}
                className="flex animate-in items-center gap-2.5 fade-in zoom-in-95 py-2 duration-200"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moss text-white">
                  <Check size={14} />
                </span>
                <span className="flex-1 text-sm text-foreground">{item.label}</span>
                {item.sweep && (
                  <span className="whitespace-nowrap rounded-full bg-vermillion px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    SWEEP DETECTED
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={cn('flex justify-end px-6 pb-6')}>
          <Button onClick={handleSkip}>See what we found →</Button>
        </div>
      </Card>
    </div>
  )
}
