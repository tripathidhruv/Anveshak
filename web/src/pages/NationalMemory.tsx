import * as React from 'react'
import { Link } from 'react-router-dom'
import { animate, useInView } from 'motion/react'
import { ArrowUpRight, Clock3, Copy, Database, Eye, FileLock2, Gauge, KeyRound, Network, ScrollText, Search, ShieldCheck, Timer, TrendingUp, UserX, Users } from 'lucide-react'
import { BarColumns, Card, CardHeader, Chip, CurveChart, DemoChip, HeatGrid, Meter, PageHeader, Reveal, SubTabs, toneHex, type Tone } from '@/components/kit'
import { cn } from '@/lib/utils'
import { AUDIT_LINES, GROWTH_RESOLVED, GROWTH_WALLETS, HIT_RATE, MEMORY, MONTHS, REUSE, REUSED_BY, STATE_HEAT, STATE_ROWS } from './nationalmemory/data'
import { MemoryLookup } from './nationalmemory/Lookup'
import { useMemoryLookup } from './nationalmemory/useMemoryLookup'

/** Animated count with Indian digit grouping (2,41,860). */
function IndianCount({ value, className, decimals = 0 }: { value: number; className?: string; decimals?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  React.useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const c = animate(0, value, {
      duration: 1.4,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        node.textContent = v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      },
    })
    return () => c.stop()
  }, [inView, value, decimals])
  return (
    <span ref={ref} className={cn('k-num', className)}>
      {(0).toFixed(decimals)}
    </span>
  )
}

