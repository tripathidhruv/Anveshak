import clsx from 'clsx'
import styles from './GraphLegend.module.css'

const ENTRIES: { swatch: string; shape?: 'diamond' | 'hexagon'; label: string }[] = [
  { swatch: 'var(--sky)', label: "Victim's wallet" },
  { swatch: 'var(--vermillion)', label: "Scammer / collection wallet" },
  { swatch: 'var(--teal)', label: 'Intermediate wallet' },
  { swatch: 'var(--violet)', shape: 'diamond', label: 'Bridge (cross-chain)' },
  { swatch: 'var(--gold)', shape: 'hexagon', label: 'Exchange' },
]

/** `.pressed` well explaining the graph's colour/shape semantics — always visible bottom-left
 * of the canvas per the source spec. */
export function GraphLegend({ className }: { className?: string }) {
  return (
    <div className={clsx(styles.legend, className)}>
      <span className={styles.title}>Legend</span>
      <ul className={styles.list}>
        {ENTRIES.map((entry) => (
          <li key={entry.label} className={styles.row}>
            <span
              className={clsx(styles.swatch, entry.shape && styles[entry.shape])}
              style={{ background: entry.swatch }}
              aria-hidden
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
