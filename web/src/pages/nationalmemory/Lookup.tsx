import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, Check, Database, History, Link2, Loader2, MapPin, Search, Sprout, Users } from 'lucide-react'
import { Address, Button, Card, CardHeader, Chip, FlowGraph, toneA, toneHex } from '@/components/kit'
import { Progress, ProgressIndicator } from '@/components/animate-ui/primitives/radix/progress'
import { cn } from '@/lib/utils'
import { LOOKUPS, LOOKUP_STEPS, UNKNOWN, type Lookup } from './data'

type Phase = 'idle' | 'searching' | 'done'

function resolve(addr: string): Lookup {
  const a = addr.trim()
  const hit = LOOKUPS.find((l) => l.addr.toLowerCase() === a.toLowerCase())
  if (hit) return hit
  const base = LOOKUPS.find((l) => l.addr === UNKNOWN)!
  return { ...base, addr: a }
}

export function MemoryLookup() {
  const [value, setValue] = React.useState(LOOKUPS[0].addr)
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [step, setStep] = React.useState(0)
  const [result, setResult] = React.useState<Lookup | null>(null)
  const timer = React.useRef<number | null>(null)
  const inputId = React.useId()

  React.useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])

  const check = (addr = value) => {
    if (!addr.trim()) return
    if (timer.current) window.clearInterval(timer.current)
    setPhase('searching')
    setStep(0)
    let i = 0
    timer.current = window.setInterval(() => {
      i += 1
      setStep(i)
      if (i >= LOOKUP_STEPS.length) {
        if (timer.current) window.clearInterval(timer.current)
        timer.current = null
        setResult(resolve(addr))
        setPhase('done')
      }
    }, 340)
  }

  const pct = phase === 'idle' ? 0 : phase === 'done' ? 100 : (step / LOOKUP_STEPS.length) * 100

  return (
    <Card variant="glass" className="pb-5">
      <CardHeader
        title="Submit a wallet — has any unit in India seen it before?"
        tech="national memory lookup · exact match + connected wallets within 3 hops · every lookup is logged"
        right={phase === 'done' && result ? <MatchChip r={result} /> : <Chip tone="neutral">SAHYOG · I4C</Chip>}
      />
      <div className="mt-3 grid grid-cols-1 gap-4 px-5 lg:grid-cols-[340px_1fr]">
        {/* ── input side ── */}
        <div className="min-w-0">
          <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] text-dim">
            Wallet address from the complaint
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              check()
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-[#18181a] px-3 focus-within:border-ember/60">
              <Search className="size-4 shrink-0 text-dim" />
              <input
                id={inputId}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="k-mono min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-dim"
                placeholder="T… or 0x…"
              />
            </div>
            <Button type="submit" variant="ember" disabled={phase === 'searching' || !value.trim()}>
              {phase === 'searching' ? <Loader2 className="animate-spin" /> : <Database />} Check national memory
            </Button>
          </form>
          <div className="mt-3 text-[12.5px] text-dim">Try a sample</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LOOKUPS.map((l) => (
              <button
                key={l.addr}
                type="button"
                onClick={() => {
                  setValue(l.addr)
                  check(l.addr)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors',
                  value === l.addr ? 'border-line-2 bg-white/[0.07] text-text' : 'border-line text-muted hover:bg-white/[0.04] hover:text-text',
                )}
              >
                <span className="size-1.5 rounded-full" style={{ background: toneHex(l.match === 'unknown' ? 'neutral' : l.match === 'connected' ? 'ember' : 'crimson') }} />
                {l.chip}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Progress value={pct} className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <ProgressIndicator className="h-full w-full rounded-full" style={{ background: `linear-gradient(90deg, ${toneA('ember', 0.4)}, ${toneHex('ember')})`, boxShadow: `0 0 10px ${toneA('ember', 0.55)}` }} />
            </Progress>
            <ul className="mt-2.5 space-y-1.5">
              {LOOKUP_STEPS.map((s, i) => {
                const done = phase === 'done' || (phase === 'searching' && i < step)
                const active = phase === 'searching' && i === step
                return (
                  <li key={s} className={cn('flex items-center gap-2 text-[13px] transition-colors', done ? 'text-text/85' : active ? 'text-text' : 'text-dim')}>
                    <span className={cn('grid size-4 place-items-center rounded-full border', done ? 'border-moss/40 bg-moss/15 text-moss' : active ? 'border-ember/50 text-ember' : 'border-line-2')}>
                      {done ? <Check className="size-2.5" strokeWidth={3} /> : active ? <Loader2 className="size-2.5 animate-spin" /> : null}
                    </span>
                    {s}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* ── result side ── */}
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {phase !== 'done' || !result ? (
              <motion.div key={phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="k-dashed grid h-full min-h-[240px] place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-full border border-line-2 text-muted">
                    {phase === 'searching' ? <Loader2 className="size-5 animate-spin text-ember" /> : <Database className="size-5" />}
                  </span>
                  <p className="mx-auto mt-3 max-w-sm text-[14px] text-muted">
                    {phase === 'searching' ? (
                      'Searching every wallet any unit has ever submitted…'
                    ) : (
                      <>
                        Press <span className="text-text">Check national memory</span>. If any of 612 units has met this wallet — or a wallet it paid — you’ll know in
                        under a second.
                      </>
                    )}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={result.addr} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                <ResultCard r={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {phase === 'done' && result && (
          <motion.div key={result.addr} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden">
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line px-5 pt-4 xl:grid-cols-[1fr_1.45fr]">
              <Provenance r={result} />
              {result.match === 'unknown' ? <SeedPanel /> : <ConnectionGraph r={result} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function MatchChip({ r }: { r: Lookup }) {
  if (r.match === 'unknown') return <Chip tone="neutral" dot>New to memory</Chip>
  if (r.match === 'connected') return <Chip tone="ember" dot pulse>Connected hit</Chip>
  return <Chip tone="crimson" dot pulse>Direct hit</Chip>
}

function ResultCard({ r }: { r: Lookup }) {
  if (r.match === 'unknown') {
    return (
      <div className="h-full rounded-2xl border border-line-2 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-moss/10 text-moss">
            <Sprout className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[15.5px] text-text">{r.headline}</div>
            <Address addr={r.addr} className="px-0 text-[12.5px]" />
          </div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          No unit has submitted this wallet, and none of the 2,41,860 known wallets has sent money to or received money from it. ANVESHAK will trace it from
          scratch — and from now on, if any officer in any state submits a connected wallet, both of you are alerted.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ['Stored now', 'wallet · chain · case ref · unit · time'],
            ['Alert on', 'any future submission within 3 hops'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-white/[0.015] p-2.5">
              <div className="text-[12px] text-dim">{k}</div>
              <div className="mt-0.5 text-[13px] text-text/90">{v}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  const facts: { icon: React.ReactNode; k: string; v: React.ReactNode }[] = [
    { icon: <History />, k: 'Known since', v: r.knownSince },
    { icon: <MapPin />, k: 'First submitted by', v: r.firstUnit },
    { icon: <Building2 />, k: 'Resolved to', v: <span className="text-gold">{r.exchange}</span> },
    { icon: <Link2 />, k: 'Linked to', v: <span className="text-crimson">{r.syndicate}</span> },
    { icon: <Users />, k: 'Related complaints', v: <span><span className="k-num text-text">{r.related}</span> in <span className="k-num text-text">{r.states}</span> states</span> },
    { icon: <Check />, k: 'Last notice outcome', v: <span style={{ color: toneHex(r.outcomeTone ?? 'neutral') }}>{r.lastOutcome}</span> },
  ]
  return (
    <div className="h-full rounded-2xl border p-4" style={{ borderColor: toneA(r.match === 'connected' ? 'ember' : 'crimson', 0.3), background: `linear-gradient(180deg, ${toneA(r.match === 'connected' ? 'ember' : 'crimson', 0.08)}, transparent 60%)` }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15.5px] leading-snug text-text">{r.headline}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[12.5px] text-muted">
            <Address addr={r.addr} chain={r.addr.startsWith('0x') ? 'Ethereum' : 'TRON'} className="px-0 text-[12.5px]" />
            {r.via && <span>· via {r.via}</span>}
          </div>
        </div>
        {r.hops && <Chip tone="ember">{r.hops} hops away</Chip>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {facts.map((f, i) => (
          <motion.div
            key={f.k}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + i * 0.06 }}
            className="flex items-start gap-2.5 border-b border-line py-2"
          >
            <span className="mt-0.5 text-dim [&_svg]:size-3.5">{f.icon}</span>
            <div className="min-w-0">
              <div className="text-[12px] text-dim">{f.k}</div>
              <div className="text-[14px] text-text/90">{f.v}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted">
        {r.match === 'connected'
          ? 'This exact wallet is new, but it paid into a wallet another state already resolved. The officer starts from the answer, not from zero.'
          : 'Another unit already did the trace and the attribution. Reuse their result, and coordinate instead of sending a duplicate notice.'}
      </p>
    </div>
  )
}

function Provenance({ r }: { r: Lookup }) {
  return (
    <div className="min-w-0">
      <div className="text-[14px] text-text/90">Who knew what, and when</div>
      <div className="text-[12px] text-dim">provenance · every entry is signed by the submitting unit</div>
      <ol className="relative mt-3 space-y-0">
        {r.prov.map((p, i) => (
          <motion.li
            key={p.date + p.what}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            className="relative grid grid-cols-[14px_1fr] gap-3 pb-3 last:pb-0"
          >
            {i < r.prov.length - 1 && <span className="absolute left-[6px] top-4 h-[calc(100%-8px)] w-px bg-line-2" />}
            <span className="relative mt-1 size-3.5 rounded-full border-2 border-[#141415]" style={{ background: toneHex(p.tone), boxShadow: `0 0 8px ${toneA(p.tone, 0.6)}` }} />
            <div className={cn('min-w-0 rounded-lg', p.you && 'border border-ember/30 bg-ember/[0.06] px-2 py-1.5')}>
              <div className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                <span className="k-mono text-muted">{p.date}</span>
                <span className="text-text/90">{p.unit}</span>
                <span className="text-dim">{p.state}</span>
                {p.you && <span className="text-[11.5px] font-medium text-ember">you</span>}
              </div>
              <div className="text-[13px] leading-snug text-muted">{p.what}</div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

function ConnectionGraph({ r }: { r: Lookup }) {
  const cols = Math.max(...r.nodes.map((n) => n.col)) + 1
  return (
    <div className="min-w-0">
      <div className="text-[14px] text-text/90">How it connects to wallets already known</div>
      <div className="text-[12px] text-dim">each card shows which unit first submitted it · hover to trace a strand</div>
      <div className="mt-3 overflow-x-auto">
        <div style={{ minWidth: cols * 160 + 40 }}>
          <FlowGraph nodes={r.nodes} edges={r.edges} height={r.nodes.length > 4 ? 250 : 210} nodeWidth={cols > 3 ? 150 : 176} nodeHeight={52} />
        </div>
      </div>
    </div>
  )
}

function SeedPanel() {
  return (
    <div className="min-w-0">
      <div className="text-[14px] text-text/90">What this submission adds</div>
      <div className="text-[12px] text-dim">the memory grows by one node — no personal data</div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { k: 'Wallet node', v: 'address + chain', tone: 'ember' as const },
          { k: 'Case reference', v: 'ANV case ID only', tone: 'sky' as const },
          { k: 'Edges', v: 'added as the trace runs', tone: 'teal' as const },
        ].map((x) => (
          <div key={x.k} className="rounded-xl border border-dashed p-3" style={{ borderColor: toneA(x.tone, 0.35) }}>
            <div className="text-[13.5px]" style={{ color: toneHex(x.tone) }}>{x.k}</div>
            <div className="mt-0.5 text-[12.5px] text-muted">{x.v}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-muted">
        38% of new complaints today touch a wallet someone else already submitted. A year ago it was 9%. Every first submission like this one is what makes
        the next officer’s hit possible.
      </p>
    </div>
  )
}
