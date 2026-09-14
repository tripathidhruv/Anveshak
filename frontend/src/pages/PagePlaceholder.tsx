import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'
import { Card } from '../components/ui'
import styles from './PagePlaceholder.module.css'

export interface PagePlaceholderProps {
  screenName: string
  note: string
  icon?: LucideIcon
}

/**
 * Shared `.raised` placeholder panel for every screen not yet built. Real screen content
 * lands in Tasks 4-7; this only proves the route resolves and the shell renders correctly.
 */
export function PagePlaceholder({ screenName, note, icon: Icon = Construction }: PagePlaceholderProps) {
  return (
    <Card className={styles.card}>
      <span className={styles.icon}>
        <Icon size={22} />
      </span>
      <h2 className="card-title">{screenName}</h2>
      <p className={styles.note}>{note}</p>
    </Card>
  )
}
