import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneA } from './tone'

export type Stage = { key: string; label: string; tech: string }

/**
 * Progress rail for a staged flow (same look as Smart Intake's). Stops the officer can't reach yet
 * are inert; reachable ones are buttons. `done` marks stops already completed.
 */
export function StageRail({
  stages,
  current,
  reachable,
  done,
  onJump,
  layoutId = 'stage-glow',
}: {
  stages: readonly Stage[]
  current: number
  reachable: (i: number) => boolean
  done: (i: number) => boolean
  onJump: (i: number) => void
  layoutId?: string
}) {
  const pct = (current / Math.max(1, stages.length - 1)) * 100
  const cols = { gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }
  return (
    <nav aria-label="Progress" className="rounded-2xl border border-line bg-white/[0.015] px-4 py-4 sm:px-6">
      {/* phone: one line + bar */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="text-text">
            Step {current + 1} of {stages.length} · {stages[current].label}
          </span>
          <span className="truncate text-dim">{stages[current].tech}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div className="h-full rounded-full bg-ember" animate={{ width: `${((current + 1) / stages.length) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 26 }} />
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {stages.map((s, i) => (
            <button
              key={s.key}
              type="button"
              disabled={!reachable(i) || i === current}
              onClick={() => onJump(i)}
              className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[12px]', i === current ? 'border-ember/50 text-text' : done(i) ? 'border-moss/30 text-moss' : 'border-line text-dim')}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* desktop: rail */}
      <ol className="relative hidden sm:grid" style={cols}>
        <div className="absolute top-[17px] h-[2px] rounded-full bg-white/[0.07]" style={{ left: `${50 / stages.length}%`, right: `${50 / stages.length}%` }} aria-hidden>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--k-moss), var(--k-ember))', boxShadow: `0 0 12px ${toneA('ember', 0.5)}` }}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22 }}
          />
        </div>
        {stages.map((s, i) => {
          const isDone = done(i) && i !== current
          const active = i === current
          const can = i !== current && reachable(i)
          return (
            <li key={s.key} className="relative flex flex-col items-center text-center">
              <button
                type="button"
                disabled={!can}
                onClick={() => onJump(i)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${s.label}${isDone ? ' (done)' : ''}`}
                className={cn('group relative grid size-9 place-items-center rounded-full outline-none', can && 'cursor-pointer')}
              >
                {active && (
                  <motion.span
                    layoutId={layoutId}
                    className="absolute -inset-1.5 rounded-full"
                    style={{ boxShadow: `0 0 0 1px ${toneA('ember', 0.5)}, 0 0 22px ${toneA('ember', 0.45)}` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                <span
                  className={cn(
                    'relative grid size-9 place-items-center rounded-full border text-[13.5px] font-semibold transition-colors duration-300',
                    isDone && 'border-moss/50 bg-moss/15 text-moss',
                    active && 'border-ember bg-ember text-white',
                    !isDone && !active && 'border-line-2 bg-card text-dim',
                    can && 'group-hover:border-text/40 group-focus-visible:ring-2 group-focus-visible:ring-ember/60',
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isDone ? (
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
              <div className={cn('mt-2 text-[13.5px] transition-colors', active ? 'text-text' : isDone ? 'text-text/80' : 'text-muted')}>{s.label}</div>
              <div className="text-[11.5px] text-dim">{s.tech}</div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Slide-in-from-the-side frame for the current stage. `dir` is +1 going forward, −1 going back. */
export function StageFrame({ stageKey, dir, children, label }: { stageKey: string; dir: number; children: React.ReactNode; label?: string }) {
  return (
    <div className="overflow-x-clip">
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={stageKey}
          aria-label={label}
          custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 72, scale: 0.985, filter: 'blur(10px)' }),
            center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' },
            exit: (d: number) => ({ opacity: 0, x: d * -56, scale: 0.985, filter: 'blur(8px)' }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
        >
          {children}
        </motion.section>
      </AnimatePresence>
    </div>
  )
}
