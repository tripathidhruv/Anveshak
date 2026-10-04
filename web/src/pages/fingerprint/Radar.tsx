import * as React from 'react'
import { motion } from 'motion/react'
import { toneA, toneHex, type Tone } from '@/components/kit'

export type RadarSeries = { name: string; tone: Tone; values: number[]; dashed?: boolean }

const SIZE = 380
const C = SIZE / 2
const R = 128

function point(i: number, n: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2
  return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]
}

function polyPath(values: number[]): string {
  return values.map((v, i) => {
    const [x, y] = point(i, values.length, Math.max(0.04, v))
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ') + ' Z'
}

/** Glowing radar (spider) chart — polygons morph with a spring when values change. */
export function Radar({
  labels,
  series,
  activeAxis,
  onAxisHover,
}: {
  labels: string[]
  series: RadarSeries[]
  activeAxis?: number | null
  onAxisHover?: (i: number | null) => void
}) {
  const id = React.useId().replace(/:/g, '')
  const n = labels.length
  const spring = { type: 'spring' as const, stiffness: 90, damping: 18 }

  return (
    <svg viewBox={`-60 -8 ${SIZE + 120} ${SIZE + 16}`} className="mx-auto block w-full max-w-[460px] overflow-visible" role="img" aria-label="Radar chart comparing behavioural habits">
      <defs>
        <filter id={`glow${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`bg${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {series.map((s, si) => (
          <radialGradient key={si} id={`fill${id}${si}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={toneA(s.tone, 0.05)} />
            <stop offset="100%" stopColor={toneA(s.tone, 0.32)} />
          </radialGradient>
        ))}
      </defs>

      <circle cx={C} cy={C} r={R + 6} fill={`url(#bg${id})`} />

      {/* grid rings */}
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <path
          key={k}
          d={polyPath(Array(n).fill(k))}
          fill="none"
          stroke={k === 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
          strokeDasharray={k === 1 ? undefined : '2 4'}
        />
      ))}

      {/* spokes + labels */}
      {labels.map((l, i) => {
        const [x, y] = point(i, n, 1)
        const [lx, ly] = point(i, n, 1.2)
        const active = activeAxis === i
        const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end'
        return (
          <g
            key={l}
            onMouseEnter={() => onAxisHover?.(i)}
            onMouseLeave={() => onAxisHover?.(null)}
            className="cursor-default"
          >
            <line x1={C} y1={C} x2={x} y2={y} stroke={active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)'} strokeWidth={active ? 1.2 : 1} />
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={11.5}
              fill={active ? '#f4f4f5' : '#8b8b90'}
              style={{ fontFamily: 'var(--font-sans)', transition: 'fill .2s' }}
            >
              <tspan fill={active ? '#f4f4f5' : '#5c5c62'} style={{ fontFamily: 'var(--font-mono)' }} fontSize={10}>
                {i + 1}{' '}
              </tspan>
              {l}
            </text>
          </g>
        )
      })}

      {/* polygons */}
      {series.map((s, si) => {
        const d = polyPath(s.values)
        return (
          <g key={s.name + si}>
            <motion.path
              initial={false}
              animate={{ d }}
              transition={spring}
              fill={`url(#fill${id}${si})`}
              stroke={toneHex(s.tone)}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? '5 5' : undefined}
              filter={`url(#glow${id})`}
              style={{ mixBlendMode: 'screen' }}
            />
            {s.values.map((v, i) => {
              const [x, y] = point(i, n, Math.max(0.04, v))
              return (
                <motion.circle
                  key={i}
                  initial={false}
                  animate={{ cx: x, cy: y, r: activeAxis === i ? 4.5 : 3 }}
                  transition={spring}
                  fill={toneHex(s.tone)}
                  stroke="#141415"
                  strokeWidth={1.5}
                  style={{ filter: `drop-shadow(0 0 5px ${toneA(s.tone, 0.8)})` }}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
