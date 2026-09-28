import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

const ENTRIES: { swatch: string; shape?: 'diamond' | 'hexagon'; dashed?: boolean; label: string }[] = [
  { swatch: 'var(--color-sky)', label: "Victim's wallet" },
  { swatch: 'var(--color-vermillion)', label: 'Scammer / collection wallet' },
  { swatch: 'var(--color-teal)', label: 'Intermediate wallet' },
  { swatch: 'var(--color-violet)', shape: 'diamond', label: 'Bridge (cross-chain, confirmed)' },
  // Dashed/hollow swatches read as "uncertain" -- distinct from every solid-filled entry above.
  { swatch: 'var(--color-violet)', shape: 'diamond', dashed: true, label: 'Bridge crossing — unconfirmed' },
  { swatch: 'var(--color-indigo)', dashed: true, label: 'Entered a mixing service (trail ends)' },
  { swatch: 'var(--color-gold)', shape: 'hexagon', label: 'Exchange' },
]

const HEXAGON_CLIP = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'

/** Small white card explaining the graph's colour/shape semantics — always visible bottom-left
 * of the canvas per the source spec. */
export function GraphLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-w-[200px] max-w-[240px] flex-col gap-2 rounded-xl border border-border bg-card p-3.5 shadow-sm', className)}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Legend</span>
      <ul className="flex flex-col gap-1.5">
        {ENTRIES.map((entry, i) => {
          const shapeStyle: CSSProperties =
            entry.shape === 'diamond'
              ? { borderRadius: 2, transform: 'rotate(45deg)' }
              : entry.shape === 'hexagon'
                ? { borderRadius: 3, clipPath: HEXAGON_CLIP }
                : { borderRadius: '50%' }
          const fillStyle: CSSProperties = entry.dashed
            ? { background: 'transparent', border: `2px dashed ${entry.swatch}` }
            : { background: entry.swatch }
          return (
            <li key={`${entry.label}-${i}`} className="flex items-center gap-2 text-xs text-foreground/80">
              <span
                className="h-3 w-3 flex-none"
                style={{ ...shapeStyle, ...fillStyle }}
                aria-hidden
              />
              {entry.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
