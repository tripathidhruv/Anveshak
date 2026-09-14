import type { CSSProperties } from 'react'
import { Copy, X } from 'lucide-react'
import { Badge, Button } from '../ui'
import type { GraphNode } from '../../types'
import { formatINR } from '../../utils/format'
import styles from './NodeDrawer.module.css'

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  victim: 'Victim',
  scammer: 'Scammer',
  wallet: 'Intermediate wallet',
  bridge: 'Bridge contract',
  hub: 'Collection wallet',
  exchange: 'Exchange',
}

export interface NodeDrawerProps {
  node: GraphNode | null
  onClose: () => void
  onCopyAddress: (addr: string) => void
}

/** Right-hand `.raised` detail drawer that opens when a graph node is clicked — address,
 * amount, first-seen timestamp, and a copy-address action per the source spec. */
export function NodeDrawer({ node, onClose, onCopyAddress }: NodeDrawerProps) {
  if (!node) {
    return (
      <div className={styles.drawer} data-empty="true">
        <p className={styles.emptyText}>Click a node in the graph to see its details here.</p>
      </div>
    )
  }

  return (
    <div className={styles.drawer}>
      <div className={styles.header}>
        <Badge style={{ ['--badge-colour' as string]: `var(--${node.accent})` } as CSSProperties}>
          {KIND_LABEL[node.kind]}
        </Badge>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close details">
          <X size={16} />
        </button>
      </div>

      <h3 className={styles.title}>{node.label}</h3>
      <p className={styles.sublabel}>{node.sublabel}</p>

      <dl className={styles.factList}>
        {node.addr && (
          <div className={styles.fact}>
            <dt>Address</dt>
            <dd className="mono">{node.addr}</dd>
          </div>
        )}
        {node.amt != null && (
          <div className={styles.fact}>
            <dt>Amount at this hop</dt>
            <dd>{formatINR(node.amt)}</dd>
          </div>
        )}
        {node.at && (
          <div className={styles.fact}>
            <dt>First seen</dt>
            <dd className="mono">{node.at}</dd>
          </div>
        )}
        <div className={styles.fact}>
          <dt>Transaction count</dt>
          <dd className={styles.notAvailable}>Not available in this demo dataset</dd>
        </div>
      </dl>

      {node.addr && (
        <Button onClick={() => onCopyAddress(node.addr!)} className={styles.copyButton}>
          <Copy size={14} />
          Copy address
        </Button>
      )}
    </div>
  )
}
