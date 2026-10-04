import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  BellRing,
  Building2,
  Check,
  Clock3,
  Eye,
  Info,
  Loader2,
  Radio,
  Send,
  ShieldCheck,
  Shuffle,
  Snowflake,
  User,
  Users,
  Wallet,
  Waypoints,
  XCircle,
} from 'lucide-react'
import {
  Address,
  BarColumns,
  Button,
  Card,
  CardHeader,
  Chip,
  Donut,
  IconTile,
  KV,
  Meter,
  PageHeader,
  Reveal,
  Stat,
  useTick,
  type FlowEdge,
  type FlowNode,
  type Tone,
  FlowGraph,
  toneA,
  toneHex,
} from '@/components/kit'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/animate-ui/components/radix/dialog'
import { Progress } from '@/components/animate-ui/components/radix/progress'
import { CASES, EXCHANGES } from '@/data/demo'
import { inr, mmss, short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ALERT_TOTALS, HIST_BINS, PAST_ALERTS, SCENARIOS, type AlertOutcome, type PredKind, type Scenario } from './interdiction/data'

const PRED_ICON: Record<PredKind, React.ReactNode> = {
  exchange: <Building2 />,
  p2p: <Users />,
  mixer: <Shuffle />,
  bridge: <Waypoints />,
}

type AlertState = { step: number; times: string[] }

const STEP_DELAYS = [0, 1400, 2900, 4800]

function clock() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false })
}

function exName(id?: string) {
  return EXCHANGES.find((e) => e.id === id)?.name ?? 'the exchange'
}

