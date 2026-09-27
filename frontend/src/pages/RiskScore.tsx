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
import { getRiskScore, type RiskScoreOut } from '../api/httpApi'
import type { RiskBand } from '../types'
import { ROUTES } from '../utils/constants'

/** Risk-band → Badge colour variant. A distinct axis from the entity-type COLOUR_SEMANTICS
 * map (utils/constants.ts), so it's kept local rather than routed through that map (which
 * would silently double-assign meaning to `gold`). */
const BAND_VARIANT: Record<RiskBand, 'vermillion' | 'gold' | 'moss'> = {
  HIGH: 'vermillion',
  MEDIUM: 'gold',
  LOW: 'moss',
}

/** The real `GET /api/v1/cases/{id}/score` response (`RiskScoreOut`, `api/httpApi.ts`) has no
 * band field at all any more -- only `ruleBasedScore`/`mlScore`/`combinedScore` numbers. This is
 * a purely local display bucketing of `combinedScore` for the badge, matching the gauge's own
 * moss/gold/vermillion colour stops (`components/ui/gauge.tsx`), never a value the backend
 * asserts. */
function bandForScore(score: number): RiskBand {
  if (score >= 0.66) return 'HIGH'
  if (score >= 0.33) return 'MEDIUM'
  return 'LOW'
}

interface FactorBarProps {
  label: string
  value: number
  max: number
  barsIn: boolean
  colorClass: string
  textClass: string
}

/** One contribution bar -- shared by the rule-based breakdown and the ML SHAP breakdown, since
 * both are label→number dicts rendered the same way (bar width scaled to the largest magnitude
 * in that dict, the signed value printed alongside). Adapted from this screen's old mock-data
 * `risk.factors` bar markup, which only ever had non-negative weights and a fixed plain/tech
 * label pair; neither real breakdown dict has that pair, and SHAP values can be negative, so
 * this reads a raw factor/feature name as the single label and signs the printed value instead
 * of hard-coding a "+" like the old markup did. */
