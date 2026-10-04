import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Link2,
  Plus,
  Radio,
  Route,
  ScanText,
  Snowflake,
  ChevronDown,
} from 'lucide-react'
import {
  Address,
  BarColumns,
  Button,
  Card,
  CardHeader,
  Chip,
  CurveChart,
  Delta,
  HeatGrid,
  IconTile,
  Reveal,
  Sankey,
  Sparkline,
  Stat,
  useCountdown,
  type Tone,
} from '@/components/kit'
import { ACTIVITY, CASES, DAYS21, FROZEN_SERIES, KPIS, SYNDICATES, TRACED_SERIES, WEEKDAY_SWEEPS, EXCHANGES } from '@/data/demo'
import { inr, mmss } from '@/lib/format'
import { cn } from '@/lib/utils'

const ACT_ICON: Record<string, React.ReactNode> = {
  snow: <Snowflake />,
  route: <Route />,
  link: <Link2 />,
  alert: <AlertTriangle />,
  clock: <Clock3 />,
}

const CHAINS: { chain: string; sym: string; usdt: number; delta: number; spark: number[]; tone: Tone; good: boolean }[] = [
  { chain: 'TRON', sym: 'USDT · TRC-20', usdt: 78351, delta: 17, spark: [12, 18, 14, 22, 19, 27, 24, 31, 28, 36, 33, 41], tone: 'moss', good: true },
  { chain: 'Ethereum', sym: 'USDT · ERC-20', usdt: 32391, delta: -12, spark: [30, 28, 31, 26, 27, 22, 24, 21, 23, 19, 20, 17], tone: 'crimson', good: false },
  { chain: 'Bitcoin', sym: 'BTC', usdt: 8739, delta: 25, spark: [5, 6, 5, 8, 7, 9, 8, 11, 10, 12, 14, 15], tone: 'moss', good: true },
]

/** sweep events: 7 days × 12 two-hour blocks (synthetic) */
const HEAT: number[][] = [
  [0, 0, 0, 0.1, 0.2, 0.1, 0.3, 0.2, 0.4, 0.8, 0.6, 0.2],
  [0, 0.1, 0, 0, 0.1, 0.2, 0.2, 0.3, 0.5, 0.7, 0.9, 0.3],
  [0.1, 0, 0, 0.1, 0.1, 0.3, 0.2, 0.4, 0.6, 1, 0.8, 0.4],
  [0, 0, 0.1, 0, 0.2, 0.2, 0.4, 0.3, 0.7, 0.9, 0.7, 0.2],
  [0, 0.1, 0, 0.1, 0.1, 0.1, 0.3, 0.5, 0.5, 0.8, 0.6, 0.3],
  [0.2, 0.1, 0, 0, 0, 0.2, 0.3, 0.4, 0.8, 0.9, 1, 0.6],
  [0.3, 0.2, 0.1, 0, 0, 0.1, 0.2, 0.3, 0.6, 0.7, 0.9, 0.5],
]

