import * as React from 'react'
import { motion } from 'motion/react'
import { toneA, toneHex } from '@/components/kit'
import { EDGES, NODES, NODE, DUST, edgeKey, type DNode, type Params, type Result } from './data'

const C = 300
const RADII = [30, 94, 160, 222, 276]
const STAGE_MS = 430

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}
function pos(n: DNode) {
  return polar(RADII[n.ring], n.angle)
}
function midAngle(a: number, b: number) {
  let d = b - a
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return a + d / 2
}

/** Steps the ripple outward one ring at a time whenever runId changes. */
export function useDiffusionStage(runId: number): number {
  const [stage, setStage] = React.useState(-1)
  React.useEffect(() => {
    setStage(0)
    let s = 0
    const t = setInterval(() => {
      s += 1
      setStage(s)
      if (s >= 4) clearInterval(t)
    }, STAGE_MS)
    return () => clearInterval(t)
  }, [runId])
  return stage
}

/** Concentric "risk ripple": listed addresses in the centre, one ring per hop. */
export function DiffusionGraph({
  params,
  result,
  selected,
  onSelect,
  runId,
  stage,
}: {
  params: Params
  result: Result
  selected: string
  onSelect: (id: string) => void
  runId: number
  stage: number
}) {
  const crim = toneHex('crimson')

  return (
    <svg viewBox="-70 -24 740 648" className="mx-auto block h-auto w-full max-w-[600px]" role="group" aria-label="Risk spreading outward from listed addresses, one ring per hop">
      <defs>
        <radialGradient id="rd-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={toneA('crimson', 0.32)} />
          <stop offset="35%" stopColor={toneA('crimson', 0.08)} />
          <stop offset="100%" stopColor={toneA('crimson', 0)} />
        </radialGradient>
        <filter id="rd-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* core glow */}
      <circle cx={C} cy={C} r={170} fill="url(#rd-core)" />

      {/* rings */}
      {RADII.slice(1).map((r, i) => {
        const hop = i + 1
        const inRange = hop <= params.maxHops
        const hit = stage === hop
        return (
          <g key={r}>
            <motion.circle
              cx={C}
              cy={C}
              r={r}
              fill="none"
              strokeWidth={hit ? 1.6 : 1}
              strokeDasharray={inRange ? undefined : '3 6'}
              animate={{ stroke: hit ? toneA('crimson', 0.55) : inRange ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.045)' }}
              transition={{ duration: 0.35 }}
            />
            <text
              x={polar(r, 98)[0]}
              y={polar(r, 98)[1] + 4}
              textAnchor="middle"
              className="k-num"
              fontSize={10}
              fill={inRange ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.16)'}
              style={{ letterSpacing: '0.08em' }}
            >
              {`HOP ${hop}`}
            </text>
          </g>
        )
      })}

      {/* diffusion wave */}
      <motion.circle
        key={`wave-${runId}`}
        cx={C}
        cy={C}
        fill="none"
        stroke={crim}
        initial={{ r: RADII[0], opacity: 0.55, strokeWidth: 10 }}
        animate={{ r: RADII[Math.min(4, params.maxHops)] + 8, opacity: 0, strokeWidth: 1 }}
        transition={{ duration: (STAGE_MS * Math.min(4, params.maxHops)) / 1000 + 0.4, ease: 'easeOut' }}
        filter="url(#rd-blur)"
      />

      {/* edges */}
      {EDGES.map((e) => {
        const a = NODE[e.from]
        const b = NODE[e.to]
        const [x1, y1] = pos(a)
        const [x2, y2] = pos(b)
        const rm = (RADII[a.ring] + RADII[b.ring]) / 2
        const [cx, cy] = polar(rm * 1.02, midAngle(a.angle, b.angle))
        const d = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`
        const dust = e.share < DUST
        const filtered = dust && params.ignoreDust
        const k = edgeKey(e)
        const live = result.live.has(k) && stage >= b.ring
        const flow = Math.min(1, result.risk[e.from] * e.share * 2.2)
        const w = 0.8 + e.share * 4.2
        return (
          <g key={k}>
            <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={w} strokeDasharray={dust ? '2 5' : undefined} opacity={filtered ? 0.35 : 1} strokeLinecap="round" />
            <motion.path
              d={d}
              fill="none"
              stroke={crim}
              strokeLinecap="round"
              strokeWidth={w}
              initial={false}
              animate={{ pathLength: live ? 1 : 0, opacity: live ? 0.25 + flow * 0.75 : 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{ filter: `drop-shadow(0 0 ${3 + flow * 6}px ${toneA('crimson', 0.4 + flow * 0.4)})` }}
            />
            {live && flow > 0.12 && <path d={d} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1} className="k-flow-dash" strokeLinecap="round" />}
          </g>
        )
      })}

      {/* nodes */}
      {NODES.map((n) => {
        const [x, y] = pos(n)
        const listed = n.kind === 'listed'
        const active = !listed || (n.list ? params.lists.has(n.list) : false)
        const lit = stage >= n.ring
        const r = lit ? result.risk[n.id] : 0
        const radius = listed ? 11 : 6.5 + r * 4.5
        const ring = listed ? toneHex('crimson') : n.kind === 'exchange' ? toneHex('gold') : n.kind === 'case' ? toneHex('teal') : 'rgba(255,255,255,0.28)'
        const fill = !active ? '#1a1a1c' : r > 0 ? toneA('crimson', Math.min(1, 0.18 + r * 0.95)) : '#1c1c1f'
        const sel = selected === n.id
        const cos = Math.cos((n.angle * Math.PI) / 180)
        const sin = Math.sin((n.angle * Math.PI) / 180)
        const off = radius + 7
        const lx = x + cos * off
        const ly = y + sin * off
        const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle'
        const above = sin < -0.3
        const glow = active && r > 0.02 ? `drop-shadow(0 0 ${4 + r * 14}px ${toneA('crimson', 0.35 + r * 0.6)})` : undefined
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={`${n.label}${n.hop ? ` (${n.hop})` : ''} — diffused risk ${result.risk[n.id].toFixed(2)}`}
            aria-pressed={sel}
            onClick={() => onSelect(n.id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                onSelect(n.id)
              }
            }}
            className="cursor-pointer outline-none"
          >
            <circle cx={x} cy={y} r={radius + 10} fill="transparent" />
            {sel && (
              <motion.circle
                cx={x}
                cy={y}
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={1.2}
                initial={{ r: radius + 10, opacity: 0 }}
                animate={{ r: radius + 5, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            )}
            {listed && active && <circle cx={x} cy={y} r={radius} fill={crim} className="k-pulse-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center', opacity: 0.4 }} />}
            <motion.circle
              cx={x}
              cy={y}
              initial={false}
              animate={{ r: radius, fill }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              stroke={active ? ring : 'rgba(255,255,255,0.18)'}
              strokeWidth={listed ? 1.6 : 1.3}
              strokeDasharray={active ? undefined : '2 3'}
              style={{ filter: glow }}
            />
            {listed ? (
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} className="k-num pointer-events-none" fill={active ? '#fff' : 'rgba(255,255,255,0.35)'}>
                {n.label.slice(-1)}
              </text>
            ) : (
              <g className="pointer-events-none">
                <text x={lx} y={above ? ly - 11 : ly + 4} textAnchor={anchor} fontSize={9.5} fill={sel ? '#f4f4f5' : 'rgba(255,255,255,0.62)'}>
                  {n.hop ? `${n.hop} · ${n.label}` : n.label}
                </text>
                <text
                  x={lx}
                  y={above ? ly + 1 : ly + 16}
                  textAnchor={anchor}
                  fontSize={10.5}
                  className="k-num"
                  fill={!lit ? 'rgba(255,255,255,0.2)' : r >= 0.2 ? toneHex('crimson') : r >= 0.08 ? toneHex('ember') : 'rgba(255,255,255,0.4)'}
                >
                  {lit ? r.toFixed(2) : '··'}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* centre caption */}
      <text x={C} y={C + 52} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.45)" style={{ letterSpacing: '0.1em' }}>
        LISTED
      </text>
    </svg>
  )
}
