import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Landmark, Megaphone, MapPin, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Well } from '@/components/ui/well'
import { api } from '../api'
import type { CampaignSummary } from '../types'
import { ROUTES } from '../utils/constants'
import { formatINR, truncateAddress } from '../utils/format'

/**
 * `/campaigns` — a registry of linked-complaint campaigns (Task 3, stub-screens-plan.md).
 * The mock dataset has exactly one campaign (shared-wallet, `KZN-2026-0417` and its siblings),
 * so this shows it as a single prominent card framed as a list — structured so a second campaign
 * card would slot in naturally once Phase 2 detects more than one, but nothing here fabricates
 * a second entry today.
 */
export default function Campaigns() {
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getCampaign().then((result) => {
      if (cancelled) return
      setCampaign(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-3xl flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            Linked-complaint campaigns
          </h1>
          <Badge variant="outline">DEMO DATA</Badge>
        </div>
        <p className="text-[15px] text-muted-foreground">
          When separate victims' complaints all trace to the same collection wallet, KAIZEN groups them into one
          campaign — worth a joint notice, not many separate ones.
        </p>
      </header>

      {loading || !campaign ? (
        <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">Loading campaigns…</Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <IconTile color="vermillion" size="lg">
                  <Megaphone size={22} />
                </IconTile>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                    One wallet, {campaign.cases} victims
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {campaign.cases} independently filed complaints, {campaign.states} states, one shared collection
                    wallet.
                  </p>
                </div>
              </div>
              <Badge variant="vermillion">Active</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              <Well className="flex flex-col items-center gap-2 p-5 text-center">
                <IconTile color="vermillion" size="sm">
                  <Users size={18} />
                </IconTile>
                <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">
                  {campaign.cases}
                </span>
                <span className="text-xs text-muted-foreground">Linked complaints</span>
              </Well>
              <Well className="flex flex-col items-center gap-2 p-5 text-center">
                <IconTile color="vermillion" size="sm">
                  <MapPin size={18} />
                </IconTile>
                <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">
                  {campaign.states}
                </span>
                <span className="text-xs text-muted-foreground">States affected</span>
              </Well>
              <Well className="flex flex-col items-center gap-2 p-5 text-center">
                <IconTile color="vermillion" size="sm">
                  <Landmark size={18} />
                </IconTile>
                <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">
                  {formatINR(campaign.totalINR)}
                </span>
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

            <div className="flex justify-end">
              <Button onClick={() => navigate(ROUTES.campaign(campaign.sharedWallet))}>
                View campaign
                <ExternalLink size={15} />
              </Button>
            </div>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            More campaigns will appear here automatically as new shared-wallet clusters are detected.
          </p>
        </div>
      )}
    </div>
  )
}
