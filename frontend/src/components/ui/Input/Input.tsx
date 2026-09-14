import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import clsx from 'clsx'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  /** Small grey technical subtitle under the label — the plain-English-heading pattern (UX law 2). */
  subtitle?: ReactNode
  wrapperClassName?: string
}

/** A `.pressed` text field with an optional label + subtitle slot. */
export function Input({ label, subtitle, wrapperClassName, className, id, ...rest }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={clsx(styles.wrapper, wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      <input id={inputId} className={clsx(styles.field, className)} {...rest} />
    </div>
  )
}
