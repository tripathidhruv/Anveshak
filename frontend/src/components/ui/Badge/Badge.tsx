import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import type { SemanticColour } from '../../../utils/constants'
import { COLOUR_SEMANTICS } from '../../../utils/constants'
import styles from './Badge.module.css'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  colour?: SemanticColour
}

/**
 * Solid-fill, white-text status/risk indicator — never encode meaning in shadow alone
 * (Global Constraints accessibility rule). E.g. HIGH RISK = solid vermillion fill.
 */
export function Badge({ children, colour, className, ...rest }: BadgeProps) {
  const accent = colour ? COLOUR_SEMANTICS[colour] : undefined
  return (
    <span className={clsx(styles.badge, className)} data-accent={accent} {...rest}>
      {children}
    </span>
  )
}
