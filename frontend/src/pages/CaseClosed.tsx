import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Home, Megaphone, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Well } from '@/components/ui/well'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import type { CampaignSummary, Case, TraceResult } from '../types'
import { ROUTES } from '../utils/constants'

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
    return (
      <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">Loading case summary…</Card>
    )
  }

  const { activeCase, trace, campaign } = data
  const hopsFollowed = Math.max(trace.routeA.hops, trace.routeB.hops) + 1

  function handleStartNewCase() {
    resetCaseStore()
    navigate(ROUTES.newCase)
  }

  return (
    <div className="flex justify-center py-6 pb-12">
      <Card className="flex w-full max-w-3xl flex-col items-center gap-6 p-10 text-center">
        <IconTile color="moss" size="lg" className="h-28 w-28">
          <CheckCircle2 size={56} />
        </IconTile>

        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-bold text-foreground">
            Case <span className="font-[family-name:var(--font-mono)]">{activeCase.id}</span> traced.
          </h1>
          <p className="max-w-lg text-[15px] text-muted-foreground">
            From one wallet address to a named exchange and a signed notice — in 41 seconds.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3.5 md:grid-cols-4">
          <Well className="flex flex-col items-center gap-1.5 p-5 text-center">
            <span className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">{hopsFollowed}</span>
            <span className="text-xs text-muted-foreground">Hops followed</span>
          </Well>
          <Well className="flex flex-col items-center gap-1.5 p-5 text-center">
            <span className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">2</span>
            <span className="text-xs text-muted-foreground">Routes traced</span>
          </Well>
          <Well className="flex flex-col items-center gap-1.5 p-5 text-center">
            <span className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">1</span>
            <span className="text-xs text-muted-foreground">Exchange identified</span>
          </Well>
          <Well className="flex flex-col items-center gap-1.5 p-5 text-center">
            <span className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">{campaign.cases}</span>
            <span className="text-xs text-muted-foreground">Linked cases</span>
          </Well>
        </div>

        <div className="flex w-full flex-col items-start gap-3 text-left">
          <span className="text-sm font-medium text-muted-foreground">Manual investigation vs. ANVESHAK</span>
          <div className="grid w-full grid-cols-[60px_1fr_84px] items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Manual</span>
            <div className="h-3.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-muted-foreground" />
            </div>
            <span className="text-right text-sm font-bold text-foreground">4–6 weeks</span>
          </div>
          <div className="grid w-full grid-cols-[60px_1fr_84px] items-center gap-3">
            <span className="text-sm font-semibold text-foreground">ANVESHAK</span>
            <div className="h-3.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[2%] min-w-[14px] rounded-full bg-moss" />
            </div>
            <span className="text-right text-sm font-bold text-foreground">41 seconds</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(ROUTES.campaign(campaign.sharedWallet))}>
            <Megaphone size={16} />
            View campaign ({campaign.cases} cases)
          </Button>
          <Button variant="outline" onClick={() => navigate(ROUTES.dashboard)}>
            <Home size={16} />
            Back to dashboard
          </Button>
          <Button variant="default" onClick={handleStartNewCase}>
            <RotateCcw size={16} />
            Start a new case
          </Button>
        </div>
      </Card>
    </div>
  )
}
