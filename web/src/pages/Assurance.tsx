import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeftRight,
  Download,
  EyeOff,
  FlaskConical,
  Layers,
  Loader2,
  Play,
  Repeat,
  RotateCcw,
  Shuffle,
  Sparkle,
  Split,
  Timer,
  Unlink,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  HeatGrid,
  IconTile,
  Meter,
  PageHeader,
  Reveal,
  ScoreRing,
  Stat,
  smoothPath,
  toneA,
  toneHex,
  type Tone,
} from '@/components/kit'
import { Tabs, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { Progress, ProgressIndicator } from '@/components/animate-ui/primitives/radix/progress'
import { EXCHANGES } from '@/data/demo'
import { cn } from '@/lib/utils'
import {
  BACKTEST,
  BY_FRAUD_TYPE,
  CONFUSION_2X2,
  EXCHANGE_CONFUSION,
  EXCHANGE_ORDER,
  OUTCOME_TONE,
  RELIABILITY,
  SCENARIOS,
  TRUST_PARTS,
  type Scenario,
} from './assurance/data'

const SCN_ICON: Record<Scenario['icon'], React.ReactNode> = {
  peel: <Layers />,
  bridge: <ArrowLeftRight />,
  mixer: <Shuffle />,
  dust: <Sparkle />,
  timer: <Timer />,
  wash: <Repeat />,
  split: <Split />,
}

const trust = TRUST_PARTS.reduce((a, p) => a + p.value * p.w, 0)

export default function AssurancePage() {
  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span>Measured, not asserted</span>
              <DemoChip />
            </>
          }
          title="Accuracy & Red Team"
          tech="We replay closed cases where the real answer is known, check whether our confidence numbers mean what they say, and attack our own engine with the tricks scammers use. Where it fails, we say so."
          actions={
            <Button>
              <Download /> Download backtest report
            </Button>
          }
        />
      </Reveal>

      {/* ── backtest band ── */}
      <Reveal delay={0.05}>
        <Card variant="glass" className="pb-5">
          <div className="grid grid-cols-1 gap-6 px-5 pt-5 xl:grid-cols-[minmax(0,330px)_1fr]">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start xl:border-r xl:border-line xl:pr-6">
              <ScoreRing value={trust} tone="moss" size={124} label={trust.toFixed(2)} sub="model trust" />
              <div className="w-full flex-1">
                <div className="text-[14px] text-text">How the trust score is built</div>
                <div className="text-[12px] text-dim">weighted blend · nothing hidden</div>
                <ul className="mt-2.5 space-y-1.5">
                  {TRUST_PARTS.map((p) => (
                    <li key={p.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 text-[12.5px]">
                      <span className="truncate text-muted">{p.label}</span>
                      <span className="k-mono text-[12px] text-dim">
                        {Math.round(p.w * 100)}% × <span className="text-text">{p.value.toFixed(2)}</span>
                      </span>
                      <Meter value={p.value} tone={p.tone} height={3} className="col-span-2 mt-0.5" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[14.5px] text-text">
                  Replayed <span className="k-num">{BACKTEST.cases}</span> closed cases with known outcomes
                </div>
                <Chip tone="neutral">synthetic replay · illustrative until run on live casework</Chip>
              </div>
              <div className="mt-0.5 text-[12.5px] text-dim">backtest · engine v14 · cases closed Jan–Aug 2026 with confirmed exchange and court outcome</div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-5">
                {[
                  { k: 'Precision', v: BACKTEST.precision, d: 2, plain: 'When ANVESHAK says “scam wallet”, it is right 94 times in 100' },
                  { k: 'Recall', v: BACKTEST.recall, d: 2, plain: 'Of all real scam wallets, it catches 89 in 100' },
                  { k: 'F1 score', v: BACKTEST.f1, d: 2, plain: 'Balance of the two above' },
                  { k: 'Right exchange, first pick', v: BACKTEST.top1, d: 2, plain: '168 of 183 cases named the correct exchange first' },
                  { k: 'Median trace time', v: BACKTEST.medianTraceSec, d: 0, suf: ' s', plain: 'From wallet address to exchange name' },
                ].map((m, i) => (
                  <motion.div
                    key={m.k}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className={cn('rounded-xl border border-line bg-white/[0.02] p-3', i === 4 && 'col-span-2 md:col-span-1')}
                  >
                    <div className="text-[12.5px] text-muted">{m.k}</div>
                    <Stat value={m.v} decimals={m.d} suffix={m.suf} className="mt-1 text-[24px] leading-none text-text" />
                    <div className="mt-1.5 text-[12px] leading-snug text-dim">{m.plain}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* ── reliability + confusion ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="h-full pb-4">
            <CardHeader
              title="Does “90% sure” really mean 90%?"
              tech="reliability diagram · predicted risk vs observed scam rate · 10 bins"
              right={<Chip tone="moss" dot>ECE {BACKTEST.ece.toFixed(3)}</Chip>}
            />
            <div className="px-5 pt-3">
              <Reliability />
              <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
                Dots near the dashed line mean the confidence is honest. Bigger dots hold more cases. Average gap between promise and reality: 3 points.
              </p>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <ConfusionCard />
        </Reveal>
      </div>

      {/* ── red team ── */}
      <Reveal delay={0.1}>
        <RedTeam />
      </Reveal>

      {/* ── blind spots + by type ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-4">
            <CardHeader title="What ANVESHAK cannot see" tech="honest blind spots · shown to judges and to court" right={<Chip tone="crimson" dot>3 known limits</Chip>} />
            <ul className="mt-3 space-y-2 px-3">
              {[
                { icon: <EyeOff />, t: 'Can’t see through a mixer — by design, we stop and flag', s: 'The trail ends at the mixer. We record where it went in and watch the exits, but never guess which coins came out.' },
                { icon: <Unlink />, t: 'Cross-chain links are timing and amount correlation, not proof', s: 'Every bridge hop carries its confidence (e.g. 82%) and is labelled “probable” in the evidence pack.' },
                { icon: <FlaskConical />, t: 'The ML model is trained on disclosed synthetic data', s: 'Rule-based signals (sweep, consolidation) need no training data. The ML layer only adjusts them, and its training set is documented.' },
              ].map((b, i) => (
                <motion.li
                  key={b.t}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.015] p-3"
                >
                  <IconTile tone="crimson" size={32} className="[&_svg]:size-3.5">
                    {b.icon}
                  </IconTile>
                  <div>
                    <div className="text-[14px] text-text">{b.t}</div>
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{b.s}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card className="h-full pb-4">
            <CardHeader title="Where it is strongest and weakest" tech="right-exchange rate by fraud type · same 214 cases" />
            <ul className="mt-4 space-y-3.5 px-5">
              {BY_FRAUD_TYPE.map((t) => (
                <li key={t.type}>
                  <div className="flex items-baseline justify-between text-[13.5px]">
                    <span className="text-text/90">{t.type}</span>
                    <span>
                      <span className="k-num text-text">{Math.round(t.acc * 100)}%</span>
                      <span className="ml-1 text-[11.5px] text-dim">n={t.n}</span>
                    </span>
                  </div>
                  <Meter value={t.acc} tone={t.acc >= 0.9 ? 'moss' : t.acc >= 0.85 ? 'gold' : 'ember'} height={5} className="mt-1.5" />
                </li>
              ))}
            </ul>
            <p className="mx-5 mt-4 text-[12.5px] leading-relaxed text-dim">
              Loan-app extortion is weakest: payments are smaller and spread over weeks, so the sweep signature is faint. Collecting more closed cases here is our next priority.
            </p>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}

/* ───────── reliability diagram (custom SVG) ───────── */

function Reliability() {
  const W = 360
  const H = 250
  const L = 36
  const R = 10
  const T = 10
  const B = 30
  const x = (p: number) => L + p * (W - L - R)
  const y = (o: number) => T + (1 - o) * (H - T - B)
  const maxN = Math.max(...RELIABILITY.map((b) => b.n))
  const line = smoothPath(RELIABILITY.map((b) => [x(b.p), y(b.o)] as [number, number]), 0.45)
  const id = React.useId()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Reliability diagram: predicted risk against observed scam rate, closely following the diagonal">
      <defs>
        <linearGradient id={`rl${id}`} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor="rgba(244,244,245,0.25)" />
          <stop offset="100%" stopColor="#f4f4f5" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={x(0)} x2={x(1)} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" />
          <line x1={x(g)} x2={x(g)} y1={y(0)} y2={y(1)} stroke="rgba(255,255,255,0.06)" />
          <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#5c5c62">
            {Math.round(g * 100)}%
          </text>
          <text x={x(g)} y={H - B + 14} textAnchor="middle" fontSize="9" fill="#5c5c62">
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      <text x={x(0.5)} y={H - 2} textAnchor="middle" fontSize="9.5" fill="#8b8b90">
        What ANVESHAK predicted
      </text>
      <text x={10} y={y(0.5)} textAnchor="middle" fontSize="9.5" fill="#8b8b90" transform={`rotate(-90 10 ${y(0.5)})`}>
        What actually happened
      </text>
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 5" />
      <text x={x(0.62)} y={y(0.7) - 4} fontSize="9" fill="#5c5c62" transform={`rotate(-34 ${x(0.62)} ${y(0.7)})`}>
        perfectly honest
      </text>
      {RELIABILITY.map((b) => (
        <line key={b.p} x1={x(b.p)} x2={x(b.p)} y1={y(b.p)} y2={y(b.o)} stroke={toneA('ember', 0.45)} strokeWidth={1.5} />
      ))}
      <path d={line} fill="none" stroke="rgba(244,244,245,0.35)" strokeWidth={6} style={{ filter: 'blur(5px)' }} />
      <motion.path
        d={line}
        fill="none"
        stroke={`url(#rl${id})`}
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: [0.3, 0.7, 0.2, 1] }}
      />
      {RELIABILITY.map((b, i) => {
        const r = 3 + Math.sqrt(b.n / maxN) * 7
        return (
          <motion.circle
            key={b.p}
            cx={x(b.p)}
            cy={y(b.o)}
            r={r}
            fill={toneA('ember', 0.85)}
            stroke="#141415"
            strokeWidth={1.5}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + i * 0.07, type: 'spring', stiffness: 300, damping: 18 }}
            style={{ filter: `drop-shadow(0 0 6px ${toneA('ember', 0.7)})`, transformBox: 'fill-box', transformOrigin: 'center' }}
          >
            <title>{`Predicted ${Math.round(b.p * 100)}% · observed ${Math.round(b.o * 100)}% · ${b.n} cases`}</title>
          </motion.circle>
        )
      })}
    </svg>
  )
}

/* ───────── confusion matrices ───────── */

function ConfusionCard() {
  const [tab, setTab] = React.useState<'scam' | 'exchange'>('scam')
  const { tp, fp, fn, tn } = CONFUSION_2X2
  const monos = EXCHANGE_ORDER.map((id) => EXCHANGES.find((e) => e.id === id)!.monogram)
  const names = EXCHANGE_ORDER.map((id) => EXCHANGES.find((e) => e.id === id)!.name)
  const norm = EXCHANGE_CONFUSION.map((row) => {
    const s = row.reduce((a, b) => a + b, 0)
    return row.map((v) => v / s)
  })
  const diag = Object.fromEntries(EXCHANGE_ORDER.map((_, i) => [`${i}-${i}`, 'moss' as Tone]))
  const correct = EXCHANGE_CONFUSION.reduce((a, row, i) => a + row[i], 0)
  const total = EXCHANGE_CONFUSION.flat().reduce((a, b) => a + b, 0)

  return (
    <Card className="h-full pb-4">
      <CardHeader
        title="Where it gets things wrong"
        tech="confusion matrix · every mistake counted"
        right={
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-8 border border-line bg-white/[0.04]">
              <TabsTrigger value="scam" className="px-2.5 text-[12.5px]">
                Scam or not
              </TabsTrigger>
              <TabsTrigger value="exchange" className="px-2.5 text-[12.5px]">
                Which exchange
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
        className="flex-wrap"
      />
      <AnimatePresence mode="wait" initial={false}>
        {tab === 'scam' ? (
          <motion.div key="scam" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="px-5 pt-4">
            <div className="grid grid-cols-[64px_1fr_1fr] gap-2 text-[12px] text-dim">
              <span />
              <span className="text-center">ANVESHAK said scam</span>
              <span className="text-center">ANVESHAK said not scam</span>
              <span className="self-center text-right">Really scam</span>
              <Cell n={tp} label="Caught" tone="moss" strong />
              <Cell n={fn} label="Missed" tone="crimson" />
              <span className="self-center text-right">Really not</span>
              <Cell n={fp} label="False alarm" tone="ember" />
              <Cell n={tn} label="Correctly cleared" tone="neutral" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2">
                <div className="text-[12.5px] text-muted">Precision</div>
                <div className="k-mono mt-0.5 text-[13px] text-text">
                  {tp} ÷ ({tp} + {fp}) = <span className="text-moss">{(tp / (tp + fp)).toFixed(2)}</span>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2">
                <div className="text-[12.5px] text-muted">Recall</div>
                <div className="k-mono mt-0.5 text-[13px] text-text">
                  {tp} ÷ ({tp} + {fn}) = <span className="text-moss">{(tp / (tp + fn)).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
              The 21 misses were mostly slow, human-paced transfers — the sweep signature is built for automation, so we flag them for manual review rather than score them low.
            </p>
          </motion.div>
        ) : (
          <motion.div key="ex" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="px-5 pt-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="mb-1.5 pl-8 text-[11.5px] text-dim">ANVESHAK's first pick →</div>
                <HeatGrid
                  data={norm}
                  cell={26}
                  gap={4}
                  rowLabels={monos}
                  colLabels={monos}
                  accent={diag}
                  title={(r, c) => `Really ${names[r]} → picked ${names[c]}: ${EXCHANGE_CONFUSION[r][c]} cases`}
                />
                <div className="mt-1 text-[11.5px] text-dim">↑ real exchange</div>
              </div>
              <div className="w-full flex-1 space-y-2">
                <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[12.5px] text-muted">Named the right exchange first</div>
                  <div className="k-mono mt-0.5 text-[13px] text-text">
                    {correct} ÷ {total} = <span className="text-moss">{(correct / total).toFixed(2)}</span>
                  </div>
                </div>
                <ul className="space-y-1.5 text-[12.5px]">
                  {EXCHANGE_ORDER.map((id, i) => {
                    const row = EXCHANGE_CONFUSION[i]
                    const s = row.reduce((a, b) => a + b, 0)
                    return (
                      <li key={id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted">{names[i]}</span>
                        <span className="k-mono text-text">
                          {row[i]}/{s}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-dim">Green cells are correct picks. Most mix-ups are between exchanges that share a payment processor's hot wallet.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function Cell({ n, label, tone, strong }: { n: number; label: string; tone: Tone; strong?: boolean }) {
  return (
    <div
      className="rounded-xl border px-3 py-3 text-center"
      style={{ borderColor: toneA(tone, strong ? 0.45 : 0.25), background: toneA(tone, strong ? 0.14 : 0.07), boxShadow: strong ? `0 0 24px ${toneA(tone, 0.15)}` : undefined }}
    >
      <div className="k-num text-[24px] leading-none" style={{ color: tone === 'neutral' ? '#f4f4f5' : toneHex(tone) }}>
        <Stat value={n} />
      </div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  )
}

/* ───────── red team (the interactive moment) ───────── */

function RedTeam() {
  const [phase, setPhase] = React.useState<'idle' | 'running' | 'done'>('idle')
  const [done, setDone] = React.useState(0)
  const timers = React.useRef<number[]>([])

  React.useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const run = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setDone(0)
    setPhase('running')
    SCENARIOS.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setDone(i + 1)
          if (i === SCENARIOS.length - 1) setPhase('done')
        }, 900 + i * 850),
      )
    })
  }

  const revealed = SCENARIOS.slice(0, done)
  const counts = {
    pass: revealed.filter((s) => s.outcome === 'pass').length,
    partial: revealed.filter((s) => s.outcome === 'partial').length,
    fail: revealed.filter((s) => s.outcome === 'fail').length,
  }
  const caught = revealed.reduce((a, s) => a + s.caught, 0)
  const attacks = revealed.reduce((a, s) => a + s.attacks, 0)
  const pct = (done / SCENARIOS.length) * 100

  return (
    <Card variant="glass" className="pb-5">
      <CardHeader
        title="Red team — we attack our own engine"
        tech="adversarial scenario library · 40 synthetic attacks per scenario · each one a known evasion trick"
        right={
          <Button variant="ember" size="sm" onClick={run} disabled={phase === 'running'}>
            {phase === 'running' ? <Loader2 className="animate-spin" /> : phase === 'done' ? <RotateCcw /> : <Play />}
            {phase === 'running' ? 'Running…' : phase === 'done' ? 'Run again' : 'Run stress test'}
          </Button>
        }
        className="flex-wrap"
      />
      <div className="px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span className="text-muted">
            {phase === 'idle' && 'Not run in this session — last full run 02 Sep 2026, 23:10'}
            {phase === 'running' && (
              <>
                Replaying <span className="text-text">{SCENARIOS[Math.min(done, SCENARIOS.length - 1)].plain.toLowerCase()}</span> · scenario {Math.min(done + 1, SCENARIOS.length)} of {SCENARIOS.length}
              </>
            )}
            {phase === 'done' && (
              <>
                Finished · <span className="text-text">{caught}</span> of {attacks} attacks detected
              </>
            )}
          </span>
          <span className="k-mono text-dim">{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <ProgressIndicator
            className="h-full w-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${toneA('ember', 0.5)}, ${toneHex('ember')})`, boxShadow: `0 0 12px ${toneA('ember', 0.6)}` }}
          />
        </Progress>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 px-5 sm:grid-cols-2 xl:grid-cols-4">
        {SCENARIOS.map((s, i) => {
          const isDone = i < done
          const isActive = phase === 'running' && i === done
          const tone = OUTCOME_TONE[s.outcome]
          return (
            <motion.div
              key={s.id}
              layout
              animate={{
                borderColor: isDone ? toneA(tone, 0.4) : isActive ? toneA('ember', 0.5) : 'rgba(255,255,255,0.07)',
                backgroundColor: isDone ? toneA(tone, 0.05) : 'rgba(255,255,255,0.015)',
              }}
              transition={{ duration: 0.4 }}
              className={cn('relative flex min-h-[208px] flex-col overflow-hidden rounded-xl border p-3.5')}
            >
              {isActive && <div className="k-shimmer pointer-events-none absolute inset-0" />}
              <div className="relative flex items-start gap-2.5">
                <IconTile tone={isDone ? tone : isActive ? 'ember' : undefined} size={32} className="[&_svg]:size-3.5">
                  {SCN_ICON[s.icon]}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-text">{s.plain}</div>
                  <div className="text-[11.5px] text-dim">{s.tech}</div>
                </div>
              </div>
              <p className="relative mt-2 text-[12.5px] leading-snug text-muted">{s.how}</p>
              <div className="relative mt-2.5">
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-dim">Detection rate</span>
                  <span className="k-num text-text">{Math.round(s.baseline * 100)}%</span>
                </div>
                <Meter value={s.baseline} tone={tone} height={4} className="mt-1" />
              </div>
              <div className="relative mt-auto pt-3">
                <AnimatePresence mode="wait" initial={false}>
                  {isDone ? (
                    <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
                      <div className="flex items-center justify-between gap-2">
                        <Chip tone={tone} solid={s.outcome !== 'partial'}>
                          {s.outcome === 'pass' ? 'Pass' : s.outcome === 'partial' ? 'Partial' : 'Fail'}
                        </Chip>
                        <span className="k-mono text-[12px] text-muted">
                          {s.caught}/{s.attacks} caught
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-snug text-text/80">{s.did}</p>
                    </motion.div>
                  ) : isActive ? (
                    <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[12px] text-ember">
                      <Loader2 className="size-3 animate-spin" /> Replaying 40 attacks…
                    </motion.div>
                  ) : (
                    <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12px] text-dim">
                      {phase === 'idle' ? 'Waiting for a run' : 'Queued'}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}

        {/* summary tile */}
        <div className={cn('flex min-h-[208px] flex-col justify-between rounded-xl p-3.5', phase === 'done' ? 'border border-line-2 bg-white/[0.03]' : 'k-dashed')}>
          <div>
            <div className="text-[14px] text-text">Result</div>
            <div className="text-[11.5px] text-dim">{phase === 'done' ? 'all 7 scenarios replayed' : 'appears as scenarios finish'}</div>
          </div>
          <div className="space-y-2">
            {(['pass', 'partial', 'fail'] as const).map((o) => (
              <div key={o} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-muted">
                  <span className="size-2 rounded-full" style={{ background: toneHex(OUTCOME_TONE[o]), boxShadow: `0 0 8px ${toneA(OUTCOME_TONE[o], 0.7)}` }} />
                  {o === 'pass' ? 'Passed' : o === 'partial' ? 'Partly caught' : 'Failed'}
                </span>
                <motion.span key={counts[o]} initial={{ scale: 1.4, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="k-num text-[16.5px] text-text">
                  {counts[o]}
                </motion.span>
              </div>
            ))}
          </div>
          <p className="text-[12px] leading-snug text-dim">
            A fail is reported, not hidden: the mixer result goes into every evidence pack as a stated limit.
          </p>
        </div>
      </div>
    </Card>
  )
}
