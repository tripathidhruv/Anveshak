import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { toneA, toneHex } from '@/components/kit'
import type { IntakeEntity } from '@/api'
import { cn } from '@/lib/utils'
import { ENTITY } from './data'
import { STAGES, type StageIndex } from './draft'

/* ───────── Stepper ───────── */

/**
 * Five-stop progress rail. Completed stops are buttons (jump back); stops ahead are inert until the
 * stage before them is satisfied — the rail never offers a jump the "Continue" button would refuse.
 */
export function Stepper({
  stage,
  reachable,
  locked,
  onJump,
}: {
  stage: StageIndex
  reachable: (i: StageIndex) => boolean
  locked: boolean
  onJump: (i: StageIndex) => void
}) {
  const pct = (stage / (STAGES.length - 1)) * 100
  return (
    <nav aria-label="Intake progress" className="relative">
      {/* phone: one line + bar */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="text-text">
            Step {stage + 1} of {STAGES.length} · {STAGES[stage].label}
          </span>
          <span className="text-dim">{STAGES[stage].tech}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div className="h-full rounded-full bg-ember" animate={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 26 }} />
        </div>
      </div>

      {/* desktop: rail */}
      <ol className="relative hidden grid-cols-5 sm:grid">
        <div className="absolute left-[10%] right-[10%] top-[17px] h-[2px] rounded-full bg-white/[0.07]" aria-hidden>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--k-moss), var(--k-ember))', boxShadow: `0 0 12px ${toneA('ember', 0.5)}` }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </div>
        {STAGES.map((s, idx) => {
          const i = idx as StageIndex
          const done = i < stage || (locked && i === stage)
          const active = i === stage && !locked
          const can = !locked && i !== stage && i !== 1 && reachable(i)
          return (
            <li key={s.key} className="relative flex flex-col items-center text-center">
              <button
                type="button"
                disabled={!can}
                onClick={() => onJump(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${s.label}${done ? ' (done)' : ''}`}
                className={cn('group relative grid size-9 place-items-center rounded-full outline-none', can && 'cursor-pointer')}
              >
                {active && (
                  <motion.span
                    layoutId="intake-step-glow"
                    className="absolute -inset-1.5 rounded-full"
                    style={{ boxShadow: `0 0 0 1px ${toneA('ember', 0.5)}, 0 0 22px ${toneA('ember', 0.45)}` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    'relative grid size-9 place-items-center rounded-full border text-[13.5px] font-semibold transition-colors duration-300',
                    done && 'border-moss/50 bg-moss/15 text-moss',
                    active && 'border-ember bg-ember text-white',
                    !done && !active && 'border-line-2 bg-card text-dim',
                    can && 'group-hover:border-text/40 group-focus-visible:ring-2 group-focus-visible:ring-ember/60',
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.span key="c" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                        <Check className="size-4" strokeWidth={3} />
                      </motion.span>
                    ) : (
                      <motion.span key="n" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
              <div className={cn('mt-2 text-[13.5px] transition-colors', active ? 'text-text' : done ? 'text-text/80' : 'text-muted')}>{s.label}</div>
              <div className="text-[11.5px] text-dim">{s.tech}</div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ───────── Sticky footer with Back / primary ───────── */

export function StageFooter({ left, right, note }: { left?: React.ReactNode; right: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="sticky bottom-3 z-20 mt-4">
      <div
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-line-2 px-3 py-2.5 backdrop-blur-xl sm:flex-nowrap"
        style={{ background: 'rgba(18,18,20,0.82)', boxShadow: '0 18px 40px -18px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)' }}
      >
        <div className="flex shrink-0 items-center gap-2">{left}</div>
        <div className="order-3 min-w-0 basis-full text-[12.5px] text-muted sm:order-none sm:basis-auto sm:flex-1">{note}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line-2 bg-white/[0.05] px-1 py-px font-sans text-[11px] text-muted">{children}</kbd>
}

/* ───────── Complaint text with entity highlights ───────── */

/** Renders `text` with each entity span marked in its tone. `focus` ids pulse (field ↔ text linkage). */
export function HighlightedText({
  text,
  entities,
  show,
  focus = [],
  stagger = 0.06,
  className,
}: {
  text: string
  entities: IntakeEntity[]
  show: boolean
  focus?: string[]
  stagger?: number
  className?: string
}) {
  const parts = React.useMemo(() => {
    const out: (string | IntakeEntity)[] = []
    let at = 0
    for (const e of [...entities].sort((a, b) => a.start - b.start)) {
      // spans index the original text; `e.text` may be the masked form (phones, UPI IDs), so render the slice
      if (e.start < at || e.end > text.length || e.end <= e.start) continue
      if (e.start > at) out.push(text.slice(at, e.start))
      out.push(e)
      at = e.end
    }
    if (at < text.length) out.push(text.slice(at))
    return out
  }, [text, entities])

  let n = 0
  return (
    <p className={cn('whitespace-pre-wrap break-words text-[14.5px] leading-[1.8] text-text/85', className)}>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <React.Fragment key={i}>{p}</React.Fragment>
        const idx = n++
        const tone = ENTITY[p.type].tone
        const hot = focus.includes(p.id)
        return (
          <motion.mark
            key={p.id}
            data-entity={p.id}
            className={cn('rounded px-0.5 text-inherit', (p.type === 'hash' || p.type === 'wallet') && 'k-mono break-all')}
            initial={false}
            animate={
              show
                ? {
                    backgroundColor: toneA(tone, hot ? 0.32 : 0.15),
                    boxShadow: hot ? `0 0 0 1.5px ${toneHex(tone)}, 0 0 16px ${toneA(tone, 0.55)}` : `inset 0 -1.5px 0 ${toneHex(tone)}`,
                    color: p.type === 'pii' ? '#d4d4d8' : toneHex(tone),
                  }
                : { backgroundColor: toneA(tone, 0), boxShadow: `inset 0 -1.5px 0 ${toneA(tone, 0)}`, color: '#dcdcdf' }
            }
            transition={{ duration: 0.35, delay: show && !hot ? idx * stagger : 0 }}
            title={show ? `${ENTITY[p.type].label} · ${Math.round(p.confidence * 100)}% — ${p.reason}` : undefined}
          >
            {text.slice(p.start, p.end)}
          </motion.mark>
        )
      })}
    </p>
  )
}

/** Ember scan line sweeping top → bottom while the complaint is read. Loops until `active` goes false. */
export function ScanSweep({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="k-shimmer absolute inset-0" />
          <motion.div
            className="absolute inset-x-0 h-20"
            style={{ background: `linear-gradient(180deg, transparent, ${toneA('ember', 0.16)})` }}
            initial={{ top: '-5rem' }}
            animate={{ top: '100%' }}
            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.15 }}
          >
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-ember" style={{ boxShadow: `0 0 14px 2px ${toneA('ember', 0.7)}` }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function EntityLegend({ dim }: { dim?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(ENTITY) as (keyof typeof ENTITY)[]).map((e) => (
        <span
          key={e}
          className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] transition-opacity', dim ? 'opacity-45' : 'opacity-100')}
          style={{ background: toneA(ENTITY[e].tone, 0.1), color: e === 'pii' ? '#c4c4c8' : toneHex(ENTITY[e].tone) }}
        >
          <span className="size-1.5 rounded-full" style={{ background: toneHex(ENTITY[e].tone) }} />
          {ENTITY[e].label}
        </span>
      ))}
    </div>
  )
}
