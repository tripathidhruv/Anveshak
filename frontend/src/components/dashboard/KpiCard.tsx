import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card } from '../ui/card'
import { IconTile } from '../ui/icon-tile'
import { Badge } from '../ui/badge'
import { useCountUp } from '../../hooks/useCountUp'
import type { DashboardKpi } from '../../types'

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

/** One KPI tile: colored icon tile, uppercase label, count-up number, delta badge, decorative sparkline. */
export function KpiCard({ kpi, icon, sparklinePath }: KpiCardProps) {
  const parsed = parseKpiValue(kpi.value)
  const animated = useCountUp(parsed?.number ?? 0)
  const displayValue = parsed
    ? `${parsed.prefix}${animated.toFixed(parsed.decimals)}${parsed.suffix}`
    : kpi.value

  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-3">
        <IconTile color="teal">{icon}</IconTile>
        <Badge variant="moss">
          {kpi.dir === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {kpi.delta}
        </Badge>
      </div>

      <span className="text-sm text-muted-foreground">{kpi.label}</span>
      <span className="font-[family-name:var(--font-mono)] text-3xl font-bold text-foreground">{displayValue}</span>

      <svg className="mt-0.5 h-8 w-full" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
        <path d={sparklinePath} fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </Card>
  )
}
