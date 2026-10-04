import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { sectionFor } from './nav'

/** Section with sub-screens: a tab bar above the active sub-screen. */
export function Section() {
  const { pathname } = useLocation()
  const section = sectionFor(pathname)
  const tabs = section?.tabs ?? []
  return (
    <div>
      <div className="k-scroll -mx-1 mb-5 mt-1 overflow-x-auto px-1 pb-1">
        <div
          className="inline-flex items-center gap-1 rounded-2xl border border-line-2 p-1"
          style={{ background: 'linear-gradient(180deg,#19191b,#121213)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
          role="tablist"
        >
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end
              role="tab"
              className={({ isActive }) =>
                cn(
                  'relative flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-[14.5px] transition-colors',
                  isActive ? 'text-text' : 'text-muted hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={`section-tab-${section?.to}`}
                      className="absolute inset-0 rounded-xl border border-line-2"
                      style={{ background: 'linear-gradient(180deg,#2c2c30,#1f1f22)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 8px 18px -10px rgba(0,0,0,0.9)' }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <t.icon className={cn('relative size-4', isActive && 'text-ember')} />
                  <span className="relative">{t.label}</span>
                  {t.isNew && <span className="relative rounded-md bg-ember/15 px-1.5 py-px text-[11.5px] font-semibold text-ember">NEW</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}>
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
