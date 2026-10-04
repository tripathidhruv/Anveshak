import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  Copy as CopyIcon,
  FileStack,
  GitMerge,
  Landmark,
  Loader2,
  MapPin,
  Minus,
  Network,
  RotateCcw,
  Send,
  Share2,
  Users,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  IconTile,
  Meter,
  PageHeader,
  Reveal,
  ScoreRing,
  Stat,
  SubTabs,
  toneA,
  toneHex,
  type Tone,
} from '@/components/kit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/radix/tooltip'
import { Progress } from '@/components/animate-ui/components/radix/progress'
import { inr, short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { COMPLAINTS, FIRS, ID_FIELDS, ROUTING_STEPS, TILES, firValue, similarity } from './jurisdiction/data'

const MAX_COMPLAINTS = Math.max(...Object.values(COMPLAINTS))
const CLUSTER = FIRS.filter((f) => f.cluster)
const CLUSTER_STATES = new Set(CLUSTER.map((f) => f.state))
const STATE_NAME = Object.fromEntries(TILES.map((t) => [t.code, t.name]))

/** identifiers shared by 2+ FIRs in the duplicate cluster */
const SHARED = ID_FIELDS.filter((f) => f.key !== 'type' && f.key !== 'phone')
  .map((f) => {
    const counts: Record<string, number> = {}
    CLUSTER.forEach((x) => {
      const v = firValue(x, f.key)
      counts[v] = (counts[v] ?? 0) + 1
    })
    const [value, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return { field: f, value, n }
  })
  .filter((s) => s.n >= 2)

export default function JurisdictionPage() {
  const [stateFilter, setStateFilter] = React.useState<string | null>(null)
  const [pair, setPair] = React.useState<[string, string]>(['rj1', 'br1'])
  const [routeStep, setRouteStep] = React.useState(0)
  const timers = React.useRef<number[]>([])
  React.useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const a = FIRS.find((f) => f.id === pair[0])!
  const b = FIRS.find((f) => f.id === pair[1])!
  const sim = similarity(a, b)
  const firs = stateFilter ? FIRS.filter((f) => f.state === stateFilter) : FIRS
  const routing = routeStep > 0 && routeStep <= ROUTING_STEPS.length
  const routed = routeStep > ROUTING_STEPS.length

  function setSide(side: 0 | 1, id: string) {
    setPair((p) => {
      const next: [string, string] = [...p] as [string, string]
      if (p[1 - side] === id) next[1 - side] = p[side] // swap instead of comparing a FIR with itself
      next[side] = id
      return next
    })
  }

  function mergeAndRoute() {
    setRouteStep(1)
    ROUTING_STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setRouteStep(i + 2), 1100 * (i + 1)))
    })
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <GitMerge className="size-3.5" /> Multi-state case merge
            </>
          }
          title="FIR Dedup & Routing"
          tech="The same syndicate is reported as separate FIRs in 11 states, and every cyber cell sends its own notice to the same exchange. ANVESHAK spots the duplicates and recommends one lead jurisdiction. · duplicate detection · jurisdiction routing"
          actions={
            <>
              <span className="k-btn-ghost inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px]">
                <Network className="size-3 text-crimson" /> SYN-07 · Saffron Desk
              </span>
            </>
          }
        />
      </Reveal>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { k: 'Complaints about one syndicate', v: 38, sub: 'across 11 states', icon: <Users />, tone: 'sky' as Tone },
          { k: 'FIRs registered separately', v: FIRS.length, sub: 'by 12 police stations', icon: <FileStack />, tone: 'neutral' as Tone },
          { k: 'Confirmed duplicates', v: CLUSTER.length, sub: 'similarity 0.60 or higher', icon: <CopyIcon />, tone: 'crimson' as Tone },
          { k: 'Notices the exchange would get', v: 11, sub: 'one per state — today', icon: <Send />, tone: 'gold' as Tone },
        ].map((t, i) => (
          <Reveal key={t.k} delay={0.05 + i * 0.04}>
            <Card variant="speckle" grain className="h-[112px] p-4">
              <div className="relative flex items-start justify-between gap-2">
                <div className="text-[13px] leading-snug text-muted">{t.k}</div>
                <IconTile tone={t.tone === 'neutral' ? undefined : t.tone} size={30}>
                  {t.icon}
                </IconTile>
              </div>
              <div className="relative mt-2 flex items-baseline gap-2">
                <Stat value={t.v} className="text-[26px] text-text" />
                <span className="text-[12px] text-dim">{t.sub}</span>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <SubTabs
        tabs={[
          {
            key: 'map',
            label: 'Where the FIRs are',
            icon: MapPin,
            badge: FIRS.length,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1fr]">
                <Card className="h-full pb-5">
                  <CardHeader
                    title="Where the victims are"
                    tech="SYN-07 complaints per state · tile map (each square is a state)"
                    right={
                      stateFilter ? (
                        <button onClick={() => setStateFilter(null)} className="k-btn-ghost inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px]">
                          <X className="size-3" /> Clear {stateFilter}
                        </button>
                      ) : (
                        <span className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">All states</span>
                      )
                    }
                  />
                  <div className="flex flex-col gap-5 px-5 pt-4 md:flex-row md:items-start">
                    <IndiaTiles selected={stateFilter} onSelect={(c) => setStateFilter((s) => (s === c ? null : c))} />
                    <div className="min-w-0 flex-1 space-y-4">
                      <div>
                        <div className="text-[12.5px] text-muted">Complaints per state</div>
                        <div className="mt-2 flex items-center gap-1.5">
                          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                            <span key={v} className="h-3 flex-1 rounded-[4px]" style={{ background: v === 0 ? 'rgba(255,255,255,0.05)' : toneA('sky', 0.12 + v * 0.7) }} />
                          ))}
                        </div>
                        <div className="mt-1 flex justify-between text-[11.5px] text-dim">
                          <span>0</span>
                          <span>{MAX_COMPLAINTS}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-[12.5px] text-muted">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-crimson" style={{ boxShadow: `0 0 6px ${toneHex('crimson')}` }} /> FIR in the duplicate cluster
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full border border-ember" /> Recommended lead state
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-line pt-3">
                        {Object.entries(COMPLAINTS)
                          .sort((x, y) => y[1] - x[1])
                          .slice(0, 5)
                          .map(([code, n]) => (
                            <button
                              key={code}
                              onClick={() => setStateFilter((s) => (s === code ? null : code))}
                              className={cn('block w-full rounded-md text-left', stateFilter === code && 'bg-white/[0.04]')}
                            >
                              <div className="flex justify-between text-[13px]">
                                <span className="text-text">{STATE_NAME[code]}</span>
                                <span className="k-num text-muted">{n}</span>
                              </div>
                              <Meter value={n / MAX_COMPLAINTS} tone="sky" height={4} className="mt-1" />
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="h-full pb-3">
                  <CardHeader
                    title={stateFilter ? `FIRs in ${STATE_NAME[stateFilter]}` : 'Every FIR about this syndicate'}
                    tech={`${firs.length} FIR${firs.length === 1 ? '' : 's'} · pick a state on the map to filter`}
                    right={<Chip tone="crimson">{firs.filter((f) => f.cluster).length} duplicates</Chip>}
                  />
                  <div className="k-scroll mt-2 max-h-[372px] overflow-auto px-3">
                    {firs.length === 0 ? (
                      <div className="k-dashed m-2 p-4 text-[13.5px] text-muted">
                        No FIR registered in {stateFilter ? STATE_NAME[stateFilter] : 'this state'} yet — {stateFilter && COMPLAINTS[stateFilter] ? `${COMPLAINTS[stateFilter]} complaints are still at NCRP stage.` : 'no complaints either.'}
                      </div>
                    ) : (
                      <ul className="divide-y divide-line">
                        <AnimatePresence initial={false}>
                          {firs.map((f) => (
                            <motion.li
                              key={f.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.025]"
                            >
                              <span className="k-num grid size-8 shrink-0 place-items-center rounded-lg border border-line-2 text-[12.5px] text-sky">{f.state}</span>
                              <div className="min-w-[150px] flex-1">
                                <div className="truncate text-[14px] text-text">
                                  {f.no} <span className="text-dim">·</span> <span className="text-muted">{f.ps}</span>
                                </div>
                                <div className="truncate text-[12px] text-dim">
                                  {f.victim} · {f.date} · {f.type}
                                </div>
                              </div>
                              <div className="k-num w-[60px] text-right text-[14px] text-text">{inr(f.amt)}</div>
                              <span className="w-[96px] text-right">
                                {f.id === 'rj0' ? (
                                  <Chip tone="moss">Earliest FIR</Chip>
                                ) : f.cluster ? (
                                  <Chip tone="crimson">Duplicate</Chip>
                                ) : (
                                  <Chip tone="neutral">Same syndicate</Chip>
                                )}
                              </span>
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    )}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'duplicates',
            label: 'Duplicate FIRs',
            icon: CopyIcon,
            badge: CLUSTER.length,
            render: (go) => (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.9fr_1.4fr]">
                  <Card className="h-full pb-4">
                    <CardHeader title="Duplicate cluster found" tech="FIR de-duplication · identifier overlap" right={<Chip tone="crimson" dot>Cluster A</Chip>} />
                    <div className="px-5 pt-3">
                      <p className="text-[15.5px] leading-snug text-text">
                        {CLUSTER.length} FIRs across {Array.from(CLUSTER_STATES).join(', ')} describe the same operation.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {SHARED.map((s) => (
                          <Chip key={s.field.key} tone={s.field.key === 'deposit' ? 'gold' : s.field.key === 'telegram' || s.field.key === 'upi' ? 'sky' : 'crimson'}>
                            {s.field.plain} ×{s.n}
                          </Chip>
                        ))}
                      </div>
                      <div className="mt-4 text-[12.5px] text-muted">Pick two FIRs to compare side by side</div>
                    </div>
                    <ul className="mt-2 space-y-1.5 px-3">
                      {CLUSTER.map((f) => {
                        const isA = pair[0] === f.id
                        const isB = pair[1] === f.id
                        return (
                          <li
                            key={f.id}
                            className={cn(
                              'flex items-center gap-3 rounded-xl border px-2.5 py-2 transition-colors',
                              isA || isB ? 'border-line-2 bg-white/[0.035]' : 'border-transparent hover:bg-white/[0.02]',
                            )}
                          >
                            <span className="k-num grid size-8 shrink-0 place-items-center rounded-lg border border-line-2 text-[12.5px] text-sky">{f.state}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13.5px] text-text">{f.no}</div>
                              <div className="truncate text-[12px] text-dim">
                                {f.ps} · {f.victim}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {(['A', 'B'] as const).map((side, si) => {
                                const on = si === 0 ? isA : isB
                                return (
                                  <button
                                    key={side}
                                    onClick={() => setSide(si as 0 | 1, f.id)}
                                    aria-label={`Compare ${f.no} as FIR ${side}`}
                                    aria-pressed={on}
                                    className={cn(
                                      'k-num grid size-7 place-items-center rounded-lg border text-[12.5px] transition-colors',
                                      on ? 'border-ember/60 bg-ember/15 text-ember' : 'border-line-2 text-dim hover:text-text',
                                    )}
                                  >
                                    {side}
                                  </button>
                                )
                              })}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Card>

                  <Card className="h-full pb-4">
                    <CardHeader
                      title="Side-by-side comparison"
                      tech="weighted identifier match · weights shown per row"
                      right={
                        <Chip tone={sim >= 0.6 ? 'moss' : sim >= 0.4 ? 'gold' : 'neutral'} dot>
                          {sim >= 0.6 ? 'Same operation' : sim >= 0.4 ? 'Possibly related' : 'Weak link'}
                        </Chip>
                      }
                    />
                    <div className="flex flex-col gap-4 px-5 pt-3 md:flex-row md:items-start">
                      <div className="flex shrink-0 flex-col items-center gap-2 md:w-[130px]">
                        <ScoreRing key={pair.join('-')} value={sim} tone={sim >= 0.6 ? 'moss' : sim >= 0.4 ? 'gold' : 'neutral'} label={sim.toFixed(2)} sub="similarity" size={118} />
                        <p className="text-center text-[12px] leading-snug text-dim">Sum of weights of matching identifiers. 0.60+ is treated as a duplicate.</p>
                      </div>
                      <div className="k-scroll min-w-0 flex-1 overflow-x-auto">
                        <table className="w-full min-w-[520px] border-separate border-spacing-y-1 text-left">
                          <thead>
                            <tr className="text-[12px] text-dim">
                              <th className="w-[34%] pb-1 font-normal">Identifier</th>
                              {[a, b].map((f, i) => (
                                <th key={i} className="pb-1 font-normal">
                                  <span className="k-num mr-1.5 text-ember">{i === 0 ? 'A' : 'B'}</span>
                                  <span className="text-text">{f.no}</span>
                                  <div className="text-[11.5px] text-dim">
                                    {f.ps} · {f.date}
                                  </div>
                                </th>
                              ))}
                              <th className="w-[54px] pb-1 text-right font-normal">Match</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ID_FIELDS.map((fld) => {
                              const va = firValue(a, fld.key)
                              const vb = firValue(b, fld.key)
                              const match = va === vb && va !== '—'
                              return (
                                <motion.tr
                                  key={fld.key}
                                  animate={{ backgroundColor: match ? toneA('moss', 0.06) : toneA('moss', 0) }}
                                  transition={{ duration: 0.35 }}
                                  className="text-[13px]"
                                >
                                  <td className="rounded-l-lg py-1.5 pl-2">
                                    <div className="text-text">{fld.plain}</div>
                                    <div className="text-[11.5px] text-dim">
                                      {fld.tech} · w {fld.w.toFixed(2)}
                                    </div>
                                  </td>
                                  {[va, vb].map((v, i) => (
                                    <td key={i} className={cn('py-1.5 pr-2', fld.mono && 'k-mono text-[12.5px]', match ? 'text-moss' : 'text-muted')}>
                                      {fld.mono && v.length > 18 ? short(v, 7, 5) : v}
                                    </td>
                                  ))}
                                  <td className="rounded-r-lg py-1.5 pr-2 text-right">
                                    <AnimatePresence mode="wait" initial={false}>
                                      <motion.span
                                        key={match ? 'y' : 'n'}
                                        initial={{ scale: 0.4, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.4, opacity: 0 }}
                                        className={cn(
                                          'inline-grid size-6 place-items-center rounded-full',
                                          match ? 'bg-moss/15 text-moss' : 'bg-white/[0.04] text-dim',
                                        )}
                                        aria-label={match ? 'match' : 'no match'}
                                      >
                                        {match ? <Check className="size-3.5" strokeWidth={2.5} /> : <Minus className="size-3.5" />}
                                      </motion.span>
                                    </AnimatePresence>
                                  </td>
                                </motion.tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="mx-5 mt-2 flex gap-2 text-[12px] leading-relaxed text-dim">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      Similarity suggests the same operation; it is not proof. An officer confirms each duplicate before FIRs are merged.
                    </p>
                  </Card>
                </div>
                <button type="button" onClick={() => go('route')} className="flex items-center gap-1.5 px-1 text-[13.5px] text-text/90 hover:text-text">
                  Recommended lead jurisdiction <ArrowRight className="size-3.5" />
                </button>
              </div>
            ),
          },
          {
            key: 'route',
            label: 'Lead state & routing',
            icon: GitMerge,
            badge: routed ? 'Routed' : undefined,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
                <Card variant="glass" className="h-full pb-5">
                  <CardHeader
                    title="Recommended lead jurisdiction"
                    tech="routing score · earliest FIR, victim count, where the hub was first seen"
                    right={
                      routed ? (
                        <Chip tone="moss" dot>
                          Routed
                        </Chip>
                      ) : (
                        <Chip tone="ember" dot>
                          Recommendation
                        </Chip>
                      )
                    }
                  />
                  <div className="grid grid-cols-1 gap-5 px-5 pt-3 md:grid-cols-[1fr_1.1fr]">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="k-num grid size-12 place-items-center rounded-xl border border-ember/50 bg-ember/10 text-[16px] text-ember">RJ</span>
                        <div>
                          <div className="k-num text-[20px] leading-tight text-text">Rajasthan</div>
                          <div className="text-[13.5px] text-muted">Cyber PS Jaipur · lead score 0.86</div>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-3">
                        {[
                          { icon: <CalendarClock />, t: 'Earliest FIR', d: 'FIR 0241/2026 · 12 Aug, a day after the hub appeared', w: 0.35 },
                          { icon: <Users />, t: 'Most victims', d: '9 of 38 complaints are from Rajasthan', w: 0.4 },
                          { icon: <MapPin />, t: 'Hub first seen in a Jaipur complaint', d: 'collection wallet TNh8yW…K9pR · 11 Aug', w: 0.25 },
                        ].map((r) => (
                          <li key={r.t} className="flex gap-3">
                            <IconTile size={30}>{r.icon}</IconTile>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[14px] text-text">{r.t}</span>
                                <span className="k-num text-[12.5px] text-muted">{Math.round(r.w * 100)}%</span>
                              </div>
                              <div className="text-[12px] text-dim">{r.d}</div>
                              <Meter value={r.w} max={0.4} tone="ember" height={3} className="mt-1.5" />
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 text-[12px] text-dim">Next best: Kerala (5 victims) · score 0.41</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[12.5px] text-muted">
                        <span>Routing plan</span>
                        <span className="k-num">
                          {Math.min(Math.max(routeStep - 1, 0), ROUTING_STEPS.length)}/{ROUTING_STEPS.length}
                        </span>
                      </div>
                      <Progress
                        value={(Math.min(Math.max(routeStep - 1, 0), ROUTING_STEPS.length) / ROUTING_STEPS.length) * 100}
                        className={cn('mt-2 h-1.5 bg-white/[0.06]', routed && '[&>div]:bg-moss')}
                      />
                      <ol className="mt-3 space-y-2">
                        {ROUTING_STEPS.map((s, i) => {
                          const done = routeStep > i + 1
                          const active = routeStep === i + 1
                          return (
                            <motion.li
                              key={s.t}
                              animate={{ borderColor: done ? toneA('moss', 0.3) : active ? toneA('ember', 0.4) : 'rgba(255,255,255,0.07)' }}
                              className="flex items-start gap-3 rounded-xl border bg-white/[0.015] px-3 py-2"
                            >
                              <span
                                className={cn(
                                  'k-num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[12px]',
                                  done ? 'border-moss/50 bg-moss/15 text-moss' : active ? 'border-ember/50 text-ember' : 'border-line-2 text-dim',
                                )}
                              >
                                {done ? <Check className="size-3" strokeWidth={3} /> : active ? <Loader2 className="size-3 animate-spin" /> : i + 1}
                              </span>
                              <div className="min-w-0">
                                <div className={cn('text-[13.5px]', done ? 'text-text' : 'text-muted')}>{s.t}</div>
                                <div className="text-[12px] text-dim">{s.d}</div>
                              </div>
                            </motion.li>
                          )
                        })}
                      </ol>
                    </div>
                  </div>

                  <div className="mx-5 mt-4">
                    <AnimatePresence mode="wait">
                      {routed ? (
                        <motion.div
                          key="done"
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-moss/30 bg-moss/[0.06] px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <IconTile tone="moss">
                              <Share2 />
                            </IconTile>
                            <div>
                              <div className="text-[14.5px] text-text">Merged into ANV-SYN07-M01 and routed to I4C</div>
                              <div className="text-[12.5px] text-muted">Lead: Cyber PS Jaipur · 1 notice to Meridian queued · 10 states will receive the reply</div>
                            </div>
                          </div>
                          <Button size="sm" variant="quiet" onClick={() => setRouteStep(0)}>
                            <RotateCcw /> Reset demo
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div key="cta" exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-between gap-3">
                          <p className="max-w-md text-[12px] leading-relaxed text-dim">
                            The consolidated notice is a <span className="text-gold">draft for officer review — not legal advice</span>. It cites BNSS §94{' '}
                            <span className="text-gold">(section reference to be verified)</span>. Every state keeps its own FIR number.
                          </p>
                          <Button variant="ember" onClick={mergeAndRoute} disabled={routing}>
                            {routing ? <Loader2 className="animate-spin" /> : <GitMerge />}
                            {routing ? 'Routing…' : 'Merge & route'}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Card>

                <Card className="h-full pb-5">
                  <CardHeader title="What merging saves" tech="estimate · per-notice effort from cyber-cell time logs (illustrative)" />
                  <div className="px-5 pt-3">
                    <div className="flex flex-wrap items-end gap-6">
                      <div>
                        <Stat value={10} className="text-[34px] leading-none text-text" />
                        <div className="mt-1 text-[12.5px] text-muted">duplicate notices avoided</div>
                      </div>
                      <div>
                        <Stat value={240} prefix="~" className="text-[34px] leading-none text-moss" />
                        <div className="mt-1 text-[12.5px] text-muted">officer-hours saved</div>
                      </div>
                    </div>
                    <div className="mt-5 space-y-3">
                      {[
                        { k: 'Drafting notices', d: '10 × 6 h', h: 60 },
                        { k: 'Chasing the exchange for replies', d: '10 × 9 h', h: 90 },
                        { k: 'Re-collecting the same evidence', d: '10 × 9 h', h: 90 },
                      ].map((r) => (
                        <div key={r.k}>
                          <div className="flex items-baseline justify-between text-[13.5px]">
                            <span className="text-text">{r.k}</span>
                            <span className="text-muted">
                              <span className="text-dim">{r.d} = </span>
                              <span className="k-num text-text">{r.h} h</span>
                            </span>
                          </div>
                          <Meter value={r.h} max={90} tone="moss" height={4} className="mt-1.5" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                        <div className="text-[12px] text-dim">Notices to Meridian</div>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="k-num text-[16px] text-dim line-through">11</span>
                          <span className="k-num text-[20px] text-text">1</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[12px] text-dim">
                          <Landmark className="size-3" /> Exchange reply
                        </div>
                        <div className="mt-0.5 text-[13.5px] text-text">One file, all 38 victims</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

/* ───────── India tile cartogram ───────── */
function IndiaTiles({ selected, onSelect }: { selected: string | null; onSelect: (code: string) => void }) {
  const cols = Math.max(...TILES.map((t) => t.c)) + 1
  const rows = Math.max(...TILES.map((t) => t.r)) + 1
  return (
    <div className="mx-auto w-full max-w-[340px] shrink-0 md:mx-0 md:w-[300px]">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
        {TILES.map((t) => {
          const n = COMPLAINTS[t.code] ?? 0
          const v = n / MAX_COMPLAINTS
          const sel = selected === t.code
          const lead = t.code === 'RJ'
          const firCount = FIRS.filter((f) => f.state === t.code).length
          return (
            <Tooltip key={t.code}>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={() => onSelect(t.code)}
                  aria-label={`${t.name}: ${n} complaints`}
                  aria-pressed={sel}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + (t.r + t.c) * 0.03, duration: 0.3 }}
                  whileHover={{ scale: 1.08 }}
                  className={cn(
                    'relative grid aspect-square place-items-center rounded-[8px] border text-center outline-none',
                    sel ? 'border-white/70' : lead ? 'border-ember/60' : 'border-white/[0.06]',
                  )}
                  style={{
                    gridRow: t.r + 1,
                    gridColumn: t.c + 1,
                    background: n ? toneA('sky', 0.12 + v * 0.7) : 'rgba(255,255,255,0.035)',
                    boxShadow: n ? `0 0 ${6 + v * 16}px ${toneA('sky', 0.18 + v * 0.4)}` : undefined,
                    zIndex: sel ? 2 : 1,
                  }}
                >
                  <span className={cn('k-num text-[12px] leading-none', n ? 'text-white' : 'text-dim')}>{t.code}</span>
                  {n > 0 && <span className="absolute bottom-[3px] text-[8.5px] leading-none text-white/75">{n}</span>}
                  {CLUSTER_STATES.has(t.code) && (
                    <span className="absolute right-[3px] top-[3px] size-1.5 rounded-full bg-crimson" style={{ boxShadow: `0 0 6px ${toneHex('crimson')}` }} />
                  )}
                </motion.button>
              </TooltipTrigger>
              <TooltipContent
                sideOffset={6}
                className="border border-line-2 bg-[var(--k-pop)] text-text [&_[data-slot=tooltip-arrow]]:bg-[var(--k-pop)] [&_[data-slot=tooltip-arrow]]:fill-[var(--k-pop)]"
              >
                <div className="text-[13.5px] font-medium">{t.name}</div>
                <div className="text-[12.5px] text-muted">
                  {n ? `${n} SYN-07 complaint${n === 1 ? '' : 's'} · ${firCount} FIR${firCount === 1 ? '' : 's'}` : 'No complaints from this syndicate'}
                </div>
                {CLUSTER_STATES.has(t.code) && <div className="text-[12px] text-crimson">Has a FIR in duplicate cluster A</div>}
                {lead && <div className="text-[12px] text-ember">Recommended lead jurisdiction</div>}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
