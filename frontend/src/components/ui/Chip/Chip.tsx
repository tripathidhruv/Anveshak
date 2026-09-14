import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'
import type { SemanticColour } from '../../../utils/constants'
import { COLOUR_SEMANTICS } from '../../../utils/constants'
import styles from './Chip.module.css'

interface BaseChipProps {
  children: ReactNode
  /** Colour keyed to the colour-semantics map — e.g. "safe" renders moss, "criminal" renders vermillion. */
  colour?: SemanticColour
  className?: string
}

export interface StatusChipProps
  extends BaseChipProps,
    Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'className' | 'color'> {
  variant?: 'status'
}

export interface SegmentedChipProps
  extends BaseChipProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'color'> {
  variant: 'segmented'
  selected?: boolean
}

export type ChipProps = StatusChipProps | SegmentedChipProps

/**
 * Two flavours in one component: a tinted `status` pill (dashboard status/risk-adjacent labels)
 * and a `segmented` single-select control chip (e.g. cryptocurrency picker on New Case).
 */
export function Chip(props: ChipProps) {
  const { children, colour, className, variant = 'status' } = props
  const accent = colour ? COLOUR_SEMANTICS[colour] : undefined

  if (variant === 'segmented') {
    const { selected, onClick, disabled, type, ...ariaRest } = props as SegmentedChipProps
    return (
      <button
        type={type ?? 'button'}
        onClick={onClick}
        disabled={disabled}
        className={clsx(styles.chip, styles.segmented, selected && styles.selected, className)}
        data-accent={accent}
        aria-pressed={selected}
        title={ariaRest.title}
      >
        {children}
      </button>
    )
  }

  const rest = props as StatusChipProps
  return (
    <span className={clsx(styles.chip, styles.status, className)} data-accent={accent} title={rest.title}>
      {children}
    </span>
  )
}
