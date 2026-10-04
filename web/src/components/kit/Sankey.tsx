import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useSize } from './charts'
import { type Tone, toneA, toneHex } from './tone'

export type SankeyNode = { id: string; label: React.ReactNode; value: number; sub?: React.ReactNode; tone?: Tone; icon?: React.ReactNode }
export type SankeyLink = { from: string; to: string; value: number; tone?: Tone }

const nodeName = (n: SankeyNode) => (typeof n.label === 'string' ? n.label : n.id)

/** Smallest node that still fits its label and value on two lines. */
const MIN_NODE = 46

/** Scale factor for one column such that Σ max(value·k, MIN_NODE) + gaps fills `avail` exactly. */
function columnScale(col: SankeyNode[], avail: number): number {
  let fixed = new Set<string>()
  let k = avail / col.reduce((a, n) => a + n.value, 0)
  for (let i = 0; i < col.length; i++) {
    const free = col.filter((n) => !fixed.has(n.id))
    k = (avail - fixed.size * MIN_NODE) / Math.max(1e-9, free.reduce((a, n) => a + n.value, 0))
    const next = new Set(col.filter((n) => n.value * k < MIN_NODE).map((n) => n.id))
    if (next.size === fixed.size) break
    fixed = next
  }
  return k
}

/**
 * Column Sankey with grayscale ribbons and optional accent ribbons (Vaulto "Total Assets").
 * Node height is proportional to value, with a floor so small flows stay readable. A ribbon takes
 * the same share of each node it touches as its value is of that node's value, so ribbons always
 * meet node edges exactly (a ribbon into a floored node is a little thicker at that end).
 */
export function Sankey({
  columns,
  links,
  height = 220,
  nodeWidth,
  gap = 12,
  format,
  className,
}: {
  columns: SankeyNode[][]
  links: SankeyLink[]
  height?: number
  /** defaults to a width that fits labels like “Unrecovered” */
  nodeWidth?: number
  gap?: number
  /** formats a ribbon's value for its hover title */
  format?: (v: number) => string
  className?: string
}) {
  const [ref, { width }] = useSize<HTMLDivElement>()
  const uid = React.useId().replace(/:/g, '')
  const [hover, setHover] = React.useState<string | null>(null)
  const nw = nodeWidth ?? Math.round(Math.min(124, Math.max(96, width * 0.21)))

  const layout = React.useMemo(() => {
    const k = Math.min(...columns.map((col) => columnScale(col, height - gap * (col.length - 1))))
    const nodes: Record<string, { x: number; y: number; h: number; n: SankeyNode; col: number }> = {}
    columns.forEach((col, ci) => {
      const hs = col.map((n) => Math.max(n.value * k, MIN_NODE))
      const total = hs.reduce((a, h) => a + h, 0) + gap * (col.length - 1)
      let y = (height - total) / 2
      const x = columns.length === 1 ? 0 : (ci / (columns.length - 1)) * (width - nw)
      col.forEach((n, i) => {
        nodes[n.id] = { x, y, h: hs[i], n, col: ci }
        y += hs[i] + gap
      })
    })
    const share = (id: string, v: number) => (v / nodes[id].n.value) * nodes[id].h
    const outOff: Record<string, number> = {}
    const inOff: Record<string, number> = {}
    // stack ribbons leaving a node in the order of their targets, and arriving in the order of their sources — fewest crossings
    const bands = [...links]
      .filter((l) => nodes[l.from] && nodes[l.to])
      .sort((a, b) => nodes[a.to].y - nodes[b.to].y)
      .map((l) => {
        const t0 = share(l.from, l.value)
        const y0 = nodes[l.from].y + (outOff[l.from] ?? 0)
        outOff[l.from] = (outOff[l.from] ?? 0) + t0
        return { l, a: nodes[l.from], b: nodes[l.to], t0, y0, t1: share(l.to, l.value), y1: 0 }
      })
    ;[...bands]
      .sort((p, q) => p.a.y - q.a.y)
      .forEach((bd) => {
        bd.y1 = bd.b.y + (inOff[bd.l.to] ?? 0)
        inOff[bd.l.to] = (inOff[bd.l.to] ?? 0) + bd.t1
      })
    return { nodes, bands }
  }, [columns, links, height, width, nw, gap])

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0">
          <defs>
            {layout.bands.map((bd, i) => (
              <linearGradient key={i} id={`sk${uid}${i}`} x1="0" x2="1">
                {bd.l.tone ? (
                  <>
                    <stop offset="0%" stopColor={toneA(bd.l.tone, 0.85)} />
                    <stop offset="100%" stopColor={toneA(bd.l.tone, 0.15)} />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.10)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.22)" />
                  </>
                )}
              </linearGradient>
            ))}
          </defs>
          {layout.bands.map((bd, i) => {
            const x0 = bd.a.x + nw
            const x1 = bd.b.x
            const mx = (x0 + x1) / 2
            const d = `M${x0},${bd.y0} C${mx},${bd.y0} ${mx},${bd.y1} ${x1},${bd.y1} L${x1},${bd.y1 + bd.t1} C${mx},${bd.y1 + bd.t1} ${mx},${bd.y0 + bd.t0} ${x0},${bd.y0 + bd.t0} Z`
            const on = !hover || hover === bd.l.from || hover === bd.l.to
            return (
              <motion.path
                key={i}
                d={d}
                fill={`url(#sk${uid}${i})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: on ? 1 : 0.25 }}
                transition={{ duration: 0.6, delay: hover ? 0 : 0.2 + i * 0.05 }}
              >
                <title>{`${nodeName(bd.a.n)} → ${nodeName(bd.b.n)}: ${format ? format(bd.l.value) : bd.l.value}`}</title>
              </motion.path>
            )
          })}
        </svg>
      )}
      {width > 0 &&
        Object.values(layout.nodes).map(({ x, y, h, n }) => (
          <div
            key={n.id}
            onMouseEnter={() => setHover(n.id)}
            onMouseLeave={() => setHover(null)}
            title={typeof n.label === 'string' ? n.label : undefined}
            className="absolute flex flex-col justify-between overflow-hidden rounded-[10px] border px-2.5 py-1.5"
            style={{
              left: x,
              top: y,
              width: nw,
              height: h,
              background: n.tone
                ? `linear-gradient(180deg, ${toneHex(n.tone)}, ${toneA(n.tone, 0.65)})`
                : 'linear-gradient(180deg, #2a2a2d, #1c1c1f)',
              borderColor: n.tone ? toneA(n.tone, 0.8) : 'rgba(255,255,255,0.1)',
              boxShadow: n.tone ? `0 0 24px -4px ${toneA(n.tone, 0.6)}` : 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-1 text-[11.5px] font-medium text-white/90 [&_svg]:size-3">
              {n.icon}
              <span className="truncate">{n.label}</span>
            </div>
            {n.sub && <div className="k-num truncate text-[12.5px] text-white/80">{n.sub}</div>}
          </div>
        ))}
    </div>
  )
}
