import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Eye, Filter, Info, Orbit, RotateCcw, ScanSearch, ShieldAlert, ShieldCheck, Sparkles, Waypoints } from 'lucide-react'
import {
  Address,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  IconTile,
  PageHeader,
  Reveal,
  toneA,
  toneHex,
} from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { CASE } from '@/data/demo'
import { cn } from '@/lib/utils'
import { DiffusionGraph, useDiffusionStage } from './riskdiffusion/DiffusionGraph'
import {
  DEFAULTS,
  DUST,
  EDGES,
  FLAG_AT,
  LISTS,
  NODE,
  NODES,
  WATCH_AT,
  diffuse,
  verdictOf,
  type DNode,
  type ListKey,
  type PathHit,
} from './riskdiffusion/data'

const shortName = (id: string) => {
  const n = NODE[id]
  if (n.kind === 'listed') return `List ${n.label.slice(-1)}`
  if (n.hop) return n.hop
  return n.label.replace(' wallet', '')
}

const listLabel = (k?: ListKey) => LISTS.find((l) => l.key === k)?.label ?? ''

export default function RiskDiffusionPage() {
  const [decay, setDecay] = React.useState(DEFAULTS.decay)
  const [maxHops, setMaxHops] = React.useState(DEFAULTS.maxHops)
  const [ignoreDust, setIgnoreDust] = React.useState(DEFAULTS.ignoreDust)
  const [lists, setLists] = React.useState<Set<ListKey>>(() => new Set<ListKey>(['ofac', 'un', 'domestic']))
  const [selected, setSelected] = React.useState('W4')
  const [runId, setRunId] = React.useState(0)
  const stage = useDiffusionStage(runId)
  const running = stage < Math.min(4, maxHops)

  const params = React.useMemo(() => ({ decay, maxHops, ignoreDust, lists }), [decay, maxHops, ignoreDust, lists])
  const result = React.useMemo(() => diffuse(params), [params])

  const rows = React.useMemo(() => {
    return NODES.map((n) => {
      const listed = n.kind === 'listed' && !!n.list && lists.has(n.list)
      const risk = result.risk[n.id]
      const v = verdictOf(risk, listed)
      return { n, listed, risk, v, hops: result.hops[n.id], best: result.paths[n.id][0] as PathHit | undefined }
    }).sort((a, b) => (a.listed !== b.listed ? (a.listed ? -1 : 1) : b.risk - a.risk))
  }, [result, lists])

  const caught = rows.filter((r) => !r.listed && r.v.key === 'flag').length
  const exactHits = rows.filter((r) => r.listed).length
  const reached = rows.filter((r) => !r.listed && r.risk > 0).length
  const dustEdges = EDGES.filter((e) => e.share < DUST).length
  const changed = decay !== DEFAULTS.decay || maxHops !== DEFAULTS.maxHops || ignoreDust !== DEFAULTS.ignoreDust || lists.size !== 3

  const toggleList = (k: ListKey) =>
    setLists((s) => {
      const next = new Set(s)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  const reset = () => {
    setDecay(DEFAULTS.decay)
    setMaxHops(DEFAULTS.maxHops)
    setIgnoreDust(DEFAULTS.ignoreDust)
    setLists(new Set<ListKey>(['ofac', 'un', 'domestic']))
    setRunId((r) => r + 1)
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <DemoChip /> <span>Screening · graph diffusion</span>
            </>
          }
          title="Sanctions-proximity risk"
          tech="Normal screening only asks “is this exact wallet on a list?” — one in-between shell wallet defeats it. ANVESHAK spreads risk outward from listed addresses through the money trail, fading with every hop and with how much value actually flowed, so “one wallet away” layering is caught. · risk diffusion over the transaction graph"
          actions={
            <>
              <span className="k-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-muted">
                <ShieldCheck className="size-3.5 text-moss" /> Lists refreshed 03 Oct 2026
              </span>
              <Button variant="ember" onClick={() => setRunId((r) => r + 1)}>
                <RotateCcw /> Re-run diffusion
              </Button>
            </>
          }
        />
      </Reveal>

      {/* ── Stat tiles ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal delay={0.05}>
          <Card variant="speckle" grain className="h-[124px] p-4">
            <div className="relative flex items-start justify-between">
              <div className="text-[14px] text-text">Caught only by diffusion</div>
              <IconTile tone="crimson" size={30}>
                <ScanSearch />
              </IconTile>
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-2">
              <div className="k-num text-[30px] leading-none text-crimson">
                <SlidingNumber number={caught} />
              </div>
              <span className="text-right text-[12px] leading-snug text-dim">
                exact-match screening
                <br />
                said <span className="text-moss">Clear</span>
              </span>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card variant="speckle" grain className="h-[124px] p-4">
            <div className="relative flex items-start justify-between">
              <div className="text-[14px] text-text">Exact-match hits</div>
              <IconTile size={30}>
                <ShieldAlert />
              </IconTile>
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-2">
              <div className="k-num text-[30px] leading-none text-text">
                <SlidingNumber number={exactHits} />
              </div>
              <span className="text-right text-[12px] leading-snug text-dim">
                wallets literally on
                <br />
                a selected list
              </span>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card variant="speckle" grain className="h-[124px] p-4">
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-[14px] text-text">Pass-through wallet 4</div>
                <div className="text-[11.5px] text-dim">hop B5 · {CASE.id}</div>
              </div>
              <Chip tone="moss" dot>
                Exact match: Clear
              </Chip>
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-2">
              <div className="k-num text-[30px] leading-none" style={{ color: toneHex(result.risk.W4 >= FLAG_AT ? 'crimson' : result.risk.W4 >= WATCH_AT ? 'ember' : 'white') }}>
                <SlidingNumber number={result.risk.W4} decimalPlaces={2} />
              </div>
              <span className="text-right text-[12px] leading-snug text-dim">
                diffused risk ·
                <br />
                {result.hops.W4 ?? '—'} hops from a list
              </span>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.2}>
          <Card variant="speckle" grain className="h-[124px] p-4">
            <div className="relative flex items-start justify-between">
              <div className="text-[14px] text-text">Wallets reached</div>
              <IconTile size={30}>
                <Waypoints />
              </IconTile>
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-2">
              <div className="k-num flex items-baseline text-[30px] leading-none text-text">
                <SlidingNumber number={reached} />
                <span className="ml-1 text-[15.5px] text-dim">/ {NODES.length - 3}</span>
              </div>
              <span className="text-right text-[12px] leading-snug text-dim">
                within {maxHops} hop{maxHops > 1 ? 's' : ''}
                <br />
                at decay {decay.toFixed(2)}
              </span>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── Graph + controls + worked example ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Reveal delay={0.1}>
          <Card variant="glass" className="h-full pb-4">
            <CardHeader
              title="Risk ripple from listed addresses"
              tech="ring = hops away · node glow = diffused risk · line width = share of value that flowed · click any wallet"
              icon={<Orbit className="size-4" />}
              right={
                running ? (
                  <Chip tone="crimson" dot pulse>
                    Spreading · hop {Math.max(0, stage)}
                  </Chip>
                ) : (
                  <Chip tone="moss" dot>
                    Diffusion complete
                  </Chip>
                )
              }
            />
            <div className="px-2 pt-2 sm:px-5">
              <DiffusionGraph params={params} result={result} selected={selected} onSelect={setSelected} runId={runId} stage={stage} />
            </div>
            <div className="mx-5 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
              <Legend swatch={<span className="size-2.5 rounded-full" style={{ background: toneHex('crimson'), boxShadow: `0 0 8px ${toneA('crimson', 0.7)}` }} />} label="Listed address" />
              <Legend swatch={<span className="size-2.5 rounded-full border" style={{ borderColor: toneHex('teal') }} />} label="Wallet on this case's trail" />
              <Legend swatch={<span className="size-2.5 rounded-full border" style={{ borderColor: toneHex('gold') }} />} label="Exchange wallet" />
              <Legend swatch={<span className="h-px w-4 border-t border-dashed border-white/40" />} label="Dust transfer (< 1%)" />
              <span className="ml-auto text-dim">numbers = diffused risk, 0–1</span>
            </div>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-3">
          <Reveal delay={0.15}>
            <Card className="pb-4">
              <CardHeader
                title="Tune the diffusion"
                tech="every change recomputes the graph and the table"
                icon={<Filter className="size-4" />}
                right={
                  changed ? (
                    <button type="button" onClick={reset} className="k-btn-ghost inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px]">
                      <RotateCcw className="size-3" /> Defaults
                    </button>
                  ) : (
                    <Chip tone="neutral">Defaults</Chip>
                  )
                }
              />
              <div className="mt-3 space-y-4 px-5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="rd-decay" className="text-[14px] text-text">
                      How fast risk fades per hop <span className="text-[12px] text-dim">· decay</span>
                    </label>
                    <span className="k-num text-[18px] text-text">{decay.toFixed(2)}</span>
                  </div>
                  <input
                    id="rd-decay"
                    type="range"
                    min={0.2}
                    max={0.8}
                    step={0.05}
                    value={decay}
                    onChange={(e) => setDecay(Number(e.target.value))}
                    className="mt-1.5 w-full accent-[var(--k-ember)]"
                  />
                  <div className="flex justify-between text-[12px] text-dim">
                    <span>0.2 · fades fast</span>
                    <span>0.8 · travels far</span>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[14px] text-text">
                      How far to look <span className="text-[12px] text-dim">· max hops</span>
                    </span>
                    <span className="text-[12px] text-dim">beyond this, risk is ignored</span>
                  </div>
                  <Tabs value={String(maxHops)} onValueChange={(v) => setMaxHops(Number(v))}>
                    <TabsList className="h-8 w-full border border-line bg-white/[0.04]" aria-label="Maximum hops">
                      {[1, 2, 3, 4].map((h) => (
                        <TabsTrigger key={h} value={String(h)} className="h-full text-[13.5px] text-muted data-[state=active]:text-text">
                          {h} hop{h > 1 ? 's' : ''}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <span>
                    <span className="block text-[14px] text-text">
                      Ignore dust below 1% <span className="text-[12px] text-dim">· minimum value-share</span>
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-dim">
                      {ignoreDust
                        ? `${dustEdges} tiny transfers ignored — they can't taint a wallet.`
                        : `${dustEdges} tiny transfers counted — "dusting" can taint innocent wallets.`}
                    </span>
                  </span>
                  <Switch
                    checked={ignoreDust}
                    onCheckedChange={setIgnoreDust}
                    aria-label="Ignore dust transfers below 1%"
                    className="mt-0.5 data-[state=checked]:bg-ember data-[state=unchecked]:bg-white/10"
                  />
                </label>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-[14px] text-text">
                      Spread from these lists <span className="text-[12px] text-dim">· list types</span>
                    </span>
                    <span className="text-[12px] text-dim">entries are synthetic</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LISTS.map((l) => {
                      const on = lists.has(l.key)
                      return (
                        <button
                          key={l.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleList(l.key)}
                          title={l.tech}
                          className={cn(
                            'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] transition-colors',
                            on ? 'border-crimson/40 bg-crimson/[0.12] text-text' : 'border-line-2 bg-white/[0.02] text-dim hover:text-muted',
                          )}
                        >
                          <span className={cn('grid size-3.5 place-items-center rounded-full', on ? 'bg-crimson text-white' : 'border border-line-2')}>
                            {on && <Check className="size-2.5" strokeWidth={3} />}
                          </span>
                          {l.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.2} className="flex-1">
            <WorkedExample node={NODE[selected]} decay={decay} result={result} listed={NODE[selected].kind === 'listed' && !!NODE[selected].list && lists.has(NODE[selected].list!)} />
          </Reveal>
        </div>
      </div>

      {/* ── Comparison table ── */}
      <Reveal delay={0.1}>
        <Card className="pb-3">
          <CardHeader
            title="Exact-match screening vs diffusion"
            tech="same wallets, two methods · red rows are wallets only diffusion catches · click a row to see its arithmetic"
            right={
              <Chip tone="crimson" dot pulse={caught > 0}>
                Caught only by diffusion: {caught}
              </Chip>
            }
          />
          <div className="k-scroll overflow-x-auto px-3 pt-3">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-[0.08em] text-dim">
                  <th className="px-2 pb-2 font-normal">Wallet</th>
                  <th className="px-2 pb-2 font-normal">Exact-match result</th>
                  <th className="px-2 pb-2 font-normal">Diffused risk</th>
                  <th className="px-2 pb-2 font-normal">Hops to a list</th>
                  <th className="px-2 pb-2 font-normal">Strongest path</th>
                  <th className="px-2 pb-2 text-right font-normal">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const onlyDiff = !r.listed && r.v.key === 'flag'
                  const sel = selected === r.n.id
                  return (
                    <motion.tr
                      layout
                      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                      key={r.n.id}
                      onClick={() => setSelected(r.n.id)}
                      className={cn(
                        'cursor-pointer border-t border-line text-[13.5px] transition-colors',
                        onlyDiff ? 'bg-crimson/[0.07] hover:bg-crimson/[0.1]' : 'hover:bg-white/[0.025]',
                        sel && 'outline outline-1 -outline-offset-1 outline-white/25',
                      )}
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelected(r.n.id)
                            }}
                            className="min-w-0 text-left"
                            aria-label={`Show arithmetic for ${r.n.label}`}
                          >
                            <div className="flex items-center gap-1.5 text-[13.5px] text-text">
                              {r.n.hop && (
                                <span className="k-mono rounded px-1 text-[11.5px]" style={{ color: toneHex('teal'), background: toneA('teal', 0.1) }}>
                                  {r.n.hop}
                                </span>
                              )}
                              {r.n.label}
                              {r.n.kind === 'listed' && <span className="text-[11.5px] text-dim">· {listLabel(r.n.list)}</span>}
                            </div>
                          </button>
                        </div>
                        <Address addr={r.n.addr} chain={r.n.chain} className="text-[12.5px]" />
                      </td>
                      <td className="px-2 py-2">
                        {r.listed ? (
                          <Chip tone="crimson" solid>
                            Match
                          </Chip>
                        ) : (
                          <Chip tone="moss" dot>
                            Clear
                          </Chip>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div
                              className="absolute inset-y-0 left-0 rounded-full"
                              initial={false}
                              animate={{ width: `${r.risk * 100}%` }}
                              transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                              style={{ background: toneHex(r.risk >= FLAG_AT ? 'crimson' : r.risk >= WATCH_AT ? 'ember' : 'neutral') }}
                            />
                          </div>
                          <span className={cn('k-num w-9 text-[14px]', r.risk >= FLAG_AT ? 'text-crimson' : r.risk >= WATCH_AT ? 'text-ember' : 'text-muted')}>{r.risk.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-[13.5px]">
                        {r.listed ? <span className="text-dim">on list</span> : r.hops === null ? <span className="text-dim">—</span> : <span className="k-num text-text">{r.hops}</span>}
                      </td>
                      <td className="px-2 py-2 text-[12.5px] text-muted">
                        {r.listed ? (
                          <span className="text-dim">seed · {listLabel(r.n.list)}</span>
                        ) : r.best ? (
                          <span className="k-mono">{r.best.nodes.map(shortName).join(' → ')}</span>
                        ) : (
                          <span className="text-dim">no path within {maxHops} hop{maxHops > 1 ? 's' : ''}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Chip tone={r.v.tone} dot={r.v.key !== 'none'} solid={r.v.key === 'listed'}>
                          {r.v.label}
                        </Chip>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-3 text-[12px] text-dim">
            <span>Flag for review ≥ {FLAG_AT.toFixed(2)}</span>
            <span>· Watch ≥ {WATCH_AT.toFixed(2)}</span>
            <span>· thresholds tuned on synthetic data — illustrative</span>
            <span>· exact-match = literal address on a selected list</span>
          </div>
        </Card>
      </Reveal>

      {/* ── Formula + honesty ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr]">
        <Reveal delay={0.1}>
          <FormulaCard decay={decay} maxHops={maxHops} />
        </Reveal>
        <Reveal delay={0.15}>
          <HonestyCard params={params} />
        </Reveal>
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  )
}

/* ───────── Worked example for the selected wallet ───────── */
function WorkedExample({ node, decay, result, listed }: { node: DNode; decay: number; result: ReturnType<typeof diffuse>; listed: boolean }) {
  const paths = result.paths[node.id]
  const shown = paths.slice(0, 3)
  const rest = paths.slice(3)
  const restSum = rest.reduce((a, p) => a + p.contrib, 0)
  const raw = paths.reduce((a, p) => a + p.contrib, 0)
  const risk = result.risk[node.id]
  const v = verdictOf(risk, listed)
  return (
    <Card className="h-full pb-4">
      <CardHeader
        title="Worked example"
        tech="the exact arithmetic behind one wallet's score"
        icon={<Sparkles className="size-4" />}
        right={
          <Chip tone={v.tone} dot solid={v.key === 'listed'}>
            {v.label}
          </Chip>
        }
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="mt-3 px-5"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14.5px] text-text">
              {node.hop ? `${node.hop} · ` : ''}
              {node.label}
            </span>
            <Address addr={node.addr} chain={node.chain} className="text-[12.5px]" />
          </div>

          {node.kind === 'listed' ? (
            <p className="mt-3 rounded-xl border border-line bg-white/[0.02] p-3 text-[13.5px] leading-relaxed text-muted">
              {listed ? (
                <>
                  This address sits on the <span className="text-text">{listLabel(node.list)}</span> list (synthetic entry). It is a <span className="text-crimson">seed</span>: its risk is fixed at{' '}
                  <span className="k-num text-text">1.00</span> and spreads outward from here.
                </>
              ) : (
                <>
                  The <span className="text-text">{listLabel(node.list)}</span> list is switched off, so this address seeds no risk. Turn the list back on to include it.
                </>
              )}
            </p>
          ) : paths.length === 0 ? (
            <p className="mt-3 rounded-xl border border-line bg-white/[0.02] p-3 text-[13.5px] leading-relaxed text-muted">
              No path from a selected list reaches this wallet within the current hop limit
. Its diffused risk is <span className="k-num text-text">0.00</span>.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {shown.map((p, i) => (
                <div key={i} className="rounded-xl border border-line bg-white/[0.02] px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1 text-[12.5px] text-muted">
                    <span className="text-dim">Path {i + 1}</span>
                    {p.nodes.map((id, j) => (
                      <React.Fragment key={id}>
                        {j > 0 && <span className="text-dim">→</span>}
                        <span className={cn('rounded px-1', NODE[id].kind === 'listed' ? 'bg-crimson/15 text-crimson' : 'text-text/85')}>{shortName(id)}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="k-mono mt-1 flex flex-wrap items-baseline gap-x-1 text-[13.5px] text-text/90">
                    <span className="text-crimson">1.0</span>
                    <span className="text-dim">×</span>
                    <span className="text-ember">
                      {decay.toFixed(2)}
                      <sup className="text-[10.5px]">{p.hops}</sup>
                    </span>
                    <span className="text-dim">×</span>
                    <span className="text-teal">({p.shares.map((s) => s.toFixed(2)).join(' × ')})</span>
                    <span className="text-dim">=</span>
                    <span className="k-num text-[14.5px] text-text">{p.contrib.toFixed(3)}</span>
                  </div>
                </div>
              ))}
              {rest.length > 0 && (
                <div className="px-1 text-[12.5px] text-dim">
                  + {rest.length} smaller path{rest.length > 1 ? 's' : ''} adding {restSum.toFixed(3)}
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-2.5">
                <span className="text-[13.5px] text-muted">
                  Sum of all paths{raw > 1 ? ' (capped at 1.00)' : ''}
                </span>
                <span className="k-num text-[24px] leading-none" style={{ color: toneHex(v.tone === 'neutral' ? 'white' : v.tone) }}>
                  {risk.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-dim">
                <span><span className="text-crimson">■</span> seed</span>
                <span><span className="text-ember">■</span> decay<sup>hops</sup></span>
                <span><span className="text-teal">■</span> value-share at each hop</span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}

/* ───────── Formula explainer ───────── */
function FormulaCard({ decay, maxHops }: { decay: number; maxHops: number }) {
  const mult = [1, 2, 3, 4].map((h) => Math.pow(decay, h))
  return (
    <Card className="h-full pb-5">
      <CardHeader title="How the score is built" tech="graph risk diffusion · no black box — three numbers, multiplied, summed over paths" icon={<Info className="size-4" />} />
      <div className="mt-3 px-5">
        <div className="k-grid-bg overflow-x-auto rounded-xl border border-line px-4 py-4">
          <div className="k-mono whitespace-nowrap text-center text-[16.5px] text-text md:text-[17px]">
            risk(w) = <span className="text-dim">Σ</span>
            <sub className="text-[11.5px] text-dim">paths</sub> <span className="text-crimson">seed</span> <span className="text-dim">×</span>{' '}
            <span className="text-ember">
              decay<sup className="text-[11.5px]">hops</sup>
            </span>{' '}
            <span className="text-dim">×</span> <span className="text-teal">value-share</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { k: 'seed', tone: 'crimson' as const, title: 'Where risk starts', body: 'A wallet literally on a list gets 1.0. Nothing else starts with any risk.' },
            { k: 'decay^hops', tone: 'ember' as const, title: 'Fades every hop', body: `Each in-between wallet multiplies risk by ${decay.toFixed(2)}. Two hops away keeps ${(decay * decay * 100).toFixed(0)}%.` },
            { k: 'value-share', tone: 'teal' as const, title: 'Follows the money', body: 'Share of the listed money that actually flowed along that path — a 0.4% payment barely counts.' },
          ].map((f) => (
            <div key={f.k} className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="k-mono text-[12.5px]" style={{ color: toneHex(f.tone) }}>
                {f.k}
              </div>
              <div className="mt-1 text-[14px] text-text">{f.title}</div>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[14px] text-text">Risk kept after each hop</div>
            <div className="text-[12px] text-dim">decay<sup>hops</sup> at decay {decay.toFixed(2)} · greyed hops are beyond the limit</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {mult.map((m, i) => {
            const on = i + 1 <= maxHops
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="relative h-[110px] w-full max-w-[56px] overflow-hidden rounded-[9px] bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                  <motion.div
                    className="absolute inset-x-0 bottom-0 rounded-[9px]"
                    initial={false}
                    animate={{ height: `${m * 100}%`, opacity: on ? 1 : 0.35 }}
                    transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                    style={{
                      background: on ? `linear-gradient(180deg, ${toneHex('ember')} 0%, ${toneA('ember', 0.45)} 30%, rgba(255,255,255,0.03) 100%)` : 'rgba(255,255,255,0.12)',
                      boxShadow: on ? `0 -6px 18px ${toneA('ember', 0.4)}` : undefined,
                    }}
                  />
                </div>
                <div className="k-num mt-1.5 text-[14.5px] text-text">{(m * 100).toFixed(m < 0.1 ? 1 : 0)}%</div>
                <div className="text-[12px] text-dim">hop {i + 1}</div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ───────── Honest limits ───────── */
function HonestyCard({ params }: { params: Parameters<typeof diffuse>[0] }) {
  const hot = React.useMemo(() => diffuse({ ...params, maxHops: 4 }).risk.G1, [params])
  const dust = React.useMemo(() => diffuse({ ...params, ignoreDust: false }).risk.K1, [params])
  const items = [
    {
      icon: <Eye />,
      tone: 'sky' as const,
      title: 'A lead for review, not a sanctions determination',
      body: 'A high score means “look closer”. Only an exact match on an official list is a sanctions hit — an officer decides what a flag means and notes it in the file.',
    },
    {
      icon: <Orbit />,
      tone: 'ember' as const,
      title: 'Decay stops “six degrees” false positives',
      body: `Everything is connected to everything eventually. Even counting 4 hops, the Meridian hot wallet scores only ${hot.toFixed(2)} — it handles thousands of strangers' deposits and should not be flagged.`,
    },
    {
      icon: <Filter />,
      tone: 'teal' as const,
      title: 'Dust is ignored on purpose',
      body: `Criminals send tiny amounts from listed wallets to innocent ones to poison screening ("dusting"). Transfers under 1% of an outflow are dropped; even if counted, the Kestrel hot wallet would score just ${dust.toFixed(3)} — yet hop-count screening would call it “1 hop from a listed address”.`,
    },
  ]
  return (
    <Card variant="glass" className="h-full pb-5">
      <CardHeader title="What this score is — and isn't" tech="honest limits · read before acting on a flag" icon={<ShieldCheck className="size-4" />} right={<Chip tone="sky">Lead, not verdict</Chip>} />
      <ul className="mt-3 space-y-2 px-4">
        {items.map((it) => (
          <li key={it.title} className="flex gap-3 rounded-xl border border-line bg-white/[0.015] px-3 py-2.5">
            <IconTile tone={it.tone} size={32}>
              {it.icon}
            </IconTile>
            <div className="min-w-0">
              <div className="text-[14px] text-text">{it.title}</div>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{it.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mx-5 mt-3 text-[12px] leading-relaxed text-dim">
        Listed addresses here are synthetic stand-ins for each list type. In production the seeds come from the official list files, refreshed daily, and each list's seed weight is set by policy.
      </p>
    </Card>
  )
}
