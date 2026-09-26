import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, FolderOpen, Globe, ShieldAlert, ShieldCheck, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { Stat } from '@/components/ui/well'
import { api } from '../api'
import type { CampaignSummary, Exchange } from '../types'
import { ROUTES } from '../utils/constants'
import { truncateAddress } from '../utils/format'

/**
 * Screen — registry of exchanges KAIZEN has attributed stolen funds to. The mock dataset has
 * exactly one (`Meridian Digital Exchange`, fictional per CLAUDE.md), so this reads as a single
 * watchlist row rather than a fabricated list. Structured so a second row would slot in
 * naturally once the backend v2 VASP-flagged-wallet feed exists — that feed itself is out of
 * scope here.
 */
export default function Exchanges() {
  const navigate = useNavigate()
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getExchange('KZN-2026-0417'), api.getCampaign()]).then(([exchangeResult, campaignResult]) => {
      if (cancelled) return
      setExchange(exchangeResult)
      setCampaign(campaignResult)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading || !exchange || !campaign) {
    return (
      <Card className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 p-10 text-center text-muted-foreground">
        <Spinner percent={70} label="Loading" />
        <p>Loading exchange registry…</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
          Flagged exchanges
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          The VASP watchlist — exchanges KAIZEN has traced stolen funds to. One entry in this demo; a live deployment
          would grow this feed automatically as new traces land.
        </p>
      </header>

      <Card className="relative flex flex-col gap-5 overflow-hidden p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <IconTile
              color="gold"
              size="lg"
              className="font-[family-name:var(--font-display)] text-xl font-bold"
            >
              {exchange.monogram}
            </IconTile>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
                {exchange.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deposit address:{' '}
                <span className="font-[family-name:var(--font-mono)] text-foreground/80">
                  {truncateAddress(exchange.depositAddr)}
                </span>
              </p>
            </div>
          </div>
          <Badge variant={exchange.fiuRegistered ? 'moss' : 'vermillion'} className="shrink-0">
            {exchange.fiuRegistered ? 'FIU-IND registered' : 'Not FIU-IND registered'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          <Stat label="Jurisdiction" value={exchange.jurisdiction} icon={<Globe size={16} />} iconColor="sky" />
          <Stat
            label="FIU-IND registered"
            value={exchange.fiuRegistered ? 'YES' : 'NO'}
            icon={<ShieldCheck size={16} />}
            iconColor={exchange.fiuRegistered ? 'moss' : 'vermillion'}
          />
          <Stat label="Indian users" value={exchange.indianUsers} icon={<Users size={16} />} iconColor="gold" />
          <Stat
            label="Linked cases"
            value={campaign.cases}
            hint="via one shared wallet"
            icon={<FolderOpen size={16} />}
            iconColor="vermillion"
          />
        </div>

        {!exchange.fiuRegistered && (
          <div className="flex items-start gap-3.5 rounded-xl bg-vermillion p-4 text-white">
            <span className="mt-0.5 flex shrink-0 items-center justify-center">
              <ShieldAlert size={18} />
            </span>
            <div>
              <p className="text-sm font-bold">Not registered with FIU-IND</p>
              <p className="mt-0.5 text-xs opacity-90">
                A registered exchange must respond to Indian law enforcement. This one is not registered, which is
                itself a finding.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users size={15} className="shrink-0" />
            {campaign.cases} complaints across {campaign.states} states have been traced to this exchange's deposit
            address.
          </div>
          <Button variant="default" onClick={() => navigate(ROUTES.exchange('KZN-2026-0417'))}>
            View attribution
            <ArrowRight size={16} />
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col items-start gap-2.5 p-6 text-muted-foreground">
        <IconTile color="primary" size="sm">
          <Building2 size={16} />
        </IconTile>
        <p className="text-sm">
          This registry previews the backend v2 VASP-flagged-wallet feed — a live deployment would list every
          exchange KAIZEN has attributed funds to, updated as new traces complete. Only one exchange exists in this
          demo dataset.
        </p>
      </Card>
    </div>
  )
}