export default function NationalMemoryPage() {
  const lookup = useMemoryLookup()
  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span>SAHYOG · I4C national portal</span>
              <DemoChip />
              <Chip tone="gold">Illustrative figures</Chip>
            </>
          }
          title="SAHYOG National Memory"
          tech="Every wallet any police unit submits through SAHYOG joins one permanent national graph. When another unit, in any state, submits a connected wallet months later, ANVESHAK already knows — and says who solved it."
          actions={
            <Link to="/audit" className="k-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[14px]">
              <ScrollText className="size-3.5" /> Lookup audit ledger
            </Link>
          }
        />
      </Reveal>

      {/* ── Hero numbers ── */}
      <Reveal delay={0.05}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[14.5px] text-muted">Wallets in national memory</div>
            <div className="mt-1 flex items-center gap-2.5">
              <IndianCount value={MEMORY.wallets} className="text-[40px] leading-none text-text md:text-[46px]" />
              <span className="k-pill text-moss">
                <ArrowUpRight className="size-3" strokeWidth={2.5} />+22.9k this month
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Network className="size-3.5" /> Resolved to an exchange: <span className="text-text">{MEMORY.resolved.toLocaleString('en-IN')}</span>
              </span>
              <span className="hidden text-dim sm:inline">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Database className="size-3.5" /> Links between wallets: <span className="text-text">{MEMORY.edges.toLocaleString('en-IN')}</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:items-center sm:gap-8">
            {[
              { k: 'Contributing cyber cells', v: <IndianCount value={MEMORY.units} className="text-[26px] text-text" />, sub: `across ${MEMORY.states} states & UTs` },
              { k: 'Hits at submission', v: <span className="k-num text-[26px] text-ember">{Math.round(MEMORY.hitRate * 100)}%</span>, sub: 'new complaints already known' },
            ].map((s) => (
              <div key={s.k} className="sm:text-right">
                {s.v}
                <div className="text-[12.5px] text-dim">{s.k}</div>
                <div className="text-[11.5px] text-dim">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <SubTabs
        tabs={[
          {
            key: 'lookup',
            label: 'Check a wallet',
            icon: Search,
            render: () => <MemoryLookup lookup={lookup} />,
          },
          {
            key: 'growth',
            label: 'How it grows',
            icon: TrendingUp,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.7fr_1fr]">
                <Card className="h-full pb-4">
                  <CardHeader title="The national memory keeps growing" tech="wallets known vs wallets resolved to an exchange · thousands · Oct 2025 – Sep 2026" right={<span className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">12 months</span>} />
                  <div className="px-5 pt-2">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="k-num text-[26px] text-text">6.4×</span>
                      <span className="text-[12.5px] text-muted">growth in a year</span>
                      <span className="flex items-center gap-3 text-[12.5px] text-muted">
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-white" />Wallets known</span>
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-gold" />Resolved to exchange</span>
                      </span>
                    </div>
                    <CurveChart
                      className="mt-3"
                      height={210}
                      labels={MONTHS}
                      series={[
                        { name: 'Wallets known', tone: 'white', data: GROWTH_WALLETS },
                        { name: 'Resolved', tone: 'gold', data: GROWTH_RESOLVED },
                      ]}
                      highlight={{ series: 0, index: 5, title: 'Mar 2026 · Kochi submits the SYN-07 hub' }}
                      format={(v) => `${v}k`}
                    />
                  </div>
                </Card>
                <Card variant="glass" className="h-full pb-5">
                  <CardHeader title="The bigger it gets, the more often it already knows" tech="% of new submissions touching a known wallet · per month" />
                  <div className="px-5 pt-2">
                    <span className="k-num text-[26px] text-text">9% → 38%</span>
                    <span className="ml-2 text-[12.5px] text-muted">network effect</span>
                    <BarColumns
                      className="mt-6"
                      height={170}
                      tone="ember"
                      data={HIT_RATE.map((v, i) => ({ label: MONTHS[i].slice(0, 1), value: v, highlight: i === HIT_RATE.length - 1 }))}
                      format={(v) => `${v}% hits`}
                    />
                  </div>
                </Card>
              </div>
            ),
          },
          {
            key: 'reuse',
            label: 'Who it helps',
            icon: Users,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.35fr]">
                <KnowledgeReused />
                <StateContribution />
              </div>
            ),
          },
          {
            key: 'safeguards',
            label: 'Reach & safeguards',
            icon: ShieldCheck,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.3fr]">
                <PlatformOnly />
                <Governance />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

/* ───────────── Knowledge reused ───────────── */
function KnowledgeReused() {
  const hours = REUSE.directHits * REUSE.hrsPerTrace + REUSE.connectedHits * REUSE.hrsPerConnected
  const rows: { icon: React.ReactNode; tone: Tone; k: string; v: React.ReactNode; how: string; sub: string }[] = [
    {
      icon: <Timer />,
      tone: 'moss',
      k: 'Officer-hours saved',
      v: <IndianCount value={hours} className="text-[24px] text-text" />,
      how: `${REUSE.directHits.toLocaleString('en-IN')} × ${REUSE.hrsPerTrace} h + ${REUSE.connectedHits.toLocaleString('en-IN')} × ${REUSE.hrsPerConnected} h`,
      sub: `≈ ${Math.round(hours / 8).toLocaleString('en-IN')} officer-days · direct hits skip a full trace, connected hits skip the first hops`,
    },
    {
      icon: <Copy />,
      tone: 'ember',
      k: 'Duplicate traces avoided',
      v: <IndianCount value={REUSE.directHits} className="text-[24px] text-text" />,
      how: 'submissions where the exact wallet was already resolved',
      sub: 'and no second notice sent to the same exchange for the same account',
    },
    {
      icon: <Gauge />,
      tone: 'sky',
      k: 'Cases accelerated',
      v: <IndianCount value={REUSE.connectedHits} className="text-[24px] text-text" />,
      how: 'submissions within 3 hops of a resolved wallet',
      sub: 'trace starts at the known hub — 3.1 hops skipped on average',
    },
  ]
  return (
    <Card className="h-full pb-4">
      <CardHeader title="Knowledge reused this month" tech={`Sep 2026 · ${MEMORY.monthSubmissions.toLocaleString('en-IN')} submissions × 38% hit rate = ${(REUSE.directHits + REUSE.connectedHits).toLocaleString('en-IN')} hits`} right={<Chip tone="gold">Illustrative</Chip>} />
      <ul className="mt-2 divide-y divide-line px-5">
        {rows.map((r) => (
          <li key={r.k} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-line-2 [&_svg]:size-4" style={{ color: toneHex(r.tone), background: 'var(--k-glass-hi)' }}>
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] text-text/90">{r.k}</span>
                {r.v}
              </div>
              <div className="k-mono mt-0.5 text-[12px] text-muted">{r.how}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-dim">{r.sub}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="px-5 text-[12px] leading-snug text-dim">Hours per trace (6.5 h manual, 2.5 h partial) are planning assumptions, not measurements. Replace with field data before deployment.</p>
    </Card>
  )
}

/* ───────────── State contributions ───────────── */
function StateContribution() {
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Which states feed the memory — and whose work others reuse" tech="wallets submitted per state × month (normalised) · top 10 of 36" right={<Chip tone="ember" dot>Story cells</Chip>} />
      <div className="grid grid-cols-1 gap-5 px-5 pt-3 lg:grid-cols-[auto_1fr]">
        <div className="overflow-x-auto">
          <HeatGrid
            data={STATE_HEAT}
            cell={14}
            gap={4}
            tone="ember"
            rowLabels={STATE_ROWS}
            colLabels={MONTHS.map((m) => m.slice(0, 1))}
            accent={{ '5-5': 'sky', '4-11': 'ember' }}
            title={(r, c, v) => `${STATE_ROWS[r]} · ${MONTHS[c]} · ~${Math.round(v * 3200).toLocaleString('en-IN')} wallets`}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-dim">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-sky" />Kerala, Mar — Kochi submits the hub</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-ember" />Rajasthan, Sep — Jaipur gets the hit</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] text-dim">Submissions reused by other states</div>
          <ul className="mt-2 space-y-3">
            {REUSED_BY.map((s) => (
              <li key={s.state}>
                <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
                  <span className="text-text/90">{s.state}</span>
                  <span className="text-[12.5px] text-muted">
                    <span className="k-num text-text">{s.reusedBy}</span> states helped
                  </span>
                </div>
                <Meter value={s.reusedBy / 35} tone={s.tone} className="mt-1" height={5} />
                <div className="mt-0.5 text-[11.5px] text-dim">{s.wallets.toLocaleString('en-IN')} wallets submitted</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-snug text-muted">
            Kerala submits fewer wallets than Maharashtra, but its early finds were reused by 21 other states — the hub Jaipur hit today included.
          </p>
        </div>
      </div>
    </Card>
  )
}

/* ───────────── Why only the platform can have this ───────────── */
function PlatformOnly() {
  const rows = [
    { k: 'Standalone tool', sub: 'one officer’s laptop — sees only its own cases', units: 1, tone: 'neutral' as Tone },
    { k: 'Commercial analytics vendor', sub: 'sees its subscribers’ cases + public labels', units: 40, tone: 'gold' as Tone },
    { k: 'SAHYOG national memory', sub: 'every submission from every unit, permanently', units: MEMORY.units, tone: 'moss' as Tone },
  ]
  return (
    <Card variant="glass" className="h-full pb-5">
      <CardHeader title="Why nobody else can build this" tech="coverage = police units whose submissions are visible to the next lookup" />
      <ul className="mt-3 space-y-4 px-5">
        {rows.map((r) => (
          <li key={r.k}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn('text-[14px]', r.tone === 'moss' ? 'text-text' : 'text-text/80')}>{r.k}</span>
              <span className="k-num text-[14.5px]" style={{ color: toneHex(r.tone) }}>
                {r.units} {r.units === 1 ? 'unit' : 'units'}
              </span>
            </div>
            <Meter value={Math.max(0.012, r.units / MEMORY.units)} tone={r.tone} className="mt-1.5" height={6} />
            <div className="mt-1 text-[12px] text-dim">{r.sub}</div>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-5 text-[13.5px] leading-relaxed text-muted">
        The memory only exists where every unit already submits — at the platform level. A vendor can copy ANVESHAK’s trace engine; it cannot copy{' '}
        <span className="text-text">two years of every cyber cell’s answers</span>.
      </p>
    </Card>
  )
}

/* ───────────── Governance ───────────── */
function Governance() {
  const items: { icon: React.ReactNode; tone: Tone; k: string; v: string }[] = [
    { icon: <KeyRound />, tone: 'ember', k: 'Access-controlled', v: 'Only SAHYOG-authorised officers can look up. Exchanges see only wallets named in notices addressed to them.' },
    { icon: <Eye />, tone: 'sky', k: 'Every lookup logged', v: 'Who, which unit, which wallet, which case — written to the hash-chained audit ledger.' },
    { icon: <Clock3 />, tone: 'gold', k: 'Retention (proposed)', v: 'Kept while any linked case is open, plus 8 years. Wallets with no confirmed case link expire after 24 months.' },
    { icon: <UserX />, tone: 'moss', k: 'No citizen PII in the graph', v: 'Stores wallets, links between wallets and case references. Never names, phone numbers, bank accounts or complaint text.' },
  ]
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Governance — who can see the memory, and what it holds" tech="RBAC · append-only audit · data minimisation" right={<ShieldCheck className="size-4 text-moss" />} />
      <div className="mt-3 grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.k} className="rounded-xl border border-line bg-white/[0.015] p-3">
            <div className="flex items-center gap-2 text-[14px] text-text">
              <span className="[&_svg]:size-3.5" style={{ color: toneHex(i.tone) }}>{i.icon}</span>
              {i.k}
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">{i.v}</p>
          </div>
        ))}
      </div>
      <div className="mx-5 mt-3 rounded-xl border border-line bg-black/30 p-3">
        <div className="mb-1.5 flex items-center justify-between text-[12px] text-dim">
          <span className="inline-flex items-center gap-1.5"><FileLock2 className="size-3" /> Latest lookups · audit ledger</span>
          <span>officer names masked</span>
        </div>
        <ul className="k-mono space-y-1 text-[12px]">
          {AUDIT_LINES.map((l) => (
            <li key={l.at} className="flex flex-wrap gap-x-3 text-muted">
              <span className="text-dim">{l.at}</span>
              <span className={l.what === 'submit' ? 'text-moss' : 'text-sky'}>{l.what}</span>
              <span className="text-text/85">{l.who}</span>
              <span className="truncate">{l.unit}</span>
              <span className="text-dim">{l.ref}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 px-5 text-[12px] text-dim">Retention periods are a proposal for I4C to decide — not an existing policy.</p>
    </Card>
  )
}
