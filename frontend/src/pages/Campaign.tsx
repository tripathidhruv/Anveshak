import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, GitBranch, Landmark, MapPin, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { PlainWords } from '@/components/ui/plain-words'
import { Well } from '@/components/ui/well'
import {
  getCampaignDetail as getCampaignDetailHttp,
  type CampaignDetailOut,
} from '../api/httpApi'
import { getCampaignDetail as getCampaignDetailMock } from '../api/mock'
import { ROUTES } from '../utils/constants'
import { formatINR, truncateAddress } from '../utils/format'

/** Resolves the same one-env-var switch locally, matching `Campaigns.tsx` and `Evidence.tsx` --
 * `getCampaignDetail` isn't part of the shared `KaizenApi` surface, so this page picks between
 * the mock and real implementation itself rather than going through `api/index.ts`. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchCampaignDetail: (campaignId: string) => Promise<CampaignDetailOut> = USE_MOCK
  ? getCampaignDetailMock
  : getCampaignDetailHttp

/** How many linked case ids to show before collapsing the rest into a "+N more" note -- campaign
 * `CAMP-2026-01`'s 38 cases would otherwise blow out the card's height. */
const MAX_VISIBLE_CASE_IDS = 12

/**
 * `/campaign/:id` — a real but intentionally light v1. The source spec (Task 9) describes this
 * as an optional multi-victim Cytoscape graph; with 8 screens to migrate in this phase, a clean
 * totals-summary card is the v1 here (noted in the Task 7 report) — both Dashboard's campaign
 * alert card and CaseClosed's "View campaign" button need a real, non-404 destination, and this
 * satisfies that without inventing a second graph-rendering surface beyond Evidence's (Task 6).
 * `:id` is the backend-assigned campaign cluster id (`CampaignOut.id`, e.g. `CAMP-2026-01`) --
 * NOT the shared/hub wallet address, which is a separate field (`hubAddress`) on the same
 * response; `Campaigns.tsx` already links here with the right one.
 */
export default function Campaign() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState<CampaignDetailOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('No campaign id given.')
      setLoading(false)
      return
    }
    let cancelled = false
    fetchCampaignDetail(id)
      .then((result) => {
        if (cancelled) return
        setCampaign(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load this campaign.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <Card className="mx-auto mt-16 max-w-md p-10 text-center text-muted-foreground">Loading campaign…</Card>
    )
  }

  if (error || !campaign) {
    return (
      <Card className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 p-10 text-center text-muted-foreground">
        <p>{error ?? 'Campaign not found.'}</p>
        <Button variant="default" onClick={() => navigate(ROUTES.campaigns)}>
          Back to campaigns
        </Button>
      </Card>
    )
  }

  const cases = campaign.caseIds.length
  const states = campaign.statesTouched.length
  const visibleCaseIds = campaign.caseIds.slice(0, MAX_VISIBLE_CASE_IDS)
  const hiddenCaseCount = cases - visibleCaseIds.length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-3xl items-start gap-4">
        <button
          type="button"
          aria-label="Back to campaigns"
          onClick={() => navigate(ROUTES.campaigns)}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            One wallet. {cases} victims.
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Every case below sent funds into the same collection wallet — this is one criminal campaign, not{' '}
            {cases} unrelated complaints.
          </p>
        </div>
      </header>

      <Card className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <Well className="flex flex-col items-center gap-2 p-5 text-center">
            <IconTile color="vermillion" size="sm">
              <Users size={18} />
            </IconTile>
            <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">{cases}</span>
            <span className="text-xs text-muted-foreground">Linked complaints</span>
          </Well>
          <Well className="flex flex-col items-center gap-2 p-5 text-center">
            <IconTile color="sky" size="sm">
              <MapPin size={18} />
            </IconTile>
            <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-foreground">{states}</span>
            <span className="text-xs text-muted-foreground">States affected</span>
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

        <div className="flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-card px-5 py-4">
          <span className="shrink-0 text-vermillion">
            <Wallet size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">Shared collection wallet</span>
            <span className="font-[family-name:var(--font-mono)] text-[15px] text-foreground">
              {truncateAddress(campaign.hubAddress)}
            </span>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitBranch size={15} />
            {campaign.chain}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium text-muted-foreground">States touched</span>
          <div className="flex flex-wrap gap-2">
            {campaign.statesTouched.map((state) => (
              <Badge key={state} variant="outline">
                {state}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-medium text-muted-foreground">Linked complaints</span>
          <div className="flex flex-wrap gap-2">
            {visibleCaseIds.map((caseId) => (
              <Badge key={caseId} variant="outline" className="font-[family-name:var(--font-mono)]">
                {caseId}
              </Badge>
            ))}
            {hiddenCaseCount > 0 ? (
              <Badge variant="outline">+{hiddenCaseCount} more</Badge>
            ) : null}
          </div>
        </div>
      </Card>

      <PlainWords>
        {cases} separate police complaints, filed independently across {states} states, all sent money to this one
        wallet. Investigated together, this is a single organised campaign — worth a joint notice, not {cases}{' '}
        separate ones.
      </PlainWords>

      <div className="flex justify-end">
        <Button variant="default" onClick={() => navigate(ROUTES.campaigns)}>
          Back to campaigns
        </Button>
      </div>
    </div>
  )
}
