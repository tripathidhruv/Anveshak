import * as React from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Check,
  GitCommitHorizontal,
  Inbox,
  PenLine,
  RotateCcw,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import {
  Address,
  Button,
  Card,
  CardHeader,
  Chip,
  CurveChart,
  DemoChip,
  IconTile,
  Meter,
  PageHeader,
  Reveal,
  ScoreRing,
  toneA,
  toneHex,
  type Tone,
} from '@/components/kit'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { cn } from '@/lib/utils'
import {
  AFTER_START,
  AGREEMENT_BY_KIND,
  BEFORE,
  DRIFT,
  DRIFT_LABELS,
  FACTORS,
  QUEUE,
  VERSIONS,
  WEIGHT_SUM,
  type FactorKey,
  type ReviewItem,
  type ReviewKind,
} from './learning/data'

type Verdict = 'accept' | 'reject' | 'correct'
type Weights = Record<FactorKey, number>

const KIND_TONE: Record<ReviewKind, Tone> = {
  'Exchange attribution': 'gold',
  'Risk call': 'crimson',
  'Bridge link': 'violet',
  'Syndicate link': 'ember',
}

const BASE_REVIEWED = 46
const BASE_AGREED = 40

/** Nudge weights after a verdict, then renormalise so they still sum to WEIGHT_SUM. */
function nudge(w: Weights, item: ReviewItem, v: Verdict): Weights {
  const step = v === 'accept' ? 0.006 : v === 'reject' ? -0.008 : -0.004
  const next = { ...w }
  for (const [k, s] of Object.entries(item.nudge) as [FactorKey, number][]) next[k] = Math.max(0.02, next[k] + step * s)
  const sum = Object.values(next).reduce((a, b) => a + b, 0)
  for (const k of Object.keys(next) as FactorKey[]) next[k] = (next[k] / sum) * WEIGHT_SUM
  return next
}

