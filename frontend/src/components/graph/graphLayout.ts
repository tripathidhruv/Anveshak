import type { GraphData, GraphEdge, GraphNode, Hop, Route } from '../../types'

export interface GraphLayout {
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
}

const COLUMN_GAP = 190
const ROW_GAP = 130
const MARGIN_X = 80
const MARGIN_Y = 70

/**
 * Left-to-right columns by longest-path depth from whichever node(s) have no incoming edge
 * (the victim's wallet) — a small hand-rolled replacement for Cytoscape's breadthfirst layout
 * now that the graph renders as plain positioned SVG/DOM instead of a Cytoscape canvas.
 * "Longest path" (not first-seen BFS depth) so a node fed by two branches of different length
 * — e.g. the exchange, reached via both the direct route and the bridge route — lands in the
 * column after its deepest incoming branch, keeping every edge pointing strictly rightward.
 */
export function computeLayout(graph: GraphData): GraphLayout {
  const outgoing = new Map<string, GraphEdge[]>()
  const hasIncoming = new Set<string>()
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge)
    outgoing.set(edge.source, list)
    hasIncoming.add(edge.target)
  }

  const roots = graph.nodes.filter((n) => !hasIncoming.has(n.id))
  const depth = new Map<string, number>()
  const queue: string[] = []
  for (const root of roots) {
    depth.set(root.id, 0)
    queue.push(root.id)
  }
  while (queue.length) {
    const id = queue.shift()!
    const d = depth.get(id) ?? 0
    for (const edge of outgoing.get(id) ?? []) {
      const existing = depth.get(edge.target)
      if (existing === undefined || d + 1 > existing) {
        depth.set(edge.target, d + 1)
        queue.push(edge.target)
      }
    }
  }

  const columns = new Map<number, string[]>()
  for (const node of graph.nodes) {
    const d = depth.get(node.id) ?? 0
    const list = columns.get(d) ?? []
    list.push(node.id)
    columns.set(d, list)
  }

  const columnSizes = Array.from(columns.values()).map((c) => c.length)
  const maxColumnSize = columnSizes.length ? Math.max(...columnSizes) : 1
  const height = MARGIN_Y * 2 + ROW_GAP * Math.max(0, maxColumnSize - 1)

  const positions = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of columns) {
    const x = MARGIN_X + d * COLUMN_GAP
    const offset = (height - ROW_GAP * (ids.length - 1)) / 2
    ids.forEach((id, i) => positions.set(id, { x, y: offset + i * ROW_GAP }))
  }

  const depths = Array.from(columns.keys())
  const maxDepth = depths.length ? Math.max(...depths) : 0
  const width = MARGIN_X * 2 + maxDepth * COLUMN_GAP

  return { positions, width, height }
}

export interface RoutePath {
  /** 'A' = the direct same-chain path (no bridge node); 'B' = the path that crosses the bridge. */
  key: 'A' | 'B'
  nodeIds: Set<string>
  edgeIds: Set<string>
}

/**
 * Enumerates every root-to-exchange path through the graph via DFS, then labels each path 'A'
 * (no bridge hop) or 'B' (crosses the bridge) — generic over whatever `GraphData` the API
 * returns rather than hardcoding the mock's node ids, so the "Show Route A/B" chips keep
 * working if the underlying dataset changes.
 */
export function computeRoutePaths(graph: GraphData): RoutePath[] {
  const outgoing = new Map<string, GraphEdge[]>()
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge)
    outgoing.set(edge.source, list)
  }

  const hasIncoming = new Set(graph.edges.map((e) => e.target))
  const roots = graph.nodes.filter((n) => !hasIncoming.has(n.id))
  const exchangeNode = graph.nodes.find((n) => n.kind === 'exchange')
  const nodeById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]))

  const paths: { nodeIds: string[]; edgeIds: string[] }[] = []

  function dfs(nodeId: string, nodeTrail: string[], edgeTrail: string[]) {
    if (exchangeNode && nodeId === exchangeNode.id) {
      paths.push({ nodeIds: [...nodeTrail], edgeIds: [...edgeTrail] })
      return
    }
    for (const edge of outgoing.get(nodeId) ?? []) {
      dfs(edge.target, [...nodeTrail, edge.target], [...edgeTrail, edge.id])
    }
  }

  for (const root of roots) dfs(root.id, [root.id], [])

  return paths.map((path) => {
    const crossesBridge = path.nodeIds.some((id) => nodeById.get(id)?.kind === 'bridge')
    return {
      key: crossesBridge ? 'B' : 'A',
      nodeIds: new Set(path.nodeIds),
      edgeIds: new Set(path.edgeIds),
    }
  })
}

/**
 * Matches a fund-flow-graph node back to the raw `Hop` it was built from, by address
 * (case-insensitive). `GraphData`/`GraphNode` don't carry a hop's `stopReason` or a route's
 * `bridgeLinks` -- only the source `Route`s do -- so this is how `FundFlowGraph`/`NodeDrawer`
 * find the "entered a mixer" / "bridge crossing unconfirmed" state behind a node without
 * `GraphNode` itself needing a new field (out of scope -- see `types/trace.ts`). Both routes are
 * searched (not just the one the caller expects) since a node id alone doesn't say which route
 * built it. Returns `null` when there's no `addr` (nothing to match on) or no route data was
 * passed in (e.g. a caller that hasn't wired routes through yet).
 */
export function findHopForNode(node: GraphNode, routes: (Route | undefined)[]): Hop | null {
  if (!node.addr) return null
  const addr = node.addr.toLowerCase()
  for (const route of routes) {
    if (!route) continue
    const hop = route.trail.find((h) => h.addr.toLowerCase() === addr)
    if (hop) return hop
  }
  return null
}
