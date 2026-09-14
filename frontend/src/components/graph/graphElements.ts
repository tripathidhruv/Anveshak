import type { ElementDefinition, LayoutOptions } from 'cytoscape'
import type { GraphData, GraphEdge, GraphNode } from '../../types'
import type { ResolvedPalette } from './graphStyle'
import { NODE_ICON } from './graphIcons'

const EDGE_LABEL_FORMAT = new Intl.NumberFormat('en-IN')

/** Blends two `#rrggbb` hex colours 50/50 — used so each edge's line colour sits between the
 * colours of the two nodes it connects, instead of one flat grey line. Cytoscape's core style
 * engine has no built-in colour-mixing, so this runs once at element-build time. */
function mixHex(a: string, b: string): string {
  const pa = Number.parseInt(a.slice(1), 16)
  const pb = Number.parseInt(b.slice(1), 16)
  const channel = (shift: number) => {
    const va = (pa >> shift) & 0xff
    const vb = (pb >> shift) & 0xff
    return Math.round((va + vb) / 2)
  }
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(channel(16))}${toHex(channel(8))}${toHex(channel(0))}`
}

/** Cytoscape elements built from the fetched `GraphData` — node colour is resolved once here
 * (from the design tokens) so the stylesheet can reference `data(color)` without Cytoscape
 * needing to understand CSS custom properties. Multi-line labels use `\n`, matching the
 * simpler of the two label techniques the source spec allows. Each edge's `lineColor` blends
 * the colours of the two nodes it connects, instead of one flat grey line. */
export function buildElements(graph: GraphData, palette: ResolvedPalette): ElementDefinition[] {
  const colorById = new Map(graph.nodes.map((node) => [node.id, palette.accents[node.accent]]))

  const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
    data: {
      id: node.id,
      label: `${node.label}\n${node.sublabel}`,
      kind: node.kind,
      accent: node.accent,
      color: palette.accents[node.accent],
      icon: NODE_ICON[node.kind],
    },
  }))

  const edges: ElementDefinition[] = graph.edges.map((edge) => {
    const sourceColor = colorById.get(edge.source) ?? palette.inkSoft
    const targetColor = colorById.get(edge.target) ?? palette.inkSoft
    return {
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: EDGE_LABEL_FORMAT.format(edge.amt),
        criminal: edge.criminal || undefined,
        lineColor: mixHex(sourceColor, targetColor),
      },
    }
  })

  return [...nodes, ...edges]
}

/** Left-to-right breadth-first layout, rooted at whichever node(s) have no incoming edge
 * (the victim's wallet). `transform` swaps x/y — the documented way to turn Cytoscape's
 * default top-to-bottom breadthfirst layout into a left-to-right one. */
export function buildLayout(graph: GraphData): LayoutOptions {
  const targets = new Set(graph.edges.map((e) => e.target))
  const roots = graph.nodes.filter((n) => !targets.has(n.id)).map((n) => n.id)

  return {
    name: 'breadthfirst',
    directed: true,
    roots: roots.length ? roots : undefined,
    fit: true,
    padding: 32,
    spacingFactor: 1.35,
    avoidOverlap: true,
    transform: (_node, position) => ({ x: position.y, y: position.x }),
  } as LayoutOptions
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
