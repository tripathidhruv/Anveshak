import { Bell, RotateCcw, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useUIStore } from '../../store/uiStore'
import { ROUTES } from '../../utils/constants'
import { getPageTitle } from './routeMeta'

/** 72px white top bar: page title, decorative search, demo chrome, Judge Mode, Reset demo. */
export function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const judgeMode = useUIStore((state) => state.judgeMode)
  const toggleJudgeMode = useUIStore((state) => state.toggleJudgeMode)
  const showToast = useUIStore((state) => state.showToast)

  const title = getPageTitle(location.pathname)

  function handleReset() {
    // `caseStore` is scaffolded in Task 3 — this already navigates home and confirms the
    // reset via toast; wiring `caseStore.reset()` in here is a one-line follow-up once that
    // store exists, so Reset demo works end to end without waiting on it.
    showToast('Demo reset')
    navigate(ROUTES.dashboard)
  }

  return (
    <header className="flex h-[72px] shrink-0 items-center gap-5 border-b border-border bg-card px-6">
      <h1 className="whitespace-nowrap font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
        {title}
      </h1>

      <div className="flex max-w-[420px] flex-1 items-center gap-2.5 rounded-xl border border-border bg-muted px-4 py-2.5 text-muted-foreground">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search cases, wallets, exchanges…"
          readOnly
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="ml-auto flex items-center gap-4">
        <Badge variant="outline" className="shrink-0">
          DEMO DATA
        </Badge>

        <button
          type="button"
          role="switch"
          aria-checked={judgeMode}
          onClick={toggleJudgeMode}
          className="flex items-center gap-2.5 text-sm font-semibold text-foreground"
        >
          <span>Judge Mode</span>
          <span
            className={cn(
              'relative h-[22px] w-[38px] rounded-full bg-muted transition-colors',
              judgeMode && 'bg-primary',
            )}
          >
            <span
              className={cn(
                'absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-card shadow-sm transition-transform',
                judgeMode && 'translate-x-4',
              )}
            />
          </span>
        </button>

        <Button variant="outline" onClick={handleReset}>
          <RotateCcw size={16} /> Reset demo
        </Button>

        <button
          type="button"
          aria-label="Notifications"
          onClick={() => showToast('Coming in v2')}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
        >
          <Bell size={16} />
        </button>

        <div
          title="Investigating Officer"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-border font-[family-name:var(--font-display)] text-xs font-bold text-primary"
        >
          IO
        </div>
      </div>
    </header>
  )
}
