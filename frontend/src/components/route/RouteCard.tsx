import { ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '../ui/card'
import { Badge } from '../ui/badge'
import type { Route, Hop } from '../../types'
import { COLOUR_SEMANTICS, type SemanticColour } from '../../utils/constants'
import { formatINR, truncateAddress } from '../../utils/format'

const cryptoFormatter = new Intl.NumberFormat('en-IN')

export interface RouteCardProps {
  routeLabel: string
  route: Route
  accent: 'teal' | 'violet'
  assetShort: string
  badgeText: string
  badgeColour: SemanticColour
  expanded: boolean
  onToggle: () => void
  onCopyAddress: (addr: string) => void
}

function hopFlagColour(flag: string | null): SemanticColour {
  if (!flag) return 'info'
  if (flag === 'EXCHANGE') return 'exchange'
  if (flag.startsWith('BRIDGE')) return 'bridge'
  return 'criminal'
}

function isBridgeNode(hop: Hop): boolean {
  return hop.flag === 'BRIDGE IN' || hop.role === 'Bridge contract'
}

function hopDotColour(hop: Hop, route: Route): string {
  if (isBridgeNode(hop)) return 'var(--color-violet)'
  if (hop.flag === 'EXCHANGE') return 'var(--color-gold)'
  const chain = hop.chain ?? route.chain ?? route.chainFrom
  if (chain === 'Ethereum') return 'var(--color-sky)'
  return 'var(--color-teal)'
}

/** Mini horizontal node-chain diagram — one dot per trail entry, the bridge (if any) as a diamond. */
function MiniChain({ route }: { route: Route }) {
  const trail = route.trail
  const step = 54
  const pad = 20
  const width = (trail.length - 1) * step + pad * 2
  const cy = 22

  return (
    <svg viewBox={`0 0 ${width} 48`} width="100%" height="48" role="img" aria-label="Route hop diagram">
      {trail.slice(1).map((hop, i) => {
        const x1 = pad + i * step
        const x2 = pad + (i + 1) * step
        return (
          <line
            key={`line-${hop.n}`}
            x1={x1}
            y1={cy}
            x2={x2}
            y2={cy}
            stroke="var(--color-border)"
            strokeWidth={2}
          />
        )
      })}
      {trail.map((hop, i) => {
        const cx = pad + i * step
        const colour = hopDotColour(hop, route)
        if (isBridgeNode(hop)) {
          return (
            <g key={hop.n}>
              <rect
                x={cx - 6}
                y={cy - 6}
                width={12}
                height={12}
                fill={colour}
                transform={`rotate(45 ${cx} ${cy})`}
              />
              <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--color-violet)">
                BRIDGE
              </text>
            </g>
          )
        }
        return <circle key={hop.n} cx={cx} cy={cy} r={6.5} fill={colour} />
      })}
    </svg>
  )
}

/** One clickable route-fork card — collapsed shows the mini chain + stats, expanded shows the full hop timeline. */
export function RouteCard({
  routeLabel,
  route,
  accent,
  assetShort,
  badgeText,
  badgeColour,
  expanded,
  onToggle,
  onCopyAddress,
}: RouteCardProps) {
  const chainDescription = route.chainFrom
    ? `${route.chainFrom} → ${route.chainTo}`
    : `Stayed on ${route.chain}`

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col gap-4 p-6 text-left transition-shadow hover:shadow-md',
        expanded && 'shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'text-base font-bold',
            accent === 'teal' ? 'text-teal' : 'text-violet',
          )}
        >
          {routeLabel} · {route.label}
        </div>
        {expanded ? (
          <ChevronUp size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        )}
      </div>

      {!expanded && (
        <div className="rounded-xl bg-muted px-2 py-3">
          <MiniChain route={route} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="font-[family-name:var(--font-mono)] font-semibold text-foreground">
          {formatINR(route.valueINR)}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="font-[family-name:var(--font-mono)] text-xs text-muted-foreground">
          {cryptoFormatter.format(route.valueCrypto)} {assetShort}
        </span>
        <span className="text-muted-foreground">·</span>
        <span>{chainDescription}</span>
        <span className="text-muted-foreground">·</span>
        <span>{route.hops} hops</span>
        <span className="text-muted-foreground">·</span>
        <span>{route.durationMin} minutes</span>
      </div>

      <div className="flex">
        <Badge variant={COLOUR_SEMANTICS[badgeColour]}>{badgeText}</Badge>
      </div>

      {expanded && (
        <div className="flex animate-in flex-col fade-in duration-200">
          {route.trail.map((hop, i) => {
            const isSwept = hop.flag === 'SWEPT'
            const isExchange = hop.flag === 'EXCHANGE'
            return (
              <div className="flex gap-3" key={hop.n}>
                <div className="flex w-7 shrink-0 flex-col items-center">
                  <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border border-border font-[family-name:var(--font-mono)] text-[11px] font-bold text-muted-foreground">
                    {hop.n}
                  </span>
                  {i < route.trail.length - 1 && <span className="my-1 min-h-3.5 w-0.5 flex-1 bg-border" />}
                </div>
                <div
                  className={cn(
                    'mb-2 flex-1 min-w-0 rounded-lg border-b border-border px-2.5 py-1.5',
                    isSwept && 'bg-vermillion/8',
                    isExchange && 'bg-gold/10',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      title={hop.addr}
                      onClick={(e) => {
                        e.stopPropagation()
                        onCopyAddress(hop.addr)
                      }}
                      className="inline-flex items-center gap-1.5 border-none bg-transparent p-0 font-[family-name:var(--font-mono)] text-[13px] text-foreground hover:text-sky"
                    >
                      {truncateAddress(hop.addr)}
                      <Copy size={12} />
                    </button>
                    <span className="text-[13px] text-muted-foreground">{hop.role}</span>
                    {hop.flag && !isSwept && <Badge variant={COLOUR_SEMANTICS[hopFlagColour(hop.flag)]}>{hop.flag}</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-[family-name:var(--font-mono)]">
                      {cryptoFormatter.format(hop.amt)} {assetShort}
                    </span>
                    <span className="font-[family-name:var(--font-mono)]">{hop.at}</span>
                    {isSwept && hop.gapSec != null && (
                      <span className="font-semibold text-vermillion">▲ {hop.gapSec}s later · ⚠ SWEPT</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
