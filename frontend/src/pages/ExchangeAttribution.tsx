import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, PlainWords, Spinner, Well } from '../components/ui'
import { api } from '../api'
import type { Exchange } from '../types'
import { ROUTES } from '../utils/constants'
import { truncateAddress } from '../utils/format'
import styles from './ExchangeAttribution.module.css'

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
      <Card className={styles.loadingCard}>
        <Spinner percent={70} label="Loading" />
        <p>Loading exchange attribution…</p>
      </Card>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="page-title">The money reached a cryptocurrency exchange.</h1>
        <p className={styles.subtitle}>
          This is where a real, named person exists — exchanges are legally required to verify identity.
        </p>
      </header>

      <div className={styles.grid}>
        <Card className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div className={styles.monogram}>{exchange.monogram}</div>
            <div className={styles.heroIdentity}>
              <h2 className={styles.exchangeName}>{exchange.name}</h2>
              <p className={styles.depositAddr}>
                Deposit address: <span className={clsx('mono', styles.depositAddrValue)}>{truncateAddress(exchange.depositAddr)}</span>
              </p>
            </div>
          </div>

          <div className={styles.statRow}>
            <Well className={styles.statWell}>
              <span className="label">Registered in</span>
              <span className={styles.statValue}>{exchange.jurisdiction}</span>
            </Well>
            <Well className={styles.statWell}>
              <span className="label">FIU-IND registered</span>
              <span className={styles.statValue}>{exchange.fiuRegistered ? 'YES' : 'NO'}</span>
            </Well>
            <Well className={styles.statWell}>
              <span className="label">Indian users</span>
              <span className={styles.statValue}>{exchange.indianUsers}</span>
            </Well>
          </div>

          {!exchange.fiuRegistered && (
            <div className={styles.complianceStrip}>
              <span className={styles.complianceIcon}>
                <ShieldAlert size={18} />
              </span>
              <div>
                <p className={styles.complianceHeading}>Not registered with FIU-IND</p>
                <p className={styles.complianceBody}>
                  A registered exchange must respond to Indian law enforcement. This one is not registered, which is
                  itself a finding.
                </p>
              </div>
            </div>
          )}
        </Card>

        <Card className={styles.evidenceCard}>
          <h3 className="card-title">How we know</h3>
          <div className={styles.evidenceList}>
            {exchange.evidence.map((item) => (
              <Well key={item.label} className={styles.evidenceItem}>
                <CheckCircle2 size={16} className={styles.checkIcon} />
                <div className={styles.evidenceBody}>
                  <p className={styles.evidenceLabel}>{item.label}</p>
                  <div className={styles.confTrack}>
                    <div className={styles.confFill} style={{ width: barsIn ? `${item.conf * 100}%` : 0 }} />
                  </div>
                </div>
                <span className={clsx('mono', styles.confValue)}>{Math.round(item.conf * 100)}%</span>
              </Well>
            ))}
          </div>
        </Card>
      </div>

      <PlainWords>Think of it as tracing stolen cash to the counter of a specific bank branch.</PlainWords>

      <div className={styles.actions}>
        <Button variant="primary" onClick={() => navigate(ROUTES.risk(id))}>
          Calculate the risk score
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