export default function InterdictionPage() {
  const tick = useTick(1000)
  const [caseId, setCaseId] = React.useState(SCENARIOS[0].caseId)
  const [alerts, setAlerts] = React.useState<Record<string, AlertState>>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const timers = React.useRef<number[]>([])

  React.useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const sc = SCENARIOS.find((s) => s.caseId === caseId)!
  const meta = CASES.find((c) => c.id === sc.caseId)!
  const top = sc.preds[0]
  const alert = alerts[sc.caseId]
  const step = alert?.step ?? 0
  const held = step >= 4
  const left = Math.max(0, sc.etaSec - tick)
  const elapsed = sc.elapsedSec + Math.min(tick, sc.etaSec)

  function sendAlert() {
    const id = sc.caseId
    setConfirmOpen(false)
    STEP_DELAYS.forEach((d, i) => {
      const t = window.setTimeout(() => {
        setAlerts((a) => {
          const prev = a[id] ?? { step: 0, times: [] }
          return { ...a, [id]: { step: i + 1, times: [...prev.times.slice(0, i), clock()] } }
        })
      }, d + 250)
      timers.current.push(t)
    })
  }

  // live entries generated in this session go on top of the ticker
  const liveAlerts = SCENARIOS.filter((s) => alerts[s.caseId]).map((s) => {
    const st = alerts[s.caseId]
    return {
      caseId: s.caseId,
      exchangeId: s.preds[0].exchangeId ?? '',
      amt: s.movingINR,
      outcome: (st.step >= 4 ? 'held' : 'pending') as AlertOutcome,
      when: `Just now, ${st.times[0]}`,
      note: st.step >= 4 ? 'held before cash-out' : 'awaiting deposit',
      live: true,
    }
  })
  const ticker = [...liveAlerts, ...PAST_ALERTS.map((a) => ({ ...a, live: false }))]
  const totals = {
    held: ALERT_TOTALS.held + liveAlerts.filter((a) => a.outcome === 'held').length,
    missed: ALERT_TOTALS.missed,
    pending: ALERT_TOTALS.pending + liveAlerts.filter((a) => a.outcome === 'pending').length,
  }
  const totalCount = totals.held + totals.missed + totals.pending
  const heldPct = Math.round((totals.held / totalCount) * 100)

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <Chip tone="ember" dot pulse>
                Live
              </Chip>
              <span>Act before the money lands</span>
            </>
          }
          title="Pre-emptive Freeze"
          tech="Every other tool traces after the fact — by then the money is cashed out. KAIZEN predicts the next hop from the syndicate's past routes and warns the likely exchange before the deposit arrives. · next-hop prediction · route-reuse model"
          actions={
            <>
              <span className="k-btn-ghost inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px]">
                <Eye className="size-3" /> {SCENARIOS.length} cases on watch
              </span>
              <span className="k-btn-ghost inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px]">
                <Radio className="size-3 text-ember" /> 1,284 wallets monitored
              </span>
            </>
          }
        />
      </Reveal>

      {/* ── Watched cases ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SCENARIOS.map((s, i) => (
          <Reveal key={s.caseId} delay={0.05 + i * 0.05}>
            <WatchCard s={s} tick={tick} active={s.caseId === caseId} alert={alerts[s.caseId]} onSelect={() => setCaseId(s.caseId)} />
          </Reveal>
        ))}
      </div>

      {/* ── Prediction graph + ETA ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2.1fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-4">
            <CardHeader
              title="Where the money goes next"
              tech={`next-hop prediction · ${sc.syndicate} · ${sc.chain}`}
              right={
                <Chip tone={sc.confidence.tone} dot>
                  {sc.confidence.label} confidence
                </Chip>
              }
            />
            <div className="k-scroll mt-2 overflow-x-auto px-4">
              <div className="min-w-[760px]">
                <PredictionGraph key={sc.caseId} sc={sc} held={held} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 text-[12.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-crimson" /> Confirmed on-chain movement
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t-2 border-dashed border-gold" /> Predicted next hop
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-4 rounded bg-white/40" /> Thicker line = more likely
              </span>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card className="h-full pb-5">
            <CardHeader
              title="Time until it reaches the exchange"
              tech="arrival estimate · historical hop timing"
              right={<Clock3 className="size-4 text-muted" />}
            />
            <div className="px-5 pt-3">
              <AnimatePresence mode="wait">
                <motion.div key={held ? 'held' : sc.caseId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                  {held ? (
                    <div className="k-num text-[44px] leading-none text-moss">Held</div>
                  ) : (
                    <div className={cn('k-num text-[44px] leading-none tabular-nums', left < 300 ? 'text-ember' : 'text-text')}>{left > 0 ? mmss(left) : '0m 00s'}</div>
                  )}
                  <div className="mt-1.5 text-[13.5px] text-muted">
                    {held ? (
                      <>
                        Funds landed at <span className="text-text">{exName(top.exchangeId)}</span> and were held
                      </>
                    ) : left > 0 ? (
                      <>
                        expected to reach <span className="text-text">{top.sub}</span> ({Math.round(top.p * 100)}% likely)
                      </>
                    ) : (
                      <>Predicted arrival window reached — check the exchange reply</>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
              <Progress
                value={held ? 100 : Math.min(100, (elapsed / (sc.elapsedSec + sc.etaSec)) * 100)}
                className={cn('mt-4 h-1.5 bg-white/[0.06]', held && '[&>div]:bg-moss')}
              />
              <div className="mt-1.5 flex justify-between text-[12px] text-dim">
                <span>On current wallet for {mmss(elapsed)}</span>
                <span>usual total ~{sc.medianMin} min</span>
              </div>

              <div className="mt-5 text-[13px] text-muted">How long this group usually waits before depositing</div>
              <BarColumns
                key={sc.caseId}
                className="mt-7"
                height={104}
                tone="ember"
                data={sc.hist.map((v, i) => {
                  const bin = Math.min(HIST_BINS.length - 1, Math.floor(elapsed / 120))
                  return { label: HIST_BINS[i], value: v, highlight: i === bin, sub: i === bin ? 'now' : undefined }
                })}
                format={(v) => `${v} past cases`}
              />
              <div className="mt-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[12.5px] text-muted">
                Based on <span className="text-text">{sc.priorTraces} prior traces</span>
                {sc.syndicate.startsWith('SYN') ? ' of this syndicate' : ' of similar cases'} — route reuse{' '}
                <span className="text-text">{Math.round(sc.routeReuse * 100)}%</span>. Minutes from the last pass-through wallet to the deposit.
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── Why + action ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.15fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-5">
            <CardHeader title="Why this prediction" tech={`contributing factors · top hop ${Math.round(top.p * 100)}% · weights sum to 100%`} />
            <ul className="mt-3 space-y-3.5 px-5">
              {sc.factors.map((f, i) => (
                <motion.li key={sc.caseId + f.plain} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] text-text">{f.plain}</span>
                    <span className="k-num shrink-0 text-[13.5px] text-text">{Math.round(f.w * 100)}%</span>
                  </div>
                  <div className="mb-1.5 text-[12px] text-dim">{f.tech}</div>
                  <Meter key={sc.caseId} value={f.w} max={0.4} tone={f.tone} height={5} />
                </motion.li>
              ))}
            </ul>
            <div className="mx-5 mt-5 flex gap-2.5 rounded-xl border border-dashed border-gold/30 bg-gold/[0.04] px-3 py-2.5 text-[13px] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-gold" />
              <span>
                <span className="text-text">This is a prediction, not proof.</span> The alert asks the exchange to watch one address and hold a matching
                deposit for a short window. It cannot freeze funds without a lawful order from the investigating officer.
              </span>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card variant="glass" className="h-full pb-5">
            <CardHeader
              title="Warn the exchange before the money lands"
              tech="pre-emptive watch-and-hold alert · secure VASP channel"
              right={
                step === 0 ? (
                  <Chip tone="neutral">Not sent</Chip>
                ) : held ? (
                  <Chip tone="moss" dot>
                    Held
                  </Chip>
                ) : (
                  <Chip tone="ember" dot pulse>
                    In progress
                  </Chip>
                )
              }
            />
            <div className="grid grid-cols-1 gap-x-6 px-5 pt-2 md:grid-cols-2">
              <div className="divide-y divide-line">
                <KV k="Recipient" v={`${exName(top.exchangeId)} · compliance desk`} />
                <KV k="Address to watch" v={top.addr ? <Address addr={top.addr} chain={sc.chain} className="py-0" tone="gold" /> : '—'} />
                <KV k="Amount on the way" v={<span className="k-num">{inr(sc.movingINR)}</span>} />
                <KV k="Crypto" v={<span className="k-mono text-[13px]">{sc.movingCrypto}</span>} />
                <KV k="Case" v={`${sc.caseId} · ${meta.who}`} />
              </div>
              <div className="mt-4 md:mt-0">
                {step === 0 ? (
                  <div className="k-dashed flex h-full min-h-[170px] flex-col justify-between p-4">
                    <div>
                      <IconTile tone="ember">
                        <BellRing />
                      </IconTile>
                      <p className="mt-3 text-[13.5px] leading-snug text-muted">
                        One alert puts the address on watch. If the deposit arrives, the exchange holds it while you obtain a lawful order.
                      </p>
                    </div>
                    <Button variant="ember" className="mt-4 w-full" onClick={() => setConfirmOpen(true)}>
                      <Snowflake /> Send pre-emptive freeze alert
                    </Button>
                  </div>
                ) : (
                  <AlertTimeline step={step} times={alert!.times} exchange={exName(top.exchangeId)} addr={top.addr ?? ''} amt={sc.movingINR} />
                )}
              </div>
            </div>
            <AnimatePresence>
              {held && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                  className="overflow-hidden"
                >
                  <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moss/30 bg-moss/[0.06] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <IconTile tone="moss">
                        <ShieldCheck />
                      </IconTile>
                      <div>
                        <Stat value={sc.movingINR / 1e5} prefix="₹" suffix=" L" decimals={1} className="text-[26px] text-moss" />
                        <div className="text-[12.5px] text-muted">held before cash-out · victim recovery now possible</div>
                      </div>
                    </div>
                    <span className="text-[12.5px] text-dim">Next: attach lawful order within 24 h</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Reveal>
      </div>

      {/* ── Ticker + success rate ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title="Recent pre-emptive alerts" tech="alert outcomes · last 7 days" right={<Chip tone="ember" dot pulse>Live</Chip>} />
            <ul className="mt-2 divide-y divide-line px-3 pb-2">
              <AnimatePresence initial={false}>
                {ticker.slice(0, 7).map((a) => (
                  <motion.li
                    key={a.caseId + a.when}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn('flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.025]', a.live && 'bg-ember/[0.04]')}
                  >
                    <OutcomeIcon outcome={a.outcome} />
                    <div className="min-w-[150px] flex-1">
                      <div className="truncate text-[14px] text-text">
                        {a.caseId} <span className="text-dim">→</span> {exName(a.exchangeId)}
                      </div>
                      <div className="truncate text-[12px] text-dim">
                        {a.when} · {a.note}
                      </div>
                    </div>
                    <div className="k-num w-[64px] text-right text-[14px] text-text">{inr(a.amt)}</div>
                    <OutcomeChip outcome={a.outcome} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card className="h-full pb-5">
            <CardHeader title="How often alerts work" tech={`${totalCount} pre-emptive alerts · last 30 days`} />
            <div className="flex flex-wrap items-center justify-center gap-6 px-5 pt-4">
              <Donut
                size={150}
                stroke={15}
                parts={[
                  { value: totals.held, tone: 'moss' },
                  { value: totals.missed, tone: 'crimson' },
                  { value: totals.pending, tone: 'neutral' },
                ]}
                center={
                  <div>
                    <div className="k-num text-[28px] leading-none text-text">{heldPct}%</div>
                    <div className="mt-1 text-[11.5px] text-muted">held in time</div>
                  </div>
                }
              />
              <div className="min-w-[150px] space-y-2.5">
                {(
                  [
                    { k: 'Held before cash-out', v: totals.held, tone: 'moss' },
                    { k: 'Missed (arrived first)', v: totals.missed, tone: 'crimson' },
                    { k: 'Waiting on exchange', v: totals.pending, tone: 'neutral' },
                  ] as { k: string; v: number; tone: Tone }[]
                ).map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-4 text-[13.5px]">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="size-2 rounded-full" style={{ background: toneHex(r.tone) }} />
                      {r.k}
                    </span>
                    <span className="k-num text-text">{r.v}</span>
                  </div>
                ))}
                <div className="border-t border-line pt-2.5 text-[12.5px] text-dim">
                  Median warning given: <span className="text-text">6m 40s</span> before deposit
                </div>
              </div>
            </div>
            <p className="mx-5 mt-4 text-[12px] leading-relaxed text-dim">
              Misses are mostly hops faster than the alert channel (under 2 min). Figures are illustrative demo data.
            </p>
          </Card>
        </Reveal>
      </div>

      {/* ── Confirm dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl border-line-2 bg-[#141415] p-0 text-text sm:max-w-[480px]">
          <div className="p-5 pb-0">
            <DialogHeader className="text-left">
              <div className="flex items-center gap-2.5">
                <IconTile tone="ember" size={32}>
                  <Snowflake />
                </IconTile>
                <DialogTitle className="text-[16.5px] font-medium">Send pre-emptive freeze alert?</DialogTitle>
              </div>
              <DialogDescription className="text-[13.5px] text-muted">
                The exchange is asked to watch one address and hold a matching deposit. Nothing is frozen yet.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="mx-5 divide-y divide-line rounded-xl border border-line bg-white/[0.02] px-3">
            <KV k="To" v={`${exName(top.exchangeId)} — compliance desk`} />
            <KV k="Watch address" v={top.addr ? <span className="k-mono text-[12.5px]">{short(top.addr, 8, 6)}</span> : '—'} />
            <KV k="Expected amount" v={`${inr(sc.movingINR)} · ${sc.movingCrypto}`} />
            <KV k="Expected in" v={left > 0 ? `~${mmss(left)}` : 'any moment'} />
            <KV k="Prediction" v={`${Math.round(top.p * 100)}% likely · ${sc.confidence.label.toLowerCase()} confidence`} />
          </div>
          <div className="mx-5 rounded-xl border border-dashed border-gold/30 bg-gold/[0.04] px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
            <div className="mb-1 flex items-center gap-1.5 text-gold">
              <AlertTriangle className="size-3.5" /> Draft for officer review — not legal advice
            </div>
            Legal basis: request to preserve and temporarily hold funds pending a written order under BNSS §94{' '}
            <span className="text-gold">(section reference to be verified)</span>. Sent by {meta.city} cyber cell for case {sc.caseId}.
          </div>
          <DialogFooter className="gap-2 border-t border-line p-4">
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="ember" onClick={sendAlert}>
              <Send /> Send freeze alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ───────── watched case card ───────── */
function WatchCard({ s, tick, active, alert, onSelect }: { s: Scenario; tick: number; active: boolean; alert?: AlertState; onSelect: () => void }) {
  const meta = CASES.find((c) => c.id === s.caseId)!
  const left = Math.max(0, s.etaSec - tick)
  const held = (alert?.step ?? 0) >= 4
  const urgent = left < 600
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'k-card relative block w-full overflow-hidden p-4 text-left transition-colors',
        active ? 'border-ember/40' : 'hover:border-line-2',
      )}
      style={active ? { boxShadow: `0 0 0 1px ${toneA('ember', 0.25)}, 0 0 32px -12px ${toneA('ember', 0.6)}` } : undefined}
    >
      {active && <motion.span layoutId="watch-active" className="absolute inset-x-0 top-0 h-[2px] bg-ember" />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] text-text">
            {s.caseId}
            {held ? (
              <Chip tone="moss" dot>
                Held
              </Chip>
            ) : alert ? (
              <Chip tone="ember" dot pulse>
                Alert out
              </Chip>
            ) : null}
          </div>
          <div className="truncate text-[12.5px] text-dim">
            {meta.who} · {meta.city} · {meta.type}
          </div>
        </div>
        <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-line-2">
          <span className={cn('absolute inset-1 rounded-full', held ? 'bg-moss/20' : urgent ? 'bg-ember/20' : 'bg-gold/15')} />
          <Radio className={cn('relative size-3.5', held ? 'text-moss' : urgent ? 'text-ember' : 'text-gold')} />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="k-num text-[20px] text-text">{inr(s.movingINR)}</div>
          <div className="text-[12px] text-dim">still moving · {s.chain}</div>
        </div>
        <div className="text-right">
          <div className={cn('k-mono text-[16.5px]', held ? 'text-moss' : urgent ? 'text-ember' : 'text-gold')}>{held ? 'held' : mmss(left)}</div>
          <div className="text-[12px] text-dim">
            → {s.preds[0].title.replace(' deposit', '')} {Math.round(s.preds[0].p * 100)}%
          </div>
        </div>
      </div>
    </button>
  )
}

