import * as React from 'react'
import { cn } from '@/lib/utils'

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/** Wraps content in the subtle animated aurora gradient (see .aurora-bg in globals.css).
 * Light theme only -- sits behind white cards, not meant to carry text directly on it. */
function AuroraBackground({ className, children, ...props }: AuroraBackgroundProps) {
  return (
    <div className={cn('aurora-bg min-h-screen bg-background', className)} {...props}>
      {children}
    </div>
  )
}

export { AuroraBackground }
