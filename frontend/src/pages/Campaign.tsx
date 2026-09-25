import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Landmark, MapPin, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { PlainWords } from '@/components/ui/plain-words'
import { Well } from '@/components/ui/well'
import { api } from '../api'
import type { CampaignSummary } from '../types'
import { ROUTES } from '../utils/constants'
import { formatINR, truncateAddress } from '../utils/format'

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
    return (
      <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">Loading campaign…</Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-3xl items-start gap-4">
        <button
          type="button"
          aria-label="Back to dashboard"
          onClick={() => navigate(ROUTES.dashboard)}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            One wallet. {campaign.cases} victims.
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Every case below sent funds into the same collection wallet — this is one criminal campaign, not{' '}
            {campaign.cases} unrelated complaints.
          </p>
        </div>
      </header>

      <Card className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <Well className="flex flex-col items-center gap-2 p-5 text-center">
            <IconTile color="vermillion" size="sm">
              <Users size={18} />
            </IconTile>
            <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">{campaign.cases}</span>
            <span className="text-xs text-muted-foreground">Linked complaints</span>
          </Well>
          <Well className="flex flex-col items-center gap-2 p-5 text-center">
            <IconTile color="vermillion" size="sm">
              <MapPin size={18} />
            </IconTile>
            <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">{campaign.states}</span>
            <span className="text-xs text-muted-foreground">States affected</span>
          </Well>
          <Well className="flex flex-col items-center gap-2 p-5 text-center">
            <IconTile color="vermillion" size="sm">
              <Landmark size={18} />
            </IconTile>
            <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">{formatINR(campaign.totalINR)}</span>
            <span className="text-xs text-muted-foreground">Total value traced</span>
          </Well>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-5 py-4">
          <span className="shrink-0 text-vermillion">
            <Wallet size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">Shared collection wallet</span>
            <span className="font-[family-name:var(--font-mono)] text-[15px] text-foreground">
              {truncateAddress(campaign.sharedWallet)}
            </span>
          </div>
        </div>
      </Card>

      <PlainWords>
        {campaign.cases} separate police complaints, filed independently across {campaign.states} states, all sent
        money to this one wallet. Investigated together, this is a single organised campaign — worth a joint
        notice, not {campaign.cases} separate ones.
      </PlainWords>

      <div className="flex justify-end">
        <Button variant="default" onClick={() => navigate(ROUTES.dashboard)}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
