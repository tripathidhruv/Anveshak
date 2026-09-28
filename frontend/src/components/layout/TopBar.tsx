import { Bell, LogOut, RotateCcw, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { clearAuthToken, clearGuestMode } from '@/lib/authToken'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useAuthStore } from '../../store/authStore'
import { useCaseStore } from '../../store/caseStore'
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
  const resetCaseStore = useCaseStore((state) => state.reset)
  const clearIdentity = useAuthStore((state) => state.clear)

  const title = getPageTitle(location.pathname)

  function handleReset() {
    resetCaseStore()
    showToast('Demo reset')
    navigate(ROUTES.dashboard)
  }

  /** `clearAuthToken()` now clears the demo role string the /login role-picker persisted
   * (see `lib/authToken.ts`), not a real JWT -- same function, same localStorage key, just no
   * longer backed by a real auth microservice. No other change needed here for that switch. */
  function handleLogout() {
    clearAuthToken()
    clearGuestMode()
    clearIdentity()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-18 shrink-0 items-center gap-5 border-b border-border bg-card px-6">
      <h1 className="whitespace-nowrap font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
        {title}
      </h1>

      <div className="flex max-w-md flex-1 items-center gap-2.5 rounded-xl border border-border bg-muted px-4 py-2.5 text-muted-foreground">
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
              'relative h-5 w-9 rounded-full bg-muted transition-colors',
              judgeMode && 'bg-primary',
            )}
          >
            <span
              className={cn(
                'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow-sm transition-transform',
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted"
        >
          <Bell size={16} />
        </button>

        <div
          title="Investigating Officer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border font-[family-name:var(--font-display)] text-xs font-bold text-primary"
        >
          IO
        </div>

        <button
          type="button"
          aria-label="Log out"
          title="Log out"
          onClick={handleLogout}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-vermillion"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
