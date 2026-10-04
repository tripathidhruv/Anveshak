import * as React from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Check,
  Clock3,
  Fingerprint as FingerprintIcon,
  Link2,
  ListChecks,
  Network,
  ShieldAlert,
  Split,
  Timer,
  TriangleAlert,
  Waypoints,
  X,
} from 'lucide-react'
import {
  Address,
  BarColumns,
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
  Stat,
  SubTabs,
  toneA,
  toneHex,
} from '@/components/kit'
import { CASE } from '@/data/demo'
import { cn } from '@/lib/utils'
import { Radar } from './fingerprint/Radar'
import {
  AXES,
  CURRENT,
  CURRENT_HEAT,
  CURRENT_SPLITS,
  OPERATORS,
  SPLIT_BUCKETS,
  heatGrid,
  similarity,
  type Operator,
} from './fingerprint/data'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLS = ['0', '', '4', '', '8', '', '12', '', '16', '', '20', '']

const RANKED = OPERATORS.map((o) => ({ ...o, sim: similarity(CURRENT.values, o.values) })).sort((a, b) => b.sim - a.sim)

const HABITS = [
  { icon: <Timer />, plain: 'How fast they sweep', tech: 'hold time' },
  { icon: <Split />, plain: 'How they split amounts', tech: 'chunk size' },
  { icon: <Clock3 />, plain: 'Which hours they work', tech: 'active hours' },
  { icon: <Waypoints />, plain: 'How many hops they use', tech: 'path length' },
  { icon: <Network />, plain: 'Chain & bridge choice', tech: 'TRON / bridge' },
  { icon: <FingerprintIcon />, plain: 'Fee settings', tech: 'fee-limit reuse' },
]

function hourOverlap(a: number[][], b: number[][]): number {
  let dot = 0
  let na = 0
  let nb = 0
  a.forEach((row, r) =>
    row.forEach((v, c) => {
      dot += v * b[r][c]
      na += v * v
      nb += b[r][c] * b[r][c]
    }),
  )
  return dot / (Math.sqrt(na * nb) || 1)
}

