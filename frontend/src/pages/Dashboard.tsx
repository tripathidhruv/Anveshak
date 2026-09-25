import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink, FolderOpen, IndianRupee, Megaphone, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { KpiCard, TraceActivityChart } from '../components/dashboard'
import { api } from '../api'
import type { CampaignSummary, CaseStatus, DashboardData, RecentCase, RiskBand } from '../types'
import type { SemanticColour } from '../utils/constants'
import { COLOUR_SEMANTICS, ROUTES } from '../utils/constants'
import { formatINR } from '../utils/format'

const KPI_ICONS = [
  <FolderOpen key="folder" size={20} />,
  <CheckCircle2 key="check" size={20} />,
  <IndianRupee key="inr" size={20} />,
  <Timer key="timer" size={20} />,
]

const KPI_ACCENTS = ['indigo', 'moss', 'gold', 'sky'] as const

/** Decorative, hand-drawn-looking sparklines — one per KPI card, purely illustrative. */
const KPI_SPARKLINES = [
  'M2 22 L18 20 L34 16 L50 18 L66 12 L82 10 L98 6 L118 4',
  'M2 20 L18 21 L34 14 L50 15 L66 9 L82 11 L98 5 L118 3',
  'M2 24 L18 18 L34 19 L50 12 L66 14 L82 8 L98 9 L118 2',
  'M2 8 L18 10 L34 6 L50 12 L66 9 L82 16 L98 14 L118 20',
]

const STATUS_COLOUR: Record<CaseStatus, SemanticColour> = {
  New: 'info',
  Traced: 'onchain',
  'Notice sent': 'bridge',
  Closed: 'safe',
}

const RISK_COLOUR: Partial<Record<RiskBand, SemanticColour>> = {
  HIGH: 'criminal',
  MEDIUM: 'exchange',
  LOW: 'safe',
}

/**
 * Screen 0 — the app's `/` route. Reads `DashboardData` once on mount. The recent-cases table
 * only makes the top ("New") row clickable: cases 2-5 in the demo dataset are dashboard-summary
 * rows only (no full case record behind them — the mock API always returns the single demo
 * case), so routing them into mid-flow screens would either 404 or silently show the wrong
 * case's data. A reasonable simplification for a hackathon demo, noted here per Task 7's brief.
 */
export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getDashboard(), api.getCampaign()]).then(([dashboardResult, campaignResult]) => {
      if (cancelled) return
      setData(dashboardResult)
      setCampaign(campaignResult)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading || !data || !campaign) {
    return (
      <Card className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 p-10 text-center text-muted-foreground">
        <Spinner percent={70} label="Loading" />
        <p>Loading dashboard…</p>
      </Card>
    )
  }

  function handleRowClick(row: RecentCase) {
    if (row.status !== 'New') return
    navigate(ROUTES.newCase)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Every active investigation, at a glance.</p>
      </header>

      <div className="grid grid-cols-2 gap-6 2xl:grid-cols-4">
        {data.kpis.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            kpi={kpi}
            icon={KPI_ICONS[index % KPI_ICONS.length]}
            sparklinePath={KPI_SPARKLINES[index % KPI_SPARKLINES.length]}
            accent={KPI_ACCENTS[index % KPI_ACCENTS.length]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[2fr_1fr]">
        <Card className="flex flex-col gap-4 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">Recent cases</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Case ID</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Complainant</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Chain</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCases.map((row) => {
                  const clickable = row.status === 'New'
                  return (
                    <tr
                      key={row.id}
                      className={cn('transition-colors', clickable && 'cursor-pointer hover:bg-muted focus-visible:bg-muted focus-visible:outline-none')}
                      onClick={() => handleRowClick(row)}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (clickable && (e.key === 'Enter' || e.key === ' ')) handleRowClick(row)
                      }}
                    >
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">{row.id}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">{row.who}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">{formatINR(row.amt)}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">{row.chain}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        <Badge variant={COLOUR_SEMANTICS[STATUS_COLOUR[row.status]]}>{row.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        {row.risk ? (
                          <Badge variant={COLOUR_SEMANTICS[RISK_COLOUR[row.risk]!]}>{row.risk}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="relative flex flex-col items-start gap-2.5 overflow-hidden p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-vermillion" aria-hidden="true" />
          <IconTile color="vermillion">
            <Megaphone size={20} />
          </IconTile>
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">Campaign alert</h3>
          <p className="text-sm text-muted-foreground">
            {campaign.cases} complaints across {campaign.states} states share one wallet.
          </p>
          <Button className="mt-1" onClick={() => navigate(ROUTES.campaign(campaign.sharedWallet))}>
            View campaign
            <ExternalLink size={15} />
          </Button>
        </Card>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">Trace activity, last 14 days</h3>
        <TraceActivityChart />
      </Card>

      <div className="flex justify-end">
        <Button variant="default" onClick={() => navigate(ROUTES.newCase)}>
          + Register new case
        </Button>
      </div>
    </div>
  )
}
