import * as React from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { short } from '@/lib/format'
import { CountingNumber } from '@/components/animate-ui/primitives/texts/counting-number'
import { type Tone, toneA, toneHex } from './tone'

/* ───────── Card ───────── */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'solid' | 'glass' | 'speckle'
  grain?: boolean
}
export function Card({ variant = 'solid', grain, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        variant === 'glass' ? 'k-card-glass' : 'k-card',
        variant === 'speckle' && 'k-speckle',
        grain && 'k-grain',
        'overflow-hidden',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/** Plain-English title + small technical subtitle (judges have zero crypto knowledge). */
export function CardHeader({
  title,
  tech,
  right,
  className,
  icon,
}: {
  title: React.ReactNode
  tech?: React.ReactNode
  right?: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 text-muted">{icon}</div>}
        <div className="min-w-0">
          <div className="text-[14.5px] font-medium text-text/90">{title}</div>
          {tech && <div className="mt-0.5 text-[12.5px] text-dim">{tech}</div>}
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
    </div>
  )
}

/* ───────── Chip ───────── */
export function Chip({
  tone = 'neutral',
  dot,
  pulse,
  className,
  children,
  solid,
}: {
  tone?: Tone
  dot?: boolean
  pulse?: boolean
  solid?: boolean
  className?: string
  children: React.ReactNode
}) {
  const c = toneHex(tone)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium leading-[1.4]',
        className,
      )}
      style={
        solid
          ? { background: c, color: tone === 'gold' || tone === 'moss' || tone === 'white' ? '#0b0b0c' : '#fff' }
          : { background: toneA(tone === 'white' ? 'neutral' : tone, 0.12), color: tone === 'neutral' ? '#c4c4c8' : c, boxShadow: `inset 0 0 0 1px ${toneA(tone === 'white' ? 'neutral' : tone, 0.22)}` }
      }
    >
      {dot && (
        <span className="relative inline-flex size-1.5">
          {pulse && <span className="k-pulse-ring absolute inset-0 rounded-full" style={{ background: c }} />}
          <span className="relative inline-flex size-1.5 rounded-full" style={{ background: c }} />
        </span>
      )}
      {children}
    </span>
  )
}

/** Mandatory "DEMO DATA" marker — all data in this prototype is synthetic. */
export function DemoChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-gold/40 bg-gold/[0.06] px-2 py-0.5 text-[11.5px] font-semibold tracking-[0.08em] text-gold',
        className,
      )}
      title="Every wallet, transaction, exchange and person in this prototype is synthetic."
    >
      DEMO DATA
    </span>
  )
}

/* ───────── Delta (↗ +24%) ───────── */
export function Delta({ value, good = 'up', className, suffix = '%' }: { value: number; good?: 'up' | 'down'; className?: string; suffix?: string }) {
  const up = value >= 0
  const positive = good === 'up' ? up : !up
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12.5px] font-medium', positive ? 'text-moss' : 'text-crimson', className)}>
      <Icon className="size-3" strokeWidth={2.5} />
      {up ? '+' : ''}
      {value}
      {suffix}
    </span>
  )
}

/* ───────── Button ───────── */
type ButtonProps = HTMLMotionProps<'button'> & {
  variant?: 'ember' | 'ghost' | 'outline' | 'quiet'
  size?: 'sm' | 'md' | 'icon'
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0',
        size === 'sm' && 'h-7 rounded-lg px-2.5 text-[13px]',
        size === 'md' && 'h-9 rounded-[10px] px-3.5 text-[14px]',
        size === 'icon' && 'size-9 rounded-[10px]',
        variant === 'ember' && 'k-btn-ember',
        variant === 'ghost' && 'k-btn-ghost hover:bg-raise',
        variant === 'outline' && 'border border-line-2 bg-transparent text-text hover:bg-white/[0.04]',
        variant === 'quiet' && 'bg-transparent text-muted hover:bg-white/[0.05] hover:text-text',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  )
})

/* ───────── Stat number ───────── */
export function Stat({
  value,
  prefix,
  suffix,
  decimals = 0,
  className,
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}) {
  return (
    <span className={cn('k-num inline-flex items-baseline', className)}>
      {prefix && <span>{prefix}</span>}
      <CountingNumber number={value} decimalPlaces={decimals} inView inViewOnce transition={{ stiffness: 70, damping: 30 }} />
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  )
}

