import { useEffect, useMemo, useRef, useState } from 'react'
import type { EventObject } from 'cytoscape'
import { Maximize2, Play, Waypoints } from 'lucide-react'
import clsx from 'clsx'
import { Chip } from '../ui'
import { useCytoscape } from '../../hooks/useCytoscape'
import type { GraphData, GraphNode } from '../../types'
import { GraphLegend } from './GraphLegend'
import { buildElements, buildLayout, computeRoutePaths } from './graphElements'
import { buildStylesheet, resolvePalette } from './graphStyle'
import styles from './FundFlowGraph.module.css'

type RouteFilter = 'both' | 'A' | 'B'

export interface FundFlowGraphProps {
  graph: GraphData
  onSelectNode: (node: GraphNode | null) => void
}

/** The Evidence screen's fund-flow graph — Cytoscape mounted via the shared `useCytoscape`
 * hook (mandatory `cy.destroy()` on unmount lives there), with the control-chip filtering,
 * legend, and animated criminal-path dashing layered on top. */
export function FundFlowGraph({ graph, onSelectNode }: FundFlowGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [routeFilter, setRouteFilter] = useState<RouteFilter>('both')
  const [animating, setAnimating] = useState(
    () => !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  )

  const palette = useMemo(() => resolvePalette(), [])
  const style = useMemo(() => buildStylesheet(palette), [palette])
  const elements = useMemo(() => buildElements(graph, palette), [graph, palette])
  const layout = useMemo(() => buildLayout(graph), [graph])
  const routePaths = useMemo(() => computeRoutePaths(graph), [graph])

  const coreRef = useCytoscape(containerRef, {
    style,
    layout,
    elements,
    wheelSensitivity: 3,
    minZoom: 0.35,
    maxZoom: 2.2,
    autoungrabify: true,
    boxSelectionEnabled: false,
  })

  // Node/background click wiring — attached once the Cytoscape core exists (same commit as
  // useCytoscape's own mount effect, since that hook is called first).
  useEffect(() => {
    const cy = coreRef.current
    if (!cy) return

    function handleNodeTap(evt: EventObject) {
      const data = evt.target.data() as { id: string }
      const node = graph.nodes.find((n) => n.id === data.id) ?? null
      onSelectNode(node)
    }
    function handleBackgroundTap(evt: EventObject) {
      if (evt.target === cy) onSelectNode(null)
    }

    cy.on('tap', 'node', handleNodeTap)
    cy.on('tap', handleBackgroundTap)
    return () => {
      cy.removeListener('tap', 'node', handleNodeTap)
      cy.removeListener('tap', handleBackgroundTap)
    }
  }, [coreRef, graph, onSelectNode])

  // Route-filter chips restyle the graph by dimming everything outside the selected path(s).
  useEffect(() => {
    const cy = coreRef.current
    if (!cy) return

    cy.batch(() => {
      if (routeFilter === 'both') {
        cy.elements().removeClass('dimmed')
        return
      }
      const activePath = routePaths.find((p) => p.key === routeFilter)
      cy.nodes().forEach((node) => {
        node.toggleClass('dimmed', !activePath?.nodeIds.has(node.id()))
      })
      cy.edges().forEach((edge) => {
        edge.toggleClass('dimmed', !activePath?.edgeIds.has(edge.id()))
      })
    })
  }, [coreRef, routeFilter, routePaths])

  // Animated line-dash-offset loop on criminal-path edges, so money visibly flows toward the
  // exchange — respects prefers-reduced-motion via the `animating` initial value/toggle.
  useEffect(() => {
    const cy = coreRef.current
    if (!cy || !animating) return

    let raf = 0
    let offset = 0
    function tick() {
      offset = (offset - 1.4) % 1000
      cy!.edges('[?criminal]').style('line-dash-offset', offset)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [coreRef, animating])

  // Ambient float: each node drifts a few px around its layout position on its own sine wave
  // (random phase/speed per node) so the graph reads as alive rather than a static diagram.
  // Positions are re-captured as the "rest" point whenever the layout (re)runs; drag/selection
  // stay unaffected since `autoungrabify` already blocks user drag on this graph.
  useEffect(() => {
    const cy = coreRef.current
    if (!cy) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const basePositions = new Map<string, { x: number; y: number }>()
    const wobble = new Map<string, { phaseX: number; phaseY: number; freq: number; amp: number }>()

    function captureBase() {
      cy!.nodes().forEach((node) => {
        basePositions.set(node.id(), { ...node.position() })
        if (!wobble.has(node.id())) {
          wobble.set(node.id(), {
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            freq: 0.5 + Math.random() * 0.4,
            amp: 3 + Math.random() * 3,
          })
        }
      })
    }

    captureBase()
    cy.on('layoutstop', captureBase)

    let raf = 0
    function tick(t: number) {
      const time = t / 1000
      cy!.nodes().forEach((node) => {
        const base = basePositions.get(node.id())
        const w = wobble.get(node.id())
        if (!base || !w) return
        node.position({
          x: base.x + Math.sin(time * w.freq + w.phaseX) * w.amp,
          y: base.y + Math.cos(time * w.freq * 0.85 + w.phaseY) * w.amp,
        })
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      cy.removeListener('layoutstop', captureBase)
    }
  }, [coreRef, graph])

  function handleFit() {
    coreRef.current?.animate({ fit: { eles: coreRef.current.elements(), padding: 32 }, duration: 320 })
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <button type="button" className={styles.fitChip} onClick={handleFit}>
          <Maximize2 size={13} />
          Fit
        </button>

        <div className={styles.segmentGroup} role="group" aria-label="Filter by route">
          <Chip variant="segmented" selected={routeFilter === 'A'} onClick={() => setRouteFilter('A')}>
            Show Route A
          </Chip>
          <Chip variant="segmented" selected={routeFilter === 'B'} onClick={() => setRouteFilter('B')}>
            Show Route B
          </Chip>
          <Chip variant="segmented" selected={routeFilter === 'both'} onClick={() => setRouteFilter('both')}>
            Show both
          </Chip>
        </div>

        <Chip
          variant="segmented"
          selected={animating}
          onClick={() => setAnimating((v) => !v)}
          className={clsx(styles.animateChip)}
        >
          <Play size={13} />
          Animate flow
        </Chip>
      </div>

      <div className={styles.canvasFrame}>
        <div ref={containerRef} className={styles.canvas} role="img" aria-label="Fund flow graph" />
        <GraphLegend className={styles.legend} />
        {graph.nodes.length === 0 && (
          <div className={styles.empty}>
            <Waypoints size={22} />
            <span>No graph data.</span>
          </div>
        )}
      </div>
    </div>
  )
}