/* ───────── prediction graph ───────── */
function PredictionGraph({ sc, held }: { sc: Scenario; held: boolean }) {
  const [selected, setSelected] = React.useState<string | null>('c')
  const { nodes, edges } = React.useMemo(() => {
    const nodes: FlowNode[] = [
      ...sc.path.map((p, i) => ({
        id: p.id,
        col: i,
        width: 150,
        title: p.title,
        sub: short(p.addr),
        tone: p.tone,
        icon: p.kind === 'victim' ? <User /> : <Wallet />,
        live: p.id === 'c' && !held,
      })),
      ...sc.preds.map((p, i) => {
        const isHeld = held && i === 0
        return {
          id: p.id,
          col: 3,
          width: 228,
          y: [0.08, 0.37, 0.66, 0.94][i],
          title: isHeld ? `${p.title} · held` : p.title,
          sub: p.sub,
          tone: (isHeld ? 'moss' : p.tone) as Tone,
          icon: isHeld ? <ShieldCheck /> : PRED_ICON[p.kind],
          ghost: !isHeld,
          badge: (
            <span
              className="k-num rounded-md px-1.5 py-0.5 text-[12.5px]"
              style={{ color: toneHex(isHeld ? 'moss' : p.tone === 'neutral' ? 'white' : p.tone), background: 'rgba(255,255,255,0.05)' }}
            >
              {Math.round(p.p * 100)}%
            </span>
          ),
        } satisfies FlowNode
      }),
    ]
    const edges: FlowEdge[] = [
      { from: 'v', to: 's', weight: 0.7, label: sc.path[1].gapLabel },
      { from: 's', to: 'c', weight: 0.7, label: sc.path[2].gapLabel },
      ...sc.preds.map((p, i) => ({
        from: 'c',
        to: p.id,
        weight: Math.max(0.06, p.p),
        dashed: !(held && i === 0),
        animated: i === 0,
        tone: (held && i === 0 ? 'moss' : p.tone) as Tone,
      })),
    ]
    return { nodes, edges }
  }, [sc, held])

  return <FlowGraph nodes={nodes} edges={edges} height={330} nodeWidth={172} nodeHeight={56} selected={selected} onSelect={(id) => setSelected((s) => (s === id ? null : id))} />
}

