import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import clsx from 'clsx'
import { useCountUp } from '../../hooks/useCountUp'
import type { DashboardKpi } from '../../types'
import styles from './KpiCard.module.css'

/**
 * Splits a KPI's display string into an animatable numeric core plus static
 * prefix/suffix — e.g. "₹18.4 Cr" -> prefix "₹", number 18.4, suffix " Cr";
 * "41 s" -> number 41, suffix " s". Falls back to a static (non-counting)
 * render if no leading/trailing numeric run is found.
 */
function parseKpiValue(value: string): { prefix: string; number: number; decimals: number; suffix: string } | null {
  const match = value.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/)
  if (!match) return null
  const [, prefix, numeric, suffix] = match
  const cleaned = numeric.replace(/,/g, '')
  const decimals = cleaned.includes('.') ? cleaned.split('.')[1].length : 0
  return { prefix, number: Number(cleaned), decimals, suffix }
}

export interface KpiCardProps {
  kpi: DashboardKpi
  icon: ReactNode
  /** A short, hand-drawn decorative sparkline path (already scaled to the viewBox used below). */
  sparklinePath: string
}

/** One KPI tile: icon tile, uppercase label, count-up number, delta pill, decorative sparkline. */
export function KpiCard({ kpi, icon, sparklinePath }: KpiCardProps) {
  const parsed = parseKpiValue(kpi.value)
  const animated = useCountUp(parsed?.number ?? 0)
  const displayValue = parsed
    ? `${parsed.prefix}${animated.toFixed(parsed.decimals)}${parsed.suffix}`
    : kpi.value

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.iconTile}>{icon}</span>
        <span className={clsx(styles.delta, styles.deltaMoss)}>
          {kpi.dir === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {kpi.delta}
        </span>
      </div>

      <span className={clsx('label', styles.label)}>{kpi.label}</span>
      <span className={clsx('kpi-number', styles.value)}>{displayValue}</span>

      <svg className={styles.sparkline} viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
        <path d={sparklinePath} fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
