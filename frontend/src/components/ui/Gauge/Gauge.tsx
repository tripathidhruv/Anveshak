import { useEffect, useId, useState } from 'react'
import clsx from 'clsx'
import styles from './Gauge.module.css'

export interface GaugeProps {
  /** 0..1 */
  value: number
  size?: number
  strokeWidth?: number
  /** Gradient sweep colours, e.g. ["var(--moss)", "var(--gold)", "var(--vermillion)"] */
  colourStops?: string[]
  showValue?: boolean
  className?: string
}

/**
 * Semicircular SVG arc gauge. Animates its sweep from 0 to `value` on mount via a
 * CSS transition on stroke-dashoffset (900ms cubic-bezier(.22,1,.36,1) per the risk-gauge spec).
 */
export function Gauge({
  value,
  size = 260,
  strokeWidth = 20,
  colourStops = ['var(--moss)', 'var(--gold)', 'var(--vermillion)'],
  showValue = true,
  className,
}: GaugeProps) {
  const gradientId = useId()
  const clamped = Math.min(1, Math.max(0, value))
  const [animatedValue, setAnimatedValue] = useState(0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedValue(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])

  const width = size
  const height = size / 2 + strokeWidth / 2
  const r = size / 2 - strokeWidth / 2
  const cx = size / 2
  const cy = size / 2

  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`

  return (
    <div className={clsx(styles.wrapper, className)}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${Math.round(clamped * 100)}%`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            {colourStops.map((colour, i) => (
              <stop key={colour} offset={colourStops.length > 1 ? i / (colourStops.length - 1) : 0} stopColor={colour} />
            ))}
          </linearGradient>
        </defs>
        <path d={arcPath} fill="none" className={styles.track} strokeWidth={strokeWidth} strokeLinecap="round" />
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - animatedValue}
          className={styles.arc}
        />
        {showValue && (
          <text x={cx} y={cy - strokeWidth} textAnchor="middle" className={styles.valueLabel}>
            {clamped.toFixed(2)}
          </text>
        )}
      </svg>
    </div>
  )
}
