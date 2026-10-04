import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useLenis } from 'lenis/react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SubTab = {
  key: string
  label: string
  icon?: LucideIcon
  /** small count or status shown after the label */
  badge?: React.ReactNode
  /** receives `go` so a tab can send the officer to another tab ("See why →") */
  render: (go: (key: string) => void) => React.ReactNode
}

/**
 * In-page sub-tabs: one topic per tab instead of one long scroll. The active tab lives in `?tab=`
 * so it survives reloads and can be linked to. Content slides in from the side it's coming from.
 * Visually an underline bar, so it never competes with the section's pill tabs above it.
 */
export function SubTabs({ tabs, param = 'tab', className }: { tabs: SubTab[]; param?: string; className?: string }) {
  const [params, setParams] = useSearchParams()
  const lenis = useLenis()
  const barRef = React.useRef<HTMLDivElement>(null)
  const raw = params.get(param)
  const active = tabs.find((t) => t.key === raw) ?? tabs[0]
  const index = tabs.indexOf(active)
  const prev = React.useRef(index)
  const dir = index >= prev.current ? 1 : -1
  React.useEffect(() => {
    prev.current = index
  }, [index])

  const go = React.useCallback(
    (key: string) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set(param, key)
          return n
        },
        { replace: true },
      )
      // bring the tab bar back into view if the officer had scrolled down a long tab
      const el = barRef.current
      if (el && el.getBoundingClientRect().top < 0) {
        if (lenis) lenis.scrollTo(el, { offset: -16, duration: 0.5 })
        else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [setParams, param, lenis],
  )

  return (
    <div className={className}>
      <div ref={barRef} className="k-scroll -mx-1 overflow-x-auto px-1">
        <div role="tablist" className="flex min-w-max items-end gap-1 border-b border-line">
          {tabs.map((t) => {
            const on = t.key === active.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => go(t.key)}
                className={cn(
                  'relative flex h-11 items-center gap-2 whitespace-nowrap px-3.5 text-[14px] outline-none transition-colors focus-visible:text-text',
                  on ? 'text-text' : 'text-muted hover:text-text',
                )}
              >
                {Icon && <Icon className={cn('size-4', on && 'text-ember')} />}
                {t.label}
                {t.badge !== undefined && (
                  <span className={cn('rounded-full px-1.5 text-[11.5px] leading-[18px]', on ? 'bg-ember/15 text-ember' : 'bg-white/[0.06] text-muted')}>{t.badge}</span>
                )}
                {on && (
                  <motion.span
                    layoutId={`subtab-${param}`}
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ember"
                    style={{ boxShadow: '0 0 12px rgba(255,79,18,0.7)' }}
                    transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-clip pt-4">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={active.key}
            role="tabpanel"
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 48, filter: 'blur(6px)' }),
              center: { opacity: 1, x: 0, filter: 'blur(0px)' },
              exit: (d: number) => ({ opacity: 0, x: d * -36, filter: 'blur(6px)' }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.7 }}
          >
            {active.render(go)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
