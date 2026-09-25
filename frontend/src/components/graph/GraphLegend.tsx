import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

const ENTRIES: { swatch: string; shape?: 'diamond' | 'hexagon'; label: string }[] = [
  { swatch: 'var(--color-sky)', label: "Victim's wallet" },
  { swatch: 'var(--color-vermillion)', label: 'Scammer / collection wallet' },
  { swatch: 'var(--color-teal)', label: 'Intermediate wallet' },
  { swatch: 'var(--color-violet)', shape: 'diamond', label: 'Bridge (cross-chain)' },
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
        {ENTRIES.map((entry) => {
          const shapeStyle: CSSProperties =
            entry.shape === 'diamond'
              ? { borderRadius: 2, transform: 'rotate(45deg)' }
              : entry.shape === 'hexagon'
                ? { borderRadius: 3, clipPath: HEXAGON_CLIP }
                : { borderRadius: '50%' }
          return (
            <li key={entry.label} className="flex items-center gap-2 text-xs text-foreground/80">
              <span
                className="h-3 w-3 flex-none"
                style={{ background: entry.swatch, ...shapeStyle }}
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
