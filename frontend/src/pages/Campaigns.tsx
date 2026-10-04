import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, GitBranch, Landmark, Megaphone, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Well } from '@/components/ui/well'
import {
  getCampaignsList as getCampaignsListHttp,
  type CampaignOut,
} from '../api/httpApi'
import { getCampaignsList as getCampaignsListMock } from '../api/mock'
import { ROUTES } from '../utils/constants'
import { formatINR, truncateAddress } from '../utils/format'

/** Resolves the same one-env-var switch locally, matching `api/index.ts`'s own `VITE_USE_MOCK`
 * handling -- `getCampaignsList` isn't part of the shared `AnveshakApi` surface (same reasoning as
 * `Evidence.tsx`'s `getEvidencePack`/`verifyEvidencePack`: a real endpoint with no client function
 * in the original mock-only `AnveshakApi` interface), so this page picks between the mock and real
 * implementation itself rather than going through `api/index.ts`. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchCampaignsList: () => Promise<CampaignOut[]> = USE_MOCK ? getCampaignsListMock : getCampaignsListHttp

/**
 * `/campaigns` — a registry of linked-complaint campaigns (Task 3, stub-screens-plan.md).
 * Backed by the real consolidation-clustering endpoint (`GET /api/v1/campaigns`,
 * `app/graph/campaigns.py`'s union-find over verified hub wallets) once `VITE_USE_MOCK=false`,
 * so this now renders however many campaigns the backend actually found -- zero, one, or many --
 * rather than a single hard-coded card. The mock dataset has two synthetic campaigns
 * (`api/mock.ts`'s `DEMO_CAMPAIGNS`) so the list-of-many-cards layout below has something real to
 * exercise offline too.
 */
export default function Campaigns() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignOut[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCampaignsList()
      .then((result) => {
        if (cancelled) return
        setCampaigns(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load campaigns.')
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
          When separate victims' complaints all trace to the same collection wallet, ANVESHAK groups them into one
          campaign — worth a joint notice, not many separate ones.
        </p>
      </header>

      {loading ? (
        <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">Loading campaigns…</Card>
      ) : error ? (
        <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">{error}</Card>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">
          No linked-complaint campaigns detected yet.
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="flex flex-col gap-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <IconTile color="vermillion" size="lg">
                    <Megaphone size={22} />
                  </IconTile>
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                      One wallet, {campaign.caseIds.length} victims
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaign.caseIds.length} independently filed complaints, one shared {campaign.chain}{' '}
                      collection wallet.
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
                    {campaign.caseIds.length}
                  </span>
                  <span className="text-xs text-muted-foreground">Linked complaints</span>
                </Well>
                <Well className="flex flex-col items-center gap-2 p-5 text-center">
                  <IconTile color="sky" size="sm">
                    <GitBranch size={18} />
                  </IconTile>
                  <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">
                    {campaign.chain}
                  </span>
                  <span className="text-xs text-muted-foreground">Chain</span>
                </Well>
                <Well className="flex flex-col items-center gap-2 p-5 text-center">
                  <IconTile color="gold" size="sm">
                    <Landmark size={18} />
                  </IconTile>
                  <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">
                    {formatINR(campaign.totalAmountINR)}
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
                    {truncateAddress(campaign.hubAddress)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => navigate(ROUTES.campaign(campaign.id))}>
                  View campaign
                  <ExternalLink size={15} />
                </Button>
              </div>
            </Card>
          ))}

          <p className="text-center text-xs text-muted-foreground">
            More campaigns will appear here automatically as new shared-wallet clusters are detected.
          </p>
        </div>
      )}
    </div>
  )
}
