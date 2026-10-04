import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, FolderOpen, Network, Radio, ScanText, Search, Snowflake, Timer, X } from 'lucide-react'
import { Button, Card, CardHeader, Chip, DemoChip, Delta, Donut, PageHeader, Reveal, Sparkline, Stat, toneHex, type Tone } from '@/components/kit'
import { Tabs, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/animate-ui/components/radix/sheet'
import { KPIS, SYNDICATES, type CaseStatus } from '@/data/demo'
import { api, errorText } from '@/api'
import { inr, short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CaseDetail } from './cases/CaseDetail'
import { CHAIN_TONE, Monogram, RecoverBadge, STATUS_TONE, inGoldenHour, syndicateOf, urgency, type CaseRow } from './cases/shared'

type FilterKey = 'all' | 'golden' | CaseStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'golden', label: 'Golden hour' },
  { key: 'Intake', label: 'New' },
  { key: 'Tracing', label: 'Tracing' },
  { key: 'Traced', label: 'Traced' },
  { key: 'Notice sent', label: 'Notice sent' },
  { key: 'Frozen', label: 'Frozen' },
  { key: 'Closed', label: 'Closed' },
]
const matches = (c: CaseRow, f: FilterKey) => (f === 'all' ? true : f === 'golden' ? inGoldenHour(c) : c.status === f)

const STATUS_ORDER: CaseStatus[] = ['Intake', 'Tracing', 'Traced', 'Notice sent', 'Frozen', 'Closed']
const GRID = 'grid grid-cols-[minmax(176px,1.5fr)_minmax(130px,1.1fr)_74px_84px_104px_minmax(150px,1.2fr)_84px_44px] items-center gap-3'

const SYN07 = SYNDICATES[0]

