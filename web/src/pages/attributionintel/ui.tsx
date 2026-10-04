import * as React from 'react'
import { Check, Minus, X } from 'lucide-react'
import { toneA, toneHex, type Tone } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { CheckState } from './data'

/** Section divider with eyebrow + plain-English heading. */
export function SectionTitle({ eyebrow, title, tech, tone = 'ember', right }: { eyebrow: string; title: string; tech: string; tone?: Tone; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-4">
      <div className="min-w-0">
        <div className="k-eyebrow mb-1 flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: toneHex(tone), boxShadow: `0 0 8px ${toneHex(tone)}` }} />
          {eyebrow}
        </div>
        <h2 className="k-num text-[20px] leading-tight text-text md:text-[22px]">{title}</h2>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">{tech}</p>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

/** Yes / no / partial / not-needed check glyph. */
export function CheckMark({ s, note }: { s: CheckState; note?: string }) {
  const map: Record<CheckState, { tone: Tone; icon: React.ReactNode; label: string }> = {
    yes: { tone: 'moss', icon: <Check className="size-3" strokeWidth={2.6} />, label: 'Yes' },
    no: { tone: 'crimson', icon: <X className="size-3" strokeWidth={2.6} />, label: 'No' },
    partial: { tone: 'gold', icon: <Minus className="size-3" strokeWidth={2.6} />, label: 'Partly' },
    na: { tone: 'neutral', icon: <span className="text-[11.5px] leading-none">—</span>, label: 'Not needed' },
  }
  const m = map[s]
  return (
    <span
      className="inline-grid size-5 place-items-center rounded-full"
      style={{ background: toneA(m.tone, 0.14), color: toneHex(m.tone), boxShadow: `inset 0 0 0 1px ${toneA(m.tone, 0.28)}` }}
      title={note ? `${m.label} — ${note}` : m.label}
      aria-label={note ? `${m.label}: ${note}` : m.label}
      role="img"
    >
      {m.icon}
    </span>
  )
}

/** Styled range slider: native input on top for keyboard + screen readers. */
export function Slider({
  min,
  max,
  step,
  value,
  onChange,
  tone,
  ariaLabel,
  marker,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  tone: Tone
  ariaLabel: string
  marker?: { at: number; label: string }
}) {
  const f = (value - min) / (max - min)
  const m = marker ? (marker.at - min) / (max - min) : null
  return (
    <div>
      <div className="group relative h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.07]" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ width: `${f * 100}%`, background: `linear-gradient(90deg, ${toneA(tone, 0.35)}, ${toneHex(tone)})`, boxShadow: `0 0 10px ${toneA(tone, 0.45)}` }}
        />
        {m !== null && <div className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-white/40" style={{ left: `${m * 100}%` }} />}
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
      {marker && m !== null && (
        <div className="relative mt-1 h-3 text-[11.5px] text-dim">
          <span className="absolute whitespace-nowrap" style={{ left: `${m * 100}%`, transform: 'translateX(-50%)' }}>
            {marker.label}
          </span>
        </div>
      )}
    </div>
  )
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="mb-1 block text-[12.5px] text-dim">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full min-w-0 rounded-lg border border-line-2 bg-[var(--k-pop)] px-2 text-[14px] text-text outline-none focus-visible:border-ember/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
