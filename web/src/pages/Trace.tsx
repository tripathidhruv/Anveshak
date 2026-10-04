import * as React from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  ArrowRightLeft,
  Blend,
  Building2,
  Check,
  CircleDot,
  FileSignature,
  Gavel,
  Layers,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  User,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import {
  Address,
  Button,
  Card,
  CardHeader,
  Chip,
  FlowGraph,
  KV,
  Meter,
  Reveal,
  type FlowEdge,
  type FlowNode,
  type Tone,
  toneA,
  toneHex,
} from '@/components/kit'
import { Tabs, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { CASE, EXCHANGE, ROUTE_A, ROUTE_B } from '@/data/demo'
import { inr, mmss, num } from '@/lib/format'
import { cn } from '@/lib/utils'

const USDT_INR = 83.5

/* ───────────── trace pipeline stages ───────────── */
const STAGES = [
  { label: 'Fetch transactions', tech: 'TRON + Ethereum adapters', ms: 3800 },
  { label: 'Follow the money', tech: 'causal, time-monotonic hops', ms: 9200 },
  { label: 'Spot automated drains', tech: 'sweep signature', ms: 2100 },
  { label: 'Find collection wallets', tech: 'consolidation detection', ms: 4400 },
  { label: 'Cross the bridge', tech: 'TRON ↔ Ethereum link', ms: 6900 },
  { label: 'Name the exchange', tech: 'deposit-address attribution', ms: 8600 },
  { label: 'Seal the evidence', tech: 'SHA-256 pack + audit log', ms: 1300 },
]

/* ───────────── graph model ───────────── */
type NodeInfo = {
  title: string
  role: string
  tone: Tone
  addr?: string
  chain?: string
  amt?: number
  at?: string
  plain: string
  flags?: { label: string; tone: Tone }[]
}

const INFO: Record<string, NodeInfo> = {
  victim: { title: "Victim's wallet", role: 'Origin', tone: 'sky', addr: ROUTE_A.trail[0].addr, chain: 'TRON', amt: 14850, at: '19:42:04', plain: 'Rekha Sharma sent 14,850 USDT from here believing it was a "task deposit".' },
  others: { title: '37 other victims', role: 'Linked complaints', tone: 'sky', plain: '37 other people in 11 states paid into the same collection wallet. Solving this trace moves all 38 cases forward.', flags: [{ label: 'Consolidation', tone: 'crimson' }] },
  scammer: { title: "Scammer's wallet", role: 'First receiver', tone: 'crimson', addr: ROUTE_A.trail[1].addr, chain: 'TRON', amt: 14850, at: '19:42:11', plain: 'Created 3 hours before the scam. Forwarded the money onward within seconds.', flags: [{ label: 'Suspect', tone: 'crimson' }] },
  w2: { title: 'Pass-through wallet 2', role: 'Hop 3', tone: 'teal', addr: ROUTE_A.trail[2].addr, chain: 'TRON', amt: 14835, at: '19:42:53', plain: 'Money left 42 seconds after arriving with 99.9% kept — a machine drain, not a person.', flags: [{ label: 'Swept · 42 s', tone: 'crimson' }] },
  w3: { title: 'Pass-through wallet 3', role: 'Hop 4', tone: 'teal', addr: ROUTE_A.trail[3].addr, chain: 'TRON', amt: 14820, at: '19:43:38', plain: 'Second automated drain in a row — 45 seconds.', flags: [{ label: 'Swept · 45 s', tone: 'crimson' }] },
  hub: { title: 'Collection wallet', role: 'Hub · 38 victims', tone: 'crimson', addr: ROUTE_A.trail[4].addr, chain: 'TRON', amt: 412900, at: '19:51:02', plain: '38 victims\' money pooled here (412,900 USDT ≈ ₹3.45 Cr) before one transfer to the exchange.', flags: [{ label: 'Hub · 38 victims', tone: 'crimson' }] },
  depA: { title: 'Exchange deposit (TRON)', role: 'Deposit address', tone: 'gold', addr: ROUTE_A.trail[5].addr, chain: 'TRON', amt: 412900, at: '20:14:27', plain: 'A customer deposit address at Meridian — this is where identity (KYC) exists.', flags: [{ label: 'Exchange', tone: 'gold' }] },
  bridge: { title: 'Bridge contract', role: 'Leaves TRON', tone: 'violet', addr: ROUTE_B.trail[2].addr, chain: 'TRON', amt: 1795, at: '19:58:41', plain: '1,795 USDT was sent into a cross-chain bridge to hide the trail on another blockchain.', flags: [{ label: 'Bridge in', tone: 'violet' }] },
  emerge: { title: 'Emerges on Ethereum', role: 'Bridge exit', tone: 'violet', addr: ROUTE_B.trail[3].addr, chain: 'Ethereum', amt: 1782, at: '20:03:19', plain: 'Matched by amount (minus the bridge fee) and timing, 4 min 38 s later. Link confidence 82% — verify before acting.', flags: [{ label: 'Bridge out · 82%', tone: 'violet' }] },
  w4: { title: 'Pass-through wallet 4', role: 'Hop 5 · Ethereum', tone: 'teal', addr: ROUTE_B.trail[4].addr, chain: 'Ethereum', amt: 1776, at: '20:09:55', plain: 'Drained 6 min 36 s later — slower than on TRON but still automated.', flags: [{ label: 'Swept', tone: 'crimson' }] },
  mixer: { title: 'Mixing service', role: 'Trail goes cold', tone: 'neutral', addr: '0x910c4e7d2b8fa3c51e', chain: 'Ethereum', amt: 400, at: '20:06:12', plain: '400 USDT entered a known mixing pool. No tool can see through a mixer — so ANVESHAK watches for the operator\'s behaviour on the other side.', flags: [{ label: 'Mixer entry', tone: 'neutral' }] },
  reacq: { title: 'Re-acquired wallet', role: 'Behavioural match', tone: 'ember', addr: '0x5d1e93ac40f7b2e6d8', chain: 'Ethereum', amt: 396, at: '21:48:30', plain: 'Withdrew a near-identical amount 1 h 42 m later with the same fee setting and timing rhythm as this operator. A lead, not proof.', flags: [{ label: 'Re-acquired · 81%', tone: 'ember' }] },
  exchange: { title: EXCHANGE.name, role: 'Cash-out point', tone: 'gold', plain: 'Both routes end at Meridian. Send one lawful request for the KYC behind both deposit addresses.', flags: [{ label: 'Not FIU-IND registered', tone: 'crimson' }] },
}

const ICON: Record<string, React.ReactNode> = {
  victim: <User />,
  others: <Users />,
  scammer: <Wallet />,
  w2: <CircleDot />,
  w3: <CircleDot />,
  hub: <Layers />,
  depA: <Building2 />,
  bridge: <ArrowRightLeft />,
  emerge: <ArrowRightLeft />,
  w4: <CircleDot />,
  mixer: <Blend />,
  reacq: <Search />,
  exchange: <Gavel />,
}

const SHORT: Record<string, string> = {"victim":"Victim","others":"+37 victims","scammer":"Scammer","w2":"Wallet 2","w3":"Wallet 3","hub":"Collection hub","depA":"Deposit · TRON","bridge":"Bridge in","emerge":"Bridge out · ETH","w4":"Wallet 4 · ETH","mixer":"Mixer pool","exchange":"Meridian"}

const SUB: Record<string, string> = { hub: "38 victims · 412,900 USDT", exchange: "Cash-out · KYC here", others: "same hub · 11 states", depA: "TBx1eM…W2kL", mixer: "trail goes cold" }

const POS: Record<string, { col: number; y: number }> = {
  victim: { col: 0, y: 0.32 },
  others: { col: 0, y: 0.06 },
  scammer: { col: 1, y: 0.32 },
  w2: { col: 2, y: 0.32 },
  w3: { col: 3, y: 0.12 },
  bridge: { col: 3, y: 0.6 },
  hub: { col: 4, y: 0.12 },
  emerge: { col: 4, y: 0.6 },
  depA: { col: 5, y: 0.12 },
  w4: { col: 5, y: 0.55 },
  mixer: { col: 5, y: 0.9 },
  exchange: { col: 6, y: 0.33 },
  reacq: { col: 6, y: 0.9 },
}

const ROUTE_A_IDS = new Set(['victim', 'others', 'scammer', 'w2', 'w3', 'hub', 'depA', 'exchange'])
const ROUTE_B_IDS = new Set(['victim', 'scammer', 'w2', 'bridge', 'emerge', 'w4', 'exchange'])
const COLD_IDS = new Set(['bridge', 'emerge', 'mixer', 'reacq'])

const EDGES: FlowEdge[] = [
  { from: 'victim', to: 'scammer', weight: 0.6, animated: true },
  { from: 'scammer', to: 'w2', weight: 0.6, animated: true },
  { from: 'w2', to: 'w3', weight: 0.55 },
  { from: 'w2', to: 'bridge', weight: 0.25, tone: 'violet' },
  { from: 'w3', to: 'hub', weight: 0.55 },
  { from: 'others', to: 'hub', weight: 0.9, tone: 'sky', dashed: true },
  { from: 'hub', to: 'depA', weight: 1, animated: true },
  { from: 'depA', to: 'exchange', weight: 1, tone: 'gold' },
  { from: 'bridge', to: 'emerge', weight: 0.25, tone: 'violet', label: '82%' },
  { from: 'emerge', to: 'w4', weight: 0.25 },
  { from: 'emerge', to: 'mixer', weight: 0.15, tone: 'neutral' },
  { from: 'w4', to: 'exchange', weight: 0.25, tone: 'gold' },
  { from: 'mixer', to: 'reacq', weight: 0.15, tone: 'ember', dashed: true },
]

const CANDIDATES = [
  { addr: '0x5d1e93ac40f7b2e6d8', score: 0.81, out: 396, after: '1h 42m', parts: [['Withdrawal timing rhythm', 0.88], ['Amount (minus pool fee)', 0.79], ['Fee / gas setting', 0.85], ['Next-hop shape (fan-out 1)', 0.71]] as [string, number][] },
  { addr: '0x8a2fb7c193e40d5a61', score: 0.46, out: 400, after: '3h 05m', parts: [['Withdrawal timing rhythm', 0.41], ['Amount (minus pool fee)', 0.83], ['Fee / gas setting', 0.22], ['Next-hop shape (fan-out 1)', 0.38]] as [string, number][] },
  { addr: '0x3c90e1f6a82db47c03', score: 0.22, out: 398, after: '6h 51m', parts: [['Withdrawal timing rhythm', 0.12], ['Amount (minus pool fee)', 0.64], ['Fee / gas setting', 0.1], ['Next-hop shape (fan-out 1)', 0.15]] as [string, number][] },
]

export default function TracePage() {
  const [run, setRun] = React.useState(0)
  const [stage, setStage] = React.useState(0)
  const [selected, setSelected] = React.useState<string>('hub')
  const [view, setView] = React.useState<'all' | 'a' | 'b' | 'cold'>('all')
  const [cand, setCand] = React.useState(0)

  React.useEffect(() => {
    setStage(0)
    let i = 0
    const t = setInterval(() => {
      i++
      setStage(i)
      if (i >= STAGES.length) clearInterval(t)
    }, 420)
    return () => clearInterval(t)
  }, [run])

  const done = stage >= STAGES.length
  const highlight = view === 'a' ? ROUTE_A_IDS : view === 'b' ? ROUTE_B_IDS : view === 'cold' ? COLD_IDS : null

  const nodes: FlowNode[] = Object.entries(POS).map(([id, p]) => {
    const info = INFO[id]
    const isReacq = id === 'reacq'
    return {
      id,
      col: p.col,
      y: p.y,
      tone: info.tone,
      icon: ICON[id],
      title: isReacq ? `Lead · ${Math.round(CANDIDATES[cand].score * 100)}%` : SHORT[id] ?? info.title,
      sub: SUB[id] ?? (info.addr ? `${info.addr.slice(0, 6)}…${info.addr.slice(-4)}` : info.role),
      ghost: id === 'others' || isReacq,
      live: id === 'hub' && done,
    }
  })

  const sel = INFO[selected]

  return (
    <div className="space-y-4">
      {/* ── header ── */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
          <div className="min-w-0">
            <div className="k-eyebrow mb-1.5 flex flex-wrap items-center gap-2">
              <span>{CASE.id}</span>
              <span className="text-dim">·</span>
              <span>{CASE.complainant}, {CASE.location}</span>
              <span className="text-dim">·</span>
              <span>{CASE.fraudType}</span>
            </div>
            <h1 className="k-num text-[28px] leading-tight md:text-[32px]">Follow the money</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.span key="done" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
                    <Chip tone="moss" dot>Traced in {CASE.traceSeconds} s</Chip>
                    <Chip tone="neutral">6 hops · 2 routes · 2 chains</Chip>
                    <Chip tone="gold">Ends at {EXCHANGE.name}</Chip>
                  </motion.span>
                ) : (
                  <motion.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Chip tone="ember" dot pulse>Tracing… {STAGES[Math.min(stage, STAGES.length - 1)].label}</Chip>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <div
              className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line-2 px-3 md:w-[380px] md:flex-none"
              style={{ background: 'linear-gradient(180deg,#1d1d20,#151517)' }}
            >
              <Wallet className="size-4 shrink-0 text-muted" />
              <span className="k-mono truncate text-[14px] text-text">{CASE.suspectWallet}</span>
              <Chip tone="crimson" className="ml-auto">TRON</Chip>
            </div>
            <Button variant="ember" onClick={() => setRun((r) => r + 1)}>
              <RotateCcw /> Re-run trace
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ── pipeline ── */}
      <Reveal delay={0.05}>
        <Card className="px-4 py-3.5">
          <div className="k-scroll flex items-stretch gap-2 overflow-x-auto">
            {STAGES.map((s, i) => {
              const state = i < stage ? 'done' : i === stage ? 'run' : 'wait'
              return (
                <div
                  key={s.label}
                  className={cn(
                    'relative flex min-w-[150px] flex-1 items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors',
                    state === 'done' && 'border-line-2 bg-white/[0.03]',
                    state === 'run' && 'border-ember/40 bg-ember/[0.06]',
                    state === 'wait' && 'border-line opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-[11.5px]',
                      state === 'done' ? 'bg-moss/15 text-moss' : state === 'run' ? 'bg-ember/20 text-ember' : 'bg-white/5 text-dim',
                    )}
                  >
                    {state === 'done' ? <Check className="size-3.5" /> : state === 'run' ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-text">{s.label}</div>
                    <div className="truncate text-[11.5px] text-dim">{state === 'done' ? `${(s.ms / 1000).toFixed(1)} s · ${s.tech}` : s.tech}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </Reveal>

      {/* ── money trail ── */}
        <Reveal delay={0.1}>
          <Card variant="glass" className="h-full pb-3">
            <CardHeader
              title="Money trail"
              tech="every arrow is a real transfer, in time order · click any wallet"
              right={
                <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
                  <TabsList className="h-8 border border-line bg-white/[0.04]">
                    <TabsTrigger value="all" className="px-2.5 text-[12.5px]">Everything</TabsTrigger>
                    <TabsTrigger value="a" className="px-2.5 text-[12.5px]">Route A</TabsTrigger>
                    <TabsTrigger value="b" className="px-2.5 text-[12.5px]">Route B · bridge</TabsTrigger>
                    <TabsTrigger value="cold" className="px-2.5 text-[12.5px]">Cold trail</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            />
            <div className="k-scroll overflow-x-auto px-4 pt-3">
              <div className="min-w-[1180px]">
                <FlowGraph key={run} nodes={nodes} edges={EDGES} height={420} nodeWidth={172} nodeHeight={58} selected={selected} onSelect={setSelected} highlight={highlight} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 pt-2 text-[12px] text-muted">
              {([
                ['sky', 'Victims'],
                ['crimson', 'Criminal wallets'],
                ['teal', 'Pass-through hop'],
                ['violet', 'Bridge (cross-chain)'],
                ['gold', 'Exchange'],
                ['ember', 'Re-acquired lead'],
              ] as [Tone, string][]).map(([t, l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: toneHex(t), boxShadow: `0 0 6px ${toneHex(t)}` }} />
                  {l}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-1.5 text-dim">
                <span className="h-px w-5 border-t border-dashed border-muted" /> dashed = inferred, verify before acting
              </span>
            </div>
          </Card>
        </Reveal>

      {/* ── selected wallet · sweep · consolidation ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.15}>
          <Card className="h-full">
            <AnimatePresence mode="wait">
              <motion.div key={selected} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22 }} className="p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl [&_svg]:size-4.5" style={{ background: toneA(sel.tone, 0.14), color: toneHex(sel.tone) }}>
                    {ICON[selected]}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[15.5px] font-medium">{selected === 'reacq' ? 'Re-acquired wallet' : sel.title}</div>
                    <div className="text-[12.5px] text-dim">{sel.role}</div>
                  </div>
                </div>
                {sel.flags && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sel.flags.map((f) => (
                      <Chip key={f.label} tone={f.tone} dot>
                        {f.label}
                      </Chip>
                    ))}
                  </div>
                )}
                <p className="mt-4 text-[14px] leading-relaxed text-text/85">{sel.plain}</p>
                <div className="mt-4 divide-y divide-line rounded-xl border border-line px-3">
                  {(selected === 'reacq' ? CANDIDATES[cand].addr : sel.addr) && (
                    <KV k="Wallet" v={<Address addr={selected === 'reacq' ? CANDIDATES[cand].addr : sel.addr!} chain={sel.chain} />} />
                  )}
                  {sel.chain && <KV k="Blockchain" v={sel.chain} />}
                  {sel.amt !== undefined && (
                    <KV k="Amount" v={<span className="k-num">{num(selected === 'reacq' ? CANDIDATES[cand].out : sel.amt)} USDT <span className="text-dim">≈ {inr((selected === 'reacq' ? CANDIDATES[cand].out : sel.amt) * USDT_INR)}</span></span>} />
                  )}
                  {sel.at && <KV k="Time (IST)" v={<span className="k-mono">02 Sep · {sel.at}</span>} />}
                  {selected === 'exchange' && (
                    <>
                      <KV k="Jurisdiction" v={EXCHANGE.jurisdiction} />
                      <KV k="Indian users" v={EXCHANGE.indianUsers} />
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected === 'exchange' || selected === 'depA' ? (
                    <>
                      <Link to="/attribution"><Button size="sm"><Gavel /> Why Meridian?</Button></Link>
                      <Link to="/evidence"><Button size="sm" variant="ember"><FileSignature /> Draft notice</Button></Link>
                    </>
                  ) : selected === 'hub' || selected === 'others' ? (
                    <Link to="/syndicates"><Button size="sm"><Users /> Open syndicate SYN-07</Button></Link>
                  ) : (
                    <Link to="/watchlists"><Button size="sm"><ShieldAlert /> Flag to exchanges</Button></Link>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <SweepCard />
        </Reveal>
        <Reveal delay={0.15}>
          <ConsolidationCard />
        </Reveal>
      </div>

      {/* ── cold trail · hop table ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.6fr]">
        <Reveal delay={0.2}>
          <Card variant="glass" className="h-full pb-4">
            <CardHeader
              title="Trail went cold? We pick it up again"
              tech="cold-trail re-acquisition · behavioural matching past a mixer"
              right={<Chip tone="ember">New</Chip>}
            />
            <p className="px-5 pt-2 text-[13px] leading-relaxed text-muted">
              400 USDT entered a mixer, which hides who withdraws what. Instead of stopping, ANVESHAK compares every withdrawal that followed against this operator's habits.
            </p>
            <div className="mt-3 space-y-1.5 px-3">
              {CANDIDATES.map((c, i) => (
                <button
                  key={c.addr}
                  onClick={() => {
                    setCand(i)
                    setSelected('reacq')
                    setView('cold')
                  }}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                    cand === i ? 'border-ember/40 bg-ember/[0.06]' : 'border-line hover:bg-white/[0.03]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="k-mono text-[13px] text-text">{c.addr.slice(0, 8)}…{c.addr.slice(-4)}</span>
                    <span className="text-[11.5px] text-dim">withdrew {c.out} USDT · {c.after} later</span>
                    <span className={cn('k-num ml-auto text-[14.5px]', i === 0 ? 'text-ember' : 'text-muted')}>{Math.round(c.score * 100)}%</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {cand === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-1.5 pt-2.5">
                          {c.parts.map(([k, v]) => (
                            <div key={k} className="grid grid-cols-[1fr_90px_32px] items-center gap-2 text-[12px]">
                              <span className="text-muted">{k}</span>
                              <Meter value={v} tone="ember" height={4} />
                              <span className="k-num text-right text-text/80">{Math.round(v * 100)}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
            <p className="mt-3 px-5 text-[12px] text-dim">A behavioural match is an investigative lead, not proof of ownership. Confirm with an exchange request before acting.</p>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title="Hop-by-hop record" tech="what goes into the evidence pack · Route A + Route B" right={<Link to="/evidence" className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">Add to pack</Link>} />
            <div className="k-scroll mt-2 overflow-x-auto px-2 pb-3">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead>
                  <tr className="text-left text-[12px] text-dim">
                    <th className="px-3 py-2 font-normal">#</th>
                    <th className="px-3 py-2 font-normal">Wallet</th>
                    <th className="px-3 py-2 font-normal">What it is</th>
                    <th className="px-3 py-2 text-right font-normal">Amount</th>
                    <th className="px-3 py-2 font-normal">Time</th>
                    <th className="px-3 py-2 font-normal">Since last hop</th>
                    <th className="px-3 py-2 font-normal">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ROUTE_A.trail, ...ROUTE_B.trail.slice(2)].map((h, i) => (
                    <tr key={`${h.addr}-${i}`} className="border-t border-line hover:bg-white/[0.02]">
                      <td className="k-num px-3 py-2 text-dim">{i + 1}</td>
                      <td className="px-2 py-1.5"><Address addr={h.addr} chain={h.chain} /></td>
                      <td className="px-3 py-2 text-text/85">{h.role}</td>
                      <td className="k-num px-3 py-2 text-right">{num(h.amt)}</td>
                      <td className="k-mono px-3 py-2 text-muted">{h.at}</td>
                      <td className="px-3 py-2">{h.gapSec ? <span className={cn('k-mono', h.gapSec < 60 ? 'text-crimson' : 'text-text/80')}>{mmss(h.gapSec)}</span> : <span className="text-dim">—</span>}</td>
                      <td className="px-3 py-2"><FlagChip flag={h.flag} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── bridge · next steps ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.6fr]">
        <Reveal delay={0.15}>
          <Card className="h-full pb-5">
            <CardHeader title="Crossing to another blockchain" tech="TRON → Ethereum bridge link" right={<Chip tone="violet">82% match</Chip>} />
            <div className="mt-4 flex items-center gap-2 px-5">
              <ChainBox chain="TRON" amt={1795} at="19:58:41" />
              <div className="relative flex-1">
                <div className="h-px w-full bg-gradient-to-r from-crimson via-violet to-sky" />
                <div className="absolute inset-x-0 -top-2.5 text-center text-[11.5px] text-violet">4 m 38 s · fee 13 USDT</div>
              </div>
              <ChainBox chain="Ethereum" amt={1782} at="20:03:19" />
            </div>
            <div className="mt-4 space-y-2 px-5">
              {([
                ['Amount matches after bridge fee', 0.94],
                ['Timing within bridge settlement window', 0.88],
                ['No competing withdrawal of same size', 0.71],
              ] as [string, number][]).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[1fr_80px_30px] items-center gap-2 text-[12.5px]">
                  <span className="text-muted">{k}</span>
                  <Meter value={v} tone="violet" height={4} />
                  <span className="k-num text-right">{Math.round(v * 100)}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 px-5 text-[12px] leading-relaxed text-dim">
              A bridge does not publish which deposit became which withdrawal. This link comes from timing and amount, so an officer must verify it before acting.
            </p>
          </Card>
        </Reveal>
        <Reveal delay={0.2}>
          <NextSteps />
        </Reveal>
      </div>
    </div>
  )
}

function FlagChip({ flag }: { flag: string }) {
  const map: Record<string, [Tone, string]> = {
    VICTIM: ['sky', 'Victim'],
    SUSPECT: ['crimson', 'Suspect'],
    SWEPT: ['crimson', 'Swept'],
    HUB: ['crimson', 'Hub · 38'],
    EXCHANGE: ['gold', 'Exchange'],
    'BRIDGE IN': ['violet', 'Bridge in'],
    'BRIDGE OUT': ['violet', 'Bridge out'],
    MIXER: ['neutral', 'Mixer'],
  }
  const [t, l] = map[flag] ?? ['neutral', flag]
  return <Chip tone={t}>{l}</Chip>
}

function ChainBox({ chain, amt, at }: { chain: string; amt: number; at: string }) {
  return (
    <div className="rounded-xl border border-line-2 bg-white/[0.03] px-3 py-2 text-center">
      <div className="text-[11.5px] text-dim">{chain}</div>
      <div className="k-num text-[16.5px]">{num(amt)}</div>
      <div className="k-mono text-[11.5px] text-muted">{at}</div>
    </div>
  )
}

/* ───────────── Sweep signature: hold time per hop on a log scale ───────────── */
function SweepCard() {
  const hops = [
    { label: "Scammer's wallet", sec: 42 },
    { label: 'Wallet 2', sec: 45 },
    { label: 'Wallet 3', sec: 444 },
    { label: 'Wallet 4 (ETH)', sec: 396 },
  ]
  const human = 14 * 60
  const max = Math.log10(6 * 3600)
  const pos = (s: number) => (Math.log10(Math.max(s, 1)) / max) * 100
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Money left within seconds" tech="sweep signature · hold time per hop (log scale)" right={<Chip tone="crimson" dot>Automated</Chip>} />
      <div className="px-5 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="k-num text-[26px]">42 s</span>
          <span className="text-[12.5px] text-muted">vs ~14 min for a real person</span>
        </div>
        <div className="relative mt-4 space-y-3">
          <div className="pointer-events-none absolute inset-y-0" style={{ left: `calc(${pos(human)}% * 0.68 + 32%)` }}>
            <div className="h-full border-l border-dashed border-moss/50" />
            <div className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[11px] text-moss">typical person</div>
          </div>
          {hops.map((h, i) => (
            <div key={h.label} className="grid grid-cols-[32%_1fr] items-center gap-0">
              <span className="truncate pr-2 text-[12.5px] text-muted">{h.label}</span>
              <div className="relative h-5 rounded-md bg-white/[0.035]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{ background: `linear-gradient(90deg, ${toneA('crimson', 0.25)}, ${toneHex('crimson')})`, boxShadow: `0 0 14px ${toneA('crimson', 0.45)}` }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pos(h.sec)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                />
                <span className="k-mono absolute inset-y-0 right-2 flex items-center text-[11.5px] text-text/80">{mmss(h.sec)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['99.9%', 'value kept per hop'],
            ['4 / 4', 'hops faster than a person'],
            ['0', 'labels needed'],
          ].map(([v, k]) => (
            <div key={k} className="rounded-xl border border-line bg-white/[0.02] py-2">
              <div className="k-num text-[16.5px]">{v}</div>
              <div className="text-[11px] text-dim">{k}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ───────────── Consolidation: 38 victims arriving at one hub over time ───────────── */
function ConsolidationCard() {
  // deterministic synthetic arrival pattern across 22 days
  const arrivals = React.useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
        day: (i * 7) % 22,
        lane: (i * 5) % 6,
        you: i === 21,
        amt: 0.4 + ((i * 37) % 10) / 10,
      })),
    [],
  )
  return (
    <Card className="h-full pb-5">
      <CardHeader title="38 victims, one wallet" tech="consolidation · arrivals into the collection hub" right={<Link to="/syndicates" className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">Syndicate</Link>} />
      <div className="px-5 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="k-num text-[26px]">₹3.45 Cr</span>
          <span className="text-[12.5px] text-muted">pooled from 11 states</span>
        </div>
        <div className="k-grid-bg relative mt-4 h-[132px] overflow-hidden rounded-xl border border-line">
          {arrivals.map((a, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.025, type: 'spring', stiffness: 300, damping: 18 }}
              style={{
                left: `${4 + (a.day / 21) * 90}%`,
                top: `${10 + a.lane * 15}%`,
                width: 6 + a.amt * 8,
                height: 6 + a.amt * 8,
                background: a.you ? toneHex('ember') : toneA('sky', 0.75),
                boxShadow: a.you ? `0 0 14px ${toneHex('ember')}` : `0 0 8px ${toneA('sky', 0.5)}`,
              }}
              title={a.you ? 'Rekha Sharma (this case)' : 'Linked victim'}
            />
          ))}
          <div className="absolute bottom-1.5 left-3 text-[11px] text-dim">11 Aug</div>
          <div className="absolute bottom-1.5 right-3 text-[11px] text-dim">02 Sep</div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
          <Zap className="size-3.5 text-ember" />
          One lawful request to Meridian can identify the account behind all 38 cases.
        </div>
      </div>
    </Card>
  )
}

function NextSteps() {
  const steps: { to: string; icon: React.ReactNode; title: string; sub: string; tone: Tone; primary?: boolean }[] = [
    { to: '/evidence', icon: <FileSignature />, title: 'Draft the lawful request', sub: 'Pre-filled notice to Meridian · officer review', tone: 'ember', primary: true },
    { to: '/interdiction', icon: <Zap />, title: 'Warn the next exchange', sub: 'Pre-emptive freeze alert · 6 min ETA', tone: 'gold' },
    { to: '/watchlists', icon: <ShieldAlert />, title: 'Flag wallets to all exchanges', sub: 'Broadcast 5 wallets · 6 exchanges', tone: 'crimson' },
    { to: '/fiat', icon: <ArrowRightLeft />, title: 'Follow the rupee exit', sub: 'P2P orders → mule bank accounts', tone: 'sky' },
  ]
  return (
    <Card variant="glass" className="h-full pb-4">
      <CardHeader title="What to do next" tech="recommended actions for this trace" />
      <div className="mt-3 grid grid-cols-1 gap-2 px-3 sm:grid-cols-2">
        {steps.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className={cn(
              'group flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors',
              s.primary ? 'border-ember/40 bg-ember/[0.07] hover:bg-ember/[0.11]' : 'border-line bg-white/[0.02] hover:bg-white/[0.04]',
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4" style={{ background: toneA(s.tone, 0.14), color: toneHex(s.tone) }}>
              {s.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-text">{s.title}</span>
              <span className="block truncate text-[12px] text-dim">{s.sub}</span>
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-dim opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </Card>
  )
}
