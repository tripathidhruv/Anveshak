import { Monitor } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { AuroraBackground } from '../ui/aurora-background'
import { Card } from '../ui/card'
import { ToastHost } from '../ui/toast'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StepRail } from './StepRail'
import { isRailVisible } from './routeMeta'

/**
 * The app shell: Sidebar + TopBar + (conditionally) StepRail + routed content.
 * Below 1024px the shell is replaced with a "best viewed on desktop" notice — both are
 * always mounted and toggled purely via Tailwind responsive classes, so there's no
 * resize-listener/hydration flicker to manage.
 */
export function PageShell() {
  const location = useLocation()
  const showRail = isRailVisible(location.pathname)

  return (
    <>
      <AuroraBackground className="hidden lg:flex">
        <div className="flex min-h-screen w-full">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <TopBar />
            <div className="flex-1 overflow-y-auto p-8">
              {showRail && <StepRail />}
              <div key={location.pathname} className="animate-in fade-in duration-200">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </AuroraBackground>

      <div className="flex min-h-screen items-center justify-center bg-background p-6 lg:hidden">
        <Card className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
          <Monitor size={32} className="text-muted-foreground" />
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
            Best viewed on desktop
          </h2>
          <p className="text-sm text-muted-foreground">
            KAIZEN&rsquo;s console is designed for a 1920×1080 (or at minimum 1440×900) desktop display. Please
            reopen this on a larger screen.
          </p>
        </Card>
      </div>

      <ToastHost />
    </>
  )
}
