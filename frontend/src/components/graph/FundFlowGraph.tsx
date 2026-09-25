import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Landmark, Maximize2, Play, Shuffle, User, Wallet, Waypoints } from 'lucide-react'
import clsx from 'clsx'
import { cn } from '@/lib/utils'
import type { GraphData, GraphNode, GraphNodeKind } from '../../types'
import { GraphLegend } from './GraphLegend'
import { computeLayout, computeRoutePaths } from './graphLayout'
import styles from './FundFlowGraph.module.css'

type RouteFilter = 'both' | 'A' | 'B'

/** How much a wheel tick moves the zoom level. 1 = the calibrated default; the earlier
 * Cytoscape `wheelSensitivity` needed ~50 ticks to see anything, which was the actual bug
 * being fixed here, not a matter of taste. */
const ZOOM_SENSITIVITY = 1
const MIN_SCALE = 0.4
const MAX_SCALE = 2.5

const KIND_ICON: Record<GraphNodeKind, typeof User> = {
  victim: User,
  scammer: Wallet,
  wallet: Wallet,
  hub: Wallet,
  bridge: Shuffle,
  exchange: Landmark,
}

const NODE_SIZE: Record<GraphNodeKind, number> = {
  victim: 60,
  scammer: 60,
  wallet: 60,
  bridge: 70,
  hub: 82,
  exchange: 88,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export interface FundFlowGraphProps {
  graph: GraphData
  onSelectNode: (node: GraphNode | null) => void
}

/** The Evidence screen's fund-flow graph — hand-rolled SVG (edges) + positioned DOM (node
 * badges) instead of a Cytoscape canvas, so nodes can use real CSS (gradients, glow, hover,
 * a gentle floating idle animation) that a canvas-rendered graph can't give them. Layout,
 * route-path membership, and zoom/pan all live in this file/graphLayout.ts now that there's no
 * Cytoscape instance to own that state. */
export function FundFlowGraph({ graph, onSelectNode }: FundFlowGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('both')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [animating, setAnimating] = useState(
    () => !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  )
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef<{ startClientX: number; startClientY: number; startViewX: number; startViewY: number } | null>(null)

  const layout = useMemo(() => computeLayout(graph), [graph])
  const routePaths = useMemo(() => computeRoutePaths(graph), [graph])
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph])

  const activePath = routeFilter === 'both' ? null : routePaths.find((p) => p.key === routeFilter) ?? null

  function fit() {
    const container = containerRef.current
    if (!container) return
    const { clientWidth, clientHeight } = container
    const scale = clamp(Math.min(clientWidth / layout.width, clientHeight / layout.height) * 0.9, MIN_SCALE, MAX_SCALE)
    setView({
      x: (clientWidth - layout.width * scale) / 2,
      y: (clientHeight - layout.height * scale) / 2,
      scale,
    })
  }

  // Fit whenever a new graph/layout arrives (mirrors the old `layout: { fit: true }` option).
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fit only when the graph itself changes
  }, [graph])

  // Native (non-React) wheel listener: React attaches `onWheel` as a passive listener, so
  // `preventDefault()` inside a JSX handler silently fails to stop the page/frame from
  // scrolling underneath the zoom. `{ passive: false }` here is the only way to actually own
  // the wheel gesture.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = container!.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0018 * ZOOM_SENSITIVITY)
        const nextScale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
        const worldX = (cursorX - v.x) / v.scale
        const worldY = (cursorY - v.y) / v.scale
        return { scale: nextScale, x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale }
      })
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  function handleBackgroundPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    setIsPanning(true)
    panRef.current = { startClientX: e.clientX, startClientY: e.clientY, startViewX: view.x, startViewY: view.y }
    setSelectedId(null)
    onSelectNode(null)
  }

  useEffect(() => {
    if (!isPanning) return
    function onMove(e: PointerEvent) {
      const start = panRef.current
      if (!start) return
      setView((v) => ({ ...v, x: start.startViewX + (e.clientX - start.startClientX), y: start.startViewY + (e.clientY - start.startClientY) }))
    }
    function onUp() {
      setIsPanning(false)
      panRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isPanning])

  function selectNode(node: GraphNode) {
    setSelectedId(node.id)
    onSelectNode(node)
  }

  const worldStyle: CSSProperties = {
    width: layout.width,
    height: layout.height,
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    transition: isPanning ? 'none' : 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
  }

  return (
    <div className={styles.wrapper}>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={fit}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-[13px] font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <Maximize2 size={13} />
          Fit
        </button>

        <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Filter by route">
          {(
            [
              { key: 'A' as const, label: 'Show Route A' },
              { key: 'B' as const, label: 'Show Route B' },
              { key: 'both' as const, label: 'Show both' },
            ]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={routeFilter === opt.key}
              onClick={() => setRouteFilter(opt.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                routeFilter === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={animating}
          onClick={() => setAnimating((v) => !v)}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors',
            animating
              ? 'border-primary/20 bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          <Play size={13} />
          Animate flow
        </button>
      </div>

      <div className={styles.canvasFrame}>
        <div
          ref={containerRef}
          className={styles.canvas}
          role="img"
          aria-label="Fund flow graph"
          onPointerDown={handleBackgroundPointerDown}
          data-panning={isPanning || undefined}
        >
          <div className={styles.world} style={worldStyle}>
            <svg className={styles.edgeLayer} width={layout.width} height={layout.height}>
              <defs>
                <marker id="ffg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 Z" fill="var(--color-indigo)" />
                </marker>
                <marker id="ffg-arrow-criminal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 Z" fill="var(--color-vermillion)" />
                </marker>
                {graph.edges.map((edge) => {
                  const from = layout.positions.get(edge.source)
                  const to = layout.positions.get(edge.target)
                  if (!from || !to) return null
                  return (
                    <linearGradient key={edge.id} id={`ffg-grad-${edge.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} gradientUnits="userSpaceOnUse">
                      <stop offset="0%" style={{ stopColor: `var(--color-${nodeById.get(edge.source)?.accent ?? 'sky'})` }} />
                      <stop offset="100%" style={{ stopColor: `var(--color-${nodeById.get(edge.target)?.accent ?? 'sky'})` }} />
                    </linearGradient>
                  )
                })}
              </defs>
              {graph.edges.map((edge) => {
                const from = layout.positions.get(edge.source)
                const to = layout.positions.get(edge.target)
                if (!from || !to) return null
                const midX = (from.x + to.x) / 2
                const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`
                const dimmed = activePath ? !activePath.edgeIds.has(edge.id) : false
                return (
                  <g key={edge.id} className={clsx(dimmed && styles.dimmed)}>
                    <path
                      d={path}
                      className={clsx(styles.edgePath, edge.criminal && styles.edgeCriminal, edge.criminal && animating && styles.edgeFlowing)}
                      stroke={edge.criminal ? 'var(--color-vermillion)' : `url(#ffg-grad-${edge.id})`}
                      markerEnd={edge.criminal ? 'url(#ffg-arrow-criminal)' : 'url(#ffg-arrow)'}
                      fill="none"
                    />
                    <text x={midX} y={(from.y + to.y) / 2 - 8} className={styles.edgeLabel} textAnchor="middle">
                      {new Intl.NumberFormat('en-IN').format(edge.amt)}
                    </text>
                  </g>
                )
              })}
            </svg>

            {graph.nodes.map((node, i) => {
              const pos = layout.positions.get(node.id)
              if (!pos) return null
              const Icon = KIND_ICON[node.kind]
              const size = NODE_SIZE[node.kind]
              const dimmed = activePath ? !activePath.nodeIds.has(node.id) : false
              const nodeStyle: CSSProperties = {
                left: pos.x,
                top: pos.y,
                width: size,
                height: size,
                ['--node-accent' as string]: `var(--color-${node.accent})`,
                ['--float-delay' as string]: `${(i * 0.37) % 2.4}s`,
                ['--float-duration' as string]: `${4.2 + (i % 4) * 0.6}s`,
              }
              return (
                <div
                  key={node.id}
                  className={clsx(styles.nodeWrap, dimmed && styles.dimmed)}
                  style={nodeStyle}
                >
                  <button
                    type="button"
                    className={clsx(
                      styles.node,
                      styles[`shape-${node.kind === 'bridge' ? 'diamond' : node.kind === 'exchange' ? 'hexagon' : 'circle'}`],
                      node.kind === 'hub' && styles.nodeHub,
                      selectedId === node.id && styles.nodeSelected,
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      selectNode(node)
                    }}
                    aria-label={`${node.label} — ${node.sublabel}`}
                  >
                    <Icon size={size * 0.4} color="#fff" strokeWidth={2.25} />
                  </button>
                  <div className={styles.nodeLabel}>
                    <div className={styles.nodeLabelPrimary}>{node.label}</div>
                    <div className={styles.nodeLabelSecondary}>{node.sublabel}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <GraphLegend className={styles.legend} />

          {graph.nodes.length === 0 && (
            <div className={styles.empty}>
              <Waypoints size={22} />
              <span>No graph data.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
