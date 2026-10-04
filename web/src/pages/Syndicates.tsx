import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, Calendar, Info, Link2, MapPin, Network, Route, Sparkles, User, Wallet } from 'lucide-react'
import {
  Address,
  Card,
  CardHeader,
  Chip,
  CurveChart,
  FlowGraph,
  IconTile,
  KV,
  Meter,
  PageHeader,
  Reveal,
  Sparkline,
  Stat,
  toneA,
  toneHex,
  useTick,
  type FlowEdge,
  type FlowNode,
} from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { EXCHANGES, SYNDICATES } from '@/data/demo'
import { inr, short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EVIDENCE, GRAPHS, LINK_THRESHOLD, linkScore, type EvidenceKey, type SynGraph } from './syndicates/data'

const ALL_ON: Record<EvidenceKey, boolean> = { hub: true, deposit: true, timing: true, telegram: true, bridge: true }

function noisyOr(keys: EvidenceKey[]) {
  return 1 - EVIDENCE.filter((e) => keys.includes(e.key)).reduce((m, e) => m * (1 - e.w), 1)
}

function daysSince(d: string) {
  const t = Date.parse(d)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.round((Date.parse('2026-10-03') - t) / 86400000))
}

export default function SyndicatesPage() {
  const [synId, setSynId] = React.useState('SYN-07')
  const [on, setOn] = React.useState<Record<EvidenceKey, boolean>>(ALL_ON)
  const [selected, setSelected] = React.useState<string | null>('h1')

  const syn = SYNDICATES.find((s) => s.id === synId)!
  const g = GRAPHS[synId]

  function pick(id: string) {
    setSynId(id)
    setOn(ALL_ON)
    setSelected('h1')
  }

  // ── recompute linkage from the evidence types still switched on ──
  const scores = React.useMemo(() => Object.fromEntries(g.cases.map((c) => [c.id, linkScore(c.via, on)])), [g, on])
  const linkedCases = g.cases.filter((c) => scores[c.id] >= LINK_THRESHOLD)
  const present = EVIDENCE.filter((e) => (g.evidenceCounts[e.key] ?? 0) > 0).map((e) => e.key)
  const enabled = present.filter((k) => on[k])
  const confidence = noisyOr(present) > 0 ? syn.confidence * (noisyOr(enabled) / noisyOr(present)) : 0
  const linkedTotal = Math.round(syn.cases * (linkedCases.length / g.cases.length))

  const highlight = React.useMemo(() => {
    if (linkedCases.length === g.cases.length) return null
    const s = new Set<string>()
    linkedCases.forEach((c) => {
      s.add(c.id)
      s.add(c.wallet)
      const w = g.wallets.find((x) => x.id === c.wallet)!
      s.add(w.hub)
      g.hubs.find((h) => h.id === w.hub)!.exchanges.forEach((e) => s.add(`ex-${e.ex}`))
    })
    return s
  }, [linkedCases, g])

  const { nodes, edges } = React.useMemo(() => buildGraph(g, scores), [g, scores])

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <Network className="size-3.5" /> Cross-case entity resolution
            </>
          }
          title="Syndicate Graph"
          tech="Each FIR is usually investigated alone. KAIZEN checks every new trace against one persistent graph — shared wallets, collection hubs and deposit addresses reveal a single syndicate behind many cases in many states. · entity resolution · persistent wallet graph"
          actions={
            <>
              <span className="k-btn-ghost inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px]">
                <Wallet className="size-3" /> 14,920 wallets in graph
              </span>
              <span className="k-btn-ghost inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px]">
                <Link2 className="size-3" /> 312 cases linked
              </span>
            </>
          }
        />
      </Reveal>

      {/* ── Syndicate selector ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SYNDICATES.map((s, i) => {
          const act = s.id === synId
          return (
            <Reveal key={s.id} delay={0.04 + i * 0.04}>
              <button
                type="button"
                onClick={() => pick(s.id)}
                aria-pressed={act}
                className={cn('k-card relative block h-full w-full overflow-hidden p-4 text-left transition-colors', !act && 'hover:border-line-2')}
                style={act ? { borderColor: toneA(s.tone, 0.45), boxShadow: `0 0 0 1px ${toneA(s.tone, 0.2)}, 0 0 30px -12px ${toneA(s.tone, 0.7)}` } : undefined}
              >
                {act && <motion.span layoutId="syn-active" className="absolute inset-x-0 top-0 h-[2px]" style={{ background: toneHex(s.tone) }} />}
                <div className="flex items-center justify-between gap-2">
                  <span className="k-num text-[13.5px]" style={{ color: toneHex(s.tone) }}>
                    {s.id}
                  </span>
                  {s.active ? (
                    <Chip tone="ember" dot pulse>
                      Active
                    </Chip>
                  ) : (
                    <Chip tone="neutral">Dormant</Chip>
                  )}
                </div>
                <div className="mt-1.5 line-clamp-2 min-h-[34px] text-[14px] leading-snug text-text">{s.name}</div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="text-[12px] text-dim">
                    {s.cases} cases · {s.states} states
                    <div className="k-num text-[14.5px] text-text">{inr(s.valueINR)}</div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[18px] text-text">{Math.round(s.confidence * 100)}%</div>
                    <div className="text-[11.5px] text-dim">linked</div>
                  </div>
                </div>
              </button>
            </Reveal>
          )
        })}
      </div>

      {/* ── Impact strip ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { k: `1 trace → ${syn.cases} cases resolved`, v: <Stat key={synId + 'c'} value={syn.cases} className="text-[26px] text-text" />, spark: g.timeline.total, tone: 'crimson' as const },
          { k: 'Stolen value linked', v: <Stat key={synId + 'v'} value={syn.valueINR / 1e7} prefix="₹" suffix=" Cr" decimals={1} className="text-[26px] text-text" />, spark: g.timeline.total.map((x, i) => x * (1 + i * 0.05)), tone: 'gold' as const },
          { k: 'States with victims', v: <Stat key={synId + 's'} value={syn.states} className="text-[26px] text-text" />, spark: g.timeline.total.map((x) => Math.min(syn.states, Math.ceil(x / 3))), tone: 'sky' as const },
          { k: `First seen · ${daysSince(syn.firstSeen) ?? '—'} days active`, v: <span className="k-num text-[22px] leading-[1.3] text-text">{syn.firstSeen}</span>, spark: g.timeline.auto, tone: 'ember' as const },
        ].map((t, i) => (
          <Reveal key={t.k} delay={0.08 + i * 0.04}>
            <Card variant="speckle" grain className="h-[112px] p-4">
              <div className="relative text-[13px] text-muted">{t.k}</div>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                {t.v}
                <Sparkline key={synId} data={t.spark} tone={t.tone} width={78} height={34} className="hidden sm:block" />
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* ── Graph + side panel ── */}
      <Reveal delay={0.1}>
        <Card className="pb-4">
          <CardHeader
            title="Who is connected to whom"
            tech="victim cases → scam wallets → collection wallets → exchanges · click any card for details"
            right={
              <Chip tone={syn.tone} dot>
                {linkedCases.length}/{g.cases.length} cases linked
              </Chip>
            }
          />
          <div className="grid grid-cols-1 gap-3 px-4 pt-3 xl:grid-cols-[1fr_300px]">
            <div className="k-scroll overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="mb-2 grid grid-cols-4 px-1 text-[12px] tracking-wide text-dim uppercase">
                  <span>Victim cases</span>
                  <span className="text-center">Scam wallets</span>
                  <span className="text-center">Collection wallets</span>
                  <span className="text-right">Exchanges</span>
                </div>
                <FlowGraph
                  key={synId}
                  nodes={nodes}
                  edges={edges}
                  height={520}
                  nodeWidth={184}
                  nodeHeight={50}
                  selected={selected}
                  onSelect={(id) => setSelected(id)}
                  highlight={highlight}
                />
              </div>
            </div>
            <SidePanel g={g} selected={selected} scores={scores} on={on} />
          </div>
        </Card>
      </Reveal>

      {/* ── Evidence + timeline/feed ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1fr]">
        <Reveal delay={0.1}>
          <Card variant="glass" className="h-full pb-5">
            <CardHeader
              title="Why these cases are one syndicate"
              tech="link evidence · switch a type off to see what still holds"
              right={
                <div className="text-right">
                  <div className="k-num flex items-baseline justify-end text-[26px] leading-none text-text">
                    <SlidingNumber number={Number(confidence.toFixed(2))} decimalPlaces={2} />
                  </div>
                  <div className="text-[11.5px] text-dim">linkage confidence</div>
                </div>
              }
            />
            <ul className="mt-4 space-y-1 px-3">
              {EVIDENCE.map((e) => {
                const count = g.evidenceCounts[e.key] ?? 0
                const disabled = count === 0
                return (
                  <li
                    key={e.key}
                    className={cn('rounded-xl px-2 py-2.5 transition-opacity', !on[e.key] && 'opacity-45', disabled && 'opacity-30')}
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={on[e.key] && !disabled}
                        disabled={disabled}
                        onCheckedChange={(v) => setOn((o) => ({ ...o, [e.key]: v }))}
                        aria-label={`Use ${e.plain.toLowerCase()} as link evidence`}
                        className="data-[state=checked]:bg-moss data-[state=unchecked]:bg-white/[0.1]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[14px] text-text">{e.plain}</span>
                          <span className="shrink-0 text-[12.5px] text-muted">
                            <span className="k-num text-text">{count}</span> of {syn.cases} cases
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{e.tech}</span>
                          <span className="k-num shrink-0 text-[12px] text-dim">weight {e.w.toFixed(2)}</span>
                        </div>
                        <Meter key={synId} value={count / syn.cases} tone={e.tone} height={4} className="mt-1.5" />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                <div className="k-num text-[20px] text-text">
                  {linkedCases.length}
                  <span className="text-[14.5px] text-dim">/{g.cases.length}</span>
                </div>
                <div className="text-[12px] text-dim">cases on the graph still linked</div>
              </div>
              <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                <div className="k-num text-[20px] text-text">
                  ~{linkedTotal}
                  <span className="text-[14.5px] text-dim">/{syn.cases}</span>
                </div>
                <div className="text-[12px] text-dim">estimated across the whole syndicate</div>
              </div>
            </div>
            <p className="mx-5 mt-3 flex gap-2 text-[12px] leading-relaxed text-dim">
              <Info className="mt-0.5 size-3 shrink-0" />
              A case stays linked while its combined evidence score is at least {LINK_THRESHOLD.toFixed(2)} (independent signals combined). Linkage is
              probabilistic — an officer confirms before any cases are merged.
            </p>
          </Card>
        </Reveal>

        <div className="grid grid-cols-1 gap-3">
          <Reveal delay={0.15}>
            <Card className="pb-4">
              <CardHeader title="Cases linked over time" tech={`cumulative · ${syn.id} since ${syn.firstSeen}`} />
              <div className="px-5 pt-2">
                <div className="flex flex-wrap items-baseline gap-3">
                  <Stat key={synId} value={syn.cases} className="text-[24px] text-text" />
                  <span className="flex items-center gap-3 text-[12.5px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-3 rounded bg-crimson" />
                      All linked
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-3 rounded bg-white" />
                      Linked automatically
                    </span>
                  </span>
                </div>
                <CurveChart
                  key={synId}
                  className="mt-2"
                  height={140}
                  labels={g.timeline.labels}
                  series={[
                    { name: 'All linked', tone: 'crimson', data: g.timeline.total },
                    { name: 'Automatic', tone: 'white', data: g.timeline.auto },
                  ]}
                  highlight={{ series: 0, index: g.timeline.labels.length - 1, title: `${g.timeline.labels[g.timeline.labels.length - 1]} · today` }}
                  format={(v) => `${v} cases`}
                />
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <AutoLinkFeed key={synId} g={g} />
          </Reveal>
        </div>
      </div>
    </div>
  )
}

/* ───────── graph construction ───────── */
function buildGraph(g: SynGraph, scores: Record<string, number>) {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  g.cases.forEach((c) => {
    const linked = scores[c.id] >= LINK_THRESHOLD
    nodes.push({
      id: c.id,
      col: 0,
      title: c.who,
      sub: `${c.id.slice(-4)} · ${c.city}, ${c.state}`,
      tone: 'sky',
      icon: <User />,
      ghost: !linked,
      width: 176,
    })
    edges.push({ from: c.id, to: c.wallet, weight: 0.25, dashed: !linked })
  })
  g.wallets.forEach((w) => {
    const n = g.cases.filter((c) => c.wallet === w.id).length
    nodes.push({
      id: w.id,
      col: 1,
      title: w.label,
      sub: short(w.addr),
      tone: 'crimson',
      icon: <Wallet />,
      badge: <span className="k-num rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-muted">{n}</span>,
      width: 178,
    })
    edges.push({ from: w.id, to: w.hub, weight: 0.35 + n * 0.12 })
  })
  g.hubs.forEach((h, hi) => {
    nodes.push({
      id: h.id,
      col: 2,
      y: g.hubs.length === 1 ? 0.5 : [0.36, 0.86][hi],
      title: h.label,
      sub: short(h.addr),
      tone: 'crimson',
      icon: <Network />,
      badge: (
        <Chip tone="crimson" solid>
          {h.victims}
        </Chip>
      ),
      live: hi === 0,
      width: 196,
    })
    h.exchanges.forEach((e, ei) => {
      edges.push({ from: h.id, to: `ex-${e.ex}`, weight: e.weight, animated: hi === 0 && ei === 0, label: `${e.deposits} deposits` })
    })
  })
  const exIds = Array.from(new Set(g.hubs.flatMap((h) => h.exchanges.map((e) => e.ex))))
  exIds.forEach((ex) => {
    const x = EXCHANGES.find((e) => e.id === ex)!
    nodes.push({ id: `ex-${ex}`, col: 3, title: x.name, sub: `${x.jurisdiction} · ${x.fiuRegistered ? 'FIU-registered' : 'not FIU-registered'}`, tone: 'gold', icon: <Building2 />, width: 190 })
  })
  return { nodes, edges }
}

/* ───────── detail side panel ───────── */
function SidePanel({ g, selected, scores, on }: { g: SynGraph; selected: string | null; scores: Record<string, number>; on: Record<EvidenceKey, boolean> }) {
  const c = g.cases.find((x) => x.id === selected)
  const w = g.wallets.find((x) => x.id === selected)
  const h = g.hubs.find((x) => x.id === selected)
  const ex = selected?.startsWith('ex-') ? EXCHANGES.find((x) => `ex-${x.id}` === selected) : undefined

  return (
    <div className="rounded-2xl border border-line bg-white/[0.015] p-4">
      <AnimatePresence mode="wait">
        <motion.div key={selected ?? 'none'} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }}>
          {c ? (
            <>
              <PanelHead tone="sky" icon={<User />} kicker="Victim case" title={c.who} sub={c.id} />
              <div className="mt-3 divide-y divide-line">
                <KV k="Where" v={`${c.city}, ${c.state}`} />
                <KV k="Amount lost" v={<span className="k-num">{inr(c.amt)}</span>} />
                <KV k="Fraud type" v={c.type} />
                <KV k="Complaint filed" v={c.filed} />
              </div>
              <div className="mt-3 text-[12.5px] text-muted">Linked to the syndicate by</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.via.map((k) => {
                  const e = EVIDENCE.find((x) => x.key === k)!
                  return (
                    <Chip key={k} tone={on[k] ? e.tone : 'neutral'} className={cn(!on[k] && 'line-through opacity-60')}>
                      {e.plain}
                    </Chip>
                  )
                })}
              </div>
              <div className="mt-4 flex items-baseline justify-between text-[12.5px]">
                <span className="text-muted">Link score</span>
                <span className={cn('k-num text-[15.5px]', scores[c.id] >= LINK_THRESHOLD ? 'text-text' : 'text-crimson')}>{scores[c.id].toFixed(2)}</span>
              </div>
              <Meter key={scores[c.id]} value={scores[c.id]} tone={scores[c.id] >= LINK_THRESHOLD ? 'moss' : 'crimson'} height={5} className="mt-1.5" />
              <div className="mt-1.5 text-[12px] text-dim">{scores[c.id] >= LINK_THRESHOLD ? 'Linked — above the 0.50 bar' : 'No longer linked with the evidence switched on'}</div>
            </>
          ) : w ? (
            <>
              <PanelHead tone="crimson" icon={<Wallet />} kicker="Scam wallet" title={w.label} sub="first receiver of victim funds" />
              <div className="mt-3">
                <Address addr={w.addr} chain={w.addr.startsWith('0x') ? 'Ethereum' : 'TRON'} full className="text-[12.5px]" />
              </div>
              <div className="mt-2 divide-y divide-line">
                <KV k="Victims paying in" v={g.cases.filter((x) => x.wallet === w.id).length} />
                <KV k="Typical hold time" v="38–47 s" />
                <KV k="Value kept per hop" v="99.8%" />
                <KV k="Sends to" v={g.hubs.find((x) => x.id === w.hub)?.label} />
              </div>
              <div className="mt-3 space-y-1.5">
                {g.cases
                  .filter((x) => x.wallet === w.id)
                  .map((x) => (
                    <div key={x.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[12.5px]">
                      <span className="text-text">{x.who}</span>
                      <span className="text-dim">{x.city}</span>
                    </div>
                  ))}
              </div>
            </>
          ) : h ? (
            <>
              <PanelHead tone="crimson" icon={<Network />} kicker="Collection wallet (hub)" title={`${h.victims} victims, one wallet`} sub="consolidation point · resolves many cases at once" />
              <div className="mt-3">
                <Address addr={h.addr} chain={h.addr.startsWith('0x') ? 'Ethereum' : 'TRON'} full className="text-[12.5px]" />
              </div>
              <div className="mt-2 divide-y divide-line">
                <KV k="Value received" v={<span className="k-num">{inr(h.valueINR)}</span>} />
                <KV k="First seen" v={h.firstSeen} />
                <KV k="Victims" v={<span className="k-num text-crimson">{h.victims}</span>} />
              </div>
              <div className="mt-3 text-[12.5px] text-muted">Cashes out at</div>
              <div className="mt-1.5 space-y-2">
                {h.exchanges.map((e) => (
                  <div key={e.ex}>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-text">{EXCHANGES.find((x) => x.id === e.ex)?.name}</span>
                      <span className="k-num text-muted">{e.deposits} deposits</span>
                    </div>
                    <Meter value={e.weight} tone="gold" height={4} className="mt-1" />
                  </div>
                ))}
              </div>
            </>
          ) : ex ? (
            <>
              <PanelHead tone="gold" icon={<Building2 />} kicker="Exchange (cash-out point)" title={ex.name} sub={`${ex.jurisdiction} · ${ex.indianUsers} Indian users`} />
              <div className="mt-3 divide-y divide-line">
                <KV k="Registered with FIU-IND" v={ex.fiuRegistered ? <span className="text-moss">Yes</span> : <span className="text-crimson">No</span>} />
                <KV k="Avg reply to police" v={`${ex.avgResponseHrs} h`} />
                <KV k="Freezes honoured" v={`${ex.freezesHonoured} of ${ex.noticesReceived}`} />
                <KV
                  k="Deposits from this group"
                  v={<span className="k-num">{g.hubs.flatMap((x) => x.exchanges).filter((x) => `ex-${x.ex}` === selected).reduce((a, x) => a + x.deposits, 0)}</span>}
                />
              </div>
              <div className="mt-3 rounded-lg border border-gold/25 bg-gold/[0.05] px-3 py-2 text-[12.5px] leading-relaxed text-muted">
                One consolidated notice here covers every linked case — the KYC record behind the deposit address identifies the account holder.
              </div>
            </>
          ) : (
            <div className="grid h-[260px] place-items-center text-center text-[13.5px] text-dim">
              <div>
                <Sparkles className="mx-auto mb-2 size-5" />
                Click a case, wallet or exchange in the graph to see its details.
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function PanelHead({ tone, icon, kicker, title, sub }: { tone: 'sky' | 'crimson' | 'gold'; icon: React.ReactNode; kicker: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="min-w-0">
        <div className="text-[12px] tracking-wide uppercase" style={{ color: toneHex(tone) }}>
          {kicker}
        </div>
        <div className="truncate text-[15.5px] font-medium text-text">{title}</div>
        <div className="text-[12.5px] text-dim">{sub}</div>
      </div>
    </div>
  )
}

/* ───────── live auto-link feed ───────── */
function AutoLinkFeed({ g }: { g: SynGraph }) {
  const tick = useTick(6500)
  const pool = g.feed
  const rows =
    pool.length === 0
      ? []
      : Array.from({ length: Math.min(4, pool.length) }, (_, k) => {
          const idx = (((tick - k) % pool.length) + pool.length) % pool.length
          return { ...pool[idx], key: tick - k, ago: k === 0 ? 'just now' : `${Math.round(k * 6.5)} s ago` }
        })
  return (
    <Card className="h-full">
      <CardHeader title="Auto-linked just now" tech="new complaints matched to this syndicate on arrival" right={<Chip tone="ember" dot pulse>Live</Chip>} />
      {rows.length === 0 ? (
        <div className="k-dashed mx-5 my-4 p-4 text-[13.5px] text-muted">No new complaints matched this syndicate in the last 30 days.</div>
      ) : (
        <ul className="mt-2 px-3 pb-3">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => {
              const e = EVIDENCE.find((x) => x.key === r.via)!
              return (
                <motion.li
                  key={r.key}
                  layout
                  initial={{ opacity: 0, y: -12, backgroundColor: toneA('ember', 0.1) }}
                  animate={{ opacity: 1, y: 0, backgroundColor: toneA('ember', 0) }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
                >
                  <IconTile size={30} tone={i === 0 ? 'ember' : undefined}>
                    {r.via === 'bridge' ? <Route /> : r.via === 'hub' ? <Network /> : r.via === 'deposit' ? <Building2 /> : r.via === 'timing' ? <Calendar /> : <MapPin />}
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-text">
                      {r.who} <span className="text-dim">· {r.city}</span>
                    </div>
                    <div className="truncate text-[12px] text-dim">
                      {r.id} · via {e.plain.toLowerCase()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[13.5px] text-text">{r.score.toFixed(2)}</div>
                    <div className="text-[11.5px] text-dim">{r.ago}</div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
