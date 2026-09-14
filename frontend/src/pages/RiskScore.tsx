import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import { Badge, Button, Card, Gauge, PlainWords, Spinner, Well } from '../components/ui'
import { api } from '../api'
import type { RiskBand, RiskScore as RiskScoreData } from '../types'
import { ROUTES } from '../utils/constants'
import styles from './RiskScore.module.css'

/** Severity colour for the risk-band pill — a distinct axis from the entity-type
 * COLOUR_SEMANTICS map (utils/constants.ts), so it's kept local rather than routed through
 * that map (which would silently double-assign meaning to `gold`). */
const BAND_COLOUR: Record<RiskBand, string> = {
  HIGH: 'var(--vermillion)',
  MEDIUM: 'var(--gold)',
  LOW: 'var(--moss)',
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
      <Card className={styles.loadingCard}>
        <Spinner percent={70} label="Loading" />
        <p>Calculating risk score…</p>
      </Card>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="page-title">How risky is this wallet?</h1>
        <p className={styles.subtitle}>
          Every contributing factor is shown below — nothing about this score is a black box.
        </p>
      </header>

      <div className={styles.grid}>
        <Card className={styles.gaugeCard}>
          <div className={styles.gaugeWell}>
            <Gauge value={risk.score} size={300} />
          </div>
          <Badge className={styles.riskPill} style={{ ['--badge-colour' as string]: BAND_COLOUR[risk.band] } as CSSProperties}>
            {risk.band} RISK
          </Badge>
          <p className={styles.gaugeCaption}>Confidence that these funds are criminal proceeds.</p>
        </Card>

        <Card className={styles.factorsCard}>
          <h3 className="card-title">What drove this score</h3>
          <div className={styles.factorList}>
            {risk.factors.map((factor) => (
              <div key={factor.plain} className={styles.factorRow}>
                <div className={styles.factorLabels}>
                  <p className={styles.factorPlain}>{factor.plain}</p>
                  <p className={styles.factorTech}>{factor.tech}</p>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: barsIn ? `${factor.w * 100}%` : 0 }} />
                </div>
                <span className={clsx('mono', styles.factorValue)}>+{factor.w.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Well className={styles.footnote}>
        Every number above is shown to the officer. Nothing is a black box — a court can be told exactly why this
        wallet was flagged.
      </Well>

      <PlainWords>
        {risk.score.toFixed(2)} out of 1. The five reasons below are the whole calculation — there is nothing
        hidden.
      </PlainWords>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => navigate(ROUTES.evidence(id))}>
          Build the evidence pack
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
