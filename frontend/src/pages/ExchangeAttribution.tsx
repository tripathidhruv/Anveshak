import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Globe, ShieldAlert, ShieldCheck, Users, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Gauge } from '@/components/ui/gauge'
import { IconTile } from '@/components/ui/icon-tile'
import { PlainWords } from '@/components/ui/plain-words'
import { Spinner } from '@/components/ui/spinner'
import { Stat } from '@/components/ui/well'
import { cn } from '@/lib/utils'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import type { Exchange } from '../types'
import { ROUTES } from '../utils/constants'
import { truncateAddress } from '../utils/format'

/**
 * Screen 4 — reads `Exchange` for the active case id and renders the gold-accented hero
 * card (identity + compliance finding) plus the "How we know" evidence list. All copy/values
 * come straight off `api.getExchange`; nothing here duplicates `DEMO.exchange` by hand.
 */
export default function ExchangeAttribution() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [exchange, setExchange] = useState<Exchange | null>(null)
  const [loading, setLoading] = useState(true)
  const [barsIn, setBarsIn] = useState(false)
  const routeA = useCaseStore((s) => s.routeA)
  const routeB = useCaseStore((s) => s.routeB)
  const setTraceResult = useCaseStore((s) => s.setTraceResult)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setBarsIn(false)
    api.getExchange(id).then((data) => {
      if (cancelled) return
      setExchange(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    // Same direct-load/refresh guard as RouteChoice/Evidence -- `routeA` (which carries the
    // real `innocence` payload, per httpApi.ts's `toRoute()`) may not be in the store yet if
    // this screen is opened without walking through Route Choice first. `getRoutes` is cached
    // per case id, so this is a no-op when the trace already ran.
    if (!id) return
    if (!routeA || !routeB) {
      api.getRoutes(id).then((result) => setTraceResult(result.routeA, result.routeB))
    }
  }, [id, routeA, routeB, setTraceResult])

  useEffect(() => {
    if (loading) return
    // Two-phase mount (start at 0, then commit to the real width) so the confidence bars
    // grow in rather than snapping straight to their final width — same technique as the
    // Gauge primitive's sweep-in.
    const frame = requestAnimationFrame(() => setBarsIn(true))
    return () => cancelAnimationFrame(frame)
  }, [loading])

  if (!id) return <Navigate to={ROUTES.dashboard} replace />

  if (loading || !exchange) {
    return (
      <Card className="mx-auto my-16 flex max-w-[420px] flex-col items-center gap-4 p-8 text-center text-muted-foreground">
        <Spinner percent={70} label="Loading" />
        <p>Loading exchange attribution…</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
          The money reached a cryptocurrency exchange.
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          This is where a real, named person exists — exchanges are legally required to verify identity.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="relative flex flex-col gap-5 overflow-hidden p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gold" aria-hidden />

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

          <div className="grid grid-cols-3 gap-3.5">
            <Stat label="Registered in" value={exchange.jurisdiction} icon={<Globe size={16} />} iconColor="sky" />
            <Stat
              label="FIU-IND registered"
              value={exchange.fiuRegistered ? 'YES' : 'NO'}
              icon={<ShieldCheck size={16} />}
              iconColor={exchange.fiuRegistered ? 'moss' : 'vermillion'}
            />
            <Stat label="Indian users" value={exchange.indianUsers} icon={<Users size={16} />} iconColor="gold" />
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
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
            How we know
          </h3>
          <div className="flex flex-col divide-y divide-border">
            {exchange.evidence.map((item) => (
              <div key={item.label} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
                <CheckCircle2 size={16} className="shrink-0 text-moss" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground/90">{item.label}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gold transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]"
                      style={{ width: barsIn ? `${item.conf * 100}%` : 0 }}
                    />
                  </div>
                </div>
                <span className="w-11 shrink-0 text-right font-[family-name:var(--font-mono)] text-sm font-bold text-foreground">
                  {Math.round(item.conf * 100)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {routeA?.innocence && (
        <Card className="flex flex-col gap-5 p-6">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
              Could this wallet be innocent?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Every risk factor elsewhere in ANVESHAK accuses. This is the only check that can say &ldquo;not this
              one&rdquo; — shown with equal weight, not buried.
            </p>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-2">
              <Gauge
                value={routeA.innocence.innocenceScore}
                size={180}
                colourStops={['var(--color-vermillion)', 'var(--color-gold)', 'var(--color-moss)']}
              />
              <span className="text-xs text-muted-foreground">Innocence score</span>
            </div>

            <div className="flex flex-col divide-y divide-border">
              {routeA.innocence.factors.map((factor) => (
                <div key={factor.check} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                  {factor.supportsInnocence ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-moss" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 shrink-0 text-vermillion" />
                  )}
                  <p className="min-w-0 flex-1 text-sm text-foreground/90">{factor.description}</p>
                  <span
                    className={cn(
                      'shrink-0 font-[family-name:var(--font-mono)] text-xs font-bold',
                      factor.supportsInnocence ? 'text-moss' : 'text-vermillion',
                    )}
                  >
                    {factor.supportsInnocence ? '+' : '−'}
                    {factor.weight.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <PlainWords>Think of it as tracing stolen cash to the counter of a specific bank branch.</PlainWords>

      <div className="flex justify-end">
        <Button variant="default" onClick={() => navigate(ROUTES.risk(id))}>
          Calculate the risk score
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
