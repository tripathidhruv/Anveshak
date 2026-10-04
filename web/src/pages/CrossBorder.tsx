import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Globe2,
  Hourglass,
  Landmark,
  Loader2,
  Lock,
  Network,
  Radio,
  Scale,
  Send,
  ShieldAlert,
  Siren,
  TriangleAlert,
} from 'lucide-react'
import {
  BarColumns,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  IconTile,
  KV,
  PageHeader,
  Reveal,
  SubTabs,
  toneA,
  toneHex,
  useCountdown,
  type Tone,
} from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { Progress } from '@/components/animate-ui/components/radix/progress'
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { CASE, CASES, EXCHANGES, type Exchange } from '@/data/demo'
import { mmss } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CHANNELS, FOREIGN_CHANNELS, JURIS, TREATY_LABEL, checklistFor, etaText, type ChannelKey, type Juris } from './crossborder/data'
import { RequestPaper } from './crossborder/RequestPaper'

const CH_ICON: Record<ChannelKey, React.ReactNode> = {
  domestic: <Landmark />,
  direct: <Building2 />,
  interpol: <Siren />,
  fiu: <Network />,
  mlat: <Scale />,
}

const GOLDEN_SEC = (CASES.find((c) => c.id === CASE.id)?.goldenMin ?? 38) * 60
const AUTO_IDS = ['summary', 'hashes', 'cert']

type SendState = 'idle' | 'sending' | 'queued'

