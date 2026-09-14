import type { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` = the one solid-indigo action per screen. `default` = raised-sm clickable surface. */
  variant?: 'primary' | 'default'
}

/**
 * The one primary action per screen is `variant="primary"` — solid indigo fill, white text,
 * neumorphic drop shadow. Everything else is `variant="default"`.
 */
export function Button({ variant = 'default', className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(styles.button, variant === 'primary' ? styles.primary : styles.default, className)}
      {...rest}
    />
  )
}
