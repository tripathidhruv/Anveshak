/**
 * Sanctions-proximity diffusion — SYNTHETIC demo graph.
 * Listed addresses are fabricated entries standing in for list *types*;
 * no real sanctioned party, exchange or wallet is represented.
 */
import type { Tone } from '@/components/kit'
import type { Chain } from '@/data/demo'

export type ListKey = 'ofac' | 'un' | 'domestic'

export const LISTS: { key: ListKey; label: string; tech: string }[] = [
  { key: 'ofac', label: 'OFAC SDN', tech: 'US sanctions list type' },
  { key: 'un', label: 'UN consolidated', tech: 'UN Security Council list type' },
  { key: 'domestic', label: 'Domestic designated', tech: 'Indian designated-entity list type' },
]

export type NodeKind = 'listed' | 'shell' | 'case' | 'exchange' | 'other'

export type DNode = {
  id: string
  addr: string
  chain: Chain
  label: string
  /** structural hop from the full listed set — fixes the ring the node sits on */
  ring: 0 | 1 | 2 | 3 | 4
  /** degrees, 0 = right, -90 = top */
  angle: number
  kind: NodeKind
  list?: ListKey
  /** hop reference on the case trail (A5, B5…) */
  hop?: string
}

/** share = fraction of the money that left `from` which went to `to` (outflow share). */
export type DEdge = { from: string; to: string; share: number }

export const NODES: DNode[] = [
  // ring 0 — listed addresses (seeds)
  { id: 'L1', addr: '0x4d17c0e9a85b2f6e13', chain: 'Ethereum', label: 'Listed address A', ring: 0, angle: -90, kind: 'listed', list: 'ofac' },
  { id: 'L2', addr: 'TJr3kW8vB5nQ1mH6sP9xD', chain: 'TRON', label: 'Listed address B', ring: 0, angle: 150, kind: 'listed', list: 'un' },
  { id: 'L3', addr: '0xb83e1f5a92c04d7e6a', chain: 'Ethereum', label: 'Listed address C', ring: 0, angle: 30, kind: 'listed', list: 'domestic' },
  // ring 1
  { id: 'B4', addr: '0x7a3fd21c9b4e8a5f2071', chain: 'Ethereum', label: 'Bridge exit', ring: 1, angle: -118, kind: 'case', hop: 'B4' },
  { id: 'S1', addr: '0x51c0a7e3d94b28f6c1', chain: 'Ethereum', label: 'Shell wallet', ring: 1, angle: -42, kind: 'shell' },
  { id: 'V1', addr: '0xe2a9d4c71f05b83e6d', chain: 'Ethereum', label: 'Merchant payout', ring: 1, angle: 62, kind: 'other' },
  { id: 'R1', addr: 'TLw6fH2pZ9kD4nB8sQ3vM', chain: 'TRON', label: 'Relay wallet', ring: 1, angle: 168, kind: 'shell' },
  { id: 'K1', addr: 'TFk2qP7mW4xN9cR1hL5sB', chain: 'TRON', label: 'Kestrel hot wallet', ring: 1, angle: 232, kind: 'exchange' },
  // ring 2
  { id: 'W4', addr: '0x9e4b8f07a2c6d13e5b', chain: 'Ethereum', label: 'Pass-through wallet 4', ring: 2, angle: -78, kind: 'case', hop: 'B5' },
  { id: 'P2', addr: '0x6c2e9a17b4f08d35e1', chain: 'Ethereum', label: 'OTC desk wallet', ring: 2, angle: -18, kind: 'other' },
  { id: 'N1', addr: '0x3f8b6e21c7d94a05b2', chain: 'Ethereum', label: 'Retail wallet', ring: 2, angle: 52, kind: 'other' },
  { id: 'A4', addr: 'TPd4wS8cM1kR5tY9nB3gH', chain: 'TRON', label: 'Pass-through wallet 3', ring: 2, angle: 138, kind: 'case', hop: 'A4' },
  { id: 'HUB', addr: 'TNh8yW5vC2mQ7fL4xK9pR', chain: 'TRON', label: 'Collection wallet', ring: 2, angle: 188, kind: 'case', hop: 'A5' },
  // ring 3
  { id: 'DB', addr: '0x2c8da154fe37b09c42', chain: 'Ethereum', label: 'Meridian deposit', ring: 3, angle: -96, kind: 'exchange', hop: 'B6' },
  { id: 'K2', addr: '0xa71d3c5e08f94b62d7', chain: 'Ethereum', label: 'Northwind hot wallet', ring: 3, angle: 2, kind: 'exchange' },
  { id: 'DA', addr: 'TBx1eM9nT7hG3sV5cW2kL', chain: 'TRON', label: 'Meridian deposit', ring: 3, angle: 204, kind: 'exchange', hop: 'A6' },
  // ring 4
  { id: 'G1', addr: '0x8e05b2d9c4a17f36e0', chain: 'Ethereum', label: 'Meridian hot wallet', ring: 4, angle: -112, kind: 'exchange' },
  { id: 'G2', addr: 'TMe4rX8kQ2wN6bH1pV9sC', chain: 'TRON', label: 'Meridian hot wallet', ring: 4, angle: 218, kind: 'exchange' },
]