export default function FingerprintPage() {
  const [selId, setSelId] = React.useState(RANKED[0].id)
  const [axis, setAxis] = React.useState<number | null>(null)
  const [linked, setLinked] = React.useState<Record<string, boolean>>({})
  const sel = RANKED.find((o) => o.id === selId)!
  const opHeat = React.useMemo(() => heatGrid(sel.heat), [sel])
  const overlap = hourOverlap(CURRENT_HEAT, opHeat)

  const rows = AXES.map((ax, i) => {
    const gap = Math.abs(CURRENT.values[i] - sel.values[i])
    return { ax, i, gap, agree: 1 - gap, contrib: ax.w * (1 - gap), status: gap <= 0.08 ? 'match' : gap <= 0.16 ? 'close' : 'differs' }
  })
  const matches = rows.filter((r) => r.status !== 'differs').sort((a, b) => a.gap - b.gap)
  const differs = rows.filter((r) => r.status === 'differs').sort((a, b) => b.gap - a.gap)
  const simTone = sel.sim >= 0.85 ? 'crimson' : sel.sim >= 0.7 ? 'gold' : 'neutral'

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <FingerprintIcon className="size-3.5" /> Case {CASE.id} · behavioural match
            </>
          }
          title="Operator fingerprint"
          tech="Scammers throw away wallets after every job — but the person or script behind them keeps the same habits. We compare those habits across cases to suggest who is running this one."
          actions={
            <>
              <DemoChip />
              <Link to="/syndicates">
                <Button>
                  <Network /> Open syndicate graph
                </Button>
              </Link>
              <Button variant="ember" onClick={() => setLinked((l) => ({ ...l, [sel.id]: !l[sel.id] }))}>
                {linked[sel.id] ? <Check /> : <Link2 />}
                {linked[sel.id] ? `${sel.id} added as lead` : `Add ${sel.id} as a lead`}
              </Button>
            </>
          }
        />
      </Reveal>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={0.05}>
          <Card variant="speckle" grain className="h-[118px] p-4">
            <div className="relative text-[13.5px] text-muted">Closest operator</div>
            <div className="relative mt-3 flex items-end justify-between">
              <div>
                <div className="k-num text-[24px] leading-none text-text">{RANKED[0].id}</div>
                <div className="mt-1.5 text-[12px] text-dim">linked to {RANKED[0].syndicate} · {RANKED[0].syndicateName}</div>
              </div>
              <Chip tone="crimson" dot>{RANKED[0].sim.toFixed(2)} similar</Chip>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card variant="speckle" grain className="h-[118px] p-4">
            <div className="relative text-[13.5px] text-muted">Habits compared</div>
            <div className="relative mt-3 flex items-end justify-between">
              <div>
                <Stat value={AXES.length} className="text-[24px] leading-none text-text" />
                <div className="mt-1.5 text-[12px] text-dim">weighted, no training labels needed</div>
              </div>
              <div className="flex gap-1">
                {AXES.map((a, i) => (
                  <span key={a.key} className="flex h-7 w-1.5 items-end overflow-hidden rounded-full bg-white/[0.06]" title={`${i + 1}. ${a.short} · weight ${Math.round(a.w * 100)}%`}>
                    <motion.span
                      className="block w-full rounded-full bg-white/50"
                      initial={{ height: 0 }}
                      animate={{ height: `${(a.w / 0.2) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                    />
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card variant="speckle" grain className="h-[118px] p-4">
            <div className="relative text-[13.5px] text-muted">Profiles searched</div>
            <div className="relative mt-3">
              <Stat value={412} className="text-[24px] leading-none text-text" />
              <div className="mt-1.5 text-[12px] text-dim">operator profiles across 1,920 closed and open cases</div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.2}>
          <Card variant="speckle" grain className="h-[118px] p-4">
            <div className="relative text-[13.5px] text-muted">Hard links with top match</div>
            <div className="relative mt-3 flex items-end justify-between">
              <div>
                <Stat value={RANKED[0].sharedWallets.length} suffix=" wallets" className="text-[24px] leading-none text-text" />
                <div className="mt-1.5 text-[12px] text-dim">shared on-chain — independent of habits</div>
              </div>
              <IconTile tone="moss" size={32}><Link2 /></IconTile>
            </div>
          </Card>
        </Reveal>
      </div>

      <SubTabs
        tabs={[
          {
            key: 'match',
            label: 'Closest match',
            icon: FingerprintIcon,
            badge: sel.sim.toFixed(2),
            render: (go) => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr]">
                <Card variant="glass" className="h-full pb-5">
                  <CardHeader
                    title="Habit profile — this case vs closest operator"
                    tech="8 behavioural features, each scaled 0–1 · hover an axis to inspect it"
                    right={
                      <span className="flex items-center gap-3 text-[12.5px] text-muted">
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-sky" />This case</span>
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: toneHex(sel.tone) }} />{sel.id}</span>
                      </span>
                    }
                  />
                  <div className="grid grid-cols-1 items-center gap-2 px-5 pt-3 md:grid-cols-[1.2fr_1fr]">
                    <div className="relative">
                      <Radar
                        labels={AXES.map((a) => a.short)}
                        activeAxis={axis}
                        onAxisHover={setAxis}
                        series={[
                          { name: sel.id, tone: sel.tone, values: sel.values },
                          { name: 'This case', tone: 'sky', values: CURRENT.values },
                        ]}
                      />
                      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <AnimatePresence mode="popLayout">
                          <motion.div
                            key={sel.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="rounded-xl bg-[var(--k-pop)] px-2 py-1 backdrop-blur"
                          >
                            <div className="k-num text-[20px] leading-none" style={{ color: toneHex(simTone) }}>{sel.sim.toFixed(2)}</div>
                            <div className="text-[11px] text-dim">similarity</div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {AXES.map((a, i) => (
                        <li
                          key={a.key}
                          onMouseEnter={() => setAxis(i)}
                          onMouseLeave={() => setAxis(null)}
                          className={cn('flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors', axis === i ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]')}
                        >
                          <span className="k-mono mt-0.5 w-3 shrink-0 text-[11.5px] text-dim">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13.5px] leading-snug text-text/90">{a.plain}</div>
                            <div className="text-[11.5px] text-dim">{a.tech}</div>
                          </div>
                          <span className="k-num shrink-0 pt-0.5 text-[12px] text-muted">{Math.round(a.w * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>

                <Card className="h-full">
                  <CardHeader title="Most similar operators" tech="ranked by weighted habit similarity · select one to compare" right={<Chip tone="neutral">5 of 412</Chip>} />
                  <ul className="mt-3 space-y-1.5 px-3 pb-3">
                    {RANKED.map((o, idx) => {
                      const active = o.id === selId
                      const tone = o.sim >= 0.85 ? 'crimson' : o.sim >= 0.7 ? 'gold' : 'neutral'
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => setSelId(o.id)}
                            aria-pressed={active}
                            className={cn(
                              'relative w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                              active ? 'border-line-2 bg-white/[0.045]' : 'border-line bg-white/[0.012] hover:border-line-2 hover:bg-white/[0.03]',
                            )}
                          >
                            {active && (
                              <motion.span
                                layoutId="fp-sel"
                                className="absolute inset-y-2 left-0 w-[3px] rounded-full"
                                style={{ background: toneHex(o.tone), boxShadow: `0 0 10px ${toneA(o.tone, 0.8)}` }}
                              />
                            )}
                            <div className="flex items-center gap-3">
                              <span className="k-num grid size-9 shrink-0 place-items-center rounded-lg border border-line-2 text-[12.5px]" style={{ color: toneHex(o.tone) }}>
                                #{idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 text-[14px] text-text">
                                  Operator {o.id}
                                  <span className="text-[12px] text-dim">· linked to {o.syndicate}</span>
                                  {linked[o.id] && <Chip tone="moss" className="py-0 text-[11px]">lead</Chip>}
                                </div>
                                <div className="truncate text-[12px] text-dim">
                                  {o.syndicateName} · {o.cases} cases · last active {o.lastSeen}
                                  {o.sharedWallets.length > 0 && <span className="text-moss"> · {o.sharedWallets.length} shared wallet{o.sharedWallets.length > 1 ? 's' : ''}</span>}
                                </div>
                              </div>
                              <div className="k-num shrink-0 text-[17px]" style={{ color: toneHex(tone) }}>{o.sim.toFixed(2)}</div>
                            </div>
                            <Meter value={o.sim} tone={tone} height={4} className="mt-2.5" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="px-5 pb-4 text-[12px] leading-relaxed text-dim">
                    Similarity = Σ weight × (1 − gap) over the 8 habits. Above 0.85 is a strong lead, 0.70–0.85 worth a look, below that is noise.
                  </p>
                  <button
                    type="button"
                    onClick={() => go('habits')}
                    className="mx-5 mb-4 flex items-center gap-1.5 text-[13.5px] text-text/90 hover:text-text"
                  >
                    See what matches with {sel.id} <ArrowRight className="size-3.5" />
                  </button>
                </Card>
              </div>
            ),
          },
          {
            key: 'habits',
            label: 'Habit by habit',
            icon: ListChecks,
            badge: `${matches.length}/8`,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_1fr]">
                <Card className="h-full pb-4">
                  <CardHeader
                    title={`What matches, what differs — ${sel.id}`}
                    tech="per-habit gap · contribution = weight × agreement"
                    right={<Chip tone={simTone} dot>{matches.length} of 8 habits agree</Chip>}
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={sel.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                      className="grid grid-cols-1 gap-4 px-5 pt-3 md:grid-cols-2"
                    >
                      <BreakdownList title="What matches" icon={<Check className="size-3.5 text-moss" />} rows={matches} sel={sel} tone="moss" empty="No habits close enough to count as a match." />
                      <BreakdownList title="What differs" icon={<X className="size-3.5 text-gold" />} rows={differs} sel={sel} tone="gold" empty="Every habit is within tolerance." />
                    </motion.div>
                  </AnimatePresence>
                </Card>

                <Card className="h-full pb-5">
                  <CardHeader
                    title="When they work"
                    tech="transfers · day × 2-hour block (IST) · cosine overlap of the two grids"
                    right={<Chip tone={overlap > 0.85 ? 'crimson' : 'neutral'} dot>{Math.round(overlap * 100)}% overlap</Chip>}
                  />
                  <div className="flex flex-wrap justify-center gap-x-6 gap-y-4 px-5 pt-4">
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-muted">
                        <span className="size-1.5 rounded-full bg-sky" /> This case <span className="text-dim">· wallet cluster, 30 days</span>
                      </div>
                      <HeatGrid data={CURRENT_HEAT} tone="sky" cell={12} gap={3} rowLabels={DAYS} colLabels={COLS} title={(r, c, v) => `${DAYS[r]} ${c * 2}:00–${c * 2 + 2}:00 · ${Math.round(v * 12)} transfers`} />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-muted">
                        <span className="size-1.5 rounded-full" style={{ background: toneHex(sel.tone) }} /> {sel.id} <span className="text-dim">· {sel.cases} cases</span>
                      </div>
                      <motion.div key={sel.id} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                        <HeatGrid data={opHeat} tone={sel.tone} cell={12} gap={3} rowLabels={DAYS} colLabels={COLS} title={(r, c, v) => `${DAYS[r]} ${c * 2}:00–${c * 2 + 2}:00 · ${Math.round(v * 40)} transfers`} />
                      </motion.div>
                    </div>
                  </div>
                  <p className="mt-4 px-5 text-[12.5px] leading-relaxed text-muted">
                    {overlap > 0.85
                      ? 'Both are busiest between 8 pm and midnight on weekdays — a shift pattern typical of a staffed scam desk.'
                      : 'Working hours only partly line up — this operator keeps a different schedule.'}
                  </p>
                </Card>
              </div>
            ),
          },
          {
            key: 'money',
            label: 'How they split money',
            icon: Split,
            render: () => (
              <Card className="pb-5">
                <CardHeader
                  title="How they split the money"
                  tech="outgoing transfer sizes (USDT) · this case vs operator history"
                  right={<Chip tone="ember" dot>4,950 USDT ladder</Chip>}
                />
                <div className="grid grid-cols-1 gap-5 px-5 pt-3 md:grid-cols-[0.9fr_1.3fr]">
                  <div>
                    <div className="text-[12.5px] text-muted">This case: {CASE.amountCrypto.toLocaleString('en-IN')} USDT left the scammer's wallet as</div>
                    <div className="mt-3 space-y-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.15 + i * 0.12 }}
                          className="flex items-center gap-2.5"
                        >
                          <span className="k-mono w-12 text-[11.5px] text-dim">19:42:{11 + i * 14}</span>
                          <div className="relative h-7 flex-1 overflow-hidden rounded-lg border border-ember/30 bg-ember/10">
                            <motion.div
                              className="absolute inset-y-0 left-0 bg-ember/25"
                              initial={{ width: 0 }}
                              whileInView={{ width: '99%' }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: 0.2 + i * 0.12 }}
                            />
                            <span className="k-num relative flex h-full items-center px-2.5 text-[14px] text-text">4,950 USDT</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                      Three identical chunks, 14 seconds apart. Staying just under 5,000 may be meant to avoid an exchange's extra checks — that motive is our guess, the pattern is fact.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted">{sel.id} · all transfers by size</span>
                      <span className="k-num text-text">{sel.splits.reduce((a, b) => a + b, 0)} transfers</span>
                    </div>
                    <BarColumns
                      key={sel.id}
                      className="mt-7"
                      height={130}
                      tone={sel.tone}
                      data={SPLIT_BUCKETS.map((l, i) => ({ label: l, value: sel.splits[i], highlight: sel.splits[i] === Math.max(...sel.splits) }))}
                      format={(v) => `${v} transfers`}
                    />
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[12.5px] leading-relaxed text-muted">
                      <Split className="mt-0.5 size-3.5 shrink-0 text-dim" />
                      <span>
                        {sel.splitNote} <span className="text-dim">This case: {CURRENT_SPLITS[5]} of {CURRENT_SPLITS.reduce((a, b) => a + b, 0)} transfers at 4,950.</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ),
          },
          {
            key: 'act',
            label: 'Before you act',
            icon: ShieldAlert,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr]">
                <Card variant="glass" className="h-full pb-5">
                  <CardHeader title="Read this before acting" tech="how to use a behavioural match" icon={<ShieldAlert className="size-4 text-gold" />} />
                  <div className="space-y-3 px-5 pt-3">
                    <div className="flex items-start gap-2.5 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2.5">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold" />
                      <p className="text-[13.5px] leading-relaxed text-text/90">
                        Similarity is an <span className="text-gold">investigative lead, not evidence of identity</span>. Two operators can share habits by coincidence or by using the same scam software.
                      </p>
                    </div>
                    <div>
                      <div className="text-[13px] text-muted">Combine it with hard links from the syndicate graph:</div>
                      <ul className="mt-2 space-y-1.5">
                        {sel.sharedWallets.length > 0 ? (
                          sel.sharedWallets.map((w) => (
                            <li key={w} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white/[0.015] px-2.5 py-1.5">
                              <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                                <Link2 className="size-3.5 text-moss" /> Shared wallet
                              </span>
                              <Address addr={w} chain="TRON" className="text-[12.5px]" />
                            </li>
                          ))
                        ) : (
                          <li className="k-dashed px-3 py-2.5 text-[12.5px] text-muted">No shared wallets with {sel.id} yet — treat this match as weak until one appears.</li>
                        )}
                      </ul>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[13px]">
                      <span className="text-muted">Combined lead strength</span>
                      <Chip tone={sel.sharedWallets.length > 0 && sel.sim >= 0.85 ? 'crimson' : sel.sharedWallets.length > 0 ? 'gold' : 'neutral'} dot>
                        {sel.sharedWallets.length > 0 && sel.sim >= 0.85 ? 'Strong — habits + shared wallets' : sel.sharedWallets.length > 0 ? 'Moderate' : 'Habits only — weak'}
                      </Chip>
                    </div>
                    <Link to="/syndicates" className="flex items-center justify-between rounded-lg px-1 py-1 text-[13.5px] text-text/90 hover:text-text">
                      See the hard links in the syndicate graph <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </Card>

                <div className="space-y-3">
                  <p className="text-[13.5px] text-muted">The six kinds of habit the match is built from:</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {HABITS.map((h) => (
                      <div key={h.plain} className="flex items-center gap-2.5 rounded-2xl border border-line bg-white/[0.015] px-3 py-2.5">
                        <IconTile size={30}>{h.icon}</IconTile>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] text-text/90">{h.plain}</div>
                          <div className="truncate text-[11.5px] text-dim">{h.tech}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function BreakdownList({
  title,
  icon,
  rows,
  sel,
  tone,
  empty,
}: {
  title: string
  icon: React.ReactNode
  rows: { ax: (typeof AXES)[number]; i: number; gap: number; agree: number; contrib: number; status: string }[]
  sel: Operator
  tone: 'moss' | 'gold'
  empty: string
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[13px] text-text/90">
        {icon} {title} <span className="text-dim">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <div className="k-dashed px-3 py-3 text-[12.5px] text-muted">{empty}</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.ax.key} className="rounded-lg border border-line bg-white/[0.015] px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] text-text/90">{r.ax.short}</span>
                <span className="k-num shrink-0 text-[12px] text-dim">+{r.contrib.toFixed(3)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px]">
                <span className="text-sky">{r.ax.raw(CURRENT.values[r.i])}</span>
                <span className="text-dim">vs</span>
                <span style={{ color: toneHex(sel.tone) }}>{r.ax.raw(sel.values[r.i])}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Meter value={r.agree} tone={r.status === 'differs' ? 'gold' : tone} height={3} />
                <span className="k-num w-8 shrink-0 text-right text-[11.5px] text-muted">{Math.round(r.agree * 100)}%</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
