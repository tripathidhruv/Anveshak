import { cn } from '@/lib/utils'
import type { Route } from '../../types'
import styles from './HopTable.module.css'

const cryptoFormatter = new Intl.NumberFormat('en-IN')

export interface HopTableProps {
  routeLabel: string
  route: Route
  assetShort: string
}

/** Full untruncated hop-by-hop table for one route, for the printable report — deliberately
 * doesn't use `truncateAddress` (Task 4's UI convenience); a report is evidence and every
 * address must be reproducible in full. */
export function HopTable({ routeLabel, route, assetShort }: HopTableProps) {
  const chainDescription = route.chainFrom ? `${route.chainFrom} to ${route.chainTo}` : route.chain

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        {routeLabel} — {route.label} ({chainDescription})
      </h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Address</th>
            <th>Role</th>
            <th>Amount</th>
            <th>Timestamp</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>
          {route.trail.map((hop) => {
            const isMixer = hop.stopReason === 'entered_mixer'
            const isUnconfirmedBridge = hop.stopReason === 'bridge_crossing_unconfirmed'
            return (
              <tr key={hop.n} className={cn(isMixer && styles.rowMixer, isUnconfirmedBridge && styles.rowBridgeUnconfirmed)}>
                <td>{hop.n}</td>
                <td className="font-[family-name:var(--font-mono)]">{hop.addr}</td>
                <td>{hop.role}</td>
                <td>
                  {cryptoFormatter.format(hop.amt)} {assetShort}
                </td>
                <td className="font-[family-name:var(--font-mono)]">
                  {hop.at}
                  {hop.gapSec != null ? ` (+${hop.gapSec}s)` : ''}
                </td>
                <td>
                  {isMixer ? (
                    <span className={styles.flagMixer}>{hop.flag ?? 'Entered a mixing service — trail ends here'}</span>
                  ) : isUnconfirmedBridge ? (
                    <span className={styles.flagBridgeUnconfirmed}>{hop.flag ?? 'Bridge crossing — unconfirmed'}</span>
                  ) : (
                    (hop.flag ?? '—')
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
