import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeftRight, Banknote, Check, Coins, Landmark, Loader2, RefreshCw, X } from 'lucide-react'
import { Button, Card, CardHeader, Chip, toneA, toneHex, type Tone } from '@/components/kit'
import { Progress } from '@/components/animate-ui/components/radix/progress'
import { inr, mmss } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FIAT_STATS, MATCHES, MATCH_WEIGHTS, scoreMatch, secOf, verdict, type MatchRow } from './data'

const STAGES = [
  'Loading 26 P2P sell orders from the desk records',
  'Loading 1,412 bank credits from 14 statements',
  'Pairing on amount (± ₹100) and time (± 15 min)',
  'Scoring pairs and checking account reuse',
]

export function MatchEngine() {
  const [sel, setSel] = React.useState('r1')
  const [run, setRun] = React.useState<{ running: boolean; pct: number; stage: number; at: string; gen: number }>({
    running: false,
    pct: 100,
    stage: STAGES.length - 1,
    at: '21:41:06',
    gen: 0,
  })
  const timer = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])

  const rerun = () => {
    if (run.running) return
    setRun((r) => ({ ...r, running: true, pct: 0, stage: 0 }))
    const start = performance.now()
    const dur = 2600
    timer.current = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / dur)
      if (p >= 1) {
        if (timer.current) window.clearInterval(timer.current)
        const d = new Date()
        const at = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
        setRun((r) => ({ running: false, pct: 100, stage: STAGES.length - 1, at, gen: r.gen + 1 }))
      } else {
        setRun((r) => ({ ...r, pct: Math.round(p * 100), stage: Math.min(STAGES.length - 1, Math.floor(p * STAGES.length)) }))
      }
    }, 60)
  }

  const row = MATCHES.find((m) => m.id === sel)!
  const sc = scoreMatch(row)

  return (
    <Card className="pb-5">
      <CardHeader
        title="Match engine — linking each crypto sale to a bank credit"
        tech="P2P order ↔ bank statement entry · score = 0.45·amount + 0.35·time + 0.20·account reuse"
        right={
          <Button variant="ember" size="sm" onClick={rerun} disabled={run.running}>
            {run.running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {run.running ? 'Matching…' : 'Re-run matching'}
          </Button>
        }
      />

      <div className="px-5 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          {run.running ? (
            <motion.div key="run" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-line bg-white/[0.02] p-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-text/90">{STAGES[run.stage]}</span>
                <span className="k-num text-muted">{run.pct}%</span>
              </div>
              <Progress value={run.pct} className="mt-2 h-1.5 bg-white/[0.06]" />
              <div className="mt-2 flex gap-3 text-[11.5px] text-dim">
                {STAGES.map((s, i) => (
                  <span key={s} className={cn('flex items-center gap-1', i < run.stage ? 'text-moss' : i === run.stage ? 'text-text' : '')}>
                    {i < run.stage ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                    Step {i + 1}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <Chip tone="moss" dot>
                {FIAT_STATS.ordersMatched} of {FIAT_STATS.ordersTotal} matched
              </Chip>
              <Chip tone="gold" dot>
                2 need review
              </Chip>
              <Chip dot>1 awaiting statement</Chip>
              <span className="text-dim">· last run {run.at} IST · showing 9 of 26 orders</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 gap-4 px-3 pt-3 xl:grid-cols-[1.3fr_1fr] xl:px-5">
        {/* ── table ── */}
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-dim">
                <th className="px-2 py-2 font-normal">Crypto side · P2P order</th>
                <th className="px-2 py-2 font-normal">Bank side · credit</th>
                <th className="px-2 py-2 text-right font-normal">Δ amount</th>
                <th className="px-2 py-2 text-right font-normal">Δ time</th>
                <th className="w-[120px] px-2 py-2 font-normal">Match score</th>
              </tr>
            </thead>
            <tbody key={run.gen}>
              {MATCHES.map((m, i) => (
                <Row key={m.id} m={m} i={i} active={m.id === sel} dim={run.running} onClick={() => setSel(m.id)} />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── evidence pair ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={row.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-line-2 bg-black/20 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[14px] font-medium text-text">Evidence pair</div>
                <div className="text-[12px] text-dim">
                  {row.desk} {row.order} ↔ {row.bank ? `${row.bank.split(' ')[0]} ${row.acct}` : 'no bank credit yet'}
                </div>
              </div>
              <VerdictChip m={row} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <Side
                tone="gold"
                icon={<Coins />}
                title="P2P sell order"
                rows={[
                  ['Desk', `${row.desk} ${row.order}`],
                  ['Seller', 'SaffronTrade_77'],
                  ['Sold', `${row.usdt.toLocaleString('en-IN')} USDT`],
                  ['Buyer pays', `₹${row.orderINR.toLocaleString('en-IN')}`],
                  ['Method', row.channel + (row.vpa ? ` → ${row.vpa}` : '')],
                  ['Placed', `${row.orderAt} IST`],
                ]}
              />
              <div className="grid place-items-center text-dim">
                <ArrowLeftRight className="size-4 rotate-90 sm:rotate-0" />
              </div>
              <Side
                tone="sky"
                icon={<Landmark />}
                title="Bank credit"
                empty={!row.bank}
                rows={
                  row.bank
                    ? [
                        ['Bank', row.bank],
                        ['Account', row.acct!],
                        ['Credited', `₹${row.creditINR!.toLocaleString('en-IN')}`],
                        ['UTR', row.utr!],
                        ['Narration', `"${row.narration}"`],
                        ['Time', `${row.creditAt} IST`],
                      ]
                    : []
                }
              />
            </div>

            {/* factors */}
            <div className="mt-4 space-y-2">
              {[
                { k: 'Amount matches', tech: sc.dAmt === null ? 'no credit' : sc.dAmt === 0 ? 'exact to the rupee' : `off by ₹${Math.abs(sc.dAmt)} (bank fee?)`, v: sc.amount, w: MATCH_WEIGHTS.amount },
                { k: 'Credit within 3 minutes of the order', tech: sc.dSec === null ? 'no credit' : `gap ${mmss(sc.dSec)}`, v: sc.time, w: MATCH_WEIGHTS.time },
                { k: 'Account seen in other cases', tech: row.reuseCases ? `${row.reuseCases} other cases` : 'first time seen', v: sc.reuse, w: MATCH_WEIGHTS.reuse },
              ].map((f) => (
                <div key={f.k} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className={cn('grid size-4 shrink-0 place-items-center rounded-full', f.v >= 0.9 ? 'bg-moss/15 text-moss' : f.v > 0 ? 'bg-gold/15 text-gold' : 'bg-white/[0.06] text-dim')}>
                    {f.v > 0 ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                  </span>
                  <div className="w-[48%] min-w-0">
                    <div className="truncate text-text/90">{f.k}</div>
                    <div className="truncate text-[11px] text-dim">{f.tech}</div>
                  </div>
                  <div className="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${f.v * 100}%` }}
                      transition={{ duration: 0.5 }}
                      style={{ background: toneHex(f.v >= 0.9 ? 'moss' : 'gold') }}
                    />
                  </div>
                  <span className="k-mono w-[74px] text-right text-[11.5px] text-muted">
                    {f.w.toFixed(2)} × {f.v.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-line pt-2 text-[13px]">
                <span className="text-muted">Match score</span>
                <span className="k-num text-[16px]" style={{ color: toneHex(verdict(sc.total, !!row.bank).tone === 'neutral' ? 'white' : verdict(sc.total, !!row.bank).tone) }}>
                  {sc.total.toFixed(2)}
                </span>
              </div>
            </div>

            <MiniTimeline m={row} />
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mx-5 mt-3 text-[12px] leading-snug text-dim">
        A match means the timing and amounts line up — strong circumstantial evidence, not proof. Pairs below 0.70 go to an officer; nothing is
        auto-filed.
      </p>
    </Card>
  )
}

function Row({ m, i, active, dim, onClick }: { m: MatchRow; i: number; active: boolean; dim: boolean; onClick: () => void }) {
  const sc = scoreMatch(m)
  const v = verdict(sc.total, !!m.bank)
  const t: Tone = v.tone === 'neutral' ? 'white' : v.tone
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dim ? 0.35 : 1, y: 0 }}
      transition={{ delay: dim ? 0 : i * 0.05, duration: 0.3 }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      aria-selected={active}
      className={cn(
        'cursor-pointer border-t border-line outline-none transition-colors focus-visible:bg-white/[0.04]',
        active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]',
      )}
      style={active ? { boxShadow: `inset 3px 0 0 ${toneHex('ember')}` } : undefined}
    >
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5 text-text">
          <span className="size-1.5 rounded-full bg-gold" />
          {m.desk} <span className="k-mono text-muted">{m.order}</span>
        </div>
        <div className="k-num pl-3 text-[12.5px] text-text/80">
          {inr(m.orderINR)} <span className="font-normal text-dim">· {m.orderAt}</span>
        </div>
      </td>
      <td className="px-2 py-2">
        {m.bank ? (
          <>
            <div className="flex items-center gap-1.5 text-text">
              <span className="size-1.5 rounded-full bg-sky" />
              {m.bank.split(' ')[0]} <span className="k-mono text-muted">{m.acct}</span>
            </div>
            <div className="k-num pl-3 text-[12.5px] text-text/80">
              {inr(m.creditINR!)} <span className="font-normal text-dim">· {m.creditAt}</span>
            </div>
          </>
        ) : (
          <span className="text-[12.5px] text-dim">No credit found yet</span>
        )}
      </td>
      <td className={cn('k-num px-2 py-2 text-right text-[13px]', sc.dAmt === 0 ? 'text-moss' : sc.dAmt === null ? 'text-dim' : 'text-gold')}>
        {sc.dAmt === null ? '—' : sc.dAmt === 0 ? '₹0' : `−₹${Math.abs(sc.dAmt)}`}
      </td>
      <td className={cn('k-num px-2 py-2 text-right text-[13px]', sc.dSec === null ? 'text-dim' : sc.dSec <= 180 ? 'text-moss' : 'text-gold')}>
        {sc.dSec === null ? '—' : mmss(sc.dSec)}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="k-num w-8 text-[13.5px]" style={{ color: toneHex(t) }}>
            {sc.total.toFixed(2)}
          </span>
          <div className="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${sc.total * 100}%`, background: toneHex(t), boxShadow: `0 0 8px ${toneA(t, 0.5)}` }} />
          </div>
        </div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: v.tone === 'neutral' ? undefined : toneHex(v.tone) }}>
          {v.label}
        </div>
      </td>
    </motion.tr>
  )
}

function VerdictChip({ m }: { m: MatchRow }) {
  const sc = scoreMatch(m)
  const v = verdict(sc.total, !!m.bank)
  return (
    <Chip tone={v.tone} dot>
      {v.label}
    </Chip>
  )
}

function Side({ tone, icon, title, rows, empty }: { tone: Tone; icon: React.ReactNode; title: string; rows: [string, string][]; empty?: boolean }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: toneA(tone, 0.25), background: toneA(tone, 0.04) }}>
      <div className="flex items-center gap-1.5 text-[12.5px] [&_svg]:size-3.5" style={{ color: toneHex(tone) }}>
        {icon}
        {title}
      </div>
      {empty ? (
        <div className="mt-3 flex flex-col items-center gap-1 py-4 text-center text-[12.5px] text-dim">
          <Banknote className="size-4" />
          Bank statement for this VPA not received yet — lawful request pending.
        </div>
      ) : (
        <dl className="mt-1.5 space-y-0.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 text-[12px]">
              <dt className="text-dim">{k}</dt>
              <dd className="truncate text-right text-text/90" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Two aligned lanes (crypto vs bank) on one clock, with a connector between the order and the credit. */
function MiniTimeline({ m }: { m: MatchRow }) {
  const tOrder = secOf(m.orderAt)
  const tRel = secOf(m.releaseAt)
  const tCred = m.creditAt ? secOf(m.creditAt) : null
  const lo = tOrder - 30
  const hi = Math.max(tRel, tCred ?? tRel) + 30
  const x = (t: number) => ((t - lo) / (hi - lo)) * 100
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600)
    const mi = Math.floor((t % 3600) / 60)
    const s = t % 60
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  const lanes: { label: string; tone: Tone; y: number }[] = [
    { label: 'Crypto', tone: 'gold', y: 34 },
    { label: 'Bank', tone: 'sky', y: 72 },
  ]
  return (
    <div className="mt-4">
      <div className="text-[12.5px] text-muted">Same clock, two ledgers</div>
      <div className="mt-2 flex gap-2">
        <div className="relative w-12 shrink-0 text-[11.5px] text-dim" style={{ height: 106 }}>
          {lanes.map((l) => (
            <span key={l.label} className="absolute -translate-y-1/2" style={{ top: l.y }}>
              {l.label}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: 106 }}>
          {lanes.map((l) => (
            <div key={l.label} className="absolute inset-x-0 h-px" style={{ top: l.y, background: toneA(l.tone, 0.3) }} />
          ))}
          {tCred !== null && (
            <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 106">
              <motion.line
                x1={x(tOrder)}
                y1={34}
                x2={x(tCred)}
                y2={72}
                stroke={toneHex('white')}
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
              <motion.line
                x1={x(tCred)}
                y1={72}
                x2={x(tRel)}
                y2={34}
                stroke={toneHex('moss')}
                strokeOpacity={0.6}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              />
            </svg>
          )}
          <Marker left={x(tOrder)} top={34} tone="gold" label="Order placed" time={fmt(tOrder)} above />
          <Marker left={x(tRel)} top={34} tone="gold" label="USDT released" time={fmt(tRel)} above delay={0.8} />
          {tCred !== null && <Marker left={x(tCred)} top={72} tone="sky" label="Rupees credited" time={fmt(tCred)} delay={0.45} />}
          {tCred !== null && (
            <span
              className="k-num absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-2 bg-[#141415] px-1.5 text-[11px] text-text"
              style={{ left: `${(x(tOrder) + x(tCred)) / 2}%`, top: 53 }}
            >
              {mmss(tCred - tOrder)}
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-dim">
        {tCred !== null
          ? `The seller released the USDT ${tRel - tCred}s after the rupees landed — they were watching this bank account.`
          : 'The order completed on the desk, but the matching bank credit has not been received yet.'}
      </p>
    </div>
  )
}

function Marker({ left, top, tone, label, time, above, delay = 0 }: { left: number; top: number; tone: Tone; label: string; time: string; above?: boolean; delay?: number }) {
  const edge = left < 18 ? 'left' : left > 82 ? 'right' : 'center'
  return (
    <motion.div
      className="absolute"
      style={{ left: `${left}%`, top }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 22 }}
    >
      <span
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#111]"
        style={{ background: toneHex(tone), boxShadow: `0 0 10px ${toneHex(tone)}` }}
      />
      <span
        className={cn(
          'absolute whitespace-nowrap text-[11px] leading-tight',
          above ? 'bottom-2' : 'top-2',
          edge === 'left' ? '-left-1' : edge === 'right' ? '-right-1 text-right' : '-translate-x-1/2 text-center',
        )}
      >
        <span className="block text-text/85">{label}</span>
        <span className="k-mono block text-dim">{time}</span>
      </span>
    </motion.div>
  )
}
