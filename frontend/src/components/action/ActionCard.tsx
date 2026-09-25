import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { IconTile } from '../ui/icon-tile'
import type { AccentColour } from '../../utils/constants'
import styles from './ActionCard.module.css'

export type ActionStatus = 'ready' | 'sending' | 'sent'

export interface ActionCardProps {
  title: string
  subtitle?: string
  caption?: string
  bodyPreview: string
  buttonLabel: string
  readyLabel: string
  /** Accent used for both the icon tile and the "ready" status badge — a document-status axis,
   * distinct from the entity-type colour semantics (same reasoning `RiskScore.tsx` uses for its
   * risk-band pill). */
  readyAccent: AccentColour
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
  readyAccent,
  status,
  onOpen,
  icon,
}: ActionCardProps) {
  const sent = status === 'sent'

  return (
    <Card className="flex flex-col gap-3.5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconTile color={readyAccent}>{icon}</IconTile>
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-[17px] font-bold text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[13px] italic text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <Badge
          variant={sent ? 'moss' : readyAccent}
          className={clsx('flex-none px-3.5 py-1.5 text-xs', sent && styles.sentChip)}
        >
          {sent && <CheckCircle2 size={13} />}
          {sent ? 'SENT ✓' : readyLabel}
        </Badge>
      </div>

      {caption && (
        <div className="flex items-center gap-2 rounded-lg bg-vermillion/10 px-3.5 py-2.5 text-xs font-semibold text-vermillion">
          <AlertTriangle size={14} />
          <span>{caption}</span>
        </div>
      )}

      <p className="relative max-h-[78px] overflow-hidden rounded-lg bg-muted p-3.5 font-[family-name:var(--font-mono)] text-xs text-muted-foreground [mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] whitespace-pre-line">
        {bodyPreview}
      </p>

      <div className="flex justify-end">
        <Button onClick={onOpen} disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : sent ? 'View document' : buttonLabel}
        </Button>
      </div>
    </Card>
  )
}
