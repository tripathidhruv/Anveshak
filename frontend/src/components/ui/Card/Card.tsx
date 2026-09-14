import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Card.module.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Inner padding, any CSS length. Defaults to 24px. */
  padding?: string | number
}

/** A `.raised` neumorphic panel — the base container surface used across every screen. */
export function Card({ children, padding, className, style, ...rest }: CardProps) {
  const paddingValue = typeof padding === 'number' ? `${padding}px` : padding
  const mergedStyle: CSSProperties = {
    ...(paddingValue ? { ['--card-padding' as string]: paddingValue } : {}),
    ...style,
  }

  return (
    <div className={clsx(styles.card, className)} style={mergedStyle} {...rest}>
      {children}
    </div>
  )
}
