import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useSize } from './charts'
import { type Tone, toneA, toneHex } from './tone'

export type FlowNode = {
  id: string
  /** column index, 0 = leftmost */
  col: number
  /** vertical position 0..1 inside the column; omit to auto-distribute */
  y?: number
  title: React.ReactNode
  sub?: React.ReactNode
  tone: Tone
  icon?: React.ReactNode
  badge?: React.ReactNode
  /** pulsing live marker */
  live?: boolean
  /** dashed outline (unconfirmed / predicted) */
  ghost?: boolean
  width?: number
}

export type FlowEdge = {
  from: string
  to: string
  tone?: Tone
  /** 0..1 relative strand thickness */
  weight?: number
  dashed?: boolean
  /** animated money-moving dashes */
  animated?: boolean
  label?: React.ReactNode
}

/**
 * Layered relationship graph with glowing Bézier strands — KAIZEN's signature visual.
 * Nodes are HTML cards absolutely positioned over an SVG strand layer.
 */
export function FlowGraph({
  nodes,
  edges,
  height = 420,
  nodeWidth = 176,
  nodeHeight = 58,
  selected,
  onSelect,
  highlight,
  className,
  padX = 8,
}: {
  nodes: FlowNode[]
  edges: FlowEdge[]
  height?: number
  nodeWidth?: number
  nodeHeight?: number
  selected?: string | null
  onSelect?: (id: string) => void
  /** ids to keep bright; everything else dims */
  highlight?: Set<string> | null
  className?: string
  padX?: number
}) {
  const [ref, { width }] = useSize<HTMLDivElement>()
  const [hover, setHover] = React.useState<string | null>(null)
  const uid = React.useId().replace(/:/g, '')

  const cols = Math.max(...nodes.map((n) => n.col)) + 1
  const pos = React.useMemo(() => {
    const out: Record<string, { x: number; y: number; w: number }> = {}
    const byCol: Record<number, FlowNode[]> = {}
    nodes.forEach((n) => (byCol[n.col] ||= []).push(n))
    const usable = Math.max(0, width - padX * 2)
    // column width = widest node in it; shrink proportionally so columns keep a 28px strand gap
    const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...(byCol[c] ?? []).map((n) => n.width ?? nodeWidth)))
    const scale = Math.min(1, (usable - (cols - 1) * 28) / Math.max(1, colW.reduce((a, b) => a + b, 0)))
    const scaled = colW.map((w) => Math.max(96, w * scale))
    const gap = cols > 1 ? (usable - scaled.reduce((a, b) => a + b, 0)) / (cols - 1) : 0
    const left = scaled.map((_, c) => scaled.slice(0, c).reduce((a, b) => a + b, 0) + gap * c)
    Object.entries(byCol).forEach(([c, list]) => {
      const ci = Number(c)
      list.forEach((n, i) => {
        const w = Math.max(96, (n.width ?? nodeWidth) * scale)
        const x = padX + (cols === 1 ? (usable - w) / 2 : left[ci] + (scaled[ci] - w) / 2)
        const fy = n.y ?? (list.length === 1 ? 0.5 : (i + 0.5) / list.length)
        const y = 6 + fy * (height - 12 - nodeHeight)
        out[n.id] = { x, y, w }
      })
    })
    return out
  }, [nodes, width, height, nodeWidth, nodeHeight, cols, padX])

  // per-node fan offsets so strands leaving/entering one card spread like a bundle
  const fan = React.useMemo(() => {
    const outs: Record<string, FlowEdge[]> = {}
    const ins: Record<string, FlowEdge[]> = {}
    edges.forEach((e) => {
      ;(outs[e.from] ||= []).push(e)
      ;(ins[e.to] ||= []).push(e)
    })
    const sortY = (id: string) => pos[id]?.y ?? 0
    Object.values(outs).forEach((l) => l.sort((a, b) => sortY(a.to) - sortY(b.to)))
    Object.values(ins).forEach((l) => l.sort((a, b) => sortY(a.from) - sortY(b.from)))
    return { outs, ins }
  }, [edges, pos])

  const nodeMap = React.useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const active = hover
  const connected = React.useMemo(() => {
    if (!active) return null
    const s = new Set([active])
    edges.forEach((e) => {
      if (e.from === active) s.add(e.to)
      if (e.to === active) s.add(e.from)
    })
    return s
  }, [active, edges])
  const lit = (id: string) => (highlight ? highlight.has(id) : connected ? connected.has(id) : true)
  const edgeLit = (e: FlowEdge) =>
    highlight ? highlight.has(e.from) && highlight.has(e.to) : active ? e.from === active || e.to === active : true

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="absolute inset-0 overflow-visible">
          <defs>
            {edges.map((e, i) => {
              const a = nodeMap[e.from]
              const b = nodeMap[e.to]
              if (!a || !b) return null
              return (
                <linearGradient key={i} id={`fg${uid}${i}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={toneHex(e.tone ?? a.tone)} />
                  <stop offset="100%" stopColor={toneHex(e.tone ?? b.tone)} />
                </linearGradient>
              )
            })}
          </defs>
          {edges.map((e, i) => {
            const pa = pos[e.from]
            const pb = pos[e.to]
            if (!pa || !pb) return null
            const outs = fan.outs[e.from]
            const ins = fan.ins[e.to]
            const oi = outs.indexOf(e)
            const ii = ins.indexOf(e)
            const spread = Math.min(nodeHeight - 18, 30)
            const oy = outs.length > 1 ? (oi / (outs.length - 1) - 0.5) * spread : 0
            const iy = ins.length > 1 ? (ii / (ins.length - 1) - 0.5) * spread : 0
            const x1 = pa.x + pa.w
            const y1 = pa.y + nodeHeight / 2 + oy
            const x2 = pb.x
            const y2 = pb.y + nodeHeight / 2 + iy
            const back = x2 < x1
            const dx = back ? 80 : Math.max(40, (x2 - x1) * 0.5)
            const d = back
              ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
              : `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
            const w = 1.4 + (e.weight ?? 0.5) * 3.2
            const on = edgeLit(e)
            return (
              <g key={i} style={{ opacity: on ? 1 : 0.12, transition: 'opacity .3s' }}>
                <path d={d} fill="none" stroke={`url(#fg${uid}${i})`} strokeWidth={w + 6} opacity={0.22} style={{ filter: 'blur(5px)' }} />
                <motion.path
                  d={d}
                  fill="none"
                  stroke={`url(#fg${uid}${i})`}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeDasharray={e.dashed ? '5 6' : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{ duration: 1.1, delay: 0.15 + (nodeMap[e.from]?.col ?? 0) * 0.18, ease: [0.3, 0.7, 0.2, 1] }}
                />
                {e.animated && on && (
                  <path d={d} fill="none" stroke="#fff" strokeOpacity={0.75} strokeWidth={Math.max(1, w * 0.45)} className="k-flow-dash" strokeLinecap="round" />
                )}
                {e.label && (
                  <foreignObject x={(x1 + x2) / 2 - 50} y={(y1 + y2) / 2 - 11} width={100} height={22} style={{ overflow: 'visible' }}>
                    <div className="flex justify-center">
                      <span className="rounded-full border border-line-2 bg-[#141415]/95 px-1.5 py-px text-[11px] whitespace-nowrap text-muted">{e.label}</span>
                    </div>
                  </foreignObject>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {width > 0 &&
        nodes.map((n, i) => {
          const p = pos[n.id]
          if (!p) return null
          const isSel = selected === n.id
          const on = lit(n.id)
          return (
            <motion.button
              type="button"
              key={n.id}
              onClick={() => onSelect?.(n.id)}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: on ? 1 : 0.3, x: 0 }}
              transition={{ duration: 0.45, delay: n.col * 0.12 + i * 0.015 }}
              className={cn(
                'absolute flex items-center gap-2.5 rounded-[12px] px-2.5 text-left outline-none',
                n.ghost ? 'border border-dashed' : 'border',
              )}
              style={{
                left: p.x,
                top: p.y,
                width: p.w,
                height: nodeHeight,
                background: isSel
                  ? `linear-gradient(180deg, ${toneA(n.tone, 0.16)}, rgba(20,20,21,0.96))`
                  : 'linear-gradient(180deg, rgba(30,30,33,0.96), rgba(18,18,19,0.96))',
                borderColor: isSel ? toneA(n.tone, 0.7) : n.ghost ? toneA(n.tone, 0.45) : 'rgba(255,255,255,0.08)',
                boxShadow: isSel
                  ? `0 0 0 1px ${toneA(n.tone, 0.3)}, 0 0 28px -4px ${toneA(n.tone, 0.55)}`
                  : `inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 24px -14px rgba(0,0,0,0.9)`,
              }}
            >
              <span
                className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full"
                style={{ background: toneHex(n.tone), boxShadow: `0 0 10px ${toneHex(n.tone)}` }}
              />
              {n.icon && (
                <span
                  className="ml-1 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4"
                  style={{ background: toneA(n.tone, 0.12), color: toneHex(n.tone) }}
                >
                  {n.icon}
                </span>
              )}
              <span className={cn('min-w-0 flex-1', !n.icon && 'ml-1.5')}>
                <span className="block truncate text-[13.5px] font-medium text-text">{n.title}</span>
                {n.sub && <span className="block truncate text-[11.5px] text-muted">{n.sub}</span>}
              </span>
              {n.badge && <span className="shrink-0">{n.badge}</span>}
              {n.live && (
                <span className="absolute -right-1 -top-1 inline-flex size-2.5">
                  <span className="k-pulse-ring absolute inset-0 rounded-full" style={{ background: toneHex(n.tone) }} />
                  <span className="relative size-2.5 rounded-full border border-[#111]" style={{ background: toneHex(n.tone) }} />
                </span>
              )}
            </motion.button>
          )
        })}
    </div>
  )
}
