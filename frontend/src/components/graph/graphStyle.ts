import type { StylesheetStyle } from 'cytoscape'
import type { AccentColour } from '../../utils/constants'

/** Reads a CSS custom property's resolved value off `:root` — Cytoscape renders to canvas, so
 * it can't consume `var(--x)` directly the way DOM/CSS-module styles can; resolve once at
 * graph-build time instead of hardcoding hex (tokens.css stays the single source of truth). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export interface ResolvedPalette {
  ink: string
  inkSoft: string
  bg: string
  indigo: string
  white: string
  accents: Record<AccentColour, string>
}

export function resolvePalette(): ResolvedPalette {
  return {
    ink: cssVar('--ink'),
    inkSoft: cssVar('--ink-soft'),
    bg: cssVar('--bg'),
    indigo: cssVar('--indigo'),
    white: '#ffffff',
    accents: {
      vermillion: cssVar('--vermillion'),
      gold: cssVar('--gold'),
      teal: cssVar('--teal'),
      violet: cssVar('--violet'),
      moss: cssVar('--moss'),
      sky: cssVar('--sky'),
    },
  }
}

/** Cytoscape stylesheet for the fund-flow graph — colours/shapes per the source spec: sky
 * victim, vermillion scammer, teal intermediates, violet bridge diamond, larger vermillion
 * collection-wallet hub, larger gold hexagon exchange. Each node also carries a small white
 * role icon (`data(icon)`, built in graphElements.ts) and a soft glow in its own accent colour
 * so the badge reads as a lifted, lit-up chip rather than a flat dot. Edges render as a
 * gradient between the colours of the nodes they connect (`data(gradColors)`) instead of one
 * flat grey line. `.dimmed` is toggled by the route filter chips; `edge[?criminal]` carries the
 * animated line-dash-offset flow. */
export function buildStylesheet(palette: ResolvedPalette): StylesheetStyle[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'background-image': 'data(icon)',
        'background-width': '58%',
        'background-height': '58%',
        'background-position-x': '50%',
        'background-position-y': '50%',
        'border-width': 5,
        'border-color': palette.white,
        label: 'data(label)',
        color: palette.ink,
        'font-family': 'Inter, system-ui, sans-serif',
        'font-size': 10,
        'font-weight': 600,
        'text-wrap': 'wrap',
        'text-max-width': '110px',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 10,
        width: 52,
        height: 52,
      },
    },
    { selector: 'node[kind = "bridge"]', style: { shape: 'diamond', width: 64, height: 64 } },
    { selector: 'node[kind = "hub"]', style: { width: 74, height: 74, 'border-width': 6 } },
    { selector: 'node[kind = "exchange"]', style: { shape: 'hexagon', width: 80, height: 80, 'border-width': 6 } },
    {
      selector: 'node:selected',
      style: { 'border-color': palette.indigo, 'border-width': 5 },
    },
    {
      selector: 'edge',
      style: {
        width: 2,
        opacity: 0.55,
        'line-color': 'data(lineColor)',
        'target-arrow-color': palette.indigo,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.1,
        'curve-style': 'bezier',
        label: 'data(label)',
        'font-size': 9,
        color: palette.ink,
        'text-background-color': palette.bg,
        'text-background-opacity': 1,
        'text-background-padding': '3px',
      },
    },
    {
      selector: 'edge[?criminal]',
      style: {
        width: 4,
        opacity: 1,
        'line-color': palette.accents.vermillion,
        'target-arrow-color': palette.accents.vermillion,
        'line-style': 'dashed',
        'line-dash-pattern': [6, 4],
      },
    },
    {
      selector: '.dimmed',
      style: { opacity: 0.12 },
    },
  ]
}