/* ───────── Address tag ───────── */
export function Address({
  addr,
  chain,
  full,
  className,
  tone,
}: {
  addr: string
  chain?: string
  full?: boolean
  className?: string
  tone?: Tone
}) {
  const [copied, setCopied] = React.useState(false)
  const chainTone: Tone = chain === 'TRON' ? 'crimson' : chain === 'Ethereum' ? 'sky' : chain === 'Bitcoin' ? 'gold' : 'neutral'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(addr).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[13.5px] text-text/85 hover:bg-white/[0.05]',
        className,
      )}
      title={`${addr} — click to copy`}
    >
      {chain && <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneHex(tone ?? chainTone) }} />}
      <span className="k-mono">{full ? addr : short(addr)}</span>
      {copied ? (
        <Check className="size-3 text-moss" />
      ) : (
        <Copy className="size-3 text-dim opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}

/* ───────── Meter (horizontal weight bar) ───────── */
export function Meter({ value, tone = 'ember', className, height = 6, max = 1 }: { value: number; tone?: Tone; className?: string; height?: number; max?: number }) {
  const w = Math.max(0, Math.min(1, value / max))
  return (
    <div className={cn('relative w-full overflow-hidden rounded-full bg-white/[0.06]', className)} style={{ height }}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${toneA(tone, 0.55)}, ${toneHex(tone)})`, boxShadow: `0 0 12px ${toneA(tone, 0.5)}` }}
        initial={{ width: 0 }}
        whileInView={{ width: `${w * 100}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </div>
  )
}

/* ───────── Score ring ───────── */
export function ScoreRing({
  value,
  size = 112,
  stroke = 9,
  tone = 'crimson',
  label,
  sub,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  label?: React.ReactNode
  sub?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = React.useId()
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={toneA(tone, 0.5)} />
            <stop offset="100%" stopColor={toneHex(tone)} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
          strokeDasharray="2 6"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - value) }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${toneA(tone, 0.6)})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="k-num text-[26px] leading-none">{label ?? Math.round(value * 100)}</div>
          {sub && <div className="mt-1 text-[11.5px] text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

/* ───────── Page header ───────── */
export function PageHeader({
  eyebrow,
  title,
  tech,
  actions,
  children,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  tech?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="k-eyebrow mb-1.5 flex items-center gap-2">{eyebrow}</div>}
        <h1 className="k-num text-[26px] leading-tight text-text md:text-[30px]">{title}</h1>
        {tech && <p className="mt-1 max-w-2xl text-[14px] text-muted">{tech}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ───────── Reveal (staggered entrance) ───────── */
export function Reveal({ delay = 0, className, children, y = 14 }: { delay?: number; className?: string; children: React.ReactNode; y?: number }) {
  return (
    <motion.div
      className={cn('min-w-0', className)}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* ───────── Key/value row ───────── */
export function KV({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-1.5 text-[13.5px]', className)}>
      <span className="text-muted">{k}</span>
      <span className="text-right text-text/90">{v}</span>
    </div>
  )
}

/* ───────── Icon tile (round dark badge like Recent Activity icons) ───────── */
export function IconTile({ children, tone, className, size = 36 }: { children: React.ReactNode; tone?: Tone; className?: string; size?: number }) {
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-full border border-line-2 [&_svg]:size-4', className)}
      style={{
        width: size,
        height: size,
        background: tone ? `radial-gradient(circle at 30% 25%, ${toneA(tone, 0.35)}, ${toneA(tone, 0.08)})` : 'linear-gradient(180deg,#232326,#18181a)',
        color: tone ? toneHex(tone) : '#e4e4e7',
      }}
    >
      {children}
    </div>
  )
}

/* ───────── Divider ───────── */
export function Hair({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />
}

/* ───────── Countdown hook ───────── */
export function useCountdown(startSec: number, running = true): number {
  const [s, setS] = React.useState(startSec)
  React.useEffect(() => {
    setS(startSec)
  }, [startSec])
  React.useEffect(() => {
    if (!running) return
    const t = setInterval(() => setS((x) => Math.max(0, x - 1)), 1000)
    return () => clearInterval(t)
  }, [running])
  return s
}

/* ───────── Live clock tick (for "live" feeds) ───────── */
export function useTick(ms = 1000): number {
  const [n, setN] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms)
    return () => clearInterval(t)
  }, [ms])
  return n
}
