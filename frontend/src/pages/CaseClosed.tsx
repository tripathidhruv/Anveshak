import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Home, Megaphone, RotateCcw } from 'lucide-react'
import { Button, Card, Well } from '../components/ui'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import type { CampaignSummary, Case, TraceResult } from '../types'
import { ROUTES } from '../utils/constants'
import styles from './CaseClosed.module.css'

interface ClosedData {
  activeCase: Case
  trace: TraceResult
  campaign: CampaignSummary
}

/**
 * Screen 7 — the completion state. No StepRail here (routeMeta.ts's `RAIL_VISIBLE_PATTERNS`
 * deliberately excludes this route). Reads case + trace + campaign from the API rather than
 * caseStore alone, so a hard refresh on this route still renders correctly.
 */
export default function CaseClosed() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const resetCaseStore = useCaseStore((s) => s.reset)
  const [data, setData] = useState<ClosedData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([api.getCase(id), api.getRoutes(id), api.getCampaign()]).then(([activeCase, trace, campaign]) => {
      if (cancelled) return
      setData({ activeCase, trace, campaign })
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return <Navigate to={ROUTES.dashboard} replace />

  if (loading || !data) {
    return <Card className={styles.loadingCard}>Loading case summary…</Card>
  }

  const { activeCase, trace, campaign } = data
  const hopsFollowed = Math.max(trace.routeA.hops, trace.routeB.hops) + 1

  function handleStartNewCase() {
    resetCaseStore()
    navigate(ROUTES.newCase)
  }

  return (
    <div className={styles.page}>
      <Card className={styles.summaryCard}>
        <div className={styles.checkWell}>
          <CheckCircle2 size={56} className={styles.checkIcon} />
        </div>

        <h1 className={styles.title}>
          Case <span className="mono">{activeCase.id}</span> traced.
        </h1>
        <p className={styles.subtitle}>
          From one wallet address to a named exchange and a signed notice — in 47 seconds.
        </p>

        <div className={styles.statGrid}>
          <Well className={styles.statWell}>
            <span className={styles.statValue}>{hopsFollowed}</span>
            <span className={styles.statLabel}>Hops followed</span>
          </Well>
          <Well className={styles.statWell}>
            <span className={styles.statValue}>2</span>
            <span className={styles.statLabel}>Routes traced</span>
          </Well>
          <Well className={styles.statWell}>
            <span className={styles.statValue}>1</span>
            <span className={styles.statLabel}>Exchange identified</span>
          </Well>
          <Well className={styles.statWell}>
            <span className={styles.statValue}>{campaign.cases}</span>
            <span className={styles.statLabel}>Linked cases</span>
          </Well>
        </div>

        <div className={styles.comparison}>
          <span className="label">Manual investigation vs. KAIZEN</span>
          <div className={styles.compareRow}>
            <span className={styles.compareLabel}>Manual</span>
            <div className={styles.compareTrack}>
              <div className={styles.compareBarManual} />
            </div>
            <span className={styles.compareValue}>4–6 weeks</span>
          </div>
          <div className={styles.compareRow}>
            <span className={styles.compareLabel}>KAIZEN</span>
            <div className={styles.compareTrack}>
              <div className={styles.compareBarKaizen} />
            </div>
            <span className={styles.compareValue}>47 seconds</span>
          </div>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => navigate(ROUTES.campaign(campaign.sharedWallet))}>
            <Megaphone size={16} />
            View campaign ({campaign.cases} cases)
          </Button>
          <Button onClick={() => navigate(ROUTES.dashboard)}>
            <Home size={16} />
            Back to dashboard
          </Button>
          <Button variant="primary" onClick={handleStartNewCase}>
            <RotateCcw size={16} />
            Start a new case
          </Button>
        </div>
      </Card>
    </div>
  )
}
