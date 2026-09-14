import { Bell, RotateCcw, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Button, Chip } from '../ui'
import { useUIStore } from '../../store/uiStore'
import { ROUTES } from '../../utils/constants'
import { getPageTitle } from './routeMeta'
import styles from './TopBar.module.css'

/** 72px `.raised` top bar: page title, decorative search, demo chrome, Judge Mode, Reset demo. */
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
    <header className={styles.topbar}>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.searchWell}>
        <Search size={16} />
        <input type="text" placeholder="Search cases, wallets, exchanges…" readOnly />
      </div>

      <div className={styles.right}>
        <Chip className={styles.demoChip} colour="info">
          DEMO DATA
        </Chip>

        <button
          type="button"
          className={styles.judgeToggle}
          role="switch"
          aria-checked={judgeMode}
          onClick={toggleJudgeMode}
        >
          <span>Judge Mode</span>
          <span className={clsx(styles.track, judgeMode && styles.trackOn)}>
            <span className={styles.knob} />
          </span>
        </button>

        <Button className={styles.resetButton} onClick={handleReset}>
          <RotateCcw size={16} /> Reset demo
        </Button>

        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notifications"
          onClick={() => showToast('Coming in v2')}
        >
          <Bell size={16} />
        </button>

        <div className={styles.avatar} title="Investigating Officer">
          IO
        </div>
      </div>
    </header>
  )
}
