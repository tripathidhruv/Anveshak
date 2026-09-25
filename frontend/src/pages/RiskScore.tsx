import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Gauge } from '@/components/ui/gauge'
import { PlainWords } from '@/components/ui/plain-words'
import { Spinner } from '@/components/ui/spinner'
import { Well } from '@/components/ui/well'
import { api } from '../api'
import type { RiskBand, RiskScore as RiskScoreData } from '../types'
import { ROUTES } from '../utils/constants'

/** Risk-band → Badge colour variant. A distinct axis from the entity-type COLOUR_SEMANTICS
 * map (utils/constants.ts), so it's kept local rather than routed through that map (which
 * would silently double-assign meaning to `gold`). */
const BAND_VARIANT: Record<RiskBand, 'vermillion' | 'gold' | 'moss'> = {
  HIGH: 'vermillion',
  MEDIUM: 'gold',
  LOW: 'moss',
}

/**
 * Screen 5 — the strongest technical differentiator per the source spec. Reads `RiskScore`
 * for the active case id, drives the Gauge primitive to `risk.score`, and renders the five
 * contribution bars from `risk.factors` in order, values untouched from the API payload.
 */
export default function RiskScore() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [risk, setRisk] = useState<RiskScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [barsIn, setBarsIn] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setBarsIn(false)
    api.getRisk(id).then((data) => {
      if (cancelled) return
      setRisk(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (loading) return
    // Same two-phase mount trick as the Gauge primitive itself, so the five contribution
    // bars grow in alongside the gauge's sweep instead of appearing pre-filled.
    const frame = requestAnimationFrame(() => setBarsIn(true))
    return () => cancelAnimationFrame(frame)
  }, [loading])

  if (!id) return <Navigate to={ROUTES.dashboard} replace />

  if (loading || !risk) {
    return (
      <Card className="mx-auto my-16 flex max-w-[420px] flex-col items-center gap-4 p-8 text-center text-muted-foreground">
        <Spinner percent={70} label="Loading" />
        <p>Calculating risk score…</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
          How risky is this wallet?
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Every contributing factor is shown below — nothing about this score is a black box.
        </p>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="flex flex-col items-center justify-center gap-5 p-6 text-center">
          <Gauge value={risk.score} size={300} />
          <Badge variant={BAND_VARIANT[risk.band]} className="px-4 py-1.5 text-sm">
            {risk.band} RISK
          </Badge>
          <p className="max-w-[260px] text-xs text-muted-foreground">
            Confidence that these funds are criminal proceeds.
          </p>
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
            What drove this score
          </h3>
          <div className="flex flex-col gap-5">
            {risk.factors.map((factor) => (
              <div
                key={factor.plain}
                className="grid grid-cols-1 gap-2 xl:grid-cols-[220px_1fr_64px] xl:items-center xl:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{factor.plain}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{factor.tech}</p>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-vermillion transition-[width] duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)]"
                    style={{ width: barsIn ? `${factor.w * 100}%` : 0 }}
                  />
                </div>
                <span className="justify-self-start font-[family-name:var(--font-mono)] text-sm font-bold text-vermillion xl:justify-self-end xl:text-right">
                  +{factor.w.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Well className="text-sm text-muted-foreground">
        Every number above is shown to the officer. Nothing is a black box — a court can be told exactly why this
        wallet was flagged.
      </Well>

      <PlainWords>
        {risk.score.toFixed(2)} out of 1. The five reasons below are the whole calculation — there is nothing
        hidden.
      </PlainWords>

      <div className="flex justify-end">
        <Button variant="default" onClick={() => navigate(ROUTES.evidence(id))}>
          Build the evidence pack
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
