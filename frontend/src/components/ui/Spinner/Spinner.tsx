import clsx from 'clsx'
import styles from './Spinner.module.css'

export interface SpinnerProps {
  /** 0..100 */
  percent: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}

/** Animated SVG progress ring (stroke-dashoffset technique) — used by the Trace screen. */
export function Spinner({ percent, size = 220, strokeWidth = 14, label, className }: SpinnerProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  const r = size / 2 - strokeWidth / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - clamped / 100)

  return (
    <div className={clsx(styles.wrapper, className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(clamped)}%`}>
        <circle cx={cx} cy={cy} r={r} fill="none" className={styles.track} strokeWidth={strokeWidth} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className={styles.ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <span className={styles.label}>{label ?? `${Math.round(clamped)}%`}</span>
    </div>
  )
}
