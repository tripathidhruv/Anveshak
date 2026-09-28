import { Copy, X } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import type { GraphNode, Route } from '../../types'
import { findHopForNode } from './graphLayout'

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  victim: 'Victim',
  scammer: 'Scammer',
  wallet: 'Intermediate wallet',
  bridge: 'Bridge contract',
  hub: 'Collection wallet',
  exchange: 'Exchange',
}

const cryptoFormatter = new Intl.NumberFormat('en-IN')

export interface NodeDrawerProps {
  node: GraphNode | null
  onClose: () => void
  onCopyAddress: (addr: string) => void
  /** Short asset symbol (e.g. "USDT") for the amount-at-this-hop field — these amounts are
   * denominated in crypto, never rupees, so they must never be run through `formatINR`. */
  assetShort: string
  /** Same routes `FundFlowGraph` receives — needed here for the same reason (see that
   * component's prop doc comment): to look up the selected node's `stopReason`/bridge-link
   * data, which `GraphNode` itself doesn't carry. */
  routeA?: Route
  routeB?: Route
}

/** Right-hand detail drawer that opens when a graph node is clicked — address, amount,
 * first-seen timestamp, and a copy-address action per the source spec. */
export function NodeDrawer({ node, onClose, onCopyAddress, assetShort, routeA, routeB }: NodeDrawerProps) {
  if (!node) {
    return (
      <Card className="flex min-h-[160px] w-[280px] flex-none items-center justify-center self-start p-6 text-center">
        <p className="text-[13px] text-muted-foreground">Click a node in the graph to see its details here.</p>
      </Card>
    )
  }

  const hop = findHopForNode(node, [routeA, routeB])
  const isMixerStop = hop?.stopReason === 'entered_mixer'
  const isUnconfirmedBridge = hop?.stopReason === 'bridge_crossing_unconfirmed'
  // Every bridge link the backend actually confirmed for either route — shown whenever a
  // bridge node is selected. Not narrowed to "the one link this node belongs to": a bridge
  // link doesn't carry the intermediate wallet address to match against, only the two sides'
  // tx hashes, so the honest thing is to surface every confirmed crossing this case has.
  const bridgeLinks = [...(routeA?.bridgeLinks ?? []), ...(routeB?.bridgeLinks ?? [])]

  return (
    <Card className="flex w-[280px] flex-none flex-col gap-3.5 self-start p-5">
      <div className="flex items-start justify-between gap-2">
        <Badge variant={node.accent}>{KIND_LABEL[node.kind]}</Badge>
        <button
          type="button"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      <div className="-mt-1">
        <h3 className="font-[family-name:var(--font-display)] text-[17px] font-bold text-foreground">{node.label}</h3>
        <p className="text-[13px] text-muted-foreground">{node.sublabel}</p>
      </div>

      <dl className="flex flex-col gap-3">
        {node.addr && (
          <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Address</dt>
            <dd className="break-all font-[family-name:var(--font-mono)] text-[13px] text-foreground">{node.addr}</dd>
          </div>
        )}
        {node.amt != null && (
          <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount at this hop</dt>
            <dd className="text-[13px] text-foreground">
              {cryptoFormatter.format(node.amt)} {assetShort}
            </dd>
          </div>
        )}
        {node.at && (
          <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">First seen</dt>
            <dd className="font-[family-name:var(--font-mono)] text-[13px] text-foreground">{node.at}</dd>
          </div>
        )}
        <div className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transaction count</dt>
          <dd className="text-[13px] italic text-muted-foreground">Not available in this demo dataset</dd>
        </div>

        {isMixerStop && (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-indigo bg-indigo/8 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-indigo">Entered a mixing service</dt>
            <dd className="text-[13px] text-foreground">
              {hop?.flag ?? 'This wallet sent the money into a cryptocurrency mixing service — we cannot trace beyond this point.'}
            </dd>
          </div>
        )}

        {isUnconfirmedBridge && (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed border-violet bg-violet/8 px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-violet">Bridge crossing — unconfirmed</dt>
            <dd className="text-[13px] text-foreground">
              {hop?.flag ?? 'The money appears to have crossed to another blockchain here, but the receiving side could not be confirmed.'}
            </dd>
          </div>
        )}

        {node.kind === 'bridge' &&
          bridgeLinks.map((link, i) => {
            const pct = link.confidence <= 1 ? link.confidence * 100 : link.confidence
            return (
              <div key={`${link.sideATxHash}-${i}`} className="flex flex-col gap-1 rounded-lg bg-violet/10 px-3 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-violet">
                  Cross-chain link confidence — {pct.toFixed(0)}%
                </dt>
                {/* Mandatory pairing (this project's synthetic-data-disclosure convention): a
                    bridge-link confidence number never appears without its disclaimer. */}
                <dd className="text-[12px] italic text-muted-foreground">{link.disclaimer}</dd>
              </div>
            )
          })}
      </dl>

      {node.addr && (
        <Button onClick={() => onCopyAddress(node.addr!)} className="w-full justify-center">
          <Copy size={14} />
          Copy address
        </Button>
      )}
    </Card>
  )
}
