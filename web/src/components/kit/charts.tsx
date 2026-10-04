import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { type Tone, toneA, toneHex } from './tone'

/* ───────── size hook ───────── */
export function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = React.useRef<T>(null)
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize((s) => (Math.abs(s.width - width) > 0.5 || Math.abs(s.height - height) > 0.5 ? { width, height } : s))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

/* ───────── smooth path (Catmull-Rom → cubic Bézier) ───────── */
export function smoothPath(pts: [number, number][], tension = 0.5): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

/* ───────── Sparkline ───────── */
export function Sparkline({
  data,
  tone = 'moss',
  width = 120,
  height = 36,
  area = true,
  className,
}: {
  data: number[]
  tone?: Tone
  width?: number
  height?: number
  area?: boolean
  className?: string
}) {
  const id = React.useId()
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - 3 - ((v - min) / (max - min || 1)) * (height - 6),
  ])
  const d = smoothPath(pts)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)}>
      <defs>
        <linearGradient id={`sa${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={toneA(tone, 0.28)} />
          <stop offset="100%" stopColor={toneA(tone, 0)} />
        </linearGradient>
        <linearGradient id={`sl${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={toneA(tone, 0.15)} />
          <stop offset="60%" stopColor={toneHex(tone)} />
          <stop offset="100%" stopColor={toneHex(tone)} />
        </linearGradient>
      </defs>
      {area && <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#sa${id})`} />}
      <motion.path
        d={d}
        fill="none"
        stroke={`url(#sl${id})`}
        strokeWidth={1.6}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 4px ${toneA(tone, 0.6)})` }}
      />
    </svg>
  )
}

/* ───────── CurveChart — glowing multi-line over a grid (Vaulto "Balance Spendings") ───────── */
export type CurveSeries = { name: string; tone: Tone; data: number[]; dashed?: boolean }

export function CurveChart({
  series,
  labels,
  height = 220,
  highlight,
  format = (v: number) => String(v),
  className,
  pills = true,
  activePill,
}: {
  series: CurveSeries[]
  labels: string[]
  height?: number
  highlight?: { series: number; index: number; title: string }
  format?: (v: number) => string
  className?: string
  pills?: boolean
  activePill?: number
}) {
  const [ref, { width }] = useSize<HTMLDivElement>()
  const [hover, setHover] = React.useState<number | null>(null)
  const id = React.useId()
  const all = series.flatMap((s) => s.data)
  const min = Math.min(...all)
  const max = Math.max(...all)
  const padT = 18
  const padB = 10
  const n = labels.length
  const x = (i: number) => (n === 1 ? 0 : (i / (n - 1)) * width)
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (height - padT - padB)
  const hi = hover ?? highlight?.index ?? null
  const hiSeries = highlight?.series ?? 0

  return (
    <div className={cn('relative', className)}>
      <div
        ref={ref}
        className="k-grid-bg relative w-full overflow-hidden rounded-xl"
        style={{ height, maskImage: 'linear-gradient(90deg, transparent 0%, #000 12%, #000 100%)' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
          setHover(Math.max(0, Math.min(n - 1, i)))
        }}
      >
        {width > 0 && (
          <svg width={width} height={height} className="absolute inset-0">
            <defs>
              {series.map((s, si) => (
                <linearGradient key={si} id={`cl${id}${si}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={toneA(s.tone, 0)} />
                  <stop offset="25%" stopColor={toneA(s.tone, 0.8)} />
                  <stop offset="100%" stopColor={toneHex(s.tone)} />
                </linearGradient>
              ))}
            </defs>
            {series.map((s, si) => {
              const d = smoothPath(s.data.map((v, i) => [x(i), y(v)]), 0.55)
              return (
                <g key={si}>
                  <path d={d} fill="none" stroke={toneA(s.tone, 0.35)} strokeWidth={6} style={{ filter: 'blur(6px)' }} />
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={`url(#cl${id}${si})`}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? '4 6' : undefined}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.6, delay: si * 0.15, ease: [0.3, 0.7, 0.2, 1] }}
                  />
                </g>
              )
            })}
            {hi !== null && (
              <line x1={x(hi)} x2={x(hi)} y1={0} y2={height} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 4" />
            )}
          </svg>
        )}
        {width > 0 && hi !== null && (
          <>
            <div
              className="pointer-events-none absolute"
              style={{ left: x(hi), top: y(series[hiSeries].data[hi]), transform: 'translate(-50%,-50%)' }}
            >
              <span className="k-pulse-ring absolute inset-0 rounded-full" style={{ background: toneHex(series[hiSeries].tone) }} />
              <span
                className="relative block size-3 rounded-full border-2 border-[#1a1a1c]"
                style={{ background: toneHex(series[hiSeries].tone), boxShadow: `0 0 12px ${toneHex(series[hiSeries].tone)}` }}
              />
            </div>
            <div
              className="pointer-events-none absolute z-10 min-w-[150px] whitespace-nowrap rounded-lg border border-line-2 bg-[#1d1d20]/95 px-2.5 py-1.5 shadow-xl backdrop-blur"
              style={{
                left: Math.min(Math.max(x(hi), 80), width - 80),
                top: Math.max(4, y(series[hiSeries].data[hi]) - 58),
                transform: 'translateX(-50%)',
              }}
            >
              <div className="text-[11.5px] text-muted">{hover === null && highlight ? highlight.title : labels[hi]}</div>
              {series.map((s, si) => (
                <div key={si} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="size-1.5 rounded-full" style={{ background: toneHex(s.tone) }} />
                    {s.name}
                  </span>
                  <span className="k-num text-text">{format(s.data[hi])}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {pills && (
        <div className="mt-3 flex items-center justify-between gap-1 overflow-hidden">
          {labels.map((l, i) => (
            <span
              key={i}
              className={cn(
                'grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] transition-colors',
                labels.length > 10 && i % 2 === 1 && 'max-md:hidden',
                i === (hover ?? activePill ?? highlight?.index)
                  ? 'bg-white/[0.14] text-text'
                  : 'bg-white/[0.04] text-dim',
              )}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────── BarColumns — tall tracks with a highlighted column (Vaulto weekday bars) ───────── */
export function BarColumns({
  data,
  height = 160,
  tone = 'crimson',
  className,
  format,
}: {
  data: { label: string; value: number; highlight?: boolean; sub?: string }[]
  height?: number
  tone?: Tone
  className?: string
  format?: (v: number) => string
}) {
  const max = Math.max(...data.map((d) => d.value)) * 1.08
  const [hover, setHover] = React.useState<number | null>(null)
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * 100
          const active = d.highlight || hover === i
          return (
            <div
              key={i}
              className="relative flex h-full flex-1 justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className="relative h-full w-full max-w-[30px] overflow-hidden rounded-[9px]"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.025) 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)',
                }}
              >
                <motion.div
                  className="absolute inset-x-0 bottom-0 rounded-[9px]"
                  initial={{ height: 0 }}
                  whileInView={{ height: `${h}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
                  style={{
                    background: d.highlight
                      ? `linear-gradient(180deg, ${toneHex(tone)} 0%, ${toneA(tone, 0.55)} 22%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0.02) 100%)`
                      : 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.04) 100%)',
                    boxShadow: d.highlight ? `0 -6px 22px ${toneA(tone, 0.55)}` : undefined,
                  }}
                />
              </div>
              {active && format && (
                <div className="pointer-events-none absolute -top-6 whitespace-nowrap rounded-md bg-[#232326] px-1.5 py-0.5 text-[11.5px] text-text shadow">
                  {format(d.value)}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex justify-between gap-2">
        {data.map((d, i) => (
          <div key={i} className={cn('flex-1 text-center text-[12px]', d.highlight ? 'font-medium text-text' : 'text-dim')}>
            {d.label}
            {d.sub && <div className="text-[11px] text-dim">{d.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── HeatGrid — square-cell matrix (Vaulto "Net Cashflow") ───────── */
export function HeatGrid({
  data,
  tone = 'white',
  cell = 13,
  gap = 3,
  rowLabels,
  colLabels,
  accent,
  className,
  title,
}: {
  data: number[][]
  tone?: Tone
  cell?: number
  gap?: number
  rowLabels?: string[]
  colLabels?: string[]
  /** cells drawn in an accent tone, keyed "r-c" */
  accent?: Record<string, Tone>
  className?: string
  title?: (r: number, c: number, v: number) => string
}) {
  return (
    <div className={cn('inline-block', className)}>
      <div className="flex" style={{ gap }}>
        {rowLabels && (
          <div className="flex flex-col pr-1.5" style={{ gap }}>
            {rowLabels.map((l) => (
              <div key={l} className="flex items-center justify-end text-[11px] text-dim" style={{ height: cell }}>
                {l}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col" style={{ gap }}>
          {data.map((row, r) => (
            <div key={r} className="flex" style={{ gap }}>
              {row.map((v, c) => {
                const acc = accent?.[`${r}-${c}`]
                const bg = acc
                  ? toneHex(acc)
                  : v <= 0.02
                    ? 'rgba(255,255,255,0.045)'
                    : tone === 'white'
                      ? `rgba(244,244,245,${0.12 + v * 0.88})`
                      : toneA(tone, 0.15 + v * 0.85)
                return (
                  <motion.div
                    key={c}
                    title={title?.(r, c, v)}
                    initial={{ opacity: 0, scale: 0.6 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: (r + c) * 0.012 }}
                    className="rounded-[3px]"
                    style={{
                      width: cell,
                      height: cell,
                      background: bg,
                      boxShadow: acc ? `0 0 10px ${toneA(acc, 0.7)}` : v > 0.85 ? '0 0 8px rgba(255,255,255,0.35)' : undefined,
                    }}
                  />
                )
              })}
            </div>
          ))}
          {colLabels && (
            <div className="flex" style={{ gap }}>
              {colLabels.map((l, i) => (
                <div key={i} className="text-center text-[10.5px] text-dim" style={{ width: cell }}>
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ───────── Donut ───────── */
export function Donut({
  parts,
  size = 140,
  stroke = 16,
  center,
}: {
  parts: { value: number; tone: Tone; label?: string }[]
  size?: number
  stroke?: number
  center?: React.ReactNode
}) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {parts.map((p, i) => {
          const len = (p.value / total) * c
          const off = acc
          acc += len
          return (
            <motion.circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={toneHex(p.tone)}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
              initial={{ strokeDashoffset: -off + len }}
              whileInView={{ strokeDashoffset: -off }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08 }}
              style={{ filter: `drop-shadow(0 0 5px ${toneA(p.tone, 0.45)})` }}
            />
          )
        })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  )
}