function useIsXl() {
  const q = '(min-width: 1280px)'
  const [m, setM] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  React.useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

export default function CasesPage() {
  const navigate = useNavigate()
  const isXl = useIsXl()
  const [t0] = React.useState(() => Date.now())
  const [filter, setFilter] = React.useState<FilterKey>('all')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<'urgent' | 'newest'>('urgent')
  const [params] = useSearchParams()
  const [selectedId, setSelectedId] = React.useState<string | null>(params.get('case'))
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [loaded, setLoaded] = React.useState<{ cases: CaseRow[] | null; error: string | null }>({ cases: null, error: null })
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    let live = true
    api
      .listCases()
      .then((cases) => live && setLoaded({ cases, error: null }))
      .catch((e) => live && setLoaded({ cases: [], error: errorText(e) }))
    return () => {
      live = false
    }
  }, [attempt])

  const CASES = loaded.cases ?? []
  const frozenThisWeek = CASES.filter((c) => c.recover === 'frozen').reduce((a, c) => a + c.amt, 0)
  const goldenCount = CASES.filter(inGoldenHour).length
  const q = query.trim().toLowerCase()
  const searched = CASES.filter((c) => !q || [c.id, c.who, c.city].some((s) => s.toLowerCase().includes(q)))
  const rows = searched
    .filter((c) => matches(c, filter))
    .map((c) => ({ c, idx: CASES.indexOf(c) }))
    .sort((a, b) => (sort === 'urgent' ? urgency(a.c, a.idx) - urgency(b.c, b.idx) : a.idx - b.idx))
    .map((r) => r.c)
  const selected = CASES.find((c) => c.id === selectedId) ?? CASES[0] ?? null

  React.useEffect(() => {
    if (isXl) setSheetOpen(false)
  }, [isXl])

  const select = (id: string) => {
    setSelectedId(id)
    if (!isXl) setSheetOpen(true)
  }

  const statusParts = STATUS_ORDER.map((s) => ({ s, value: CASES.filter((c) => c.status === s).length, tone: STATUS_TONE[s] })).filter((p) => p.value > 0)
  const syn07Mine = CASES.filter((c) => c.syndicate === SYN07.id).length

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <DemoChip /> <span>Cyber PS Jaipur · investigator queue</span>
            </>
          }
          title="Cases"
          tech="Golden hour first — ranked by the minutes left before stolen money reaches an exchange or is cashed out"
          actions={
            <Button onClick={() => navigate('/cases/new')}>
              <ScanText /> New case from complaint
            </Button>
          }
        />
      </Reveal>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          delay={0.05}
          icon={<FolderOpen />}
          title="Active cases"
          sub="across the cyber cell"
          spark={[118, 122, 125, 131, 129, 136, 141, 147]}
          tone="moss"
        >
          <Stat value={KPIS.activeCases} className="text-[24px] text-text" />
          <Delta value={12} className="ml-2" />
        </KpiTile>
        <KpiTile delay={0.1} icon={<Timer />} title="Inside golden hour" sub="money still moving — act now" spark={[1, 2, 1, 4, 2, 3, 5, 3]} tone="ember" live>
          <Stat value={goldenCount} className="text-[24px] text-ember" />
          <span className="ml-2 text-[12.5px] text-muted">cases</span>
        </KpiTile>
        <KpiTile
          delay={0.15}
          icon={<Radio />}
          title="Notices pending"
          sub="awaiting exchange reply · 2 past deadline"
          spark={[4, 6, 5, 8, 7, 9, 11, 9]}
          tone="gold"
        >
          <Stat value={9} className="text-[24px] text-text" />
          <Delta value={-18} good="down" className="ml-2" />
        </KpiTile>
        <KpiTile delay={0.2} icon={<Snowflake />} title="Frozen this week" sub="confirmed by exchanges" spark={[2, 3, 3, 6, 5, 8, 9, 12]} tone="moss">
          <Stat value={frozenThisWeek / 1e5} prefix="₹" suffix=" L" decimals={1} className="text-[24px] text-text" />
          <Delta value={31} className="ml-2" />
        </KpiTile>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_350px]">
        {/* ── Queue table ── */}
        <Reveal delay={0.1} className="min-w-0">
          <Card className="h-full pb-2">
            <CardHeader
              title="My queue"
              tech={`${rows.length} of ${CASES.length} cases shown · click a row for details`}
              right={
                <Chip tone="ember" dot pulse>
                  Live countdowns
                </Chip>
              }
            />
            <div className="space-y-2.5 px-5 pt-3">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <TabsList className="h-8 border border-line bg-white/[0.04]">
                    {FILTERS.map((f) => {
                      const n = searched.filter((c) => matches(c, f.key)).length
                      return (
                        <TabsTrigger key={f.key} value={f.key} className="gap-1.5 px-2.5 text-[13px]">
                          {f.label}
                          <span
                            className={cn(
                              'k-num rounded-full px-1.5 text-[11.5px] leading-4',
                              f.key === 'golden' ? 'bg-ember/15 text-ember' : 'bg-white/[0.06] text-muted',
                            )}
                          >
                            {n}
                          </span>
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                </div>
              </Tabs>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[200px] flex-1">
                  <span className="sr-only">Search cases</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by case ID, name or city"
                    className="h-8 w-full rounded-lg border border-line bg-white/[0.03] pl-8 pr-8 text-[13.5px] text-text outline-none placeholder:text-dim focus:border-line-2"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-dim hover:text-text"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </label>
                <Tabs value={sort} onValueChange={(v) => setSort(v as 'urgent' | 'newest')}>
                  <TabsList className="h-8 border border-line bg-white/[0.04]">
                    <TabsTrigger value="urgent" className="px-2.5 text-[13px]">
                      Most urgent first
                    </TabsTrigger>
                    <TabsTrigger value="newest" className="px-2.5 text-[13px]">
                      Newest
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="k-scroll mt-3 overflow-x-auto px-3">
              <div className="min-w-[960px] pb-1" role="table" aria-label="Case queue">
                <div role="row" className={cn(GRID, 'border-b border-line px-3 pb-2 text-[12px] text-dim')}>
                  <span role="columnheader">Case · complainant</span>
                  <span role="columnheader">Scam type</span>
                  <span role="columnheader">Network</span>
                  <span role="columnheader" className="text-right">
                    Lost
                  </span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Can we still recover it?</span>
                  <span role="columnheader">Syndicate</span>
                  <span role="columnheader">Exch.</span>
                </div>
                <div className="relative mt-1 space-y-1">
                  {!loaded.cases &&
                    [0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="k-shimmer h-[58px] rounded-xl border border-line bg-white/[0.02]" style={{ opacity: 1 - i * 0.13 }} />
                    ))}
                  {loaded.error && (
                    <div className="my-2 flex flex-wrap items-center gap-3 rounded-xl border border-crimson/30 bg-crimson/[0.06] p-4 text-[13.5px] text-text">
                      Couldn't load the queue. <span className="text-muted">{loaded.error}</span>
                      <Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                        Try again
                      </Button>
                    </div>
                  )}
                  <AnimatePresence mode="popLayout" initial={true}>
                    {rows.map((c, i) => (
                      <CaseRowView key={c.id} c={c} i={i} t0={t0} selected={c.id === selected?.id} onSelect={() => select(c.id)} />
                    ))}
                  </AnimatePresence>
                  {loaded.cases && !loaded.error && rows.length === 0 && (
                    <div className="k-dashed my-2 flex flex-col items-center gap-2 p-8 text-center text-[13.5px] text-muted">
                      No cases match{query ? ` “${query}”` : ''} in this view.
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('')
                          setFilter('all')
                        }}
                        className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]"
                      >
                        Show all cases
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* ── Side column ── */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          {selected && (
            <Reveal delay={0.15} className="hidden xl:block">
              <Card variant="glass">
                <CardHeader
                  title={selected.id}
                  tech={`${selected.who} · ${selected.city}, ${selected.state}`}
                  right={<span className="text-[12px] text-dim">selected</span>}
                />
                <div className="pt-3">
                  <CaseDetail c={selected} t0={t0} />
                </div>
              </Card>
            </Reveal>
          )}

          <Reveal delay={0.2}>
            <Card className="pb-4">
              <CardHeader title="Queue at a glance" tech="cases by status" />
              <div className="flex items-center gap-4 px-5 pt-3">
                <Donut
                  size={118}
                  stroke={13}
                  parts={statusParts.map((p) => ({ value: p.value, tone: p.tone, label: p.s }))}
                  center={
                    <div>
                      <div className="k-num text-[22px] leading-none text-text">{CASES.length}</div>
                      <div className="mt-0.5 text-[11.5px] text-dim">in my queue</div>
                    </div>
                  }
                />
                <ul className="min-w-0 flex-1 space-y-1">
                  {statusParts.map((p) => (
                    <li key={p.s}>
                      <button
                        type="button"
                        onClick={() => setFilter(p.s)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-[13px] hover:bg-white/[0.04]"
                      >
                        <span className="size-2 rounded-sm" style={{ background: toneHex(p.tone) }} />
                        <span className="flex-1 text-muted">{p.s}</span>
                        <span className="k-num text-text">{p.value}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mx-5 mt-4 rounded-xl border border-crimson/25 bg-crimson/[0.06] p-3.5">
                <div className="flex items-center gap-2 text-[12.5px] text-crimson">
                  <Network className="size-3.5" /> Consolidation
                </div>
                <div className="k-num mt-1.5 text-[18px] leading-tight text-text">One trace solved {SYN07.cases} cases</div>
                <p className="mt-1 text-[13px] leading-snug text-muted">
                  {SYN07.cases} victims in {SYN07.states} states paid into the same collection wallet{' '}
                  <span className="k-mono text-text/85">{short(SYN07.hub)}</span>. {syn07Mine} of them are in your queue.
                </p>
                <Link to="/syndicates" className="mt-2.5 inline-flex items-center gap-1 text-[13px] text-text hover:text-ember">
                  Open {SYN07.id} “Saffron Desk” <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      {/* ── Mobile / tablet detail sheet ── */}
      {selected && (
        <Sheet open={sheetOpen && !isXl} onOpenChange={setSheetOpen}>
          <SheetContent className="w-[92vw] max-w-[400px] overflow-y-auto border-line-2 bg-[#141415] p-0">
            <SheetHeader className="px-5 pb-0 pt-5">
              <SheetTitle className="k-num text-[18px] text-text">{selected.id}</SheetTitle>
              <SheetDescription className="text-[13.5px] text-muted">
                {selected.who} · {selected.city}, {selected.state}
              </SheetDescription>
            </SheetHeader>
            <CaseDetail c={selected} t0={t0} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function KpiTile({
  delay,
  icon,
  title,
  sub,
  spark,
  tone,
  live,
  children,
}: {
  delay: number
  icon: React.ReactNode
  title: string
  sub: string
  spark: number[]
  tone: Tone
  live?: boolean
  children: React.ReactNode
}) {
  return (
    <Reveal delay={delay}>
      <Card variant="speckle" grain className="h-[118px] p-4">
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full border border-line-2 bg-white/[0.06] [&_svg]:size-3.5',
                live ? 'text-ember' : 'text-muted',
              )}
            >
              {icon}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] text-text">{title}</div>
              <div className="truncate text-[11.5px] text-dim">{sub}</div>
            </div>
          </div>
          {live && (
            <Chip tone="ember" dot pulse>
              Live
            </Chip>
          )}
        </div>
        <div className="relative mt-3 flex items-end justify-between">
          <div className="flex items-baseline">{children}</div>
          <Sparkline data={spark} tone={tone} width={84} height={34} />
        </div>
      </Card>
    </Reveal>
  )
}

function CaseRowView({ c, i, t0, selected, onSelect }: { c: CaseRow; i: number; t0: number; selected: boolean; onSelect: () => void }) {
  const syn = syndicateOf(c)
  return (
    <motion.div
      layout
      role="row"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        layout: { type: 'spring', stiffness: 420, damping: 38 },
        opacity: { duration: 0.3, delay: i * 0.035 },
        y: { duration: 0.35, delay: i * 0.035 },
      }}
      className={cn(
        GRID,
        'relative cursor-pointer rounded-xl border px-3 py-2.5 outline-none transition-colors',
        selected ? 'border-line-2 bg-white/[0.05]' : 'border-transparent hover:border-line hover:bg-white/[0.025]',
      )}
    >
      {selected && (
        <motion.span
          layoutId="case-sel"
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-ember"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <div role="cell" className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-[14px] text-text">
          {c.id}
          {c.isNew && <span className="rounded-md bg-ember/15 px-1.5 py-px text-[10.5px] font-semibold text-ember">NEW</span>}
        </div>
        <div className="truncate text-[12px] text-dim">
          {c.who} · {c.city}
        </div>
      </div>
      <div role="cell" className="min-w-0">
        <div className="truncate text-[13.5px] text-text/85">{c.type}</div>
        <div className="text-[12px] text-dim">filed {c.filed}</div>
      </div>
      <div role="cell" className="flex items-center gap-1.5 text-[13px] text-muted">
        <span className="size-1.5 rounded-full" style={{ background: toneHex(CHAIN_TONE[c.chain]) }} />
        {c.chain === 'Ethereum' ? 'ETH' : c.chain === 'Bitcoin' ? 'BTC' : 'TRON'}
      </div>
      <div role="cell" className="k-num text-right text-[14px] text-text">
        {inr(c.amt)}
      </div>
      <div role="cell">
        <Chip tone={STATUS_TONE[c.status]} dot pulse={c.status === 'Tracing'}>
          {c.status}
        </Chip>
      </div>
      <div role="cell" className="min-w-0">
        <RecoverBadge c={c} t0={t0} />
      </div>
      <div role="cell">{syn ? <Chip tone={syn.tone}>{syn.id}</Chip> : <span className="text-[12.5px] text-dim">—</span>}</div>
      <div role="cell">
        <Monogram c={c} />
      </div>
    </motion.div>
  )
}
