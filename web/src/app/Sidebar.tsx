import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { PanelLeft, Siren } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV } from './nav'
import { LogoMark, Wordmark } from './Logo'
import { useCountdown } from '@/components/kit'
import { mmss } from '@/lib/format'

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const left = useCountdown(38 * 60 + 12)
  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-line bg-sidebar transition-[width] duration-300',
        collapsed ? 'w-[76px]' : 'w-[256px]',
      )}
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)', backdropFilter: 'blur(26px) saturate(160%)', WebkitBackdropFilter: 'blur(26px) saturate(160%)' }}
    >
      <div className={cn('flex h-16 shrink-0 items-center px-5', collapsed ? 'justify-center px-0' : 'justify-between')}>
        {collapsed ? <LogoMark /> : <Wordmark />}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md text-dim hover:bg-white/5 hover:text-text"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="size-4" />
          </button>
        )}
      </div>

      <nav className="k-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {NAV.map((g, gi) => (
          <div key={g.label} className={cn(gi > 0 && 'mt-4 border-t border-line pt-4')}>
            {!collapsed && <div className="mb-1.5 px-2.5 text-[12px] font-medium tracking-[0.04em] text-dim">{g.label}</div>}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === '/'}
                    onClick={onNavigate}
                    title={collapsed ? it.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive ? 'text-text' : 'text-muted hover:bg-white/[0.035] hover:text-text',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-[10px] border border-line-2"
                            style={{
                              background: 'var(--k-glass-hi)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 16px -8px rgba(0,0,0,0.9)',
                            }}
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span
                          className={cn(
                            'relative grid size-5 shrink-0 place-items-center rounded-md',
                            isActive && 'bg-white text-[#111]',
                          )}
                        >
                          <it.icon className="size-[14px]" strokeWidth={isActive ? 2.4 : 1.8} />
                        </span>
                        {!collapsed && <span className="relative flex-1 truncate">{it.label}</span>}
                        {!collapsed && it.live && (
                          <span className="relative inline-flex size-1.5">
                            <span className="k-pulse-ring absolute inset-0 rounded-full bg-ember" />
                            <span className="relative size-1.5 rounded-full bg-ember" />
                          </span>
                        )}
                        {!collapsed && it.badge && (
                          <span className="relative grid h-[18px] min-w-[18px] place-items-center rounded-md bg-white/[0.07] px-1 text-[11.5px] text-text/80">
                            {it.badge}
                          </span>
                        )}
                        {!collapsed && it.isNew && !it.badge && (
                          <span className="relative rounded-md bg-ember/15 px-1.5 py-px text-[10.5px] font-semibold tracking-wide text-ember">NEW</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-3">
        {collapsed ? (
          <button onClick={onToggle} className="mx-auto grid size-10 place-items-center rounded-xl border border-line-2 bg-raise text-ember" aria-label="Expand sidebar">
            <Siren className="size-4" />
          </button>
        ) : (
          <NavLink
            to="/interdiction"
            onClick={onNavigate}
            className="k-card-glass k-grain relative block overflow-hidden p-3.5 hover:border-ember/40"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,79,18,0.35), transparent 70%)' }}
            />
            <div className="relative flex items-start gap-2.5">
              <span className="mt-0.5 grid size-7 place-items-center rounded-lg bg-ember/15 text-ember">
                <Siren className="size-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-text">Golden hour · 3 cases</div>
                <div className="mt-0.5 text-[12px] leading-snug text-muted">
                  Funds still moving. Next freeze window closes in <span className="k-mono text-ember">{mmss(left)}</span>
                </div>
              </div>
            </div>
          </NavLink>
        )}
      </div>
    </aside>
  )
}
