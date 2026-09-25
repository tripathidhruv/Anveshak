import * as React from 'react'
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PlainWordsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/**
 * The full-width "in plain words" strip with a lightbulb icon + one plain-English sentence,
 * placed under every technical panel (UX law 3: "In plain words").
 */
function PlainWords({ children, className, ...props }: PlainWordsProps) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-primary/10 bg-primary/5 p-4', className)} {...props}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lightbulb size={16} />
      </span>
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  )
}

export { PlainWords }