export default function CrossBorderPage() {
  const [exId, setExId] = React.useState('meridian')
  const [urgent, setUrgent] = React.useState(true)
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set(EXCHANGES.flatMap((e) => AUTO_IDS.map((id) => `${e.id}:${id}`))))
  const [sent, setSent] = React.useState<Record<string, SendState>>({})
  const left = useCountdown(GOLDEN_SEC)

  const ex = EXCHANGES.find((e) => e.id === exId)!
  const j = JURIS[exId]
  const registered = ex.fiuRegistered
  const sendState = sent[exId] ?? 'idle'

  const items = checklistFor(j, urgent)
  const isChecked = (id: string) => checked.has(`${exId}:${id}`) || (id === 'preserve' && sendState === 'queued')
  const done = items.filter((i) => isChecked(i.id)).length
  const toggle = (id: string) =>
    setChecked((s) => {
      const k = `${exId}:${id}`
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const sendPreservation = () => {
    if (sendState !== 'idle') return
    const id = exId
    setSent((s) => ({ ...s, [id]: 'sending' }))
    setTimeout(() => setSent((s) => ({ ...s, [id]: 'queued' })), 2200)
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <DemoChip /> <span>Evidence · cross-border</span>
            </>
          }
          title="Cross-border routing"
          tech="Finding a foreign exchange is not the finish line — an exchange in Seychelles or the UAE has no duty to honour an Indian notice. ANVESHAK works out the right legal channel for that exchange's country, the realistic response time, and drafts the request. · MLAT / jurisdiction routing"
          actions={
            <span className="k-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-muted">
              <TriangleAlert className="size-3.5 text-gold" /> Country data illustrative — verify with the central authority
            </span>
          }
        />
      </Reveal>

      {/* ── Jurisdiction selector (drives every tab below) ── */}
      <Reveal delay={0.05}>
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[14px] text-text">
              Where did the money land? <span className="text-[12.5px] text-dim">· pick an exchange — this case resolved to Meridian; the others are what-ifs</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" role="radiogroup" aria-label="Exchange the money landed at">
            {EXCHANGES.map((e) => {
              const on = e.id === exId
              return (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setExId(e.id)}
                  className={cn('relative rounded-2xl border p-3 text-left transition-colors', on ? 'border-line-2' : 'border-line hover:border-line-2 hover:bg-white/[0.02]')}
                >
                  {on && (
                    <motion.span
                      layoutId="cb-ex-sel"
                      className="absolute inset-0 rounded-2xl"
                      style={{ background: `radial-gradient(120% 90% at 0% 0%, ${toneA(e.tone, 0.16)}, rgba(255,255,255,0.02) 70%)`, boxShadow: `inset 0 0 0 1px ${toneA(e.tone, 0.45)}` }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <div className="relative flex items-center gap-2">
                    <span className="k-num grid size-8 shrink-0 place-items-center rounded-lg border border-line-2 text-[12.5px]" style={{ color: toneHex(e.tone), background: toneA(e.tone, 0.08) }}>
                      {e.monogram}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] text-text">{e.name}</div>
                      <div className="text-[12px] text-dim">{e.jurisdiction}</div>
                    </div>
                  </div>
                  <div className="relative mt-2 flex flex-wrap items-center gap-1">
                    <Chip tone={e.fiuRegistered ? 'moss' : 'neutral'} className="text-[11.5px]">
                      {e.fiuRegistered ? 'FIU-IND registered' : 'Not registered'}
                    </Chip>
                    {e.id === 'meridian' && (
                      <Chip tone="gold" dot className="text-[11.5px]">
                        This case
                      </Chip>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </Reveal>

      <SubTabs
        tabs={[
          {
            key: 'route',
            label: 'Recommended route',
            icon: Globe2,
            render: (go) => (
              <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1fr]">
                <Reveal delay={0.1}>
                  <RouteCard ex={ex} j={j} urgent={urgent} />
                </Reveal>
                <Reveal delay={0.15}>
                  <DecisionPath ex={ex} j={j} urgent={urgent} setUrgent={setUrgent} left={left} />
                </Reveal>
              </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
                  <span className="text-[13.5px] text-muted">Next: preserve the funds, then draft the request for this route.</span>
                  <Button size="sm" onClick={() => go('act')}>
                    <Send /> Preserve & draft <ArrowRight />
                  </Button>
                </div>
              </div>
            ),
          },
          {
            key: 'channels',
            label: 'Channels & timing',
            icon: Network,
            render: () => (
              <div className="space-y-3">
              <Reveal delay={0.1}>
                <div>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[14.5px] font-medium text-text/90">
                      The four cross-border channels <span className="text-[12.5px] font-normal text-dim">· what each can get you, how fast, and who signs</span>
                    </div>
                    {registered && (
                      <Chip tone="moss" dot>
                        {ex.name} is registered in India — these are fallbacks only
                      </Chip>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {FOREIGN_CHANNELS.map((k) => (
                      <ChannelCard key={k} k={k} j={j} urgent={urgent} />
                    ))}
                  </div>
                </div>
              </Reveal>
                <Reveal delay={0.15}>
                  <EtaCard ex={ex} j={j} />
                </Reveal>
              </div>
            ),
          },
          {
            key: 'act',
            label: 'Preserve & draft request',
            icon: Send,
            badge: `${done}/${items.length}`,
            render: () => (
              <div className="space-y-3">
                <p className="text-[13.5px] text-muted">The lawful requests for this exchange: preserve the funds first, gather the documents, then review the drafted request.</p>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.35fr]">
                  <div className="flex min-w-0 flex-col gap-3">
                    <Reveal delay={0.05}>
                      <PreserveCard ex={ex} j={j} urgent={urgent} left={left} state={sendState} onSend={sendPreservation} />
                    </Reveal>
                    <Reveal delay={0.1}>
                      <Card className="pb-4">
                        <CardHeader
                          title="Document checklist"
                          tech={`what this route needs · ${ex.name}`}
                          icon={<FileText className="size-4" />}
                          right={
                            <Chip tone={done === items.length ? 'moss' : 'neutral'} dot>
                              {done}/{items.length} ready
                            </Chip>
                          }
                        />
                        <div className="mt-3 px-5">
                          <div className="flex items-baseline justify-between">
                            <span className="k-num text-[26px] leading-none text-text">{Math.round((done / items.length) * 100)}%</span>
                            <span className="text-[12.5px] text-dim">{items.length - done === 0 ? 'ready to send for sign-off' : `${items.length - done} item${items.length - done > 1 ? 's' : ''} to go`}</span>
                          </div>
                          <Progress value={(done / items.length) * 100} className="mt-2 h-1.5 bg-white/[0.06]" />
                        </div>
                        <ul className="mt-3 space-y-1 px-3">
                          <AnimatePresence initial={false}>
                            {items.map((it) => {
                              const on = isChecked(it.id)
                              return (
                                <motion.li
                                  key={`${exId}-${it.id}`}
                                  layout
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 8 }}
                                  transition={{ duration: 0.22 }}
                                >
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={on}
                                    onClick={() => toggle(it.id)}
                                    className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.03]"
                                  >
                                    <span
                                      className={cn('mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors', on ? 'border-moss bg-moss text-[#0b0b0c]' : 'border-line-2 bg-white/[0.02]')}
                                    >
                                      <AnimatePresence>
                                        {on && (
                                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 26 }}>
                                            <Check className="size-3" strokeWidth={3} />
                                          </motion.span>
                                        )}
                                      </AnimatePresence>
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className={cn('block text-[14px]', on ? 'text-muted line-through decoration-white/20' : 'text-text')}>{it.label}</span>
                                      <span className="block text-[12px] text-dim">{it.tech}</span>
                                    </span>
                                    {it.auto && <Chip tone="teal" className="mt-0.5 text-[11.5px]">from evidence pack</Chip>}
                                    {it.id === 'preserve' && sendState === 'queued' && <Chip tone="moss" className="mt-0.5 text-[11.5px]">queued</Chip>}
                                  </button>
                                </motion.li>
                              )
                            })}
                          </AnimatePresence>
                        </ul>
                      </Card>
                    </Reveal>
                  </div>
                  <Reveal delay={0.15}>
                    <DraftCard ex={ex} j={j} urgent={urgent} />
                  </Reveal>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

/* ───────── Recommended route (hero) ───────── */
function RouteCard({ ex, j, urgent }: { ex: Exchange; j: Juris; urgent: boolean }) {
  const p = CHANNELS[j.route.primary]
  const f = CHANNELS[j.route.fallback]
  const pre = CHANNELS[j.route.preserve]
  const showPre = urgent && j.route.preserve !== j.route.primary
  const steps: { tag: string; tone: Tone; ch: typeof p; eta?: number; note: string }[] = [
    ...(showPre ? [{ tag: 'Preserve now', tone: 'ember' as Tone, ch: pre, eta: j.eta[pre.key], note: 'stops withdrawal while the rest is processed' }] : []),
    { tag: 'Primary channel', tone: 'moss' as Tone, ch: p, eta: j.eta[p.key], note: p.binding },
    { tag: 'Fallback · binding', tone: 'white' as Tone, ch: f, eta: j.eta[f.key], note: j.etaNote?.[f.key] ?? f.binding },
  ]
  return (
    <Card variant="glass" className="h-full pb-5">
      <CardHeader
        title="Recommended route"
        tech="jurisdiction autopilot · channel chosen from registration, contact, treaty basis and urgency"
        icon={<Globe2 className="size-4" />}
        right={<Chip tone={ex.fiuRegistered ? 'moss' : 'gold'} dot>{ex.fiuRegistered ? 'FIU-IND registered' : 'Not FIU-IND registered'}</Chip>}
      />
      <AnimatePresence mode="wait">
        <motion.div key={ex.id + String(urgent)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="px-5">
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[13.5px] text-muted">The money landed at</div>
              <div className="k-num mt-0.5 text-[24px] leading-tight text-text md:text-[28px]">{ex.name}</div>
              <div className="mt-1 text-[13.5px] text-muted">
                {j.country} · {ex.indianUsers} Indian users · replies in ~{ex.avgResponseHrs} h on average
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12.5px] text-dim">First useful response</div>
              <div className="k-num text-[26px] leading-none" style={{ color: toneHex('moss') }}>
                {etaText(j.eta[p.key] ?? 0)}
              </div>
              <div className="text-[12px] text-dim">via {p.short}</div>
            </div>
          </div>

          <div className="relative mt-4 space-y-2">
            {steps.map((s, i) => (
              <motion.div
                key={s.tag}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.08 }}
                className="flex items-center gap-3 rounded-xl border bg-white/[0.02] px-3 py-2.5"
                style={{ borderColor: s.tone === 'white' ? 'var(--k-line)' : toneA(s.tone, 0.35) }}
              >
                <span className="k-num grid size-6 shrink-0 place-items-center rounded-full text-[12.5px]" style={{ background: toneA(s.tone, 0.15), color: toneHex(s.tone) }}>
                  {i + 1}
                </span>
                <IconTile tone={s.tone === 'white' ? undefined : s.tone} size={32}>
                  {CH_ICON[s.ch.key]}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] uppercase tracking-[0.08em]" style={{ color: s.tone === 'white' ? 'var(--k-muted)' : toneHex(s.tone) }}>
                    {s.tag}
                  </div>
                  <div className="truncate text-[14px] text-text">{s.ch.name}</div>
                  <div className="truncate text-[12px] text-dim">{s.note}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="k-num text-[15.5px] text-text">{s.eta !== undefined ? etaText(s.eta) : '—'}</div>
                  <div className="text-[11.5px] text-dim">expected</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-[12.5px] text-dim">What to ask for</div>
              <ul className="space-y-1">
                {p.obtains.map((o) => (
                  <li key={o} className="flex items-start gap-1.5 text-[13.5px] text-text/90">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-moss" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 sm:mt-0">
              <KV k="Who signs" v={p.signatory} className="items-start" />
              <KV k="Binding?" v={<span style={{ color: toneHex(p.bindingTone) }}>{p.binding}</span>} className="items-start" />
              <KV k="Court-ready records" v={`via ${f.short}`} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}

/* ───────── Decision path ───────── */
function DecisionPath({ ex, j, urgent, setUrgent, left }: { ex: Exchange; j: Juris; urgent: boolean; setUrgent: (v: boolean) => void; left: number }) {
  const reg = ex.fiuRegistered
  const steps: { q: string; tech: string; a: string; tone: Tone; then: string; skipped?: boolean }[] = [
    {
      q: 'Is the exchange registered with FIU-IND?',
      tech: "India's financial intelligence unit · registered exchanges must answer Indian notices",
      a: reg ? 'Yes' : 'No',
      tone: reg ? 'moss' : 'ember',
      then: reg ? 'A domestic notice is enforceable — no treaty needed.' : "An Indian notice can't compel it — we need a cross-border channel.",
    },
    {
      q: 'Does it have an India compliance contact?',
      tech: 'law-enforcement desk that replies to Indian police',
      a: reg ? 'Nodal officer' : j.contact === 'voluntary' ? 'Yes, voluntary' : 'No',
      tone: reg ? 'moss' : j.contact === 'voluntary' ? 'gold' : 'ember',
      then: reg ? 'Notice goes to the nodal officer on its registration.' : j.contact === 'voluntary' ? 'Ask it directly first — fastest, but it can say no.' : "Don't wait on the exchange — use intelligence and police channels.",
      skipped: reg,
    },
    {
      q: 'Is there a treaty route with that country?',
      tech: 'mutual legal assistance basis · illustrative, verify with the central authority',
      a: TREATY_LABEL[j.treaty],
      tone: j.treaty === 'domestic' ? 'neutral' : 'sky',
      then: j.route.fallback === 'mlat' ? 'For court-admissible records and a binding freeze, file an MLAT request via MHA.' : 'Not needed — escalate through FIU-IND if the exchange stalls.',
      skipped: j.route.fallback !== 'mlat',
    },
    {
      q: 'Is it urgent — is the money still moving?',
      tech: 'golden hour · funds can still be withdrawn',
      a: urgent ? `Yes · ${mmss(left)} left` : 'No · funds at rest',
      tone: urgent ? 'ember' : 'neutral',
      then: urgent
        ? j.route.preserve === j.route.primary
          ? 'Put the freeze request in the first notice itself.'
          : `Preserve first via ${CHANNELS[j.route.preserve].short} so nothing is withdrawn while slower requests run.`
        : 'Skip preservation and file the primary request.',
    },
  ]
  const result = urgent && j.route.preserve !== j.route.primary ? `${CHANNELS[j.route.preserve].short} → ${CHANNELS[j.route.primary].short} → ${CHANNELS[j.route.fallback].short}` : `${CHANNELS[j.route.primary].short} → ${CHANNELS[j.route.fallback].short}`

  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="Why this route"
        tech="four questions ANVESHAK answers for every foreign exchange"
        icon={<Radio className="size-4" />}
        right={
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
            Money still moving
            <Switch checked={urgent} onCheckedChange={setUrgent} aria-label="Money still moving" className="data-[state=checked]:bg-ember data-[state=unchecked]:bg-white/10" />
          </label>
        }
      />
      <AnimatePresence mode="wait">
        <motion.ol key={ex.id} className="relative mt-4 px-5" initial="hide" animate="show" exit="hide" variants={{ show: { transition: { staggerChildren: 0.09 } }, hide: {} }}>
          {steps.map((s, i) => (
            <motion.li
              key={i}
              variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.28 }}
              className={cn('relative flex gap-3 pb-4', s.skipped && 'opacity-45')}
            >
              {/* connector */}
              <span className="absolute left-[13px] top-7 bottom-0 w-px bg-line" aria-hidden />
              <motion.span
                aria-hidden
                className="absolute left-[13px] top-7 w-px origin-top"
                style={{ background: s.skipped ? 'transparent' : toneHex(s.tone), boxShadow: s.skipped ? undefined : `0 0 6px ${toneA(s.tone, 0.6)}`, bottom: 0 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.2 + i * 0.12, duration: 0.35 }}
              />
              <span
                className="k-num relative z-10 grid size-[27px] shrink-0 place-items-center rounded-full border text-[12.5px]"
                style={{ borderColor: s.skipped ? 'var(--k-line-2)' : toneA(s.tone, 0.5), background: s.skipped ? 'transparent' : toneA(s.tone, 0.12), color: s.skipped ? 'var(--k-dim)' : toneHex(s.tone) }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[14px] text-text">{s.q}</span>
                  {s.skipped ? <Chip tone="neutral">not needed</Chip> : <Chip tone={s.tone} dot>{s.a}</Chip>}
                </div>
                <div className="text-[12px] text-dim">{s.tech}</div>
                {!s.skipped && <div className="mt-1 text-[13px] text-muted">→ {s.then}</div>}
              </div>
            </motion.li>
          ))}
          <motion.li variants={{ hide: { opacity: 0, scale: 0.97 }, show: { opacity: 1, scale: 1 } }} className="relative flex gap-3">
            <span className="relative z-10 grid size-[27px] shrink-0 place-items-center rounded-full bg-moss text-[#0b0b0c]">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-moss/30 bg-moss/[0.07] px-3 py-2">
              <div className="text-[11.5px] uppercase tracking-[0.08em] text-moss">Result</div>
              <div className="k-num text-[16.5px] text-text">{result}</div>
            </div>
          </motion.li>
        </motion.ol>
      </AnimatePresence>
    </Card>
  )
}

/* ───────── Channel card ───────── */
function ChannelCard({ k, j, urgent }: { k: ChannelKey; j: Juris; urgent: boolean }) {
  const c = CHANNELS[k]
  const role: { label: string; tone: Tone } | null =
    j.route.primary === k
      ? { label: 'Recommended', tone: 'moss' }
      : urgent && j.route.preserve === k
        ? { label: 'Preserve first', tone: 'ember' }
        : j.route.fallback === k
          ? { label: 'Binding fallback', tone: 'white' }
          : null
  const eta = j.eta[k]
  const rec = role?.tone === 'moss'
  return (
    <motion.div layout transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="h-full">
      <Card
        className={cn('h-full p-4 transition-shadow', !role && 'opacity-75')}
        style={rec ? { borderColor: toneA('moss', 0.45), boxShadow: `0 0 0 1px ${toneA('moss', 0.2)}, 0 18px 40px -20px ${toneA('moss', 0.45)}` } : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <IconTile tone={role && role.tone !== 'white' ? role.tone : undefined}>{CH_ICON[k]}</IconTile>
          <AnimatePresence mode="wait">
            <motion.span key={role?.label ?? 'none'} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              {role ? (
                <Chip tone={role.tone} dot solid={rec}>
                  {role.label}
                </Chip>
              ) : (
                <Chip tone="neutral">{eta === undefined ? 'Not needed' : 'Available'}</Chip>
              )}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="mt-3 text-[14.5px] font-medium text-text">{c.name}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-dim">{c.tech}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-white/[0.02] px-2 py-1.5">
            <div className="text-[11.5px] text-dim">Typical</div>
            <div className="text-[13px] text-text">{c.turnaround}</div>
          </div>
          <div className="rounded-lg border border-line bg-white/[0.02] px-2 py-1.5">
            <div className="text-[11.5px] text-dim">Here</div>
            <div className="k-num text-[14px] text-text">{eta !== undefined ? etaText(eta) : '—'}</div>
          </div>
        </div>
        <div className="mt-2.5 flex items-start gap-1.5 text-[12.5px]" style={{ color: toneHex(c.bindingTone) }}>
          {c.bindingTone === 'moss' ? <Lock className="mt-0.5 size-3 shrink-0" /> : <ShieldAlert className="mt-0.5 size-3 shrink-0" />}
          {c.binding}
        </div>
        <ul className="mt-2.5 space-y-1">
          {c.obtains.map((o) => (
            <li key={o} className="flex items-start gap-1.5 text-[13px] text-muted">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" />
              {o}
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-line pt-2 text-[12px] text-dim">
          Signs: <span className="text-muted">{c.signatory}</span>
        </div>
      </Card>
    </motion.div>
  )
}

/* ───────── ETA chart ───────── */
function EtaCard({ ex, j }: { ex: Exchange; j: Juris }) {
  const keys = (Object.keys(j.eta) as ChannelKey[]).sort((a, b) => (j.eta[a] ?? 0) - (j.eta[b] ?? 0))
  const data = keys.map((k) => ({ label: CHANNELS[k].short, value: j.eta[k] ?? 0, highlight: k === j.route.primary, sub: etaText(j.eta[k] ?? 0) }))
  const slowest = Math.max(...keys.map((k) => j.eta[k] ?? 0))
  const primary = j.eta[j.route.primary] ?? 1
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="How long each channel takes here"
        tech={`expected days to a first useful response · ${ex.name}, ${j.country} · illustrative`}
        icon={<Clock3 className="size-4" />}
        right={<Chip tone="moss" dot>Recommended highlighted</Chip>}
      />
      <div className="px-5 pt-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="k-num text-[26px] text-text">{etaText(primary)}</span>
          <span className="text-[13px] text-muted">
            via {CHANNELS[j.route.primary].short} — the slowest channel here takes <span className="text-text">{etaText(slowest)}</span>
            {slowest / primary >= 2 && <> ({Math.round(slowest / primary)}× longer)</>}
          </span>
        </div>
        <BarColumns key={ex.id} className="mt-8" height={170} tone="moss" data={data} format={(v) => etaText(v)} />
        {j.etaNote && (
          <div className="mt-3 flex flex-wrap gap-x-3 text-[12px] text-dim">
            {Object.entries(j.etaNote).map(([k, v]) => (
              <span key={k}>
                {CHANNELS[k as ChannelKey].short}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

/* ───────── Preserve first ───────── */
function PreserveCard({ ex, j, urgent, left, state, onSend }: { ex: Exchange; j: Juris; urgent: boolean; left: number; state: SendState; onSend: () => void }) {
  const pre = CHANNELS[j.route.preserve]
  const [pct, setPct] = React.useState(0)
  React.useEffect(() => {
    if (state !== 'sending') {
      setPct(state === 'queued' ? 100 : 0)
      return
    }
    setPct(0)
    const t0 = Date.now()
    const t = setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / 2100) * 100)
      setPct(p)
      if (p >= 100) clearInterval(t)
    }, 60)
    return () => clearInterval(t)
  }, [state])
  const phase = pct < 34 ? 'Filling case facts from the trace' : pct < 67 ? 'Attaching wallet addresses and hashes' : 'Queuing for SHO sign-off'
  const frac = left / GOLDEN_SEC
  return (
    <Card variant="speckle" grain className="h-full pb-5">
      <CardHeader
        title="Preserve first, then ask"
        tech="preservation stops deletion or withdrawal while the slower binding request is processed"
        icon={<Hourglass className="size-4 text-ember" />}
        right={urgent ? <Chip tone="ember" dot pulse>Golden hour</Chip> : <Chip tone="neutral">Not urgent</Chip>}
      />
      <div className="relative px-5 pt-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[12.5px] text-dim">Time left before funds can be withdrawn</div>
            <div className={cn('k-mono mt-0.5 text-[34px] leading-none', urgent ? 'text-ember' : 'text-dim')}>{urgent ? mmss(left) : '—'}</div>
          </div>
          <div className="text-right text-[12.5px] text-muted">
            via <span className="text-text">{pre.short}</span>
            <div className="text-[12px] text-dim">to {j.route.preserve === 'interpol' ? `NCB ${j.country}` : ex.name}</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: urgent ? `${frac * 100}%` : '0%' }}
            transition={{ duration: 0.8 }}
            style={{ background: `linear-gradient(90deg, ${toneA('ember', 0.5)}, ${toneHex('ember')})`, boxShadow: `0 0 10px ${toneA('ember', 0.5)}` }}
          />
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          A binding request to {j.country === 'India' ? 'a court' : j.country} can take {etaText(j.eta[j.route.fallback] ?? 0)}. The money can leave in minutes. A preservation request is short, fast and asks only that nothing be deleted or withdrawn — the full request follows.
        </p>

        <div className="mt-4">
          <AnimatePresence mode="wait">
            {state === 'queued' ? (
              <motion.div key="q" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 rounded-xl border border-moss/30 bg-moss/[0.07] px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-moss" />
                <div className="text-[13.5px]">
                  <div className="text-text">Preservation draft queued for SHO sign-off</div>
                  <div className="text-[12px] text-dim">
                    {pre.short} · {CASE.id} · nothing is sent until an officer approves it
                  </div>
                </div>
              </motion.div>
            ) : state === 'sending' ? (
              <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="mb-1.5 flex items-center gap-2 text-[13px] text-muted">
                  <Loader2 className="size-3.5 animate-spin text-ember" /> {phase}…
                </div>
                <Progress value={pct} className="h-1.5 bg-white/[0.06]" />
              </motion.div>
            ) : (
              <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2">
                <Button variant="ember" onClick={onSend} disabled={!urgent}>
                  <Send /> Send preservation request
                </Button>
                <span className="text-[12px] text-dim">{urgent ? 'creates a draft for officer approval' : 'not needed — funds are at rest'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  )
}

/* ───────── Draft preview ───────── */
function DraftCard({ ex, j, urgent }: { ex: Exchange; j: Juris; urgent: boolean }) {
  const docs: { key: string; label: string; ch: ChannelKey; preserve?: boolean }[] = []
  if (urgent && j.route.preserve !== j.route.primary) docs.push({ key: 'preserve', label: `Preservation · ${CHANNELS[j.route.preserve].short}`, ch: j.route.preserve, preserve: true })
  docs.push({ key: 'primary', label: `Primary · ${CHANNELS[j.route.primary].short}`, ch: j.route.primary })
  docs.push({ key: 'fallback', label: `Binding · ${CHANNELS[j.route.fallback].short}`, ch: j.route.fallback })
  const [tab, setTab] = React.useState(docs[0].key)
  const valid = docs.some((d) => d.key === tab) ? tab : docs[0].key
  React.useEffect(() => {
    setTab(docs[0].key)
    // reset to the first document whenever the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id, urgent])

  return (
    <Card className="h-full pb-5">
      <CardHeader title="Draft request" tech="pre-filled for the chosen channel · review the highlighted fields" icon={<FileText className="size-4" />} right={<Chip tone="gold">Draft</Chip>} />
      <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[13px] leading-snug text-muted">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-gold" />
        <span>
          <span className="font-medium text-gold">Draft for officer review — not legal advice.</span> Channel and country details are illustrative; confirm the legal basis with the central authority before sending.
        </span>
      </div>
      <Tabs value={valid} onValueChange={setTab} className="mt-3 px-5">
        <div className="k-scroll -mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-8 border border-line bg-white/[0.04]">
            {docs.map((d) => (
              <TabsTrigger key={d.key} value={d.key} className="h-full px-3 text-[13.5px] text-muted data-[state=active]:text-text">
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContents className="mt-2">
          {docs.map((d) => (
            <TabsContent key={d.key} value={d.key}>
              <RequestPaper channel={d.ch} exchange={ex} juris={j} preserve={d.preserve} />
            </TabsContent>
          ))}
        </TabsContents>
      </Tabs>
    </Card>
  )
}
