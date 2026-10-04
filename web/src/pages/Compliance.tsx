import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlarmClock,
  BellRing,
  CheckCircle2,
  Download,
  FileWarning,
  Gavel,
  Landmark,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  CurveChart,
  Delta,
  DemoChip,
  IconTile,
  KV,
  Meter,
  PageHeader,
  Reveal,
  Sparkline,
  SubTabs,
  toneA,
  toneHex,
  useCountdown,
  type Tone,
} from '@/components/kit'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  GRADE_TONE,
  KESTREL_HRS,
  LADDER,
  LADDER_MAX_DAY,
  MERIDIAN_HRS,
  NOTICES,
  TREND_LABELS,
  WINDOW_HRS,
  ex,
  gradeExchanges,
  type Notice,
  type NoticeStatus,
} from './compliance/data'

/* ───────── helpers ───────── */

/** 187_200 s → "2d 04h" · 18_720 s → "5h 12m" · 725 s → "12m 05s" */
function dh(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(r).padStart(2, '0')}s`
}

type Ev = { t: string; text: string; tone: Tone; fresh?: boolean }
type Override = { status: NoticeStatus; events: Ev[] }

const STATUS_META: Record<NoticeStatus, { label: string; tone: Tone; pulse?: boolean; solid?: boolean }> = {
  awaiting: { label: 'Awaiting reply', tone: 'neutral', pulse: true },
  reminded: { label: 'Reminder sent', tone: 'ember', pulse: true },
  responded: { label: 'Responded', tone: 'moss' },
  breached: { label: 'Breached · reminded', tone: 'crimson' },
  escalated: { label: 'Breached → escalated', tone: 'crimson', solid: true },
}

function baseEvents(n: Notice): Ev[] {
  const e = ex(n.exchange)
  const out: Ev[] = [{ t: n.sentAt, text: `Notice sent to ${e.name} compliance desk`, tone: 'gold' }]
  if (n.exchange !== 'orbita' && n.exchange !== 'arcadia') out.push({ t: '+40 min', text: 'Delivery acknowledged by exchange', tone: 'neutral' })
  if (n.status === 'responded') {
    out.push({ t: `+${n.repliedHrs} h`, text: `Exchange replied — ${n.outcome}`, tone: 'moss' })
    return out
  }
  if (n.ageHrs >= WINDOW_HRS) out.push({ t: '+72 h', text: 'Response window missed — automated reminder sent', tone: 'ember' })
  if (n.status === 'escalated') out.push({ t: '+168 h', text: 'Escalated to FIU-IND · regulator copied on the case', tone: 'crimson' })
  if (n.ageHrs >= 240) out.push({ t: '+240 h', text: 'Blocking recommendation drafted (IT Act) — awaiting officer review', tone: 'crimson' })
  return out
}

function Monogram({ id, size = 30 }: { id: string; size?: number }) {
  const e = ex(id)
  return (
    <span
      className="k-num grid shrink-0 place-items-center rounded-lg border text-[12px]"
      style={{ width: size, height: size, color: toneHex(e.tone), borderColor: toneA(e.tone, 0.35), background: toneA(e.tone, 0.1) }}
    >
      {e.monogram}
    </span>
  )
}

/* ───────── page ───────── */

export default function CompliancePage() {
  const [overrides, setOverrides] = React.useState<Record<string, Override>>({})
  const [selected, setSelected] = React.useState(NOTICES[0].id)

  const statusOf = (n: Notice) => overrides[n.id]?.status ?? n.status
  const breachedCount = NOTICES.filter((n) => ['breached', 'escalated'].includes(statusOf(n))).length
  const remindersToday = Object.values(overrides).filter((o) => o.status === 'reminded').length

  const act = (n: Notice, kind: 'remind' | 'escalate') => {
    setOverrides((o) => {
      const prev = o[n.id] ?? { status: n.status, events: [] }
      const ev: Ev =
        kind === 'remind'
          ? { t: 'just now', text: 'Reminder sent early by SI Kavita Rathore — window clock unchanged', tone: 'ember', fresh: true }
          : { t: 'just now', text: 'Escalated to FIU-IND by SI Kavita Rathore · letter attached to case diary', tone: 'crimson', fresh: true }
      return { ...o, [n.id]: { status: kind === 'remind' ? 'reminded' : 'escalated', events: [...prev.events, ev] } }
    })
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span>What happens after the notice</span>
              <DemoChip />
            </>
          }
          title="Exchange Compliance"
          tech="Every other tool stops at “notice sent”. ANVESHAK keeps the clock running on each notice, escalates automatically when an exchange goes quiet, and grades every exchange on how it actually behaves."
          actions={
            <>
              <span className="k-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] text-muted">
                <Timer className="size-3.5" /> Window: {WINDOW_HRS} h
              </span>
              <Button>
                <Download /> Export SLA report
              </Button>
            </>
          }
        />
      </Reveal>

      {/* ── stat tiles ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { k: 'Notices still open', v: 14, suffix: '', sub: 'across 6 exchanges', spark: [9, 11, 10, 12, 13, 12, 14], tone: 'gold' as Tone, icon: <FileWarning /> },
          { k: 'Answered inside the window', v: 71, suffix: '%', sub: 'replied within 72 h', spark: [58, 61, 60, 66, 64, 69, 71], tone: 'moss' as Tone, icon: <ShieldCheck />, delta: 6 },
          { k: 'Breached & escalated', v: breachedCount, suffix: '', sub: remindersToday ? `${remindersToday} reminder${remindersToday > 1 ? 's' : ''} sent this session` : 'auto-reminded, then FIU-IND', spark: [1, 2, 2, 3, 3, 4, breachedCount], tone: 'crimson' as Tone, icon: <ShieldAlert /> },
          { k: 'Average time to reply', v: 26, suffix: ' h', sub: 'first substantive reply', spark: [38, 35, 33, 31, 30, 28, 26], tone: 'moss' as Tone, icon: <AlarmClock />, delta: -14 },
        ].map((s, i) => (
          <Reveal key={s.k} delay={0.05 + i * 0.05}>
            <Card variant="speckle" grain className="h-[124px] p-4">
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <IconTile tone={s.tone} size={28} className="[&_svg]:size-3.5">
                    {s.icon}
                  </IconTile>
                  <div className="text-[13.5px] text-muted">{s.k}</div>
                </div>
                {s.delta !== undefined && <Delta value={s.delta} good={s.delta < 0 ? 'down' : 'up'} />}
              </div>
              <div className="relative mt-4 flex items-end justify-between">
                <div>
                  <span className="k-num text-[26px] leading-none text-text">
                    <motion.span key={s.v} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
                      {s.v}
                    </motion.span>
                    {s.suffix}
                  </span>
                  <div className="mt-1 text-[12px] text-dim">{s.sub}</div>
                </div>
                <Sparkline data={s.spark} tone={s.tone} width={88} height={36} />
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <SubTabs
        tabs={[
          {
            key: 'notices',
            label: 'Notices on the clock',
            icon: AlarmClock,
            badge: breachedCount,
            render: () => (
              <div className="space-y-3">
                <p className="text-[13.5px] text-muted">Pick a notice to see where it stands on the escalation ladder, and remind or escalate from there.</p>
                    <NoticeDesk overrides={overrides} selected={selected} onSelect={setSelected} onAct={act} />
              </div>
            ),
          },
          {
            key: 'exchanges',
            label: 'How each exchange behaves',
            icon: Landmark,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
                <Reveal delay={0.1}>
                  <Scorecard />
                </Reveal>
                <Reveal delay={0.15}>
                  <Card className="h-full pb-4">
                    <CardHeader
                      title="Who answers fast, who stalls"
                      tech="hours to first reply · daily average · last 21 days"
                      right={<Chip tone="ember" dot>72 h window</Chip>}
                    />
                    <div className="px-5 pt-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="k-num text-[26px] text-text">71 h</span>
                        <span className="text-[12.5px] text-muted">Meridian today, up from 44 h</span>
                        <Delta value={61} good="down" />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[12.5px] text-muted">
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-gold" />Meridian Digital Exchange</span>
                        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-moss" />Kestrel Exchange</span>
                      </div>
                      <CurveChart
                        className="mt-3"
                        height={196}
                        labels={TREND_LABELS}
                        series={[
                          { name: 'Meridian', tone: 'gold', data: MERIDIAN_HRS },
                          { name: 'Kestrel', tone: 'moss', data: KESTREL_HRS },
                        ]}
                        highlight={{ series: 0, index: 19, title: 'Sep 20, 2026' }}
                        format={(v) => `${v} h`}
                      />
                      <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
                        Meridian is drifting towards the 72 h limit — ANVESHAK will shorten its reminder to 48 h if the trend holds for 7 more days.
                      </p>
                    </div>
                  </Card>
                </Reveal>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

/* ───────── notices table + ladder (owns the live clock) ───────── */

function NoticeDesk({
  overrides,
  selected,
  onSelect,
  onAct,
}: {
  overrides: Record<string, Override>
  selected: string
  onSelect: (id: string) => void
  onAct: (n: Notice, kind: 'remind' | 'escalate') => void
}) {
  const START = 10_000_000
  const left = useCountdown(START)
  const elapsed = START - left
  const statusOf = (n: Notice) => overrides[n.id]?.status ?? n.status
  const sel = NOTICES.find((n) => n.id === selected)!

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
      <Reveal delay={0.1}>
        <Card className="h-full">
          <CardHeader
            title="Notices and their response clocks"
            tech="BNSS §94 notices to exchanges · section reference to be verified · click a row"
            right={<Chip tone="neutral">10 most recent</Chip>}
          />
          <div className="k-scroll mt-3 overflow-x-auto px-3 pb-3">
            <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-dim">
                  <th className="px-3 py-1.5 font-normal">Notice · case</th>
                  <th className="px-3 py-1.5 font-normal">Exchange</th>
                  <th className="px-3 py-1.5 font-normal">Asks for · sent</th>
                  <th className="px-3 py-1.5 font-normal">Response window</th>
                  <th className="px-3 py-1.5 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {NOTICES.map((n) => (
                  <NoticeRow
                    key={n.id}
                    n={n}
                    status={statusOf(n)}
                    ageSec={n.ageHrs * 3600 + elapsed}
                    active={n.id === selected}
                    onSelect={() => onSelect(n.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
      <Reveal delay={0.15}>
        <LadderPanel
          n={sel}
          status={statusOf(sel)}
          ageSec={sel.ageHrs * 3600 + elapsed}
          extra={overrides[sel.id]?.events ?? []}
          onAct={(k) => onAct(sel, k)}
        />
      </Reveal>
    </div>
  )
}

function NoticeRow({ n, status, ageSec, active, onSelect }: { n: Notice; status: NoticeStatus; ageSec: number; active: boolean; onSelect: () => void }) {
  const e = ex(n.exchange)
  const bad = status === 'breached' || status === 'escalated'
  const windowLeft = WINDOW_HRS * 3600 - ageSec
  const meta = STATUS_META[status]
  const bg = bad ? toneA('crimson', active ? 0.12 : 0.06) : active ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.015)'

  let clock: React.ReactNode
  if (status === 'responded') {
    clock = (
      <div>
        <div className="k-mono text-[14px] text-moss">Replied in {n.repliedHrs} h</div>
        <div className="text-[11.5px] text-dim">inside the window</div>
      </div>
    )
  } else if (status === 'escalated') {
    clock = (
      <div>
        <div className="k-mono text-[14px] text-crimson">Day {Math.floor(ageSec / 86400)} · with FIU-IND</div>
        <div className="text-[11.5px] text-dim">{ageSec >= 10 * 86400 ? 'block recommendation drafted' : `block rec. in ${dh(10 * 86400 - ageSec)}`}</div>
      </div>
    )
  } else if (status === 'breached' || windowLeft <= 0) {
    clock = (
      <div>
        <div className="k-mono text-[14px] text-crimson">Overdue {dh(-windowLeft)}</div>
        <div className="text-[11.5px] text-dim">FIU-IND in {dh(7 * 86400 - ageSec)}</div>
      </div>
    )
  } else {
    const urgent = windowLeft < 12 * 3600
    clock = (
      <div className="w-[132px]">
        <div className={cn('k-mono text-[14px]', urgent ? 'text-ember' : 'text-text')}>{dh(windowLeft)} left</div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (ageSec / (WINDOW_HRS * 3600)) * 100)}%`,
              background: urgent ? toneHex('ember') : 'rgba(255,255,255,0.45)',
              boxShadow: urgent ? `0 0 8px ${toneA('ember', 0.6)}` : undefined,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <tr
      tabIndex={0}
      role="button"
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onSelect()
        }
      }}
      style={{ '--row-bg': bg } as React.CSSProperties}
      className="cursor-pointer outline-none [&>td]:bg-[var(--row-bg)] [&>td]:transition-colors [&>td]:duration-500 [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl focus-visible:[&>td]:bg-white/[0.06] hover:[&>td]:bg-white/[0.04]"
    >
      <td className="relative px-3 py-2.5">
        <span
          className="absolute inset-y-2 left-0 w-[3px] rounded-full transition-colors"
          style={{ background: active ? toneHex(bad ? 'crimson' : 'ember') : 'transparent' }}
        />
        <div className="k-mono text-[13.5px] text-text">{n.id}</div>
        <div className="text-[12px] text-dim">
          {n.caseId} · {n.victim}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Monogram id={n.exchange} size={26} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] text-text/90">{e.name}</div>
            <div className="text-[11.5px] text-dim">{e.jurisdiction}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-[13px] text-text/80">{n.type}</div>
        <div className="k-mono text-[11.5px] text-dim">{n.sentAt}</div>
      </td>
      <td className="px-3 py-2.5">{clock}</td>
      <td className="px-3 py-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.7, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="inline-block"
          >
            <Chip tone={meta.tone} dot={!meta.solid} pulse={meta.pulse} solid={meta.solid}>
              {meta.label}
            </Chip>
          </motion.span>
        </AnimatePresence>
      </td>
    </tr>
  )
}

