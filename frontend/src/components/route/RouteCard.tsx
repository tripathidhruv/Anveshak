import { ChevronDown, ChevronUp, Copy } from 'lucide-react'
import clsx from 'clsx'
import { Badge } from '../ui'
import type { Route, Hop } from '../../types'
import type { SemanticColour } from '../../utils/constants'
import { formatINR, truncateAddress } from '../../utils/format'
import styles from './RouteCard.module.css'

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
  if (isBridgeNode(hop)) return 'var(--violet)'
  if (hop.flag === 'EXCHANGE') return 'var(--gold)'
  const chain = hop.chain ?? route.chain ?? route.chainFrom
  if (chain === 'Ethereum') return 'var(--sky)'
  return 'var(--teal)'
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
            stroke="var(--shadow-dark)"
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
              <text x={cx} y={cy + 20} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--violet)">
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
    <div className={styles.card} data-expanded={expanded} onClick={onToggle}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title} data-accent={accent}>
            {routeLabel} · {route.label}
          </div>
        </div>
        {expanded ? <ChevronUp size={18} className={styles.chevron} /> : <ChevronDown size={18} className={styles.chevron} />}
      </div>

      {!expanded && (
        <div className={styles.chainWell}>
          <MiniChain route={route} />
        </div>
      )}

      <div className={styles.stats}>
        <span className={styles.statValue}>{formatINR(route.valueINR)}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.statValueCrypto}>
          {cryptoFormatter.format(route.valueCrypto)} {assetShort}
        </span>
        <span className={styles.dot}>·</span>
        <span>{chainDescription}</span>
        <span className={styles.dot}>·</span>
        <span>{route.hops} hops</span>
        <span className={styles.dot}>·</span>
        <span>{route.durationMin} minutes</span>
      </div>

      <div className={styles.badgeRow}>
        <Badge colour={badgeColour}>{badgeText}</Badge>
      </div>

      {expanded && (
        <div className={styles.timeline}>
          {route.trail.map((hop, i) => {
            const isSwept = hop.flag === 'SWEPT'
            const isExchange = hop.flag === 'EXCHANGE'
            return (
              <div className={styles.hopRow} key={hop.n}>
                <div className={styles.railCol}>
                  <span className={styles.hopNumber}>{hop.n}</span>
                  {i < route.trail.length - 1 && <span className={styles.railLine} />}
                </div>
                <div
                  className={clsx(styles.hopBody, isSwept && styles.sweptBody, isExchange && styles.exchangeBody)}
                >
                  <div className={styles.hopMain}>
                    <button
                      type="button"
                      className={styles.hopAddress}
                      title={hop.addr}
                      onClick={(e) => {
                        e.stopPropagation()
                        onCopyAddress(hop.addr)
                      }}
                    >
                      {truncateAddress(hop.addr)}
                      <Copy size={12} />
                    </button>
                    <span className={styles.hopRole}>{hop.role}</span>
                    {hop.flag && !isSwept && <Badge colour={hopFlagColour(hop.flag)}>{hop.flag}</Badge>}
                  </div>
                  <div className={styles.hopMeta}>
                    <span className="mono">
                      {cryptoFormatter.format(hop.amt)} {assetShort}
                    </span>
                    <span className="mono">{hop.at}</span>
                    {isSwept && hop.gapSec != null && (
                      <span className={styles.sweepNote}>
                        ▲ {hop.gapSec}s later · ⚠ SWEPT
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
