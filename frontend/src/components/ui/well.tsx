import * as React from 'react'
import { cn } from '@/lib/utils'
import { IconTile } from './icon-tile'

export interface WellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/** Generic flat "well" container — stat blocks, footnotes, any grouped content block. */
function Well({ children, className, ...props }: WellProps) {
  return (
    <div className={cn('rounded-xl bg-muted p-4', className)} {...props}>
      {children}
    </div>
  )
}

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  value: React.ReactNode
  /** Optional small trailing note, e.g. a delta or unit. */
  hint?: React.ReactNode
  /** Optional small icon tile shown above the label -- matches the Dashboard KPI-tile pattern. */
  icon?: React.ReactNode
  /** Icon-tile colour, only used when `icon` is given. */
  iconColor?: React.ComponentProps<typeof IconTile>['color']
}

/** A small KPI-style stat block (label + big number) built on top of `Well`. */
function Stat({ label, value, hint, icon, iconColor, className, ...props }: StatProps) {
  return (
    <Well className={cn('flex flex-col gap-1', className)} {...props}>
      {icon && (
        <IconTile color={iconColor} size="sm" className="mb-1">
          {icon}
        </IconTile>
      )}
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-[family-name:var(--font-mono)] text-2xl font-bold text-foreground">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Well>
  )
}

export { Well, Stat }
