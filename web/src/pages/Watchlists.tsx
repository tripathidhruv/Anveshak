import * as React from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Ban,
  BellRing,
  Building2,
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Snowflake,
  Webhook,
  Zap,
} from 'lucide-react'
import {
  Address,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  Hair,
  IconTile,
  KV,
  Meter,
  Reveal,
  Sparkline,
  Stat,
  toneA,
  toneHex,
  useCountdown,
  useTick,
  type Tone,
} from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { Progress } from '@/components/animate-ui/components/radix/progress'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/radix/tooltip'
import { CASE, EXCHANGES, ROUTE_A, ROUTE_B, type Hop } from '@/data/demo'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  ACK_DELAY,
  POOL,
  PREDICTED_TODAY,
  REASON_TECH,
  REASON_TONE,
  SANCTIONS_TODAY,
  SANCTION_MATCH_ADDR,
  SCORED_TODAY,
  WEBHOOKS,
  type PoolWallet,
} from './watchlists/data'

type AckState = 'ack' | 'pending' | 'failed'
type FeedItem = PoolWallet & { uid: number; born: number }

const ACK_TONE: Record<AckState, Tone> = { ack: 'moss', pending: 'gold', failed: 'crimson' }
const ACK_LABEL: Record<AckState, string> = { ack: 'acknowledged', pending: 'pending', failed: 'failed — retrying' }

function makeItem(uid: number, born: number): FeedItem {
  return { ...POOL[uid % POOL.length], uid, born }
}

function ackFor(item: FeedItem, exId: string, tick: number): AckState {
  const age = tick - item.born
  if (age < ACK_DELAY[exId]) return 'pending'
  if (exId === 'orbita' && item.uid % 2 === 0) return 'failed'
  if (exId === 'arcadia' && item.uid % 4 === 1) return 'failed'
  return 'ack'
}

const BASE_FLAGGED = 1284
const INITIAL = 5
const USDT_INR = 83.5
const HUB = ROUTE_A.trail.find((h) => h.flag === 'HUB')!

