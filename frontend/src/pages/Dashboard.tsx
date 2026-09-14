import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink, FolderOpen, IndianRupee, Megaphone, Timer } from 'lucide-react'
import clsx from 'clsx'
import { Badge, Button, Card, Chip, Spinner } from '../components/ui'
import { KpiCard, TraceActivityChart } from '../components/dashboard'
import { api } from '../api'
import type { CampaignSummary, CaseStatus, DashboardData, RecentCase, RiskBand } from '../types'
import type { SemanticColour } from '../utils/constants'
import { ROUTES } from '../utils/constants'
import { formatINR } from '../utils/format'
import styles from './Dashboard.module.css'

const KPI_ICONS = [
  <FolderOpen key="folder" size={20} />,
  <CheckCircle2 key="check" size={20} />,
  <IndianRupee key="inr" size={20} />,
  <Timer key="timer" size={20} />,
]

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
      <Card className={styles.loadingCard}>
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
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="page-title">Dashboard</h1>
        <p className={styles.subtitle}>Every active investigation, at a glance.</p>
      </header>

      <div className={styles.kpiGrid}>
        {data.kpis.map((kpi, index) => (
          <KpiCard key={kpi.label} kpi={kpi} icon={KPI_ICONS[index % KPI_ICONS.length]} sparklinePath={KPI_SPARKLINES[index % KPI_SPARKLINES.length]} />
        ))}
      </div>

      <div className={styles.mainGrid}>
        <Card className={styles.tableCard}>
          <h3 className="card-title">Recent cases</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Complainant</th>
                  <th>Amount</th>
                  <th>Chain</th>
                  <th>Status</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCases.map((row) => {
                  const clickable = row.status === 'New'
                  return (
                    <tr
                      key={row.id}
                      className={clsx(styles.row, clickable && styles.rowClickable)}
                      onClick={() => handleRowClick(row)}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (clickable && (e.key === 'Enter' || e.key === ' ')) handleRowClick(row)
                      }}
                    >
                      <td className="mono">{row.id}</td>
                      <td>{row.who}</td>
                      <td className="mono">{formatINR(row.amt)}</td>
                      <td>{row.chain}</td>
                      <td>
                        <Chip colour={STATUS_COLOUR[row.status]}>{row.status}</Chip>
                      </td>
                      <td>
                        {row.risk ? <Badge colour={RISK_COLOUR[row.risk]}>{row.risk}</Badge> : <span className={styles.riskDash}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className={styles.campaignCard}>
          <span className={styles.campaignIcon}>
            <Megaphone size={20} />
          </span>
          <h3 className="card-title">Campaign alert</h3>
          <p className={styles.campaignBody}>
            {campaign.cases} complaints across {campaign.states} states share one wallet.
          </p>
          <Button className={styles.campaignLink} onClick={() => navigate(ROUTES.campaign(campaign.sharedWallet))}>
            View campaign
            <ExternalLink size={15} />
          </Button>
        </Card>
      </div>

      <Card className={styles.chartCard}>
        <h3 className="card-title">Trace activity, last 14 days</h3>
        <TraceActivityChart />
      </Card>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => navigate(ROUTES.newCase)}>
          + Register new case
        </Button>
      </div>
    </div>
  )
}
