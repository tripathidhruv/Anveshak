import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useSize } from './charts'
import { type Tone, toneA, toneHex } from './tone'

export type SankeyNode = { id: string; label: React.ReactNode; value: number; sub?: React.ReactNode; tone?: Tone; icon?: React.ReactNode }
export type SankeyLink = { from: string; to: string; value: number; tone?: Tone }

/**
 * Column Sankey with grayscale ribbons and optional accent ribbons (Vaulto "Total Assets").
 * Ribbon thickness is proportional to value on both ends.
 */
export function Sankey({
  columns,
  links,
  height = 220,
  nodeWidth = 64,
  gap = 14,
  className,
}: {
  columns: SankeyNode[][]
  links: SankeyLink[]
  height?: number
  nodeWidth?: number
  gap?: number
  className?: string
}) {
  const [ref, { width }] = useSize<HTMLDivElement>()
  const uid = React.useId().replace(/:/g, '')
  const [hover, setHover] = React.useState<string | null>(null)

  const layout = React.useMemo(() => {
    const k = Math.min(
      ...columns.map((col) => (height - gap * (col.length - 1)) / col.reduce((a, n) => a + n.value, 0)),
    )
    const nodes: Record<string, { x: number; y: number; h: number; n: SankeyNode; col: number }> = {}
    columns.forEach((col, ci) => {
      const total = col.reduce((a, n) => a + n.value * k, 0) + gap * (col.length - 1)
      let y = (height - total) / 2
      const x = columns.length === 1 ? 0 : (ci / (columns.length - 1)) * (width - nodeWidth)
      col.forEach((n) => {
        const h = n.value * k
        nodes[n.id] = { x, y, h, n, col: ci }
        y += h + gap
      })
    })
    const outOff: Record<string, number> = {}
    const inOff: Record<string, number> = {}
    const sorted = [...links].sort((a, b) => (nodes[a.to]?.y ?? 0) - (nodes[b.to]?.y ?? 0))
    const bands = sorted.map((l) => {
      const a = nodes[l.from]
      const b = nodes[l.to]
      const t = l.value * k
      const y0 = a.y + (outOff[l.from] ?? 0)
      outOff[l.from] = (outOff[l.from] ?? 0) + t
      return { l, a, b, t, y0 }
    })
    const sortedIn = [...bands].sort((p, q) => p.a.y - q.a.y)
    const y1map = new Map<SankeyLink, number>()
    sortedIn.forEach((bd) => {
      const y1 = bd.b.y + (inOff[bd.l.to] ?? 0)
      inOff[bd.l.to] = (inOff[bd.l.to] ?? 0) + bd.t
      y1map.set(bd.l, y1)
    })
    return { nodes, bands: bands.map((bd) => ({ ...bd, y1: y1map.get(bd.l)! })) }
  }, [columns, links, height, width, nodeWidth, gap])

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
            const x0 = bd.a.x + nodeWidth
            const x1 = bd.b.x
            const mx = (x0 + x1) / 2
            const d = `M${x0},${bd.y0} C${mx},${bd.y0} ${mx},${bd.y1} ${x1},${bd.y1} L${x1},${bd.y1 + bd.t} C${mx},${bd.y1 + bd.t} ${mx},${bd.y0 + bd.t} ${x0},${bd.y0 + bd.t} Z`
            const on = !hover || hover === bd.l.from || hover === bd.l.to
            return (
              <motion.path
                key={i}
                d={d}
                fill={`url(#sk${uid}${i})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: on ? 1 : 0.25 }}
                transition={{ duration: 0.6, delay: hover ? 0 : 0.2 + i * 0.05 }}
              />
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
            className="absolute flex flex-col justify-between overflow-hidden rounded-[10px] border px-2 py-1.5"
            style={{
              left: x,
              top: y,
              width: nodeWidth,
              height: Math.max(h, 30),
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
            {h > 44 && n.sub && <div className="k-num truncate text-[12.5px] text-white/80">{n.sub}</div>}
          </div>
        ))}
    </div>
  )
}