export default function WatchlistsPage() {
  const tick = useTick(1000)
  const [paused, setPaused] = React.useState(false)
  const [feed, setFeed] = React.useState<FeedItem[]>(() => Array.from({ length: INITIAL }, (_, i) => makeItem(INITIAL - 1 - i, -30)))
  const nextUid = React.useRef(INITIAL)
  const lastPush = React.useRef(0)
  const [pushed, setPushed] = React.useState(0)

  React.useEffect(() => {
    if (paused) return
    if (tick - lastPush.current >= 4) {
      lastPush.current = tick
      const uid = nextUid.current++
      setFeed((f) => [makeItem(uid, tick), ...f].slice(0, 6))
      setPushed((p) => p + 1)
    }
  }, [tick, paused])

  return (
    <div className="space-y-4">
      {/* ── Hero ── */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[14.5px] text-muted">
              Wallets flagged and pushed to exchanges <DemoChip />
            </div>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="k-num text-[40px] leading-none text-text md:text-[46px]">
                <SlidingNumber number={BASE_FLAGGED + pushed} thousandSeparator="," />
              </span>
              <span className="k-pill text-moss">
                <Radio className="size-3" strokeWidth={2.5} />+{87 + pushed} today
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5" /> Exchanges subscribed: <span className="text-text">6</span>
              </span>
              <span className="text-dim">|</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1.5">
                    <Zap className="size-3.5" /> Median push latency: <span className="text-text">1.8 s</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="border border-line-2 bg-[#1d1d20] text-text">Time from ANVESHAK flagging a wallet to the exchange's server confirming receipt</TooltipContent>
              </Tooltip>
              <span className="text-dim">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Ban className="size-3.5" /> Deposits blocked: <span className="text-text">₹2.3 Cr</span>
                <span className="text-dim">(214 deposits)</span>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
                {paused ? <Play /> : <Pause />} {paused ? 'Resume broadcast' : 'Pause broadcast'}
              </Button>
              <Link to="/interdiction">
                <Button>
                  <Snowflake /> Pre-emptive freeze
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden items-center gap-6 xl:flex">
            {[
              { k: 'Acknowledged (24 h)', v: 99.1, s: '%', d: 1 },
              { k: 'Pushes today', v: 2140, s: '', d: 0 },
              { k: 'Repeat-wallet hits', v: 37, s: '', d: 0 },
            ].map((s) => (
              <div key={s.k} className="text-right">
                <Stat value={s.v} suffix={s.s} decimals={s.d} className="text-[26px] text-text" />
                <div className="text-[12.5px] text-dim">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Live feed + rules ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.65fr_1fr]">
        <Reveal delay={0.1}>
          <Card variant="glass" className="h-full pb-3">
            <CardHeader
              title="Live broadcast to exchanges"
              tech="watchlist push · signed webhook per exchange · ack dots: moss = received, gold = pending, red = failed"
              right={paused ? <Chip tone="gold" dot>Paused</Chip> : <Chip tone="ember" dot pulse>Live</Chip>}
            />
            <div className="mt-3 hidden grid-cols-[minmax(0,1.3fr)_64px_minmax(0,1fr)_minmax(0,1.25fr)] gap-3 px-5 pb-1 text-[11.5px] uppercase tracking-[0.08em] text-dim md:grid">
              <span>Wallet</span>
              <span>Risk</span>
              <span>Why flagged</span>
              <span>Delivered to</span>
            </div>
            <ul className="space-y-1.5 px-3 pt-1">
              <AnimatePresence initial={false}>
                {feed.map((f) => (
                  <FeedRow key={f.uid} item={f} tick={tick} fresh={tick - f.born < 2} />
                ))}
              </AnimatePresence>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-5 text-[12px] text-dim">
              {EXCHANGES.map((e) => (
                <span key={e.id} className="inline-flex items-center gap-1">
                  <span className="k-mono text-muted">{e.monogram}</span> {e.name}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <RulesCard />
        </Reveal>
      </div>

      {/* ── Webhook health + exchange preview ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_1fr]">
        <Reveal delay={0.1}>
          <WebhookHealth />
        </Reveal>
        <Reveal delay={0.15}>
          <ExchangePreview item={feed[0]} />
        </Reveal>
      </div>

      {/* ── Sanctions + freeze ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Reveal delay={0.1}>
          <SanctionsTable />
        </Reveal>
        <Reveal delay={0.15}>
          <FreezeCheck />
        </Reveal>
      </div>
    </div>
  )
}

/* ───────── Feed row ───────── */
function FeedRow({ item, tick, fresh }: { item: FeedItem; tick: number; fresh: boolean }) {
  const states = EXCHANGES.map((e) => ({ e, s: ackFor(item, e.id, tick) }))
  const acked = states.filter((x) => x.s === 'ack').length
  const failed = states.filter((x) => x.s === 'failed').length
  const riskTone: Tone = item.risk >= 0.9 ? 'crimson' : item.risk >= 0.85 ? 'ember' : 'gold'
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={cn(
        'relative grid grid-cols-1 gap-x-3 gap-y-2 overflow-hidden rounded-xl border px-3 py-2.5 md:grid-cols-[minmax(0,1.3fr)_64px_minmax(0,1fr)_minmax(0,1.25fr)] md:items-center',
        fresh ? 'border-ember/40 bg-ember/[0.06]' : 'border-line bg-white/[0.015]',
      )}
      style={{ transition: 'background-color .8s, border-color .8s' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative inline-flex size-2 shrink-0">
          {fresh && <span className="k-pulse-ring absolute inset-0 rounded-full bg-ember" />}
          <span className={cn('relative inline-flex size-2 rounded-full', fresh ? 'bg-ember' : 'bg-white/20')} />
        </span>
        <div className="min-w-0">
          <Address addr={item.addr} chain={item.chain} className="text-[13.5px]" />
          <div className="px-1 text-[11.5px] text-dim">
            {item.chain} · {item.caseRef}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 md:block">
        <span className="text-[11.5px] text-dim md:hidden">Risk</span>
        <div className="k-num text-[16.5px] leading-none" style={{ color: toneHex(riskTone) }}>
          {item.risk.toFixed(2)}
        </div>
        <Meter value={item.risk} tone={riskTone} height={3} className="mt-1 hidden w-12 md:block" />
      </div>
      <div className="min-w-0">
        <Chip tone={REASON_TONE[item.reason]} className="text-[12px]">
          {item.reason}
        </Chip>
        <div className="mt-0.5 truncate px-1 text-[11.5px] text-dim">{REASON_TECH[item.reason]}</div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-1">
          {states.map(({ e, s }) => (
            <motion.span
              key={e.id}
              title={`${e.name} · ${ACK_LABEL[s]}`}
              animate={{ scale: s === 'pending' ? [1, 0.9, 1] : 1 }}
              transition={s === 'pending' ? { repeat: Infinity, duration: 1 } : { duration: 0.2 }}
              className="k-mono grid h-5 w-[26px] place-items-center rounded-md text-[8.5px] font-semibold"
              style={{ background: toneA(ACK_TONE[s], 0.14), color: toneHex(ACK_TONE[s]), boxShadow: `inset 0 0 0 1px ${toneA(ACK_TONE[s], 0.35)}` }}
            >
              {e.monogram}
            </motion.span>
          ))}
        </div>
        <div className="mt-1 text-[11.5px] text-dim">
          <span className="text-text/80">{acked}/6</span> acknowledged
          {failed > 0 && <span className="text-crimson"> · {failed} retrying</span>}
        </div>
      </div>
    </motion.li>
  )
}

/* ───────── Auto-flag rules ───────── */
function RulesCard() {
  const [auto, setAuto] = React.useState(true)
  const [predicted, setPredicted] = React.useState(true)
  const [sanctions, setSanctions] = React.useState(true)
  const [t, setT] = React.useState(0.8)

  const scored = auto ? SCORED_TODAY.filter((s) => s >= t).length : 0
  const pred = auto && predicted ? PREDICTED_TODAY.filter((s) => s >= t).length : 0
  const sanc = sanctions ? SANCTIONS_TODAY : 0
  const total = scored + pred + sanc
  const precision = Math.min(0.97, 0.58 + (t - 0.5) * 0.85)

  const bins = Array.from({ length: 20 }, (_, i) => {
    const lo = 0.5 + i * 0.025
    return { lo, n: SCORED_TODAY.filter((s) => s >= lo && s < lo + 0.025).length }
  })
  const maxN = Math.max(...bins.map((b) => b.n))

  const rules = [
    { plain: `Auto-flag when risk ≥ ${t.toFixed(2)}`, tech: 'explainable risk score · factors travel with the alert', on: auto, set: setAuto },
    { plain: 'Include predicted next-hop wallets', tech: 'wallets the graph model expects money to reach next', on: predicted, set: setPredicted, disabled: !auto },
    { plain: 'Include sanctions-list hits', tech: 'OFAC SDN + UN consolidated list, exact match', on: sanctions, set: setSanctions },
  ]

  return (
    <Card className="h-full pb-5">
      <CardHeader title="Auto-flag rules" tech="what ANVESHAK pushes without an officer clicking" right={<Chip tone="neutral">Policy v3</Chip>} />
      <ul className="mt-3 space-y-1 px-3">
        {rules.map((r) => (
          <li key={r.tech} className={cn('flex items-center gap-3 rounded-xl px-2 py-2', r.disabled && 'opacity-45')}>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-text/90">{r.plain}</div>
              <div className="text-[12px] text-dim">{r.tech}</div>
            </div>
            <Switch checked={r.on} onCheckedChange={(v: boolean) => r.set(v)} disabled={r.disabled} aria-label={r.plain} />
          </li>
        ))}
      </ul>
      <div className="mx-5 mt-2 rounded-xl border border-line bg-white/[0.02] p-3">
        <div className="flex items-center justify-between text-[12.5px]">
          <label htmlFor="risk-threshold" className="text-muted">Risk threshold</label>
          <span className="k-num text-[14.5px] text-text">{t.toFixed(2)}</span>
        </div>
        <div className="relative mt-3 flex h-14 items-end gap-[3px]" aria-hidden>
          {bins.map((b) => {
            const on = auto && b.lo + 0.0001 >= t - 0.024
            return (
              <motion.div
                key={b.lo}
                className="flex-1 rounded-t-[3px]"
                animate={{
                  height: `${Math.max(6, (b.n / maxN) * 100)}%`,
                  backgroundColor: on ? toneA('crimson', 0.85) : 'rgba(255,255,255,0.1)',
                  boxShadow: on ? `0 0 8px ${toneA('crimson', 0.45)}` : '0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.3 }}
              />
            )
          })}
        </div>
        <input
          id="risk-threshold"
          type="range"
          min={0.5}
          max={0.95}
          step={0.01}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--k-ember)]"
        />
        <div className="flex justify-between text-[11px] text-dim">
          <span>0.50 · flag more</span>
          <span>0.95 · flag less</span>
        </div>
      </div>
      <div className="mx-5 mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[12.5px] text-muted">Would be flagged today</div>
          <div className="k-num mt-0.5 text-[30px] leading-none text-text">
            <SlidingNumber number={total} />
          </div>
          <div className="mt-1 text-[11.5px] text-dim">
            {scored} scored · {pred} predicted · {sanc} sanctions
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] text-muted">Est. alert accuracy</div>
          <div className="k-num mt-0.5 text-[18px] text-moss">~{Math.round(precision * 100)}%</div>
          <div className="text-[11.5px] text-dim">from 386 officer-reviewed alerts</div>
        </div>
      </div>
      <p className="mx-5 mt-3 text-[12px] leading-relaxed text-dim">
        Lower thresholds catch more wallets but send more false alarms to exchanges. A flag asks the exchange to review — it never blocks funds on its own.
      </p>
    </Card>
  )
}

/* ───────── Webhook health ───────── */
function WebhookHealth() {
  const statusTone = { healthy: 'moss', degraded: 'gold', retrying: 'crimson' } as const
  return (
    <Card className="h-full pb-3">
      <CardHeader
        title="Delivery health per exchange"
        tech="signed webhook · median latency, 24-hour success rate, failures"
        icon={<Webhook className="size-4" />}
        right={<Chip tone="gold" dot>2 need attention</Chip>}
      />
      <div className="overflow-x-auto px-3 pt-3">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-[0.08em] text-dim">
              <th className="px-2 pb-2 font-normal">Exchange</th>
              <th className="px-2 pb-2 font-normal">Latency (p50)</th>
              <th className="px-2 pb-2 font-normal">Last 10 pushes</th>
              <th className="px-2 pb-2 text-right font-normal">Success</th>
              <th className="px-2 pb-2 text-right font-normal">Failed 24 h</th>
              <th className="px-2 pb-2 text-right font-normal">Last delivery</th>
            </tr>
          </thead>
          <tbody>
            {WEBHOOKS.map((w) => {
              const ex = EXCHANGES.find((e) => e.id === w.id)!
              const tone: Tone = w.p50 < 2 ? 'moss' : w.p50 < 4 ? 'gold' : 'crimson'
              return (
                <tr key={w.id} className="border-t border-line text-[13.5px] hover:bg-white/[0.02]">
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="k-mono grid size-7 shrink-0 place-items-center rounded-lg border border-line-2 text-[11.5px]" style={{ color: toneHex(ex.tone) }}>
                        {ex.monogram}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-text/90">{ex.name}</div>
                        <Chip tone={statusTone[w.status]} dot className="mt-0.5 py-0 text-[11px]">
                          {w.status}
                        </Chip>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="k-num w-9 text-text">{w.p50.toFixed(1)}s</span>
                      <Meter value={w.p50} max={7} tone={tone} height={4} className="w-20" />
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <Sparkline data={w.spark} tone={tone} width={86} height={24} />
                  </td>
                  <td className={cn('k-num px-2 py-2.5 text-right', w.success >= 0.99 ? 'text-text' : w.success >= 0.95 ? 'text-gold' : 'text-crimson')}>
                    {(w.success * 100).toFixed(1)}%
                  </td>
                  <td className={cn('k-num px-2 py-2.5 text-right', w.fails > 10 ? 'text-crimson' : 'text-muted')}>{w.fails}</td>
                  <td className="px-2 py-2.5 text-right text-[12.5px] text-muted">{w.last}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 pt-2 text-[12px] text-dim">
        Failed pushes retry with back-off for 24 h, then escalate to the exchange's nodal officer by e-mail and are logged for FIU-IND reporting.
      </p>
    </Card>
  )
}

/* ───────── What the exchange sees ───────── */
function ExchangePreview({ item }: { item: FeedItem }) {
  const [acted, setActed] = React.useState<{ uid: number; what: 'ack' | 'hold' } | null>(null)
  const done = acted && acted.uid === item.uid ? acted.what : null
  const maxW = Math.max(...item.factors.map((f) => f.w))
  return (
    <Card className="h-full pb-4">
      <CardHeader title="What the exchange sees" tech="preview of the alert in a subscribed exchange's compliance console" right={<Chip tone="gold">Meridian view</Chip>} />
      <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-gold/20 bg-[#0b0b0c] shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-gold/[0.06] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="k-mono grid size-6 shrink-0 place-items-center rounded-md bg-gold text-[11px] font-bold text-[#0b0b0c]">MD</span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-text">Meridian Digital Exchange</div>
              <div className="truncate text-[11px] text-dim">Compliance console · Inbound law-enforcement alerts</div>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[11.5px] text-gold">
            <BellRing className="size-3.5" /> 1 new
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={item.uid}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3 }}
            className="p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <span className="rounded bg-crimson/15 px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-crimson">HIGH RISK</span>
                Source: ANVESHAK watchlist · I4C
              </div>
              <span className="k-mono text-[11.5px] text-dim">ALRT-{String(48210 + item.uid).padStart(6, '0')}</span>
            </div>
            <div className="mt-2.5 text-[14px] text-text">Hold deposits from this address pending review</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Address addr={item.addr} chain={item.chain} full className="max-w-full truncate text-[12.5px]" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 text-[12.5px]">
              <KV k="Risk score" v={<span className="k-num text-crimson">{item.risk.toFixed(2)}</span>} className="py-1" />
              <KV k="Reason" v={item.reason} className="py-1" />
              <KV k="Case" v={item.caseRef} className="py-1" />
              <KV k="Requested by" v="Cyber PS Jaipur" className="py-1" />
            </div>
            <div className="mt-2 text-[11.5px] uppercase tracking-[0.08em] text-dim">Why this wallet was flagged</div>
            <ul className="mt-1.5 space-y-1.5">
              {item.factors.map((f) => (
                <li key={f.plain} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[46%] truncate text-text/85">{f.plain}</span>
                  <Meter value={f.w / maxW} tone="crimson" height={4} />
                  <span className="k-num w-8 shrink-0 text-right text-dim">{Math.round(f.w * 100)}%</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {done ? (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 text-[13px] text-moss">
                  <CheckCircle2 className="size-4" />
                  {done === 'hold' ? 'Deposits on hold · ANVESHAK notified in 1.6 s' : 'Acknowledged · ANVESHAK notified in 1.2 s'}
                </motion.span>
              ) : (
                <>
                  <Button size="sm" onClick={() => setActed({ uid: item.uid, what: 'hold' })} className="border-gold/40 text-gold">
                    <ShieldCheck /> Hold deposits
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => setActed({ uid: item.uid, what: 'ack' })}>
                    Acknowledge only
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mx-5 mt-3 text-[12px] leading-relaxed text-dim">
        The contributing factors travel with every alert, so the exchange's team can see why — nothing is a black box. Updates with the newest broadcast.
      </p>
    </Card>
  )
}

/* ───────── Sanctions screening ───────── */
type ScreenRow = Hop & { route: 'A' | 'B' }

function SanctionsTable() {
  const seen = new Set<string>()
  const rows: ScreenRow[] = []
  for (const h of ROUTE_A.trail) {
    seen.add(h.addr)
    rows.push({ ...h, route: 'A' })
  }
  for (const h of ROUTE_B.trail) {
    if (seen.has(h.addr)) continue
    seen.add(h.addr)
    rows.push({ ...h, route: 'B' })
  }
  const [reviewed, setReviewed] = React.useState(false)

  return (
    <Card className="h-full pb-3">
      <CardHeader
        title="Sanctions check on every hop"
        tech="each wallet on both trails screened against the OFAC SDN and UN consolidated lists"
        right={
          reviewed ? (
            <Chip tone="moss" dot>All clear</Chip>
          ) : (
            <Chip tone="gold" dot pulse>1 needs review</Chip>
          )
        }
      />
      <div className="overflow-x-auto px-3 pt-3">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-[0.08em] text-dim">
              <th className="px-2 pb-2 font-normal">Hop</th>
              <th className="px-2 pb-2 font-normal">Wallet</th>
              <th className="px-2 pb-2 font-normal">Role</th>
              <th className="px-2 pb-2 font-normal">OFAC SDN</th>
              <th className="px-2 pb-2 font-normal">UN list</th>
              <th className="px-2 pb-2 text-right font-normal">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hit = r.addr === SANCTION_MATCH_ADDR && !reviewed
              const hopTone: Tone = r.flag === 'EXCHANGE' ? 'gold' : r.flag.startsWith('BRIDGE') ? 'violet' : r.flag === 'VICTIM' ? 'sky' : r.flag === 'SUSPECT' || r.flag === 'HUB' ? 'crimson' : 'teal'
              return (
                <tr key={r.route + r.n} className={cn('border-t border-line text-[13.5px]', hit && 'bg-gold/[0.05]')}>
                  <td className="px-2 py-2">
                    <span className="k-mono rounded-md px-1.5 py-0.5 text-[12px]" style={{ color: toneHex(hopTone), background: toneA(hopTone, 0.1) }}>
                      {r.route}
                      {r.n}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <Address addr={r.addr} chain={r.chain} className="text-[13px]" />
                  </td>
                  <td className="px-2 py-2 text-[13px] text-muted">{r.role}</td>
                  <td className="px-2 py-2 text-[12.5px]">{hit ? <span className="text-gold">1-hop exposure</span> : <span className="text-dim">no match</span>}</td>
                  <td className="px-2 py-2 text-[12.5px] text-dim">no match</td>
                  <td className="px-2 py-2 text-right">
                    {hit ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help rounded-full outline-none">
                            <Chip tone="gold" dot>Possible match · needs review</Chip>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[260px] border border-line-2 bg-[#1d1d20] text-text">
                          This wallet received funds from a contract that also paid a listed address. Not on the list itself — an officer must decide.
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Chip tone="moss" dot>Clear</Chip>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
        <div className="text-[12.5px] leading-relaxed text-muted">
          {reviewed ? (
            <>Possible match on hop B4 reviewed by SI Kavita Rathore — <span className="text-moss">indirect exposure only, not a listed party</span>.</>
          ) : (
            <>Hop B4 is one step from a listed address (synthetic entry). Indirect exposure is a lead to note in the file, not a sanctions hit.</>
          )}
        </div>
        <Button size="sm" onClick={() => setReviewed((r) => !r)}>
          {reviewed ? 'Undo review' : 'Mark B4 as reviewed'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-2.5 text-[12px] text-dim">
        <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> List refreshed 03 Oct 2026</span>
        <span>· OFAC SDN (02 Oct 2026)</span>
        <span>· UN consolidated (30 Sep 2026)</span>
        <span>· exact address match + 1-hop exposure</span>
      </div>
    </Card>
  )
}

/* ───────── Stablecoin freeze check ───────── */
function FreezeCheck() {
  const left = useCountdown(38 * 60)
  const pctLeft = (left / 3600) * 100
  const balanceINR = HUB.amt * USDT_INR
  const steps = [
    { plain: 'Officer drafts request in ANVESHAK', tech: 'pre-filled from this trace' },
    { plain: 'Routed via I4C to the issuer', tech: "issuer's law-enforcement request channel" },
    { plain: 'Issuer freezes the tokens on-chain', tech: 'token-contract blacklist function' },
  ]
  return (
    <Card variant="speckle" grain className="h-full pb-5">
      <CardHeader
        title="Can this money be frozen at the source?"
        tech="USDT on TRON can be frozen by its issuer — even before it reaches an exchange"
        icon={<Snowflake className="size-4 text-sky" />}
      />
      <div className="relative space-y-3 px-5 pt-3">
        <div className="flex items-center justify-between rounded-xl border border-moss/25 bg-moss/[0.06] px-3 py-2.5">
          <div>
            <div className="text-[14px] text-text">Freezable by issuer</div>
            <div className="text-[12px] text-dim">{CASE.asset} · issuer-controlled token</div>
          </div>
          <Chip tone="moss" solid>Yes</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
            <div className="text-[12px] text-muted">Balance at collection wallet</div>
            <div className="k-num mt-1 text-[18px] text-text">{HUB.amt.toLocaleString('en-IN')}</div>
            <div className="text-[11.5px] text-dim">USDT ≈ {inr(balanceINR)}</div>
          </div>
          <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
            <div className="text-[12px] text-muted">Wallet</div>
            <Address addr={HUB.addr} chain="TRON" className="mt-1 -ml-1 text-[13px]" />
            <div className="text-[11.5px] text-dim">38 victims pay in</div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted">Golden hour left</span>
            <span className={cn('k-mono text-[14.5px]', left < 30 * 60 ? 'text-ember' : 'text-gold')}>
              {Math.floor(left / 60)}m {String(left % 60).padStart(2, '0')}s
            </span>
          </div>
          <Progress value={pctLeft} className="mt-1.5 h-1.5 bg-white/[0.06]" />
          <div className="mt-1 text-[11.5px] text-dim">Funds at this hub have moved to an exchange within ~40 min in past cases.</div>
        </div>
        <Hair />
        <div>
          <div className="text-[12px] uppercase tracking-[0.08em] text-dim">Suggested route</div>
          <ol className="mt-2 space-y-2">
            {steps.map((s, i) => (
              <li key={s.plain} className="flex items-start gap-2.5">
                <IconTile size={22} className="k-num text-[11.5px]">{i + 1}</IconTile>
                <div>
                  <div className="text-[13.5px] text-text/90">{s.plain}</div>
                  <div className="text-[11.5px] text-dim">{s.tech}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <Link to="/evidence" className="block">
          <Button variant="ember" className="w-full">
            Draft issuer freeze request <ArrowRight />
          </Button>
        </Link>
        <p className="text-[11.5px] leading-relaxed text-dim">Freezing is at the issuer's discretion; ANVESHAK only prepares the request for an officer to send.</p>
      </div>
    </Card>
  )
}
