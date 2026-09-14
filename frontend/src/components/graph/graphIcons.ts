import type { GraphNodeKind } from '../../types'

/** Small inline-SVG glyphs rendered on top of each node's colour badge (via Cytoscape's
 * `background-image`) — a "wallet / person / bridge / exchange" role icon instead of a plain
 * circle, so the graph reads at a glance instead of needing the legend for every dot. Kept as
 * hand-rolled data URIs (not an icon-font asset) since Cytoscape's canvas renderer loads
 * `background-image` as a plain `<img>` src, not JSX. */
function svgDataUri(inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const PERSON = svgDataUri(
  '<circle cx="12" cy="8" r="3.6" fill="#fff" stroke="none"/><path d="M5 20c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5" fill="#fff" stroke="none"/>',
)

const WALLET = svgDataUri(
  '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><circle cx="17" cy="14" r="1.3" fill="#fff" stroke="none"/>',
)

const SHUFFLE = svgDataUri(
  '<path d="M3 7h5l8 10h5"/><path d="M3 17h5l8-10h5"/><path d="M16 4l4 3-4 3"/><path d="M16 14l4 3-4 3"/>',
)

const BANK = svgDataUri(
  '<path d="M3 10l9-6 9 6"/><path d="M4 21h16"/><path d="M5 21v-9"/><path d="M9 21v-9"/><path d="M15 21v-9"/><path d="M19 21v-9"/>',
)

/** `scammer`, `wallet`, and `hub` all render the same wallet glyph — the legend already treats
 * "Scammer / collection wallet" as one concept; size and colour (not icon) carry the distinction
 * between an ordinary hop and the big collection wallet. */
export const NODE_ICON: Record<GraphNodeKind, string> = {
  victim: PERSON,
  scammer: WALLET,
  wallet: WALLET,
  hub: WALLET,
  bridge: SHUFFLE,
  exchange: BANK,
}
