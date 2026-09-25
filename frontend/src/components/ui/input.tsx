import * as React from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  /** Small grey technical subtitle under the label — the plain-English-heading pattern. */
  subtitle?: React.ReactNode
  wrapperClassName?: string
}

/** A labeled text input with an optional plain-English subtitle slot. */
function Input({ label, subtitle, wrapperClassName, className, id, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      <input
        id={inputId}
        className={cn(
          'rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export { Input }
