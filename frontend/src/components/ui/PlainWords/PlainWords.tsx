import type { HTMLAttributes, ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import clsx from 'clsx'
import styles from './PlainWords.module.css'

export interface PlainWordsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * The full-width `.pressed` strip with a lightbulb icon + one plain-English sentence,
 * placed under every technical panel (UX law 3: "In plain words").
 */
export function PlainWords({ children, className, ...rest }: PlainWordsProps) {
  return (
    <div className={clsx(styles.strip, className)} {...rest}>
      <span className={styles.iconTile}>
        <Lightbulb size={18} />
      </span>
      <p className={styles.text}>{children}</p>
    </div>
  )
}
