import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, FileText, Radio, Route, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Address, Button, Chip, Hair, KV, toneA, toneHex, type Tone } from '@/components/kit'
import { inr } from '@/lib/format'
import { CHAIN_TONE, RecoverBadge, STATUS_TONE, exchangeOf, syndicateOf, walletFor, type CaseRow } from './shared'

type Step = { title: string; sub: string; tone: Tone; addr?: string; ghost?: boolean }

function trailFor(c: CaseRow): Step[] {
  const ex = exchangeOf(c)
  const syn = syndicateOf(c)
  const n = Number(c.id.slice(-2))
  const steps: Step[] = [
    { title: 'Victim pays', sub: `${c.who} · ${c.city}`, tone: 'sky' },
    { title: "Scammer's wallet", sub: `${c.chain} · received ${inr(c.amt)}`, tone: 'crimson', addr: walletFor(c) },
  ]
  if (c.status === 'Intake') {
    steps.push({ title: 'Trace not started', sub: 'complaint parsed — start the trace to follow the money', tone: 'neutral', ghost: true })
    return steps
  }
  steps.push({ title: `${2 + (n % 3)} pass-through wallets`, sub: `swept onward in ${24 + ((n * 7) % 40)} s each — automated`, tone: 'teal' })
  if (syn) steps.push({ title: 'Collection wallet', sub: `${syn.id} hub · ${syn.cases} victims pooled here`, tone: 'crimson', addr: syn.hub })
  if (ex) {
    const frozen = c.recover === 'frozen'
    steps.push({
      title: c.status === 'Tracing' ? `Heading to ${ex.name}` : ex.name,
      sub: frozen ? 'deposit frozen by the exchange' : c.recover === 'lost' ? 'withdrawn to a bank — cashed out' : 'exchange deposit · KYC identity held here',
      tone: frozen ? 'moss' : 'gold',
      ghost: c.status === 'Tracing',
    })
  }
  return steps
}

/* ───────── where the case stands, and the one thing to do next ───────── */

const JOURNEY = ['Intake', 'Tracing', 'Traced', 'Notice sent', 'Frozen'] as const
const JOURNEY_LABEL: Record<(typeof JOURNEY)[number], string> = {
  Intake: 'Opened',
  Tracing: 'Tracing',
  Traced: 'Exchange found',
  'Notice sent': 'Notice sent',
  Frozen: 'Frozen',
}

type Next = { label: string; to: string; icon: LucideIcon; why: string }

/** One primary action per stage — the button an officer would press next, not a fixed "open trace". */
function nextStep(c: CaseRow, hasExchange: boolean): Next {
  switch (c.status) {
    case 'Intake':
      return { label: 'Start the trace', to: '/trace', icon: Route, why: 'Complaint is in. Follow the money before it reaches an exchange.' }
    case 'Tracing':
      return { label: 'Watch the live trace', to: '/trace', icon: Route, why: 'Funds are still being followed hop by hop.' }
    case 'Traced':
      return hasExchange && c.recover !== 'lost'
        ? { label: 'Draft the freeze notice', to: '/evidence', icon: FileText, why: 'The exchange holding the money is known. Ask it to freeze.' }
        : { label: 'Review the trace', to: '/trace', icon: Route, why: c.recover === 'lost' ? 'Money was cashed out — ask the exchange for the withdrawal records.' : 'No exchange identified yet.' }
    case 'Notice sent':
      return { label: "Track the exchange's reply", to: '/evidence/compliance', icon: Radio, why: 'Notice delivered — watch the response deadline.' }
    case 'Frozen':
      return { label: 'Open the evidence pack', to: '/evidence', icon: ShieldCheck, why: 'Funds are held. Prepare the pack for the refund order.' }
    default:
      return { label: 'Open the evidence pack', to: '/evidence', icon: ShieldCheck, why: 'Case closed. The sealed pack stays available.' }
  }
}