export default function Dashboard() {
  const golden = CASES.filter((c) => c.goldenMin !== null && (c.recover === 'moving' || c.recover === 'at_rest')).slice(0, 3)
  const [range, setRange] = React.useState<'21d' | '7d'>('21d')
  const labels = range === '21d' ? DAYS21 : DAYS21.slice(-7)
  const traced = range === '21d' ? TRACED_SERIES : TRACED_SERIES.slice(-7)
  const frozen = range === '21d' ? FROZEN_SERIES : FROZEN_SERIES.slice(-7)

  return (
    <div className="space-y-4">
      {/* ── Hero: total value + actions ── */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
          <div>
            <div className="text-[14.5px] text-muted">Total value traced to an exchange</div>
            <div className="mt-1 flex items-center gap-2.5">
              <Stat value={KPIS.valueTracedINR / 1e7} prefix="₹" suffix=" Cr" decimals={2} className="text-[40px] leading-none text-text md:text-[46px]" />
              <span className="k-pill text-moss">
                <ArrowUpRight className="size-3" strokeWidth={2.5} />+{KPIS.valueTracedDelta}%
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Snowflake className="size-3.5" /> Frozen: <span className="text-text">{inr(KPIS.frozenINR)}</span>
                <Delta value={31} />
              </span>
              <span className="hidden text-dim sm:inline">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Radio className="size-3.5" /> Still moving: <span className="text-text">{inr(KPIS.atRiskINR)}</span>
                <Delta value={-8} good="down" />
              </span>
              <span className="hidden text-dim sm:inline">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" /> Median trace: <span className="text-text">{KPIS.medianTraceSec}s</span>
                <span className="text-dim">(was 4–6 weeks)</span>
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link to="/trace">
                <Button variant="ember">
                  <Plus /> New trace
                </Button>
              </Link>
              <Link to="/intake">
                <Button>
                  <ScanText /> Parse complaint
                </Button>
              </Link>
              <Link to="/interdiction">
                <Button>
                  <Snowflake /> Pre-emptive freeze
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden items-center gap-6 xl:flex">
            {[
              { k: 'Active cases', v: KPIS.activeCases },
              { k: 'Traced to exchange', v: KPIS.tracedToExchange },
              { k: 'Open syndicates', v: KPIS.syndicatesOpen },
            ].map((s) => (
              <div key={s.k} className="text-right">
                <Stat value={s.v} className="text-[26px] text-text" />
                <div className="text-[12.5px] text-dim">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── Chain tiles ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CHAINS.map((c, i) => (
          <Reveal key={c.chain} delay={0.05 + i * 0.05}>
            <Card variant="speckle" grain className="h-[118px] p-4">
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full border border-line-2 bg-white/[0.06] text-[11.5px] font-semibold">
                    {c.chain === 'TRON' ? 'T' : c.chain === 'Ethereum' ? 'Ξ' : '₿'}
                  </span>
                  <div>
                    <div className="text-[14px] text-text">{c.chain}</div>
                    <div className="text-[11.5px] text-dim">{c.sym}</div>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex items-end justify-between">
                <div>
                  <Stat value={c.usdt} className="text-[22px] text-text" />
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Delta value={c.delta} />
                    <span className="text-[11.5px] text-dim">traced this month</span>
                  </div>
                </div>
                <Sparkline data={c.spark} tone={c.tone} width={92} height={38} />
              </div>
            </Card>
          </Reveal>
        ))}
        <Reveal delay={0.2}>
          <div className="k-dashed flex h-[118px] flex-col justify-between p-4">
            <span className="grid size-7 place-items-center rounded-full border border-line-2 text-muted">
              <Plus className="size-3.5" />
            </span>
            <p className="text-[13.5px] leading-snug text-muted">
              Add another <span className="text-text">chain adapter</span> — Polygon, BSC or Solana — to the trace engine.
            </p>
          </div>
        </Reveal>
      </div>

      {/* ── Curves + weekday bars ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.75fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full pb-4">
            <CardHeader
              title="Stolen value traced vs value frozen"
              tech="₹ lakh per day · trace engine + freeze confirmations"
              right={
                <>
                  <button
                    onClick={() => setRange(range === '21d' ? '7d' : '21d')}
                    className="k-btn-ghost inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px]"
                  >
                    {range === '21d' ? 'Last 21 days' : 'Last 7 days'} <ChevronDown className="size-3" />
                  </button>
                  <span className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">All chains</span>
                </>
              }
            />
            <div className="px-5 pt-2">
              <div className="flex items-baseline gap-3">
                <Stat value={traced.reduce((a, b) => a + b, 0) * 100000 / 1e7} prefix="₹" suffix=" Cr" decimals={2} className="text-[26px] text-text" />
                <span className="flex items-center gap-3 text-[12.5px] text-muted">
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-crimson" />Traced</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-white" />Frozen</span>
                </span>
              </div>
              <CurveChart
                key={range}
                className="mt-3"
                height={210}
                labels={labels}
                series={[
                  { name: 'Traced', tone: 'crimson', data: traced },
                  { name: 'Frozen', tone: 'white', data: frozen },
                ]}
                highlight={{ series: 0, index: labels.length - 4, title: `Sep ${labels[labels.length - 4]}, 2026` }}
                format={(v) => `₹${v} L`}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card variant="glass" className="h-full pb-5">
            <CardHeader
              title="Sweeps detected this week"
              tech="sweep signature · funds out < 60 s, > 99% kept"
              right={
                <Link to="/trace" className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">
                  See all
                </Link>
              }
            />
            <div className="px-5 pt-2">
              <Stat value={313} className="text-[26px] text-text" />
              <span className="ml-2 text-[12.5px] text-muted">automated drains caught</span>
              <BarColumns className="mt-6" height={190} data={WEEKDAY_SWEEPS} format={(v) => `${v} sweeps`} />
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── Activity · Sankey · Heat ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_1.35fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title="Recent activity" tech="live event stream" right={<Link to="/audit" className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">See all</Link>} />
            <ul className="mt-2 divide-y divide-line px-3 pb-2">
              {ACTIVITY.map((a) => (
                <li key={a.title} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.025]">
                  <IconTile>{ACT_ICON[a.icon]}</IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-text">{a.title}</div>
                    <div className="truncate text-[12px] text-dim">{a.sub}</div>
                  </div>
                  <div className={cn('k-num shrink-0 text-[14px]', a.tone === 'moss' ? 'text-moss' : 'text-text')}>{a.value}</div>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card className="h-full pb-5">
            <CardHeader title="Where the stolen money went" tech="fund-flow Sankey · last 30 days" />
            <div className="px-5 pt-1">
              <Stat value={18.42} prefix="₹" suffix=" Cr" decimals={2} className="text-[26px] text-text" />
              <Sankey
                className="mt-4"
                height={200}
                nodeWidth={78}
                columns={[
                  [
                    { id: 'tron', label: 'TRON', value: 11.4, sub: '₹11.4 Cr' },
                    { id: 'eth', label: 'Ethereum', value: 5.1, sub: '₹5.1 Cr' },
                    { id: 'btc', label: 'Bitcoin', value: 1.9, sub: '₹1.9 Cr' },
                  ],
                  [
                    { id: 'exch', label: 'Exchanges', value: 14.6, sub: '₹14.6 Cr', tone: 'gold' },
                    { id: 'p2p', label: 'P2P desks', value: 2.4, sub: '₹2.4 Cr' },
                    { id: 'mix', label: 'Mixers', value: 1.4, sub: '₹1.4 Cr' },
                  ],
                  [
                    { id: 'frozen', label: 'Frozen', value: 6.2, sub: '₹6.2 Cr', tone: 'moss' },
                    { id: 'notice', label: 'Notice out', value: 8.4, sub: '₹8.4 Cr' },
                    { id: 'lost', label: 'Unrecovered', value: 3.8, sub: '₹3.8 Cr' },
                  ],
                ]}
                links={[
                  { from: 'tron', to: 'exch', value: 9.3, tone: 'gold' },
                  { from: 'tron', to: 'p2p', value: 1.6 },
                  { from: 'tron', to: 'mix', value: 0.5 },
                  { from: 'eth', to: 'exch', value: 4.0 },
                  { from: 'eth', to: 'mix', value: 0.9 },
                  { from: 'eth', to: 'p2p', value: 0.2 },
                  { from: 'btc', to: 'exch', value: 1.3 },
                  { from: 'btc', to: 'p2p', value: 0.6 },
                  { from: 'exch', to: 'frozen', value: 6.2, tone: 'moss' },
                  { from: 'exch', to: 'notice', value: 8.4 },
                  { from: 'p2p', to: 'lost', value: 2.4 },
                  { from: 'mix', to: 'lost', value: 1.4 },
                ]}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.2}>
          <Card className="h-full pb-5 lg:col-span-2 xl:col-span-1">
            <CardHeader title="When scammers move money" tech="sweep events · day × 2-hour block (IST)" right={<Chip tone="ember" dot>Peak 18–22h</Chip>} />
            <div className="px-5 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="k-num text-[26px] text-text">71%</span>
                <span className="text-[12.5px] text-muted">of sweeps happen after 6 pm</span>
              </div>
              <div className="mt-4 flex justify-center">
                <HeatGrid
                  data={HEAT}
                  cell={15}
                  gap={4}
                  rowLabels={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
                  colLabels={['0', '', '4', '', '8', '', '12', '', '16', '', '20', '']}
                  accent={{ '2-9': 'ember', '5-10': 'ember' }}
                  title={(r, c, v) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][r]} ${c * 2}:00–${c * 2 + 2}:00 · ${Math.round(v * 40)} sweeps`}
                />
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── Golden hour + syndicates + exchanges ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader
              title="Golden hour — money still recoverable"
              tech="cases ranked by time left before funds reach an exchange or cash out"
              right={<Chip tone="ember" dot pulse>Live</Chip>}
            />
            <div className="mt-3 space-y-2 px-3 pb-3">
              {golden.map((c) => (
                <GoldenRow key={c.id} c={c} />
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card variant="glass" className="h-full">
            <CardHeader title="Syndicates linked this month" tech="cross-case entity resolution" right={<Link to="/syndicates" className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">Open graph</Link>} />
            <ul className="mt-2 space-y-1 px-3 pb-3">
              {SYNDICATES.slice(0, 3).map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.03]">
                  <span className="k-num grid size-9 shrink-0 place-items-center rounded-lg border border-line-2 text-[12.5px]" style={{ color: `var(--k-${s.tone})` }}>
                    {s.id.split('-')[1]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-text">{s.name}</div>
                    <div className="text-[12px] text-dim">
                      {s.cases} cases · {s.states} states · via {s.exchanges.map((e) => EXCHANGES.find((x) => x.id === e)!.monogram).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="k-num text-[14px] text-text">{inr(s.valueINR)}</div>
                    <div className="text-[11.5px] text-dim">{Math.round(s.confidence * 100)}% linked</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}

function GoldenRow({ c }: { c: (typeof CASES)[number] }) {
  const left = useCountdown((c.goldenMin ?? 0) * 60)
  const urgent = left < 30 * 60
  return (
    <Link
      to="/trace"
      className="group flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3 py-2.5 hover:border-line-2 hover:bg-white/[0.03]"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-full border border-line-2">
        <span className={cn('absolute inset-1 rounded-full', urgent ? 'bg-ember/20' : 'bg-gold/15')} />
        <Radio className={cn('relative size-4', urgent ? 'text-ember' : 'text-gold')} />
      </span>
      <div className="min-w-[160px] flex-1">
        <div className="flex items-center gap-2 text-[14px] text-text">
          {c.id} <span className="text-dim">·</span> <span className="text-muted">{c.who}</span>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-dim">
          {c.type} · <Address addr={c.chain === 'TRON' ? 'TQm7bK3xF9jH2nL6pV4sD' : '0x9e4b8f07a2c6d13e5b'} chain={c.chain} className="py-0 text-[12px]" />
        </div>
      </div>
      <div className="text-right">
        <div className="k-num text-[14.5px] text-text">{inr(c.amt)}</div>
        <div className="text-[11.5px] text-dim">{c.recover === 'moving' ? 'moving between wallets' : 'resting in a wallet'}</div>
      </div>
      <div className="w-[96px] text-right">
        <div className={cn('k-mono text-[15.5px]', urgent ? 'text-ember' : 'text-gold')}>{mmss(left)}</div>
        <div className="text-[11.5px] text-dim">to act</div>
      </div>
    </Link>
  )
}
