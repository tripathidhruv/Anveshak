import { LifeBuoy, Plus } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Button } from '../ui'
import { useUIStore } from '../../store/uiStore'
import { ROUTES } from '../../utils/constants'
import { NAV_ITEMS } from './navConfig'
import styles from './Sidebar.module.css'

/** 248px `.raised` sidebar: logo, primary nav, `+ New Case`, Help & Support footer. */
export function Sidebar() {
  const navigate = useNavigate()
  const showToast = useUIStore((state) => state.showToast)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoBlock}>
        <div className={styles.logoMark}>◆</div>
        <div>
          <div className={styles.logoText}>KAIZEN</div>
          <div className={styles.logoSub}>Cyber Cell Console</div>
        </div>
      </div>

      <nav className={styles.navSection}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
            >
              <span className={styles.navIcon}>
                <Icon size={18} />
              </span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge ? <span className={styles.navBadge}>{item.badge}</span> : null}
            </NavLink>
          )
        })}
      </nav>

      <Button
        variant="primary"
        className={styles.newCaseButton}
        onClick={() => navigate(ROUTES.newCase)}
      >
        <Plus size={16} /> New Case
      </Button>

      <div className={styles.spacer} />

      <button
        type="button"
        className={styles.helpLink}
        onClick={() => showToast('Coming in v2')}
      >
        <LifeBuoy size={16} /> Help &amp; Support
      </button>
    </aside>
  )
}
