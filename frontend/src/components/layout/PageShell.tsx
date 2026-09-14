import { Monitor } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { ToastHost } from '../ui'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StepRail } from './StepRail'
import { isRailVisible } from './routeMeta'
import styles from './PageShell.module.css'

/**
 * The app shell: Sidebar + TopBar + (conditionally) StepRail + routed content.
 * Below 1024px the shell is replaced with a "best viewed on desktop" notice — both are
 * always mounted and toggled purely via CSS media queries (`PageShell.module.css`), so
 * there's no resize-listener/hydration flicker to manage.
 */
export function PageShell() {
  const location = useLocation()
  const showRail = isRailVisible(location.pathname)

  return (
    <>
      <div className={styles.shell}>
        <Sidebar />
        <div className={styles.main}>
          <TopBar />
          <div className={styles.content}>
            {showRail && <StepRail />}
            <div key={location.pathname} className={styles.transition}>
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.mobileLock}>
        <div className={styles.mobileLockCard}>
          <Monitor size={32} />
          <h2 className="card-title">Best viewed on desktop</h2>
          <p>
            KAIZEN&rsquo;s console is designed for a 1920×1080 (or at minimum 1440×900) desktop display.
            Please reopen this on a larger screen.
          </p>
        </div>
      </div>

      <ToastHost />
    </>
  )
}