function LadderPanel({
  n,
  status,
  ageSec,
  extra,
  onAct,
}: {
  n: Notice
  status: NoticeStatus
  ageSec: number
  extra: Ev[]
  onAct: (k: 'remind' | 'escalate') => void
}) {
  const e = ex(n.exchange)
  const ageDay = ageSec / 86400
  const markerDay = Math.min(
    LADDER_MAX_DAY,
    status === 'responded' ? (n.repliedHrs ?? 0) / 24 : status === 'escalated' ? Math.max(ageDay, 7) : ageDay,
  )
  const pct = (d: number) => (d / LADDER_MAX_DAY) * 100
  const closed = status === 'responded'
  const markerTone: Tone = closed ? 'moss' : status === 'escalated' || status === 'breached' ? 'crimson' : status === 'reminded' ? 'ember' : 'gold'

  const reached = (i: number) => {
    if (i === 0) return true
    if (closed) return false
    if (i === 1) return status === 'reminded' || markerDay >= 3
    if (i === 2) return status === 'escalated' || markerDay >= 7
    return markerDay >= 10
  }
  const current = closed ? -1 : [3, 2, 1, 0].find((i) => reached(i)) ?? 0

  let next: { label: string; value: string; tone: Tone }
  if (closed) next = { label: 'Closed', value: n.outcome ?? 'Replied', tone: 'moss' }
  else if (status === 'escalated') next = ageSec >= 10 * 86400 ? { label: 'Blocking recommendation', value: 'drafted · awaiting officer', tone: 'crimson' } : { label: 'Blocking recommendation in', value: dh(10 * 86400 - ageSec), tone: 'crimson' }
  else if (status === 'breached' || status === 'reminded' || ageSec >= WINDOW_HRS * 3600) next = { label: 'Escalates to FIU-IND in', value: dh(7 * 86400 - ageSec), tone: 'crimson' }
  else next = { label: 'Automated reminder in', value: dh(WINDOW_HRS * 3600 - ageSec), tone: 'gold' }

  const events = [...baseEvents(n), ...extra]

  return (
    <Card variant="glass" className="h-full pb-4">
      <CardHeader
        title="Where this notice stands"
        tech="escalation ladder · days since the notice was sent"
        right={
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={status} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Chip tone={STATUS_META[status].tone} dot pulse={STATUS_META[status].pulse}>
                {STATUS_META[status].label}
              </Chip>
            </motion.span>
          </AnimatePresence>
        }
      />
      <div className="px-5 pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={n.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}>
            <div className="flex items-center gap-2.5">
              <Monogram id={n.exchange} size={34} />
              <div className="min-w-0 flex-1">
                <div className="k-mono truncate text-[14px] text-text">{n.id}</div>
                <div className="truncate text-[12.5px] text-dim">
                  {e.name} · {n.caseId}
                </div>
              </div>
              <div className="text-right">
                <div className={cn('k-mono text-[16.5px]', next.tone === 'moss' ? 'text-moss' : next.tone === 'crimson' ? 'text-crimson' : 'text-gold')}>
                  {closed ? 'Closed' : next.value}
                </div>
                <div className="text-[11.5px] text-dim">{closed ? `replied in ${n.repliedHrs} h` : next.label.toLowerCase()}</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* track */}
        <div className="relative mt-9 h-6">
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/[0.07]" />
          <motion.div
            className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            animate={{ width: `${pct(markerDay)}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
            style={{ background: `linear-gradient(90deg, ${toneA('gold', 0.5)}, ${toneHex(markerTone)})`, boxShadow: `0 0 12px ${toneA(markerTone, 0.55)}` }}
          />
          {LADDER.map((s, i) => (
            <span
              key={s.day}
              className="absolute top-1/2 grid size-3.5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition-colors duration-500"
              style={{
                left: `${pct(s.day)}%`,
                borderColor: reached(i) ? toneHex(s.tone) : 'rgba(255,255,255,0.18)',
                background: reached(i) ? toneHex(s.tone) : 'var(--k-solid)',
                boxShadow: reached(i) ? `0 0 10px ${toneA(s.tone, 0.7)}` : undefined,
              }}
            />
          ))}
          <motion.div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ left: `${pct(markerDay)}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          >
            <span className="k-pulse-ring absolute inset-0 rounded-full" style={{ background: toneHex(markerTone) }} />
            <span className="relative block size-4 rounded-full border-2 border-[var(--k-solid)]" style={{ background: toneHex(markerTone), boxShadow: `0 0 14px ${toneHex(markerTone)}` }} />
            <span className="k-mono absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--k-pop)] px-1.5 py-0.5 text-[11.5px] text-text">
              Day {markerDay.toFixed(1)}
            </span>
          </motion.div>
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-dim">
          {LADDER.map((s) => (
            <span key={s.day} className="k-mono absolute -translate-x-1/2" style={{ left: `${pct(s.day)}%` }}>
              D{s.day}
            </span>
          ))}
        </div>

        {/* steps */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {LADDER.map((s, i) => {
            const on = reached(i)
            const cur = i === current
            return (
              <motion.div
                key={s.day}
                layout
                className="rounded-xl border px-2.5 py-2 transition-colors duration-500"
                style={{
                  borderColor: cur ? toneA(s.tone, 0.45) : 'rgba(255,255,255,0.07)',
                  background: cur ? toneA(s.tone, 0.08) : 'rgba(255,255,255,0.015)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="k-mono text-[11.5px] text-dim">Day {s.day}</span>
                  {on ? (
                    <CheckCircle2 className="size-3.5" style={{ color: toneHex(closed && i > 0 ? 'neutral' : s.tone) }} aria-label="reached" />
                  ) : (
                    <span className="text-[11px] text-dim">{closed ? 'not needed' : 'upcoming'}</span>
                  )}
                </div>
                <div className={cn('mt-0.5 text-[13px]', on ? 'text-text' : 'text-muted')}>{s.title}</div>
                <div className="text-[11.5px] text-dim">{s.sub}</div>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-3 divide-y divide-line">
          <KV k="Exchange" v={`${e.name} · ${e.jurisdiction}`} />
          <KV k="Registered with FIU-IND" v={e.fiuRegistered ? <Chip tone="moss" dot>Yes</Chip> : <Chip tone="crimson" dot>No — offshore</Chip>} />
          <KV k="Amount asked to freeze" v={<span className="k-num">{inr(n.freezeINR)}</span>} />
          <KV k="Legal basis" v={<span className="inline-flex items-center gap-1.5">BNSS §94 <Chip tone="gold">reference to be verified</Chip></span>} />
        </div>

        {/* timeline */}
        <div className="mt-3">
          <div className="text-[12.5px] text-muted">What has happened</div>
          <ul className="relative mt-2 space-y-2 pl-4">
            <span className="absolute bottom-1 left-[4px] top-1 w-px bg-line-2" />
            <AnimatePresence initial={false}>
              {events.map((ev, i) => (
                <motion.li
                  key={`${n.id}-${i}-${ev.text}`}
                  initial={ev.fresh ? { opacity: 0, x: -8, height: 0 } : false}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  className="relative"
                >
                  <span
                    className="absolute -left-4 top-1 size-[9px] rounded-full border-2 border-[var(--k-solid)]"
                    style={{ background: toneHex(ev.tone), boxShadow: ev.fresh ? `0 0 10px ${toneHex(ev.tone)}` : undefined }}
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] leading-snug text-text/85">{ev.text}</span>
                    <span className="k-mono shrink-0 text-[11.5px] text-dim">{ev.t}</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onAct('remind')} disabled={closed || status === 'escalated' || status === 'reminded'}>
            <BellRing /> Send reminder now
          </Button>
          <Button size="sm" variant="ember" onClick={() => onAct('escalate')} disabled={closed || status === 'escalated'}>
            <Landmark /> Escalate to FIU-IND
          </Button>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-dim">
          <Scale className="mt-px size-3 shrink-0" />
          Draft for officer review — not legal advice. Reminders and escalation letters are pre-filled; nothing leaves ANVESHAK without an officer's sign-off.
        </p>
      </div>
    </Card>
  )
}

/* ───────── scorecard ───────── */

function Scorecard() {
  const rows = gradeExchanges()
  return (
    <Card className="h-full pb-3">
      <CardHeader
        title="How each exchange behaves"
        tech="responsiveness scorecard · every notice ANVESHAK has sent"
        right={<Chip tone="gold" dot>6 exchanges</Chip>}
      />
      <div className="mt-3 hidden grid-cols-[22px_minmax(0,1.6fr)_70px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-3 px-5 text-[12px] text-dim md:grid">
        <span>#</span>
        <span>Exchange</span>
        <span className="text-right">Avg reply</span>
        <span>On time</span>
        <span>Freezes honoured</span>
        <span className="text-right">Grade</span>
      </div>
      <ul className="mt-1 space-y-1 px-3">
        {rows.map((r, i) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="grid grid-cols-[22px_minmax(0,1fr)_44px] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.025] md:grid-cols-[22px_minmax(0,1.6fr)_70px_minmax(0,1fr)_minmax(0,1fr)_44px]"
          >
            <span className="k-num text-[13.5px] text-dim">{i + 1}</span>
            <div className="flex min-w-0 items-center gap-2.5">
              <Monogram id={r.id} />
              <div className="min-w-0">
                <div className="truncate text-[14px] text-text">{r.name}</div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-dim">
                  {r.jurisdiction}
                  {r.fiuRegistered ? (
                    <span className="inline-flex items-center gap-0.5 text-moss">
                      <ShieldCheck className="size-3" /> FIU-IND
                    </span>
                  ) : (
                    <span className="text-crimson/80">not FIU-registered</span>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-2 col-start-2 grid grid-cols-3 gap-3 md:col-span-1 md:col-start-auto md:contents">
              <div className="k-num text-[14px] text-text md:text-right">
                {r.avgResponseHrs} h<div className="text-[11px] font-normal text-dim md:hidden">avg reply</div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="k-num text-text">{Math.round(r.slaHitRate * 100)}%</span>
                </div>
                <Meter value={r.slaHitRate} tone={r.slaHitRate > 0.7 ? 'moss' : r.slaHitRate > 0.4 ? 'gold' : 'crimson'} height={4} className="mt-1" />
              </div>
              <div>
                <div className="text-[12px]">
                  <span className="k-num text-text">{r.freezesHonoured}</span>
                  <span className="text-dim">/{r.noticesReceived}</span>
                </div>
                <Meter value={r.freezeRate} tone={r.freezeRate > 0.7 ? 'moss' : r.freezeRate > 0.4 ? 'gold' : 'crimson'} height={4} className="mt-1" />
              </div>
            </div>
            <div className="col-start-3 row-start-1 flex justify-end md:col-start-auto md:row-start-auto">
              <span
                className="k-num grid size-9 place-items-center rounded-xl border text-[16px]"
                title={`score ${r.score.toFixed(2)}`}
                style={{ color: toneHex(GRADE_TONE[r.grade]), borderColor: toneA(GRADE_TONE[r.grade], 0.4), background: toneA(GRADE_TONE[r.grade], 0.1), boxShadow: `0 0 16px ${toneA(GRADE_TONE[r.grade], 0.2)}` }}
              >
                {r.grade}
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
      <div className="mx-5 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-white/[0.02] px-3 py-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5 text-text/80">
          <Gavel className="size-3" /> How the grade is worked out
        </span>
        <span>40% replies on time</span>
        <span>30% freezes honoured</span>
        <span>30% speed (120 h or slower scores 0)</span>
        <span className="text-dim">A ≥ 0.85 · B ≥ 0.70 · C ≥ 0.55 · D ≥ 0.40</span>
      </div>
    </Card>
  )
}