export default function LearningPage() {
  const [queue, setQueue] = React.useState<ReviewItem[]>(QUEUE)
  const [stamped, setStamped] = React.useState<Record<string, Verdict>>({})
  const [tally, setTally] = React.useState({ accept: 0, reject: 0, correct: 0 })
  const [weights, setWeights] = React.useState<Weights>(AFTER_START)
  const [lastChange, setLastChange] = React.useState<{ item: ReviewItem; v: Verdict; keys: FactorKey[] } | null>(null)
  const [requested, setRequested] = React.useState(false)

  const session = tally.accept + tally.reject + tally.correct
  const agreement = (BASE_AGREED + tally.accept) / (BASE_REVIEWED + session)

  const decide = (item: ReviewItem, v: Verdict) => {
    if (stamped[item.id]) return
    setStamped((s) => ({ ...s, [item.id]: v }))
    setTally((t) => ({ ...t, [v]: t[v] + 1 }))
    setWeights((w) => nudge(w, item, v))
    setLastChange({ item, v, keys: Object.keys(item.nudge) as FactorKey[] })
    window.setTimeout(() => setQueue((q) => q.filter((x) => x.id !== item.id)), 650)
  }

  const reset = () => {
    setQueue(QUEUE)
    setStamped({})
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span>The system learns from casework</span>
              <DemoChip />
            </>
          }
          title="Officer Feedback Loop"
          tech="Every attribution and risk call KAIZEN makes goes to an officer for a verdict. Accepted, rejected and corrected calls nudge the scoring weights — slowly, visibly, and only after two officers agree."
          actions={
            <Link to="/audit">
              <Button>
                <ScrollText /> See change log
              </Button>
            </Link>
          }
        />
      </Reveal>

      {/* ── stat tiles ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { k: 'Waiting for your verdict', v: queue.filter((q) => !stamped[q.id]).length, suf: '', sub: 'attribution and risk calls', tone: 'ember' as Tone, icon: <Inbox /> },
          { k: 'Verdicts this week', v: BASE_REVIEWED + session, suf: '', sub: session ? `${session} from you this session` : '5 officers · 3 districts', tone: 'sky' as Tone, icon: <UserCheck /> },
          { k: 'Officers agree with KAIZEN', v: Math.round(agreement * 100), suf: '%', sub: 'accepted without changes', tone: 'moss' as Tone, icon: <ShieldCheck /> },
          { k: 'Weight updates shipped', v: 3, suf: '', sub: 'v12 → v14 · all double-signed', tone: 'neutral' as Tone, icon: <GitCommitHorizontal /> },
        ].map((s, i) => (
          <Reveal key={s.k} delay={0.05 + i * 0.05}>
            <Card variant="speckle" grain className="h-[118px] p-4">
              <div className="relative flex items-center gap-2">
                <IconTile tone={s.tone === 'neutral' ? undefined : s.tone} size={28} className="[&_svg]:size-3.5">
                  {s.icon}
                </IconTile>
                <span className="text-[13.5px] text-muted">{s.k}</span>
              </div>
              <div className="relative mt-4">
                <span className="k-num flex items-baseline text-[26px] leading-none text-text">
                  <SlidingNumber number={s.v} initiallyStable />
                  {s.suf}
                </span>
                <div className="mt-1 text-[12px] text-dim">{s.sub}</div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* ── queue + weights ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-3">
            <CardHeader
              title="Calls waiting for an officer's verdict"
              tech="review queue · accept, reject or correct each machine call"
              right={
                <div className="flex items-center gap-1.5 text-[12.5px]">
                  <Chip tone="moss">{tally.accept} accepted</Chip>
                  <Chip tone="crimson">{tally.reject} rejected</Chip>
                  <Chip tone="gold">{tally.correct} corrected</Chip>
                </div>
              }
              className="flex-wrap"
            />
            <div className="k-scroll mt-3 max-h-[640px] space-y-2 overflow-y-auto px-3">
              <AnimatePresence initial={false} mode="popLayout">
                {queue.map((item) => (
                  <ReviewCard key={item.id} item={item} stamp={stamped[item.id]} onDecide={(v) => decide(item, v)} />
                ))}
                {queue.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="k-dashed flex flex-col items-center gap-2 px-6 py-10 text-center"
                  >
                    <IconTile tone="moss">
                      <Check />
                    </IconTile>
                    <div className="text-[14.5px] text-text">Queue clear — {session} verdicts recorded</div>
                    <p className="max-w-sm text-[13px] text-muted">Your verdicts have been folded into candidate v15. It still needs a second officer before anything changes in production.</p>
                    <Button size="sm" onClick={reset} className="mt-1">
                      <RotateCcw /> Reload demo queue
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15}>
          <Card variant="glass" className="h-full pb-4">
            <CardHeader
              title="What your feedback changed"
              tech="factor weights · v14 live vs v15 candidate"
              right={<Chip tone="ember" dot pulse={!!lastChange}>Candidate v15</Chip>}
            />
            <div className="mt-3 space-y-3.5 px-5">
              {FACTORS.map((f) => {
                const before = BEFORE[f.key]
                const after = weights[f.key]
                const d = (after - before) * 100
                const hot = lastChange?.keys.includes(f.key)
                return (
                  <motion.div key={f.key} animate={{ opacity: lastChange && !hot ? 0.6 : 1 }} transition={{ duration: 0.4 }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] text-text">{f.plain}</div>
                        <div className="text-[11.5px] text-dim">{f.tech}</div>
                      </div>
                      <div className="flex shrink-0 items-baseline gap-2">
                        <span className="k-mono text-[12px] text-dim">{(before * 100).toFixed(1)}</span>
                        <span className="text-dim">→</span>
                        <motion.span key={after.toFixed(3)} initial={{ color: toneHex('ember') }} animate={{ color: '#f4f4f5' }} transition={{ duration: 1.2 }} className="k-num text-[14.5px]">
                          {(after * 100).toFixed(1)}
                        </motion.span>
                        <span className={cn('inline-flex w-[54px] items-center justify-end text-[12px] font-medium', Math.abs(d) < 0.05 ? 'text-dim' : d > 0 ? 'text-moss' : 'text-crimson')}>
                          {Math.abs(d) < 0.05 ? '±0' : d > 0 ? <ArrowUpRight className="size-3" strokeWidth={2.5} /> : <ArrowDownRight className="size-3" strokeWidth={2.5} />}
                          {Math.abs(d) >= 0.05 && `${Math.abs(d).toFixed(1)}`}
                        </span>
                      </div>
                    </div>
                    <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-white/[0.14]" style={{ width: `${(before / 0.35) * 100}%` }} />
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        initial={false}
                        animate={{ width: `${(after / 0.35) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                        style={{
                          background: `linear-gradient(90deg, ${toneA(f.tone, 0.35)}, ${toneHex(f.tone)})`,
                          boxShadow: `0 0 10px ${toneA(f.tone, hot ? 0.8 : 0.35)}`,
                          mixBlendMode: 'screen',
                        }}
                      />
                      <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: `${(before / 0.35) * 100}%` }} />
                    </div>
                  </motion.div>
                )
              })}
            </div>
            <div className="mx-5 mt-4 flex items-center gap-3 text-[12px] text-dim">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-white/[0.14]" />v14 live</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-ember" />v15 candidate</span>
              <span>points out of 100 · weights sum to {Math.round(WEIGHT_SUM * 100)}</span>
            </div>
            <div className="mx-5 mt-3 min-h-[54px] rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
              <AnimatePresence mode="wait" initial={false}>
                {lastChange ? (
                  <motion.div key={lastChange.item.id + lastChange.v} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-start gap-2 text-[13px]">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ember" />
                    <span className="text-muted">
                      Your <span className="text-text">{lastChange.v === 'accept' ? 'acceptance' : lastChange.v === 'reject' ? 'rejection' : 'correction'}</span> on {lastChange.item.caseId} nudged{' '}
                      <span className="text-text">{lastChange.keys.map((k) => FACTORS.find((f) => f.key === k)!.tech).join(' and ')}</span>. Change is held in v15 until a second officer agrees.
                    </span>
                  </motion.div>
                ) : (
                  <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[13px] text-dim">
                    Give a verdict on the left — the weights it touches will move here, by at most 0.8 points per verdict.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── drift + agreement ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-4">
            <CardHeader title="How the weights have drifted" tech="factor weight · points out of 100 · last 8 weeks" right={<Chip tone="neutral">178 verdicts</Chip>} />
            <div className="px-5 pt-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                {FACTORS.map((f) => (
                  <span key={f.key} className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded" style={{ background: toneHex(f.tone) }} />
                    {f.tech}
                  </span>
                ))}
              </div>
              <CurveChart
                className="mt-3"
                height={210}
                labels={DRIFT_LABELS}
                series={FACTORS.map((f) => ({ name: f.tech, tone: f.tone, data: DRIFT[f.key], dashed: f.key === 'age' }))}
                highlight={{ series: 0, index: 7, title: 'Week 8 · v14 live' }}
                format={(v) => `${v} pts`}
              />
              <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
                Sweep speed has gained 5 points as officers confirmed automated drains; wallet age lost 5 after it kept flagging legitimate new users.
              </p>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card className="h-full pb-4">
            <CardHeader title="Do officers agree with the engine?" tech="agreement rate · by type of call" />
            <div className="flex flex-col items-center gap-5 px-5 pt-4 sm:flex-row sm:items-start">
              <ScoreRing value={agreement} tone="moss" size={118} label={`${Math.round(agreement * 100)}%`} sub="agree" />
              <ul className="w-full flex-1 space-y-3">
                {AGREEMENT_BY_KIND.map((a) => (
                  <li key={a.kind}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-text/90">{a.kind}</span>
                      <span>
                        <span className="k-num text-text">{Math.round(a.rate * 100)}%</span>
                        <span className="ml-1 text-[11.5px] text-dim">of {a.n}</span>
                      </span>
                    </div>
                    <Meter value={a.rate} tone={KIND_TONE[a.kind]} height={5} className="mt-1" />
                  </li>
                ))}
              </ul>
            </div>
            <p className="mx-5 mt-4 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-[12.5px] leading-relaxed text-muted">
              Lowest agreement is on <span className="text-violet">bridge links</span> — these are timing and amount matches, not proof, so officers overrule them more often. That is working as intended.
            </p>
          </Card>
        </Reveal>
      </div>

      {/* ── versions + guardrails ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-4">
            <CardHeader title="Model versions" tech="what changed, why, and who signed it off" />
            <ol className="mt-4 grid grid-cols-1 gap-3 px-5 md:grid-cols-4">
              {VERSIONS.map((v, i) => {
                const tone: Tone = v.state === 'live' ? 'moss' : v.state === 'candidate' ? 'ember' : 'neutral'
                return (
                  <motion.li
                    key={v.v}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="relative z-10 size-3 shrink-0 rounded-full border-2"
                        style={{ borderColor: toneHex(tone), background: v.state === 'retired' ? '#141415' : toneHex(tone), boxShadow: v.state !== 'retired' ? `0 0 10px ${toneA(tone, 0.7)}` : undefined }}
                      />
                      {i < VERSIONS.length - 1 && <span className="hidden h-px flex-1 bg-line-2 md:block" />}
                    </div>
                    <div
                      className={cn('mt-2.5 rounded-xl border p-3', v.state === 'candidate' ? 'border-dashed' : '')}
                      style={{ borderColor: v.state === 'retired' ? 'rgba(255,255,255,0.07)' : toneA(tone, 0.35), background: v.state === 'retired' ? 'rgba(255,255,255,0.015)' : toneA(tone, 0.06) }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="k-num text-[16.5px] text-text">{v.v}</span>
                        <Chip tone={tone} dot={v.state !== 'retired'} pulse={v.state === 'candidate'}>
                          {v.state === 'live' ? 'Live' : v.state === 'candidate' ? 'Candidate' : 'Retired'}
                        </Chip>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-dim">{v.date}</div>
                      <ul className="mt-2 space-y-1">
                        {v.lines.map((l) => (
                          <li key={l} className="text-[12.5px] leading-snug text-muted">
                            {l}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 border-t border-line pt-1.5 text-[11.5px] text-dim">{v.signed}</div>
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card variant="glass" className="h-full pb-4">
            <CardHeader title="Guardrails on learning" tech="why feedback cannot quietly change the model" right={<Chip tone="moss" dot>Enforced</Chip>} />
            <ul className="mt-3 space-y-2.5 px-5">
              {[
                { icon: <Users />, t: 'Weights only change after 2 officers agree', s: 'one officer cannot move a score on their own' },
                { icon: <Ban />, t: 'No automatic deployment', s: 'a supervisor promotes each version by hand' },
                { icon: <ScrollText />, t: 'Every change is logged in the Audit Ledger', s: 'before/after weights, verdicts and signatures' },
              ].map((g) => (
                <li key={g.t} className="flex items-start gap-3">
                  <IconTile tone="moss" size={30} className="[&_svg]:size-3.5">
                    {g.icon}
                  </IconTile>
                  <div>
                    <div className="text-[14px] text-text">{g.t}</div>
                    <div className="text-[12px] text-dim">{g.s}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mx-5 mt-4 rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="text-[12.5px] text-muted">Sign-offs for candidate v15</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SignSlot name="SI Kavita Rathore" role="you" done={session > 0} />
                <SignSlot name="Insp. Arjun Bhatia" role={requested ? 'request sent' : 'second officer'} done={false} waiting={requested} />
              </div>
              <Button variant="ember" size="sm" className="mt-3 w-full" disabled={session === 0 || requested} onClick={() => setRequested(true)}>
                <Send /> {requested ? 'Second sign-off requested' : session === 0 ? 'Give a verdict to sign v15' : 'Request second sign-off'}
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}

/* ───────── review card ───────── */

const STAMP: Record<Verdict, { label: string; tone: Tone }> = {
  accept: { label: 'Accepted', tone: 'moss' },
  reject: { label: 'Rejected', tone: 'crimson' },
  correct: { label: 'Corrected', tone: 'gold' },
}

const ReviewCard = React.forwardRef<HTMLDivElement, { item: ReviewItem; stamp?: Verdict; onDecide: (v: Verdict) => void }>(function ReviewCard(
  { item, stamp, onDecide },
  ref,
) {
  const [correcting, setCorrecting] = React.useState(false)
  const [alt, setAlt] = React.useState(item.alts[0])
  const tone = KIND_TONE[item.kind]
  const confTone: Tone = item.confidence >= 0.85 ? 'moss' : item.confidence >= 0.7 ? 'gold' : 'crimson'
  const selectId = `alt-${item.id}`

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: stamp === 'reject' ? -60 : 60, scale: 0.96, transition: { duration: 0.3 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="relative overflow-hidden rounded-xl border border-line bg-white/[0.015] p-3.5"
      style={stamp ? { borderColor: toneA(STAMP[stamp].tone, 0.5) } : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={tone} dot>
          {item.kind}
        </Chip>
        <span className="k-mono text-[12.5px] text-muted">{item.caseId}</span>
        <span className="text-[12px] text-dim">· {item.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11.5px] text-dim">confidence</span>
          <div className="w-14">
            <Meter value={item.confidence} tone={confTone} height={4} />
          </div>
          <span className="k-num text-[14.5px] text-text">{item.confidence.toFixed(2)}</span>
        </div>
      </div>
      <div className="mt-2 text-[14.5px] leading-snug text-text">{item.claim}</div>
      {item.addr && (
        <div className="mt-1">
          <Address addr={item.addr} chain={item.chain} className="-ml-1 text-[12.5px]" />
        </div>
      )}
      <ul className="mt-1.5 space-y-0.5">
        {item.evidence.map((e) => (
          <li key={e} className="flex items-start gap-1.5 text-[12.5px] text-muted">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" />
            {e}
          </li>
        ))}
      </ul>

      <AnimatePresence initial={false}>
        {correcting && !stamp && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gold/25 bg-gold/[0.05] p-2">
              <label htmlFor={selectId} className="text-[12.5px] text-muted">
                Correct answer
              </label>
              <select
                id={selectId}
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                className="h-7 min-w-0 flex-1 rounded-lg border border-line-2 bg-[#18181a] px-2 text-[13px] text-text outline-none focus-visible:border-gold/60"
              >
                {item.alts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => onDecide('correct')} className="text-gold">
                <Check /> Save correction
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onDecide('accept')} disabled={!!stamp} className="border-moss/30 text-moss">
          <Check /> Accept
        </Button>
        <Button size="sm" onClick={() => onDecide('reject')} disabled={!!stamp} className="border-crimson/30 text-crimson">
          <X /> Reject
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setCorrecting((c) => !c)} disabled={!!stamp} aria-expanded={correcting}>
          <PenLine /> Correct
        </Button>
      </div>

      <AnimatePresence>
        {stamp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 grid place-items-center"
            style={{ background: `linear-gradient(90deg, ${toneA(STAMP[stamp].tone, 0.04)}, ${toneA(STAMP[stamp].tone, 0.16)})` }}
          >
            <motion.span
              initial={{ scale: 1.6, rotate: -10, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="k-num rounded-lg border-2 px-3 py-1 text-[16.5px] uppercase tracking-[0.12em]"
              style={{ color: toneHex(STAMP[stamp].tone), borderColor: toneHex(STAMP[stamp].tone), background: 'rgba(11,11,12,0.7)' }}
            >
              {STAMP[stamp].label}
              {stamp === 'correct' && <span className="ml-2 text-[11.5px] normal-case tracking-normal text-muted">→ {alt}</span>}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

function SignSlot({ name, role, done, waiting }: { name: string; role: string; done: boolean; waiting?: boolean }) {
  return (
    <div
      className={cn('rounded-lg border px-2.5 py-2 transition-colors duration-500', done ? 'border-moss/40 bg-moss/[0.07]' : 'border-dashed border-line-2')}
    >
      <div className="flex items-center gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {done ? (
            <motion.span key="d" initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-4 place-items-center rounded-full bg-moss text-[#0b0b0c]">
              <Check className="size-2.5" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span key="w" initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn('size-4 rounded-full border border-line-2', waiting && 'k-shimmer')} />
          )}
        </AnimatePresence>
        <span className="truncate text-[13px] text-text">{name}</span>
      </div>
      <div className="mt-0.5 pl-[22px] text-[11.5px] text-dim">{done ? 'signed' : role}</div>
    </div>
  )
}