function CaseJourney({ c }: { c: CaseRow }) {
  const closed = c.status === 'Closed'
  const cur = closed ? JOURNEY.length : JOURNEY.indexOf(c.status as (typeof JOURNEY)[number])
  const lost = c.recover === 'lost'
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="text-muted">Case progress</span>
        <span className="text-dim">{closed ? 'closed' : `step ${cur + 1} of ${JOURNEY.length}`}</span>
      </div>
      <ol className="relative mt-3 grid grid-cols-5">
        <span className="absolute left-[10%] right-[10%] top-[7px] h-[2px] rounded-full bg-white/[0.07]" aria-hidden />
        <motion.span
          className="absolute left-[10%] top-[7px] h-[2px] rounded-full bg-moss"
          initial={{ width: 0 }}
          animate={{ width: `${(Math.min(cur, JOURNEY.length - 1) / (JOURNEY.length - 1)) * 80}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22, delay: 0.1 }}
          aria-hidden
        />
        {JOURNEY.map((k, i) => {
          const done = i < cur
          const active = i === cur
          const dead = lost && k === 'Frozen'
          return (
            <li key={k} className="relative flex flex-col items-center text-center" aria-current={active ? 'step' : undefined}>
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08 * i, type: 'spring', stiffness: 420, damping: 22 }}
                className="relative grid size-4 place-items-center rounded-full border-2"
                style={{
                  borderColor: dead ? toneHex('neutral') : done ? toneHex('moss') : active ? toneHex('ember') : 'rgba(255,255,255,0.14)',
                  background: done ? toneA('moss', 0.25) : active ? toneA('ember', 0.25) : 'var(--k-solid)',
                }}
              >
                {done && <Check className="size-2.5 text-moss" strokeWidth={4} />}
                {active && <span className="k-pulse-ring absolute inset-0 rounded-full" style={{ background: toneHex('ember') }} />}
              </motion.span>
              <span className={`mt-1.5 text-[11.5px] leading-tight ${active ? 'text-text' : done ? 'text-text/70' : 'text-dim'}`}>
                {dead ? 'Cashed out' : JOURNEY_LABEL[k]}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function CaseDetail({ c, t0 }: { c: CaseRow; t0: number }) {
  const navigate = useNavigate()
  const ex = exchangeOf(c)
  const syn = syndicateOf(c)
  const steps = trailFor(c)
  const next = nextStep(c, Boolean(ex))
  const alt = next.to === '/trace' ? { label: 'Draft notice', to: '/evidence', icon: FileText, ok: Boolean(ex) } : { label: 'Open live trace', to: '/trace', icon: Route, ok: true }

  return (
    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="px-5 pb-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={STATUS_TONE[c.status]} dot pulse={c.status === 'Tracing'}>
          {c.status}
        </Chip>
        {c.risk && <Chip tone={c.risk === 'HIGH' ? 'crimson' : c.risk === 'MEDIUM' ? 'gold' : 'moss'}>{c.risk.toLowerCase()} risk</Chip>}
        {syn && <Chip tone={syn.tone}>{syn.id}</Chip>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="k-num text-[28px] leading-none text-text">{inr(c.amt)}</div>
          <div className="mt-1 text-[12.5px] text-dim">lost · {c.type}</div>
        </div>
        <div className="max-w-[150px] text-right">
          <RecoverBadge key={c.id} c={c} t0={t0} />
        </div>
      </div>

      <Hair className="my-4" />

      <CaseJourney c={c} />

      <Hair className="my-4" />

      <div className="text-[12.5px] text-muted">Where the money went</div>
      <ol className="relative mt-2.5 space-y-0">
        {steps.map((s, i) => (
          <motion.li
            key={s.title + i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i }}
            className="relative flex gap-3 pb-3 last:pb-0"
          >
            {i < steps.length - 1 && (
              <span
                className="absolute left-[6px] top-4 h-[calc(100%-8px)] w-px"
                style={{ background: `linear-gradient(180deg, ${toneA(s.tone, 0.6)}, ${toneA(steps[i + 1].tone, 0.6)})` }}
              />
            )}
            <span
              className="relative mt-1 size-[13px] shrink-0 rounded-full border-2"
              style={{
                borderColor: toneHex(s.tone),
                background: s.ghost ? 'transparent' : toneA(s.tone, 0.3),
                borderStyle: s.ghost ? 'dashed' : 'solid',
                boxShadow: s.ghost ? undefined : `0 0 8px ${toneA(s.tone, 0.5)}`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div className={s.ghost ? 'text-[13.5px] text-muted' : 'text-[13.5px] text-text'}>{s.title}</div>
              <div className="text-[12px] leading-snug text-dim">{s.sub}</div>
              {s.addr && <Address addr={s.addr} chain={c.chain} className="-ml-1 mt-0.5 py-0 text-[12px]" tone={s.tone} />}
            </div>
          </motion.li>
        ))}
      </ol>

      <Hair className="my-4" />

      <div className="divide-y divide-line">
        <KV k="Filed" v={`${c.filed} 2026 · ${c.city}, ${c.state}`} />
        <KV
          k="Network"
          v={
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: toneHex(CHAIN_TONE[c.chain]) }} />
              {c.chain}
            </span>
          }
        />
        <KV k="Exchange" v={ex ? `${ex.name} · ${ex.fiuRegistered ? 'FIU-registered' : 'not FIU-registered'}` : 'not yet known'} />
        {ex && <KV k="Typical reply time" v={`${ex.avgResponseHrs} h · ${Math.round(ex.slaHitRate * 100)}% on time`} />}
      </div>

      <div className="mt-4 rounded-xl border border-ember/25 bg-ember/[0.05] p-3">
        <div className="text-[12px] text-ember">Next step</div>
        <div className="mt-0.5 text-[13px] leading-snug text-text/85">{next.why}</div>
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr]">
          <Button variant="ember" onClick={() => navigate(next.to)}>
            <next.icon /> {next.label}
          </Button>
          <Button onClick={() => navigate(alt.to)} disabled={!alt.ok}>
            <alt.icon /> {alt.label}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-dim">Notices open as a draft for officer review — not legal advice.</p>
    </motion.div>
  )
}
