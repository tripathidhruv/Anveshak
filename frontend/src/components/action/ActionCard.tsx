import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import { Badge, Button, Card } from '../ui'
import styles from './ActionCard.module.css'

export type ActionStatus = 'ready' | 'sending' | 'sent'

export interface ActionCardProps {
  title: string
  subtitle?: string
  caption?: string
  bodyPreview: string
  buttonLabel: string
  readyLabel: string
  /** A CSS colour value, e.g. `'var(--sky)'` — kept off the shared `COLOUR_SEMANTICS` map since
   * these are document-status chips, a distinct axis from the entity-type colour semantics
   * (same reasoning `RiskScore.tsx` uses for its risk-band pill). */
  readyColour: string
  status: ActionStatus
  onOpen: () => void
  icon: ReactNode
}

/** One stacked lawful-action card — status chip flips to a moss "SENT ✓" once the notice has
 * gone out, per the source spec. */
export function ActionCard({
  title,
  subtitle,
  caption,
  bodyPreview,
  buttonLabel,
  readyLabel,
  readyColour,
  status,
  onOpen,
  icon,
}: ActionCardProps) {
  const sent = status === 'sent'

  return (
    <Card className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <span className={styles.iconTile}>{icon}</span>
          <div>
            <h3 className={styles.title}>{title}</h3>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
        <Badge
          className={clsx(styles.statusChip, sent && styles.sentChip)}
          style={{ ['--badge-colour' as string]: sent ? 'var(--moss)' : readyColour } as CSSProperties}
        >
          {sent && <CheckCircle2 size={13} />}
          {sent ? 'SENT ✓' : readyLabel}
        </Badge>
      </div>

      {caption && (
        <div className={styles.caption}>
          <AlertTriangle size={14} />
          <span>{caption}</span>
        </div>
      )}

      <p className={styles.preview}>{bodyPreview}</p>

      <div className={styles.actions}>
        <Button onClick={onOpen} disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : sent ? 'View document' : buttonLabel}
        </Button>
      </div>
    </Card>
  )
}