function FactorBar({ label, value, max, barsIn, colorClass, textClass }: FactorBarProps) {
  const width = Math.min(1, Math.abs(value) / max) * 100
  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-[220px_1fr_72px] xl:items-center xl:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${colorClass} transition-[width] duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)]`}
          style={{ width: barsIn ? `${width}%` : 0 }}
        />
      </div>
      <span
        className={`justify-self-start font-[family-name:var(--font-mono)] text-sm font-bold ${textClass} xl:justify-self-end xl:text-right`}
      >
        {value >= 0 ? '+' : ''}
        {value.toFixed(2)}
      </span>
    </div>
  )
}

/**
 * Screen 5 — the strongest technical differentiator per the source spec. Reads the real
 * `GET /api/v1/cases/{id}/score` response (`getRiskScore`, `api/httpApi.ts`) directly, bypassing
 * the mock/real `api` switch entirely -- this endpoint has no mock counterpart and no
 * `require_role` dependency (see that function's own doc comment), matching the
 * real-backend-only pattern `FlaggedWallets.tsx`/`VaspReplies.tsx` established for other screens
 * that only exist against the live backend today.
 */
export default function RiskScore() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [risk, setRisk] = useState<RiskScoreOut | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [barsIn, setBarsIn] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setRisk(null)
    setError(null)
    setBarsIn(false)
    getRiskScore(id)
      .then((data) => {
        if (cancelled) return
        setRisk(data)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not calculate the risk score for this case. Try again in a moment.')
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!risk) return
    // Same two-phase mount trick as the Gauge primitive itself, so the contribution bars grow
    // in alongside the gauge's sweep instead of appearing pre-filled.
    const frame = requestAnimationFrame(() => setBarsIn(true))
    return () => cancelAnimationFrame(frame)
  }, [risk])

  if (!id) return <Navigate to={ROUTES.dashboard} replace />

  if (error) {
    return (
      <Card className="mx-auto my-16 max-w-[480px] border-destructive/40 bg-destructive/5 p-8 text-center text-sm font-medium text-destructive">
        {error}
      </Card>
    )
  }

  if (!risk) {
    return (
      <Card className="mx-auto my-16 flex max-w-[420px] flex-col items-center gap-4 p-8 text-center text-muted-foreground">
        <Spinner percent={70} label="Loading" />
        <p>Calculating risk score…</p>
      </Card>
    )
  }

  const band = bandForScore(risk.combinedScore)
  const ruleFactors = Object.entries(risk.ruleBasedScore.breakdown)
  const maxRuleWeight = Math.max(0.01, ...ruleFactors.map(([, w]) => Math.abs(w)))
  const shapFactors = risk.mlScore ? Object.entries(risk.mlScore.shapBreakdown) : []
  const maxShap = Math.max(0.01, ...shapFactors.map(([, v]) => Math.abs(v)))

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
          How risky is this wallet?
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Every contributing factor is shown below — nothing about this score is a black box.
        </p>
        <p className="mt-1 break-all font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
          {risk.walletAddress} · {risk.chain}
        </p>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="flex flex-col items-center justify-center gap-5 p-6 text-center">
          <Gauge value={risk.combinedScore} size={300} />
          <Badge variant={BAND_VARIANT[band]} className="px-4 py-1.5 text-sm">
            {band} RISK
          </Badge>
          <p className="max-w-[260px] text-xs text-muted-foreground">
            Combined score — confidence that these funds are criminal proceeds.
          </p>
        </Card>

        <Card className="flex flex-col gap-5 p-6">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
            Rule-based score: {risk.ruleBasedScore.score.toFixed(2)}
          </h3>
          <p className="text-xs text-muted-foreground">{risk.ruleBasedScore.reasoning}</p>
          <div className="flex flex-col gap-5">
            {ruleFactors.map(([factor, weight]) => (
              <FactorBar
                key={factor}
                label={factor}
                value={weight}
                max={maxRuleWeight}
                barsIn={barsIn}
                colorClass="bg-vermillion"
                textClass="text-vermillion"
              />
            ))}
          </div>
        </Card>
      </div>

      <Card className="flex flex-col gap-5 p-6">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
          Machine-learning score
        </h3>
        {risk.mlScore ? (
          <>
            <p className="text-sm text-foreground">
              <span className="font-[family-name:var(--font-mono)] font-bold text-foreground">
                {risk.mlScore.score.toFixed(2)}
              </span>{' '}
              — SHAP contributions per feature (positive pushes the score up, negative pulls it down):
            </p>
            <div className="flex flex-col gap-5">
              {shapFactors.map(([feature, value]) => (
                <FactorBar
                  key={feature}
                  label={feature}
                  value={value}
                  max={maxShap}
                  barsIn={barsIn}
                  colorClass={value >= 0 ? 'bg-vermillion' : 'bg-teal'}
                  textClass={value >= 0 ? 'text-vermillion' : 'text-teal'}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Not enough data for the ML layer yet.</p>
            <ul className="list-inside list-disc">
              {risk.dataQualityReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Mandatory whenever an ML score is present -- CLAUDE.md rule 5 ("legal text is a draft,
          never presented as auto-generated legal advice") extends to this project's synthetic-
          data disclosure being treated with the same seriousness as a correctness bug, so this
          is rendered plainly in the page body, never behind a tooltip. */}
      {risk.mlScore && <Well className="text-sm text-muted-foreground">{risk.syntheticDataDisclosure}</Well>}

      <Well className="text-sm text-muted-foreground">
        Every number above is shown to the officer. Nothing is a black box — a court can be told exactly why this
        wallet was flagged.
      </Well>

      <PlainWords>
        {risk.combinedScore.toFixed(2)} out of 1, combining the rule-based score with the ML score when there's
        enough data to run it. Every reason behind both is shown above — there is nothing hidden.
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
