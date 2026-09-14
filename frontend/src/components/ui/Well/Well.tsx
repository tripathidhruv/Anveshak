import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Well.module.css'

export interface WellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** A generic `.pressed` container — stat wells, footnotes, any sunken content block. */
export function Well({ children, className, ...rest }: WellProps) {
  return (
    <div className={clsx(styles.well, className)} {...rest}>
      {children}
    </div>
  )
}