export const EDGES: DEdge[] = [
  { from: 'L1', to: 'S1', share: 0.92 },
  { from: 'L1', to: 'B4', share: 0.06 },
  { from: 'L3', to: 'S1', share: 0.8 },
  { from: 'L3', to: 'V1', share: 0.006 },
  { from: 'L2', to: 'R1', share: 0.85 },
  { from: 'L2', to: 'K1', share: 0.004 },
  { from: 'S1', to: 'W4', share: 0.68 },
  { from: 'S1', to: 'P2', share: 0.22 },
  { from: 'B4', to: 'W4', share: 0.99 },
  { from: 'V1', to: 'N1', share: 0.3 },
  { from: 'R1', to: 'HUB', share: 0.4 },
  { from: 'R1', to: 'A4', share: 0.12 },
  { from: 'A4', to: 'HUB', share: 0.99 },
  { from: 'W4', to: 'DB', share: 1 },
  { from: 'P2', to: 'K2', share: 0.5 },
  { from: 'HUB', to: 'DA', share: 1 },
  { from: 'DB', to: 'G1', share: 1 },
  { from: 'DA', to: 'G2', share: 1 },
]

export const NODE: Record<string, DNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))

export const DUST = 0.01
export const SEED = 1

export type Params = { decay: number; maxHops: number; ignoreDust: boolean; lists: Set<ListKey> }

export type PathHit = { nodes: string[]; shares: number[]; share: number; hops: number; contrib: number }

export type Result = {
  risk: Record<string, number>
  hops: Record<string, number | null>
  paths: Record<string, PathHit[]>
  /** edges carrying risk under current params */
  live: Set<string>
}

export const edgeKey = (e: DEdge) => `${e.from}>${e.to}`

/**
 * risk(w) = Σ over paths p from a listed address: seed × decay^hops(p) × valueShare(p)
 * valueShare(p) = product of outflow shares along p.
 */
export function diffuse(p: Params): Result {
  const risk: Record<string, number> = {}
  const hops: Record<string, number | null> = {}
  const paths: Record<string, PathHit[]> = {}
  const live = new Set<string>()
  for (const n of NODES) {
    risk[n.id] = 0
    hops[n.id] = null
    paths[n.id] = []
  }
  const out: Record<string, DEdge[]> = {}
  for (const e of EDGES) {
    if (p.ignoreDust && e.share < DUST) continue
    ;(out[e.from] ??= []).push(e)
  }
  const seeds = NODES.filter((n) => n.kind === 'listed' && n.list && p.lists.has(n.list))
  for (const s of seeds) {
    risk[s.id] = SEED
    hops[s.id] = 0
    const walk = (id: string, trail: string[], shares: number[], share: number, depth: number, edges: string[]) => {
      if (depth >= p.maxHops) return
      for (const e of out[id] ?? []) {
        if (trail.includes(e.to)) continue
        const t = NODE[e.to]
        if (t.kind === 'listed') continue
        const sh = share * e.share
        const d = depth + 1
        const contrib = SEED * Math.pow(p.decay, d) * sh
        const nextTrail = [...trail, e.to]
        const nextEdges = [...edges, edgeKey(e)]
        risk[e.to] += contrib
        hops[e.to] = hops[e.to] === null ? d : Math.min(hops[e.to]!, d)
        paths[e.to].push({ nodes: nextTrail, shares: [...shares, e.share], share: sh, hops: d, contrib })
        if (contrib >= 0.005) nextEdges.forEach((k) => live.add(k))
        walk(e.to, nextTrail, [...shares, e.share], sh, d, nextEdges)
      }
    }
    walk(s.id, [s.id], [], 1, 0, [])
  }
  for (const id in risk) {
    risk[id] = Math.min(1, risk[id])
    paths[id].sort((a, b) => b.contrib - a.contrib)
  }
  return { risk, hops, paths, live }
}

export type Verdict = { label: string; tone: Tone; key: 'listed' | 'flag' | 'watch' | 'low' | 'none' }

export const FLAG_AT = 0.2
export const WATCH_AT = 0.08

export function verdictOf(risk: number, listed: boolean): Verdict {
  if (listed) return { key: 'listed', label: 'On a list', tone: 'crimson' }
  if (risk >= FLAG_AT) return { key: 'flag', label: 'Flag for review', tone: 'crimson' }
  if (risk >= WATCH_AT) return { key: 'watch', label: 'Watch', tone: 'ember' }
  if (risk > 0) return { key: 'low', label: 'No action', tone: 'neutral' }
  return { key: 'none', label: 'Not reached', tone: 'neutral' }
}

export const DEFAULTS = { decay: 0.5, maxHops: 3, ignoreDust: true }
