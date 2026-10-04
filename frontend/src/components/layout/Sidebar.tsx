import { LifeBuoy, Plus } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { LogoMark } from '../../assets/logoMark'
import { useUIStore } from '../../store/uiStore'
import { ROUTES } from '../../utils/constants'
import { NAV_ITEMS } from './navConfig'

/** 248px white `Card`-style sidebar: logo, primary nav, `+ New Case`, Help & Support footer. */
export function Sidebar() {
  const navigate = useNavigate()
  const showToast = useUIStore((state) => state.showToast)

  return (
    <aside className="flex h-screen w-62 shrink-0 flex-col gap-6 border-r border-border bg-card p-4">
      <div className="flex items-center gap-3 px-2 pt-2">
        <LogoMark size={22} />
        <div>
          <div className="font-[family-name:var(--font-display)] text-sm font-bold leading-tight text-foreground">
            ANVESHAK
          </div>
          <div className="text-xs text-muted-foreground">Cyber Cell Console</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon

          if (!item.to) {
            return (
              <button
                key={item.key}
                type="button"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => showToast('Coming in v2')}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  <Icon size={18} />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            )
          }

          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted',
                  isActive && 'bg-primary/10 font-semibold text-primary hover:bg-primary/10',
                )
              }
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <Icon size={18} />
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      <Button variant="default" className="w-full" onClick={() => navigate(ROUTES.newCase)}>
        <Plus size={16} /> New Case
      </Button>

      <div className="flex-1" />

      <button
        type="button"
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        onClick={() => showToast('Coming in v2')}
      >
        <LifeBuoy size={16} /> Help &amp; Support
      </button>
    </aside>
  )
}