/* ───────── alert status timeline ───────── */
function AlertTimeline({ step, times, exchange, addr, amt }: { step: number; times: string[]; exchange: string; addr: string; amt: number }) {
  const steps = [
    { t: 'Alert sent', d: `Secure notice to ${exchange} compliance desk` },
    { t: 'Exchange acknowledged', d: 'Compliance officer on duty confirmed receipt' },
    { t: 'Address on watch', d: `${short(addr)} flagged for incoming deposits` },
    { t: 'Funds arrived & held', d: `${inr(amt)} credited and held pending lawful order` },
  ]
  return (
    <ol className="relative space-y-0">
      {steps.map((s, i) => {
        const done = step > i
        const active = step === i
        const last = i === steps.length - 1
        const tone: Tone = last ? 'moss' : 'ember'
        return (
          <li key={s.t} className="relative flex gap-3 pb-3.5 last:pb-0">
            {!last && (
              <span className="absolute left-[13px] top-7 bottom-0 w-px bg-white/[0.08]">
                <motion.span
                  className="absolute inset-x-0 top-0 bg-ember"
                  initial={{ height: 0 }}
                  animate={{ height: step > i + 1 ? '100%' : step > i ? '50%' : 0 }}
                  transition={{ duration: 0.6 }}
                />
              </span>
            )}
            <motion.span
              className="relative grid size-[27px] shrink-0 place-items-center rounded-full border"
              animate={{
                borderColor: done ? toneHex(tone) : 'rgba(255,255,255,0.12)',
                backgroundColor: done ? toneA(tone, last ? 0.18 : 0.14) : 'rgba(255,255,255,0.02)',
                scale: done ? [1.25, 1] : 1,
              }}
              transition={{ duration: 0.4 }}
            >
              {done ? (
                <Check className="size-3.5" style={{ color: toneHex(tone) }} strokeWidth={2.5} />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin text-muted" />
              ) : (
                <span className="size-1.5 rounded-full bg-white/20" />
              )}
            </motion.span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-[14px]', done ? (last ? 'text-moss' : 'text-text') : 'text-muted')}>{s.t}</span>
                <span className="k-mono text-[12px] text-dim">{done ? times[i] : active ? 'waiting…' : ''}</span>
              </div>
              <div className="truncate text-[12px] text-dim">{s.d}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function OutcomeIcon({ outcome }: { outcome: AlertOutcome }) {
  if (outcome === 'held')
    return (
      <IconTile tone="moss" size={32}>
        <ShieldCheck />
      </IconTile>
    )
  if (outcome === 'missed')
    return (
      <IconTile tone="crimson" size={32}>
        <XCircle />
      </IconTile>
    )
  return (
    <IconTile size={32}>
      <Clock3 />
    </IconTile>
  )
}

function OutcomeChip({ outcome }: { outcome: AlertOutcome }) {
  return (
    <span className="w-[66px] text-right">
      {outcome === 'held' ? (
        <Chip tone="moss">Held</Chip>
      ) : outcome === 'missed' ? (
        <Chip tone="crimson">Missed</Chip>
      ) : (
        <Chip tone="neutral" dot pulse>
          Pending
        </Chip>
      )}
    </span>
  )
}
