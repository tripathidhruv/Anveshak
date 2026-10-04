import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Globe2, Languages, Radar, ScanSearch, Search, ShieldAlert, Users } from 'lucide-react'
import { Address, Button, Card, CardHeader, Chip, CurveChart, Meter, toneA, toneHex, type Tone } from '@/components/kit'
import { Progress, ProgressIndicator } from '@/components/animate-ui/primitives/radix/progress'
import { cn } from '@/lib/utils'
import { CRED_WEIGHTS, OSINT_WALLETS, REPORTS, SOURCES, TL_FIRST, TL_INDIA, TL_LABELS, TL_PUBLIC, TL_REKHA, credOf, type Report } from './data'

const credTone = (v: number): Tone => (v >= 0.7 ? 'moss' : v >= 0.4 ? 'gold' : 'crimson')
const credLabel = (v: number) => (v >= 0.7 ? 'Used as evidence' : v >= 0.4 ? 'Corroboration only' : 'Discarded')

type Phase = 'idle' | 'scanning' | 'done'

/* ───────────── Scan + hit list + report cards ───────────── */
export function OsintScan({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [prog, setProg] = React.useState<number[]>(SOURCES.map(() => 0))
  const [wallet, setWallet] = React.useState(OSINT_WALLETS[0].addr)
  const timer = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])

  const run = () => {
    if (timer.current) window.clearInterval(timer.current)
    setPhase('scanning')
    setProg(SOURCES.map(() => 0))
    let t = 0
    timer.current = window.setInterval(() => {
      t += 1
      // sources run staggered and overlap a little, ~2.4 s total
      const next = SOURCES.map((_, i) => Math.max(0, Math.min(100, (t - i * 4) * 9)))
      setProg(next)
      if (next.every((p) => p >= 100)) {
        if (timer.current) window.clearInterval(timer.current)
        timer.current = null
        setPhase('done')
      }
    }, 60)
  }

  const hitsBySource = (src: string) => REPORTS.filter((r) => r.source === src).length
  const revealed = (src: string, i: number) => Math.round((hitsBySource(src) * prog[i]) / 100)
  const totalFound = SOURCES.reduce((a, s, i) => a + revealed(s.id, i), 0)
  const walletReports = REPORTS.filter((r) => r.wallet === wallet).sort((a, b) => credOf(b) - credOf(a))
  const meta = OSINT_WALLETS.find((w) => w.addr === wallet)!

  return (
    <Card variant="glass" className="pb-4">
      <CardHeader
        title="What victims abroad already posted about these wallets"
        tech="OSINT cross-reference · every suspect wallet vs public crowd-reported scam data"
        right={
          <>
            {phase === 'done' && <Chip tone="moss" dot>Scan complete</Chip>}
            {phase === 'scanning' && <Chip tone="ember" dot pulse>Scanning</Chip>}
            <Button variant="ember" size="sm" onClick={run} disabled={phase === 'scanning'}>
              <ScanSearch /> {phase === 'done' ? 'Scan again' : 'Scan public sources'}
            </Button>
          </>
        }
      />
      <p className="max-w-3xl px-5 pt-2 text-[13.5px] leading-relaxed text-muted">
        Victims in other countries often post scam wallets on public scam-report sites and forums — sometimes before anyone in India files a
        complaint. ANVESHAK checks every wallet on the trace against these public sources and scores each report, because crowd reports can be wrong or
        malicious.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 px-5 lg:grid-cols-[300px_1fr]">
        {/* left: sources + wallets */}
        <div className="min-w-0 space-y-4">
          <div className="space-y-2.5">
            {SOURCES.map((s, i) => (
              <div key={s.id}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate text-text/90">{s.id}</span>
                  <span className="k-mono shrink-0 text-[12px] text-dim">{phase === 'idle' ? s.size : `${revealed(s.id, i)} hits`}</span>
                </div>
                <Progress value={phase === 'idle' ? 0 : prog[i]} className="relative mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <ProgressIndicator className="h-full w-full rounded-full" style={{ background: `linear-gradient(90deg, ${toneA(s.tone, 0.4)}, ${toneHex(s.tone)})`, boxShadow: `0 0 10px ${toneA(s.tone, 0.5)}` }} />
                </Progress>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-1 text-[12.5px] text-muted">
              <span>Reports found</span>
              <span className="k-num text-[18px] text-text">{phase === 'idle' ? '—' : totalFound}</span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[12.5px] text-dim">Wallets on this trace</div>
            <ul className="space-y-1">
              {OSINT_WALLETS.map((w) => {
                const n = REPORTS.filter((r) => r.wallet === w.addr).length
                const show = phase === 'done'
                const on = show && wallet === w.addr
                return (
                  <li key={w.addr}>
                    <button
                      type="button"
                      disabled={!show || n === 0}
                      onClick={() => setWallet(w.addr)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:cursor-default',
                        on ? 'border-line-2 bg-white/[0.05]' : 'border-transparent hover:bg-white/[0.03]',
                      )}
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneHex(w.tone) }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] text-text/90">{w.role}</div>
                        <div className="k-mono truncate text-[11.5px] text-dim">{w.addr}</div>
                      </div>
                      <span
                        className={cn('k-num min-w-6 rounded-md px-1.5 py-0.5 text-center text-[12.5px]', !show && 'text-dim')}
                        style={show && n > 0 ? { background: toneA(n > 2 ? 'crimson' : 'gold', 0.14), color: toneHex(n > 2 ? 'crimson' : 'gold') } : undefined}
                      >
                        {show ? n : '·'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* right: report cards */}
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {phase !== 'done' ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="k-dashed grid h-full min-h-[260px] place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid size-11 place-items-center rounded-full border border-line-2 text-muted">
                    {phase === 'scanning' ? <Radar className="size-5 animate-spin text-ember [animation-duration:2.4s]" /> : <Search className="size-5" />}
                  </span>
                  <p className="mt-3 max-w-sm text-[14px] text-muted">
                    {phase === 'scanning' ? (
                      <>Checking {OSINT_WALLETS.length} wallets against {SOURCES.length} public sources…</>
                    ) : (
                      <>
                        Run a scan to check the <span className="text-text">{OSINT_WALLETS.length} wallets</span> on this trace against public scam reports in any
                        language.
                      </>
                    )}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={wallet} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] text-text">{meta.role}</span>
                    <Address addr={meta.addr} chain={meta.addr.startsWith('0x') ? 'Ethereum' : 'TRON'} />
                  </div>
                  <span className="text-[12.5px] text-muted">
                    {walletReports.length} report{walletReports.length === 1 ? '' : 's'} · {new Set(walletReports.filter((r) => r.cc !== '—').map((r) => r.cc)).size || 0} countries
                  </span>
                </div>
                {walletReports.length === 0 ? (
                  <div className="k-dashed p-6 text-center text-[13.5px] text-muted">No public reports for this wallet.</div>
                ) : (
                  <div className="grid max-h-[520px] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                    {walletReports.map((r, i) => (
                      <ReportCard key={r.id} r={r} i={i} active={selected === r.id} onClick={() => onSelect(r.id)} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Card>
  )
}

function ReportCard({ r, i, active, onClick }: { r: Report; i: number; active: boolean; onClick: () => void }) {
  const c = credOf(r)
  const t = credTone(c)
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.3 }}
      className={cn(
        'flex flex-col rounded-xl border p-3 text-left transition-colors',
        active ? 'border-line-2 bg-white/[0.05]' : 'border-line bg-white/[0.015] hover:border-line-2',
        r.discarded && 'opacity-70',
      )}
      aria-pressed={active}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] text-text">
            <span className="k-mono rounded bg-white/[0.06] px-1 text-[11.5px] text-muted">{r.cc}</span>
            {r.country}
          </div>
          <div className="truncate text-[12px] text-dim">{r.source} · {r.date}</div>
        </div>
        <span className="k-num shrink-0 rounded-md px-1.5 py-0.5 text-[12.5px]" style={{ background: toneA(t, 0.14), color: toneHex(t) }} title="Credibility score">
          {c.toFixed(2)}
        </span>
      </div>
      <p className={cn('mt-2 text-[13px] leading-snug text-text/80', r.discarded && 'line-through decoration-crimson/60')}>“{r.excerpt}”</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {r.keywords.map((k) => (
          <span key={k} className="rounded-full bg-crimson/10 px-1.5 py-px text-[11.5px] text-crimson">{k}</span>
        ))}
      </div>
      <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-0.5 pt-2 text-[11.5px] text-dim">
        <span className="inline-flex items-center gap-1"><Languages className="size-3" />{r.lang}</span>
        <span className="k-num text-[12.5px] text-muted">{r.amount}</span>
      </div>
      <div className={cn('mt-1.5 flex items-start gap-1 text-[12px]', r.s.onchain >= 0.7 ? 'text-teal' : r.s.onchain >= 0.4 ? 'text-gold' : 'text-crimson')}>
        {r.s.onchain >= 0.7 ? <Check className="mt-px size-3 shrink-0" /> : <ShieldAlert className="mt-px size-3 shrink-0" />}
        {r.onchainNote}
      </div>
    </motion.button>
  )
}

/* ───────────── Credibility breakdown ───────────── */
export function Credibility({ selected }: { selected: string }) {
  const r = REPORTS.find((x) => x.id === selected) ?? REPORTS[0]
  const c = credOf(r)
  const t = credTone(c)
  const bands = [
    { label: 'Used as evidence', tone: 'moss' as Tone, n: REPORTS.filter((x) => credOf(x) >= 0.7).length },
    { label: 'Corroboration only', tone: 'gold' as Tone, n: REPORTS.filter((x) => credOf(x) >= 0.4 && credOf(x) < 0.7).length },
    { label: 'Discarded', tone: 'crimson' as Tone, n: REPORTS.filter((x) => credOf(x) < 0.4).length },
  ]
  return (
    <Card className="h-full pb-5">
      <CardHeader title="How much we trust each report" tech="credibility = Σ weight × factor · click a report card to inspect it" right={<Chip tone={t} dot>{credLabel(c)}</Chip>} />
      <div className="px-5 pt-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] text-text">{r.country} · {r.source}</div>
                <div className="k-mono truncate text-[12px] text-dim">{r.id} · {r.wallet}</div>
              </div>
              <span className="k-num text-[28px] leading-none" style={{ color: toneHex(t) }}>{c.toFixed(2)}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {CRED_WEIGHTS.map((f) => {
                const s = r.s[f.key]
                return (
                  <div key={f.key}>
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="truncate text-text/90">{f.plain}</span>
                      <span className="k-mono shrink-0 text-[12px] text-muted">
                        {f.w.toFixed(2)} × {s.toFixed(2)} = <span className="text-text">{(f.w * s).toFixed(2)}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Meter value={s} tone={s >= 0.7 ? 'moss' : s >= 0.4 ? 'gold' : 'crimson'} height={5} />
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-dim">{f.tech}</div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {bands.map((b) => (
            <div key={b.label} className="rounded-xl border border-line bg-white/[0.015] p-2.5">
              <div className="k-num text-[18px]" style={{ color: toneHex(b.tone) }}>{b.n}</div>
              <div className="text-[12px] leading-tight text-muted">{b.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-snug text-dim">
          Thresholds: ≥ 0.70 used as evidence · 0.40–0.70 corroboration only · &lt; 0.40 discarded. One report named the victim’s own wallet as the scammer — the
          blockchain contradicts it, so it scores 0.12 and is dropped.
        </p>
      </div>
    </Card>
  )
}

/* ───────────── Timeline: reported before the complaint ───────────── */
export function EarlyWarning() {
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="The collection wallet was public 9 days before Rekha’s complaint"
        tech="cumulative public reports vs Indian complaints later traced to the same wallet · 20 Aug – 06 Sep 2026"
        right={<Chip tone="ember" dot>9-day head start</Chip>}
      />
      <div className="px-5 pt-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-sky" />Public crowd reports (abroad)</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-crimson" />Indian complaints traced to the wallet</span>
        </div>
        <CurveChart
          className="mt-3"
          height={196}
          labels={TL_LABELS}
          series={[
            { name: 'Public reports', tone: 'sky', data: TL_PUBLIC },
            { name: 'Indian complaints', tone: 'crimson', data: TL_INDIA },
          ]}
          highlight={{ series: 0, index: TL_FIRST, title: '26 Aug · first public report' }}
          format={(v) => String(v)}
        />
        {/* 9-day bracket */}
        <div className="relative mt-3 h-12">
          <div
            className="absolute top-0 h-12 rounded-lg border border-dashed border-ember/50 bg-ember/[0.06]"
            style={{ left: `${(TL_FIRST / (TL_LABELS.length - 1)) * 100}%`, width: `${((TL_REKHA - TL_FIRST) / (TL_LABELS.length - 1)) * 100}%` }}
          >
            <div className="flex h-full items-center justify-between gap-2 px-2 text-[12px]">
              <span className="truncate text-sky">26 Aug · first report</span>
              <span className="k-num hidden text-[14.5px] text-ember sm:inline">9 days</span>
              <span className="truncate text-right text-crimson">04 Sep · Rekha</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          <span className="text-text">14 Indian victims, including Rekha, paid into this wallet after it was first reported abroad.</span> With daily OSINT
          scans, ANVESHAK could have flagged it to exchanges 9 days earlier.
        </p>
      </div>
    </Card>
  )
}

/* ───────────── Country breakdown ───────────── */
export function Countries() {
  const credible = REPORTS.filter((r) => r.cc !== '—' && !r.discarded && credOf(r) >= 0.4 && (r.wallet === OSINT_WALLETS[0].addr || r.wallet === OSINT_WALLETS[1].addr))
  const by = Object.entries(
    credible.reduce<Record<string, { n: number; cc: string; langs: Set<string> }>>((a, r) => {
      a[r.country] ||= { n: 0, cc: r.cc, langs: new Set() }
      a[r.country].n++
      a[r.country].langs.add(r.lang.split(' ·')[0])
      return a
    }, {}),
  ).sort((a, b) => b[1].n - a[1].n)
  const max = Math.max(...by.map(([, v]) => v.n))
  const langs = new Set(credible.map((r) => r.lang.split(' ·')[0]))
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Where the reports come from" tech="credible reports on the scammer + collection wallets, by reporter country" right={<Globe2 className="size-4 text-muted" />} />
      <div className="px-5 pt-2">
        <div className="flex items-baseline gap-2">
          <span className="k-num text-[26px] text-text">{credible.length}</span>
          <span className="text-[12.5px] text-muted">reports · {by.length} countries · {langs.size} languages</span>
        </div>
        <ul className="mt-3 space-y-2">
          {by.map(([country, v], i) => (
            <li key={country} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5">
              <span className="k-mono rounded bg-white/[0.06] px-1 text-center text-[11.5px] text-muted">{v.cc}</span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] text-text/90">{country}</span>
                  <span className="truncate text-[11.5px] text-dim">{[...v.langs].join(', ')}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(v.n / max) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
                    style={{ background: `linear-gradient(90deg, ${toneA('sky', 0.4)}, ${toneHex('sky')})`, boxShadow: `0 0 8px ${toneA('sky', 0.45)}` }}
                  />
                </div>
              </div>
              <span className="k-num w-5 text-right text-[14.5px] text-text">{v.n}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-white/[0.015] p-2.5 text-[12.5px] leading-snug text-muted">
          <Users className="mt-0.5 size-3.5 shrink-0 text-sky" />
          Same script everywhere — “part-time job”, “like videos”, “VIP”, “pay to withdraw”. One operator, many countries: this is the cross-border evidence
          an MLAT request needs.
        </div>
      </div>
    </Card>
  )
}
