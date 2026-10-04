import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, Chip, toneA, toneHex, type Tone } from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { cn } from '@/lib/utils'
import {
  AGE_STOPS,
  BASE_INPUTS,
  NOTICE_THRESHOLD,
  SWEEP_MAX,
  contributions,
  fmtDuration,
  score as scoreOf,
  type RiskInputs,
} from './model'

/* log-scale mapping for the sweep slider: 0..1000 ↔ 42 s..6 h */
const S0 = BASE_INPUTS.sweepSec
const toSec = (p: number) => S0 * Math.pow(SWEEP_MAX / S0, p / 1000)
const toPos = (s: number) => (Math.log(s / S0) / Math.log(SWEEP_MAX / S0)) * 1000

const PRESETS: { label: string; inputs: Partial<RiskInputs> }[] = [
  { label: 'Money sat for 6 hours', inputs: { sweepSec: SWEEP_MAX } },
  { label: 'Only one victim', inputs: { victims: 1 } },
  { label: 'Indian-registered exchange', inputs: { registered: true } },
  { label: 'Ordinary user wallet', inputs: { sweepSec: 5400, victims: 2, keptPct: 72, ageIdx: 4 } },
]

export function WhatIf() {
  const [inp, setInp] = React.useState<RiskInputs>(BASE_INPUTS)
  const set = (p: Partial<RiskInputs>) => setInp((x) => ({ ...x, ...p }))
  const base = scoreOf(BASE_INPUTS)
  const s = scoreOf(inp)
  const parts = contributions(inp)
  const baseParts = contributions(BASE_INPUTS)
  const qualifies = s >= NOTICE_THRESHOLD
  const tone: Tone = qualifies ? 'crimson' : 'moss'
  const changed = JSON.stringify(inp) !== JSON.stringify(BASE_INPUTS)

  const clauses: string[] = []
  if (Math.abs(inp.sweepSec - S0) > 1) clauses.push(`the money had sat for ${fmtDuration(inp.sweepSec)}`)
  if (inp.victims !== BASE_INPUTS.victims) clauses.push(inp.victims === 1 ? 'only one victim had paid into the hub' : `only ${inp.victims} victims had paid into the hub`)
  if (Math.abs(inp.keptPct - BASE_INPUTS.keptPct) > 0.05) clauses.push(`only ${inp.keptPct.toFixed(1)}% of the value had been kept`)
  if (inp.registered) clauses.push('the exchange were registered with FIU-IND')
  if (inp.ageIdx !== 0) clauses.push(`the wallet had existed for ${AGE_STOPS[inp.ageIdx].label}`)
  const list = clauses.length <= 1 ? clauses.join('') : `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`

  return (
    <Card variant="glass" className="pb-5">
      <CardHeader
        title="What would change the verdict?"
        tech="counterfactual explanation · move a factor, the rule score recomputes live"
        icon={<Sparkles className="size-4" />}
        right={
          <Button size="sm" onClick={() => setInp(BASE_INPUTS)} disabled={!changed}>
            <RotateCcw /> Reset to case
          </Button>
        }
      />
      <div className="flex flex-wrap gap-1.5 px-5 pt-3">
        <span className="mr-1 self-center text-[12.5px] text-dim">Try:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setInp({ ...BASE_INPUTS, ...p.inputs })}
            className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px] hover:bg-raise"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 px-5 pt-4 lg:grid-cols-[1.25fr_1fr]">
        {/* ── controls ── */}
        <div className="space-y-4">
          <Control
            label="How fast the money left the wallet"
            tech="sweep latency · weight 0.31"
            value={fmtDuration(inp.sweepSec)}
            contribution={parts[0].c}
            delta={parts[0].c - baseParts[0].c}
          >
            <Slider
              ariaLabel="Sweep time"
              min={0}
              max={1000}
              step={1}
              value={toPos(inp.sweepSec)}
              onChange={(p) => set({ sweepSec: p <= 2 ? S0 : toSec(p) })}
              ticks={[['42 s', 0], ['5 min', toPos(300) / 1000], ['30 min', toPos(1800) / 1000], ['6 h', 1]]}
              tone="crimson"
            />
          </Control>
          <Control
            label="Victims whose money landed in the same wallet"
            tech="consolidation hub in-degree · weight 0.24"
            value={`${inp.victims}`}
            contribution={parts[1].c}
            delta={parts[1].c - baseParts[1].c}
          >
            <Slider ariaLabel="Victims in hub" min={1} max={38} step={1} value={inp.victims} onChange={(v) => set({ victims: Math.round(v) })} ticks={[['1', 0], ['10', 9 / 37], ['20', 19 / 37], ['38', 1]]} tone="crimson" />
          </Control>
          <Control
            label="Share of the money kept at each hop"
            tech="value preservation ratio · weight 0.15"
            value={`${inp.keptPct.toFixed(1)}%`}
            contribution={parts[2].c}
            delta={parts[2].c - baseParts[2].c}
          >
            <Slider ariaLabel="Value kept" min={60} max={99.9} step={0.1} value={inp.keptPct} onChange={(v) => set({ keptPct: Math.round(v * 10) / 10 })} ticks={[['60%', 0], ['75%', 15 / 39.9], ['90%', 30 / 39.9], ['99.9%', 1]]} tone="ember" />
          </Control>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Control
              label="Exchange registered in India"
              tech="FIU-IND VASP registration · weight 0.12"
              value={inp.registered ? 'Yes' : 'No'}
              contribution={parts[3].c}
              delta={parts[3].c - baseParts[3].c}
            >
              <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-muted">
                <Switch
                  checked={inp.registered}
                  onCheckedChange={(v) => set({ registered: v })}
                  aria-label="Exchange registered in India"
                  className="data-[state=checked]:bg-moss data-[state=unchecked]:bg-white/10"
                />
                {inp.registered ? 'Registered — removes this factor' : 'Not registered (Seychelles)'}
              </label>
            </Control>
            <Control
              label="How old the wallet was"
              tech="first-seen before incident · weight 0.08"
              value={AGE_STOPS[inp.ageIdx].label}
              contribution={parts[4].c}
              delta={parts[4].c - baseParts[4].c}
            >
              <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Wallet age">
                {AGE_STOPS.map((a, i) => (
                  <button
                    key={a.label}
                    type="button"
                    role="radio"
                    aria-checked={inp.ageIdx === i}
                    onClick={() => set({ ageIdx: i })}
                    className={cn(
                      'h-6 rounded-md border px-1.5 text-[12px] transition-colors',
                      inp.ageIdx === i ? 'border-ember/50 bg-ember/15 text-text' : 'border-line bg-white/[0.03] text-muted hover:text-text',
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Control>
          </div>
        </div>

        {/* ── live verdict ── */}
        <div className="flex flex-col rounded-2xl border border-line bg-black/20 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <LiveRing value={s} tone={tone} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-dim">Rule-based risk score</div>
              <div className="k-num flex items-baseline text-[34px] leading-none" style={{ color: toneHex(tone) }}>
                <SlidingNumber number={Math.round(s * 100) / 100} decimalPlaces={2} />
              </div>
              <div className="mt-1 text-[12.5px] text-muted">
                was <span className="k-num text-text">{base.toFixed(2)}</span>
                {changed && (
                  <span className={cn('ml-1.5 k-num', s < base ? 'text-moss' : 'text-crimson')}>
                    {s < base ? '−' : '+'}
                    {Math.abs(s - base).toFixed(2)}
                  </span>
                )}
              </div>
              <motion.div key={String(qualifies)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
                <Chip tone={tone} dot solid={!qualifies}>
                  {qualifies ? 'Still qualifies for a notice' : 'Below notice threshold'}
                </Chip>
              </motion.div>
            </div>
          </div>

          {/* threshold bar */}
          <div className="mt-5">
            <div className="relative h-3 rounded-full bg-white/[0.06]">
              <div className="absolute inset-y-0 rounded-r-full" style={{ left: `${NOTICE_THRESHOLD * 100}%`, right: 0, background: toneA('crimson', 0.08) }} />
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                animate={{ width: `${s * 100}%`, background: `linear-gradient(90deg, ${toneA(tone, 0.4)}, ${toneHex(tone)})` }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                style={{ boxShadow: `0 0 14px ${toneA(tone, 0.5)}` }}
              />
              <div className="absolute -inset-y-1.5 w-px bg-white/70" style={{ left: `${NOTICE_THRESHOLD * 100}%` }} />
            </div>
            <div className="relative mt-1.5 h-4 text-[11.5px] text-dim">
              <span className="absolute left-0">0</span>
              <span className="absolute -translate-x-1/2 whitespace-nowrap text-text/80" style={{ left: `${NOTICE_THRESHOLD * 100}%` }}>
                Notice threshold 0.60
              </span>
              <span className="absolute right-0">1.00</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={`${list}|${qualifies}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-4 rounded-xl border border-line bg-white/[0.02] p-3 text-[14px] leading-relaxed text-text/90"
            >
              {!changed ? (
                <>
                  As traced, the score is <b className="k-num">{s.toFixed(2)}</b> — well above the notice threshold. Move any control to see what it
                  would take to change that.
                </>
              ) : (
                <>
                  If {list}, the score would {s < base ? 'fall' : 'rise'} to <b className="k-num">{s.toFixed(2)}</b> —{' '}
                  {qualifies ? (
                    <span className="text-crimson">still above the notice threshold, so the case still qualifies.</span>
                  ) : (
                    <span className="text-moss">below the notice threshold, so ANVESHAK would not recommend a notice.</span>
                  )}
                </>
              )}
            </motion.p>
          </AnimatePresence>

          <div className="mt-4 space-y-1.5">
            {parts.map((f) => (
              <div key={f.plain} className="flex items-center gap-2 text-[12px]">
                <span className="w-[46%] truncate text-muted" title={f.plain}>
                  {f.plain}
                </span>
                <div className="relative h-1.5 flex-1 rounded-full bg-white/[0.05]">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    animate={{ width: `${(f.c / 0.31) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                    style={{ background: toneHex(f.tone === 'neutral' ? 'white' : f.tone), opacity: 0.85 }}
                  />
                </div>
                <span className="k-num w-9 text-right text-text/80">+{f.c.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-snug text-dim">
            What-ifs use the same weights as the live score. "No money came back" is held fixed. The threshold is a policy setting, not a law.
          </p>
        </div>
      </div>
    </Card>
  )
}

function Control({
  label,
  tech,
  value,
  contribution,
  delta,
  children,
}: {
  label: string
  tech: string
  value: string
  contribution: number
  delta: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] text-text">{label}</div>
          <div className="text-[12px] text-dim">{tech}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="k-num text-[15.5px] text-text">{value}</div>
          <div className="text-[11.5px] text-dim">
            +{contribution.toFixed(2)}
            {Math.abs(delta) > 0.004 && <span className={cn('ml-1', delta < 0 ? 'text-moss' : 'text-crimson')}>({delta < 0 ? '−' : '+'}{Math.abs(delta).toFixed(2)})</span>}
          </div>
        </div>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** Styled range slider: native <input type=range> on top for keyboard + screen readers. */
function Slider({
  min,
  max,
  step,
  value,
  onChange,
  ticks,
  tone,
  ariaLabel,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  ticks: [string, number][]
  tone: Tone
  ariaLabel: string
}) {
  const f = (value - min) / (max - min)
  return (
    <div>
      <div className="group relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.07]" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ width: `${f * 100}%`, background: `linear-gradient(90deg, ${toneA(tone, 0.35)}, ${toneHex(tone)})`, boxShadow: `0 0 10px ${toneA(tone, 0.45)}` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--k-solid)] transition-transform group-active:scale-110 group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-ember"
          style={{ left: `${f * 100}%`, background: toneHex('white'), boxShadow: `0 0 0 3px ${toneA(tone, 0.35)}` }}
        />
        <input
          type="range"
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="relative mt-1 h-3 text-[11px] text-dim">
        {ticks.map(([t, at]) => (
          <span key={t} className="absolute whitespace-nowrap" style={{ left: `${at * 100}%`, transform: `translateX(-${at * 100}%)` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function LiveRing({ value, tone, size = 112, stroke = 10 }: { value: number; tone: Tone; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const th = NOTICE_THRESHOLD * 2 * Math.PI - Math.PI / 2
  const tx = size / 2 + Math.cos(th) * r
  const ty = size / 2 + Math.sin(th) * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value), stroke: toneHex(tone) }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ filter: `drop-shadow(0 0 6px ${toneA(tone, 0.6)})` }}
        />
        {/* threshold tick */}
        <circle cx={tx} cy={ty} r={3.5} fill={toneHex('white')} strokeWidth={2} style={{ stroke: 'var(--k-solid)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-dim">risk</div>
          <div className="k-num text-[14.5px] text-muted">{value >= NOTICE_THRESHOLD ? 'HIGH' : value >= 0.4 ? 'MEDIUM' : 'LOW'}</div>
        </div>
      </div>
    </div>
  )
}
