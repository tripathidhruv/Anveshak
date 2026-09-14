import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Button, Spinner } from '../components/ui'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { ROUTES } from '../utils/constants'
import styles from './Tracing.module.css'

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
    <div className={styles.page}>
      <Card>
        <div className={styles.stage}>
          <div className={styles.ringColumn}>
            <div className={styles.ringWell}>
              <Spinner percent={percent} size={260} strokeWidth={14} />
            </div>
            <p className={styles.statusLine} key={statusIndex}>
              {STATUS_LINES[statusIndex]}
            </p>
          </div>

          <div className={styles.checklist}>
            <span className={styles.checklistTitle}>What we&rsquo;ve found so far</span>
            {CHECKLIST_ITEMS.slice(0, checklistShown).map((item, index) => (
              <div className={styles.checkItem} key={item.label} style={{ animationDelay: `${index * 20}ms` }}>
                <span className={styles.checkDot}>
                  <Check size={14} />
                </span>
                <span className={styles.checkLabel}>{item.label}</span>
                {item.sweep && <span className={styles.sweepPill}>SWEEP DETECTED</span>}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <Button onClick={handleSkip}>See what we found →</Button>
        </div>
      </Card>
    </div>
  )
}
