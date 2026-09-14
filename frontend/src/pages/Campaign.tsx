import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Landmark, MapPin, Users, Wallet } from 'lucide-react'
import { Button, Card, PlainWords, Well } from '../components/ui'
import { api } from '../api'
import type { CampaignSummary } from '../types'
import { ROUTES } from '../utils/constants'
import { formatINR, truncateAddress } from '../utils/format'
import styles from './Campaign.module.css'

/**
 * `/campaign/:id` — a real but intentionally light v1. The source spec (Task 9) describes this
 * as an optional multi-victim Cytoscape graph; with 8 screens to migrate in this phase, a clean
 * totals-summary card is the v1 here (noted in the Task 7 report) — both Dashboard's campaign
 * alert card and CaseClosed's "View campaign" button need a real, non-404 destination, and this
 * satisfies that without inventing a second graph-rendering surface beyond Evidence's (Task 6).
 * The route id itself (the shared wallet address) isn't used by the mock API — `getCampaign`
 * always returns the single demo campaign — but is threaded through for when Phase 2 wires a
 * real backend keyed by campaign/shared-wallet id.
 */
export default function Campaign() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getCampaign(id).then((result) => {
      if (cancelled) return
      setCampaign(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading || !campaign) {
    return <Card className={styles.loadingCard}>Loading campaign…</Card>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} aria-label="Back to dashboard" onClick={() => navigate(ROUTES.dashboard)}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">One wallet. {campaign.cases} victims.</h1>
          <p className={styles.subtitle}>
            Every case below sent funds into the same collection wallet — this is one criminal campaign, not{' '}
            {campaign.cases} unrelated complaints.
          </p>
        </div>
      </header>

      <Card className={styles.summaryCard}>
        <div className={styles.statGrid}>
          <Well className={styles.statWell}>
            <span className={styles.statIcon}>
              <Users size={18} />
            </span>
            <span className={styles.statValue}>{campaign.cases}</span>
            <span className={styles.statLabel}>Linked complaints</span>
          </Well>
          <Well className={styles.statWell}>
            <span className={styles.statIcon}>
              <MapPin size={18} />
            </span>
            <span className={styles.statValue}>{campaign.states}</span>
            <span className={styles.statLabel}>States affected</span>
          </Well>
          <Well className={styles.statWell}>
            <span className={styles.statIcon}>
              <Landmark size={18} />
            </span>
            <span className="mono">{formatINR(campaign.totalINR)}</span>
            <span className={styles.statLabel}>Total value traced</span>
          </Well>
        </div>

        <div className={styles.walletRow}>
          <span className={styles.walletIcon}>
            <Wallet size={18} />
          </span>
          <div className={styles.walletText}>
            <span className="label">Shared collection wallet</span>
            <span className={styles.walletValue}>
              <span className="mono">{truncateAddress(campaign.sharedWallet)}</span>
            </span>
          </div>
        </div>
      </Card>

      <PlainWords>
        {campaign.cases} separate police complaints, filed independently across {campaign.states} states, all sent
        money to this one wallet. Investigated together, this is a single organised campaign — worth a joint
        notice, not {campaign.cases} separate ones.
      </PlainWords>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => navigate(ROUTES.dashboard)}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
