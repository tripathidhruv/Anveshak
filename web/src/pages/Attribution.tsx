import * as React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  BadgeCheck,
  Building2,
  Check,
  FileText,
  Fingerprint,
  Globe2,
  Info,
  Minus,
  Scale,
  ShieldQuestion,
  Users,
  X,
} from 'lucide-react'
import {
  Address,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  Hair,
  Meter,
  PageHeader,
  Reveal,
  ScoreRing,
  toneA,
  toneHex,
} from '@/components/kit'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/animate-ui/components/radix/tooltip'
import { CASE, EXCHANGE, RISK, ROUTE_A } from '@/data/demo'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  ATTRIBUTION_P,
  BASE_INPUTS,
  CANDIDATES,
  EVIDENCE,
  INNOCENCE,
  INNOCENCE_PRIOR,
  INNOCENCE_SCORE,
  ML_BASE,
  NOTICE_THRESHOLD,
  SHAP,
  contributions,
  score as riskScore,
} from './attribution/model'
import { WhatIf } from './attribution/WhatIf'

const DEPOSIT = ROUTE_A.trail.find((h) => h.flag === 'EXCHANGE')!

export default function AttributionPage() {
  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span className="k-mono">{CASE.id}</span>
              <span className="text-dim">·</span>
              <span>{CASE.complainant}, {CASE.location}</span>
              <DemoChip />
            </>
          }
          title="Attribution & Risk"
          tech="Which exchange received the stolen money, how sure we are, and why. Every number on this page shows its working — nothing is a black box."
          actions={
            <>
              <Link to="/trace">
                <Button>
                  <Fingerprint /> Back to trace
                </Button>
              </Link>
              <Link to="/evidence">
                <Button variant="ember">
                  <FileText /> Draft notice to Meridian
                </Button>
              </Link>
            </>
          }
        />
      </Reveal>

      <Reveal delay={0.05}>
        <Hero />
      </Reveal>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_1fr]">
        <Reveal delay={0.1}>
          <EvidenceCard />
        </Reveal>
        <div className="space-y-3">
          <Reveal delay={0.15}>
            <HonestyCard />
          </Reveal>
          <Reveal delay={0.2}>
            <CandidatesCard />
          </Reveal>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_1fr]">
        <Reveal delay={0.1}>
          <Waterfall />
        </Reveal>
        <Reveal delay={0.15}>
          <RulesVsMl />
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <WhatIf />
      </Reveal>

      <Reveal delay={0.1}>
        <InnocenceCard />
      </Reveal>
    </div>
  )
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero() {
  return (
    <Card variant="glass" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="k-num grid size-16 shrink-0 place-items-center rounded-2xl border text-[22px]"
            style={{
              color: toneHex('gold'),
              borderColor: toneA('gold', 0.4),
              background: `radial-gradient(circle at 30% 20%, ${toneA('gold', 0.3)}, ${toneA('gold', 0.05)})`,
              boxShadow: `0 0 32px -8px ${toneA('gold', 0.6)}`,
            }}
          >
            {EXCHANGE.monogram}
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] text-muted">The money was cashed in at</div>
            <div className="k-num text-[24px] leading-tight text-text md:text-[28px]">{EXCHANGE.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-dim">
              Deposit address <Address addr={DEPOSIT.addr} chain="TRON" tone="gold" />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Chip tone="gold" dot>
                Crypto exchange (VASP)
              </Chip>
              <Chip>
                <Globe2 className="size-3" /> {EXCHANGE.jurisdiction}
              </Chip>
              <Chip tone="crimson" dot>
                Not registered with FIU-IND
              </Chip>
              <Chip>
                <Users className="size-3" /> {EXCHANGE.indianUsers} Indian users
              </Chip>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <ScoreRing value={ATTRIBUTION_P} tone="gold" size={124} label={ATTRIBUTION_P.toFixed(2)} sub="attribution" />
            <div className="text-[12px] text-muted">How sure we are it's Meridian</div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <ScoreRing value={RISK.score} tone="crimson" size={124} label={RISK.score.toFixed(2)} sub={`risk · ${RISK.band}`} />
            <div className="text-[12px] text-muted">How likely this is a scam flow</div>
          </div>
        </div>
      </div>

      <Hair className="my-4" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
        {[
          { k: 'Received from the collection wallet', v: `${num(DEPOSIT.amt)} USDT`, s: `at ${DEPOSIT.at} IST · 02 Sep` },
          { k: 'Of which traced to this case', v: `${num(ROUTE_A.valueCrypto)} USDT`, s: '≈ ₹10.9 L of ₹12.4 L stolen' },
          { k: 'Typical reply to police', v: `${EXCHANGE.avgResponseHrs} h`, s: `${Math.round(EXCHANGE.slaHitRate * 100)}% within deadline` },
          { k: 'Freezes honoured', v: `${EXCHANGE.freezesHonoured} / ${EXCHANGE.noticesReceived}`, s: 'notices from Indian police' },
        ].map((x) => (
          <div key={x.k}>
            <div className="text-[12px] text-dim">{x.k}</div>
            <div className="k-num mt-0.5 text-[17px] text-text">{x.v}</div>
            <div className="text-[12px] text-muted">{x.s}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ───────────────────────── Evidence + noisy-OR ───────────────────────── */
function EvidenceCard() {
  const product = EVIDENCE.reduce((p, e) => p * e.miss, 1)
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="Why we think this is Meridian"
        tech="four signals that partly overlap · combined with a weighted noisy-OR"
        right={<Chip tone="gold" dot>{ATTRIBUTION_P.toFixed(2)} combined</Chip>}
      />
      <ul className="mt-3 space-y-2 px-3">
        {EVIDENCE.map((e, i) => (
          <li key={e.label} className="rounded-xl border border-line bg-white/[0.015] px-3 py-2.5">
            <div className="flex items-start gap-3">
              <span className="k-num grid size-6 shrink-0 place-items-center rounded-md border border-line-2 text-[12px] text-gold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] leading-snug text-text">{e.label}</div>
                <div className="text-[12px] text-dim">{e.tech}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="k-num text-[15.5px] text-text">{e.conf.toFixed(2)}</div>
                <div className="text-[11.5px] text-dim">confidence</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 pl-9">
              <Meter value={e.conf} tone="gold" className="flex-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="k-mono shrink-0 rounded px-1 text-[12px] text-muted hover:bg-white/[0.05]">
                    w {e.w.toFixed(2)}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Independence weight — discounts signals that partly overlap with others.</TooltipContent>
              </Tooltip>
            </div>
          </li>
        ))}
      </ul>

      <div className="mx-5 mt-4 rounded-xl border border-gold/25 bg-gold/[0.04] p-3.5">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Info className="size-3.5 text-gold" />
          How the signals combine — the chance that <i>every</i> signal is wrong at once
        </div>
        <div className="k-mono mt-2.5 overflow-x-auto text-[13.5px] leading-relaxed whitespace-nowrap text-text/90">
          <div>
            <span className="text-dim">P(Meridian) = 1 − Π (1 − wᵢ · cᵢ)</span>
          </div>
          <div>
            = 1 − ({EVIDENCE.map((e) => e.miss.toFixed(3)).join(' × ')})
          </div>
          <div>
            = 1 − {product.toFixed(3)} = <span className="k-num text-[15.5px] text-gold">{ATTRIBUTION_P.toFixed(2)}</span>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-dim">
          Raw signals would multiply out to 0.9998 — the independence weights deliberately pull that down, because three of the four signals look
          at the same sweep behaviour.
        </p>
      </div>
    </Card>
  )
}

/* ───────────────────────── Honesty card ───────────────────────── */
function HonestyCard() {
  return (
    <Card variant="speckle" grain className="p-5">
      <div className="relative flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-sky/30 bg-sky/10 text-sky">
          <Scale className="size-4" />
        </span>
        <div>
          <div className="text-[14.5px] font-medium text-text">Where, not who</div>
          <div className="text-[12px] text-dim">operator vs beneficiary</div>
        </div>
      </div>
      <p className="relative mt-3 text-[14.5px] leading-relaxed text-text/90">
        This tells you <b className="text-gold">where</b> the money was cashed out — not <b className="text-crimson">who</b> the scammer is. Identity
        comes from the exchange's KYC records after a lawful request.
      </p>
      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
        <div className="rounded-lg border border-line bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-moss">
            <Check className="size-3" /> We can say
          </div>
          <div className="mt-1 text-muted">Meridian operates the wallet that received the funds.</div>
        </div>
        <div className="rounded-lg border border-line bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-1.5 text-crimson">
            <X className="size-3" /> We cannot say
          </div>
          <div className="mt-1 text-muted">Which Meridian customer owns the account — or that Meridian is complicit.</div>
        </div>
      </div>
    </Card>
  )
}

/* ───────────────────────── Alternative candidates ───────────────────────── */
function CandidatesCard() {
  return (
    <Card className="pb-3">
      <CardHeader title="Other exchanges we ruled out" tech="posterior over candidate operators · sums to 1.00" />
      <div className="mt-2 overflow-x-auto px-3">
        <table className="w-full min-w-[340px] text-left text-[13.5px]">
          <thead>
            <tr className="text-[12px] text-dim">
              <th className="px-2 py-1.5 font-normal">Candidate</th>
              <th className="w-[92px] px-2 py-1.5 font-normal">Probability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CANDIDATES.map((c, i) => (
              <tr key={c.name} className={cn('align-top', i === 0 && 'bg-gold/[0.04]')}>
                <td className="px-2 py-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="k-num mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border text-[11.5px]"
                      style={{ color: toneHex(c.tone), borderColor: toneA(c.tone, 0.3), background: toneA(c.tone, 0.08) }}
                    >
                      {c.monogram}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-text">
                        {c.name}
                        {i === 0 ? <BadgeCheck className="size-3.5 text-gold" /> : <span className="text-[11.5px] text-dim">rejected</span>}
                      </div>
                      <div className="text-[12px] leading-snug text-dim">{c.why}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="k-num text-[14.5px] text-text">{c.p.toFixed(2)}</div>
                  <Meter value={c.p} tone={i === 0 ? 'gold' : 'neutral'} height={4} className="mt-1" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ───────────────────────── Waterfall ───────────────────────── */
function Waterfall() {
  const parts = contributions(BASE_INPUTS)
  const total = riskScore(BASE_INPUTS)
  let acc = 0
  const steps = parts.map((p) => {
    const start = acc
    acc += p.c
    return { ...p, start }
  })
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="How the risk score is built"
        tech="rule score = Σ weight × signal strength · each step adds to the last"
        right={<Chip tone="crimson" dot>{total.toFixed(2)} · {RISK.band}</Chip>}
      />
      <div className="mt-4 px-5">
        <div className="relative">
          {/* grid + threshold */}
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 sm:left-[44%]">
            {ticks.map((t) => (
              <div key={t} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: `${t * 100}%` }} />
            ))}
            <div className="absolute -bottom-1 -top-1 w-px border-l border-dashed border-white/40" style={{ left: `${NOTICE_THRESHOLD * 100}%` }} />
          </div>

          <div className="space-y-2.5">
            {steps.map((s, i) => (
              <div key={s.plain} className="relative grid grid-cols-1 items-center gap-1 sm:grid-cols-[44%_1fr] sm:gap-0">
                <div className="min-w-0 pr-3">
                  <div className="truncate text-[13.5px] text-text" title={s.plain}>
                    {s.plain}
                  </div>
                  <div className="truncate text-[12px] text-dim">
                    {s.tech} · <span className="k-mono">{s.w.toFixed(2)} × {s.s.toFixed(2)}</span>
                  </div>
                </div>
                <div className="relative h-7">
                  {i > 0 && <div className="absolute -top-2.5 h-2.5 w-px bg-white/20" style={{ left: `${s.start * 100}%` }} />}
                  <motion.div
                    className="absolute inset-y-1 rounded-md"
                    style={{
                      left: `${s.start * 100}%`,
                      background: `linear-gradient(90deg, ${toneA(s.tone === 'neutral' ? 'white' : s.tone, 0.45)}, ${toneHex(s.tone === 'neutral' ? 'white' : s.tone)})`,
                      boxShadow: `0 0 14px ${toneA(s.tone === 'neutral' ? 'white' : s.tone, 0.35)}`,
                    }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.c * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.15 + i * 0.12, ease: [0.2, 0.7, 0.2, 1] }}
                  />
                  <motion.span
                    className="k-num absolute top-1/2 -translate-y-1/2 pl-1.5 text-[12.5px] text-text/90"
                    style={{ left: `${(s.start + s.c) * 100}%` }}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.12 }}
                  >
                    +{s.c.toFixed(2)}
                  </motion.span>
                </div>
              </div>
            ))}
            <div className="relative grid grid-cols-1 items-center gap-1 border-t border-line pt-2.5 sm:grid-cols-[44%_1fr] sm:gap-0">
              <div className="pr-3">
                <div className="text-[14px] font-medium text-text">Risk score</div>
                <div className="text-[12px] text-dim">sum of the six steps above</div>
              </div>
              <div className="relative h-8">
                <motion.div
                  className="absolute inset-y-1 left-0 rounded-md"
                  style={{ background: `linear-gradient(90deg, ${toneA('crimson', 0.35)}, ${toneHex('crimson')})`, boxShadow: `0 0 18px ${toneA('crimson', 0.5)}` }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${total * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: 0.95, ease: [0.2, 0.7, 0.2, 1] }}
                />
                <span className="k-num absolute top-1/2 -translate-y-1/2 pl-2 text-[15.5px] text-text" style={{ left: `${total * 100}%` }}>
                  {total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-[44%_1fr]">
          <div className="hidden sm:block" />
          <div className="relative h-4 text-[11px] text-dim">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t * 100}%` }}>
                {t.toFixed(2)}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-dim">
          Dashed line: notice threshold {NOTICE_THRESHOLD.toFixed(2)}. Weights are set by policy and published; signal strength is measured from the
          blockchain.
        </p>
      </div>
    </Card>
  )
}

/* ───────────────────────── Rules vs ML ───────────────────────── */
function RulesVsMl() {
  const rule = RISK.score
  const ml = RISK.mlScore
  const gap = Math.abs(rule - ml)
  const agree = gap <= 0.1
  const maxShap = Math.max(...SHAP.map((s) => s.v))
  return (
    <Card variant="glass" className="h-full pb-5">
      <CardHeader title="Second opinion from a model" tech="rules vs gated ML · LightGBM + SHAP" right={<Chip tone={agree ? 'moss' : 'gold'} dot>{agree ? 'Agree' : 'Disagree'}</Chip>} />
      <div className="mt-4 grid grid-cols-2 gap-3 px-5">
        {[
          { k: 'Rule score', v: rule, s: 'transparent weights · primary', tone: 'crimson' as const },
          { k: 'ML score', v: ml, s: 'gated · never shown alone', tone: 'violet' as const },
        ].map((x) => (
          <div key={x.k} className="rounded-xl border border-line bg-white/[0.02] p-3">
            <div className="text-[12px] text-dim">{x.k}</div>
            <div className="k-num text-[26px] leading-tight" style={{ color: toneHex(x.tone) }}>
              {x.v.toFixed(2)}
            </div>
            <Meter value={x.v} tone={x.tone} height={4} className="mt-1.5" />
            <div className="mt-1.5 text-[11.5px] text-muted">{x.s}</div>
          </div>
        ))}
      </div>
      <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-moss/25 bg-moss/[0.05] px-3 py-2 text-[13px] text-text/90">
        <Check className="size-3.5 text-moss" />
        Scores differ by <span className="k-num">{gap.toFixed(2)}</span> — within the 0.10 agreement band, so the model may be shown.
      </div>

      <div className="mt-4 px-5">
        <div className="text-[13px] text-muted">What pushed the model's score up</div>
        <div className="text-[11.5px] text-dim">SHAP values · starts from base rate {ML_BASE.toFixed(2)}</div>
        <div className="mt-2.5 space-y-1.5">
          {SHAP.map((s) => (
            <div key={s.tech} className="flex items-center gap-2 text-[12.5px]">
              <div className="w-[44%] min-w-0">
                <div className="truncate text-text/90">{s.plain}</div>
                <div className="k-mono truncate text-[11px] text-dim">{s.tech}</div>
              </div>
              <div className="relative h-2 flex-1 rounded-full bg-white/[0.05]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${toneA('violet', 0.4)}, ${toneHex('violet')})` }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(s.v / maxShap) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7 }}
                />
              </div>
              <span className="k-num w-9 text-right text-text/80">+{s.v.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="k-mono mt-2 text-[12px] text-dim">
          {ML_BASE.toFixed(2)} + {SHAP.map((s) => s.v.toFixed(2)).join(' + ')} = <span className="text-violet">{ml.toFixed(2)}</span>
        </div>
      </div>
      <p className="mx-5 mt-3 text-[12px] leading-snug text-dim">
        Trained on disclosed synthetic data (no real case labels exist yet). The model can only confirm the rule score — if they disagree by more
        than 0.10, the ML number is hidden and the case goes to an officer.
      </p>
    </Card>
  )
}

/* ───────────────────────── Innocence check ───────────────────────── */
function InnocenceCard() {
  const supports = INNOCENCE.filter((f) => f.v > 0)
  const against = INNOCENCE.filter((f) => f.v < 0)
  const neutral = INNOCENCE.filter((f) => f.v === 0)
  return (
    <Card className="pb-5">
      <CardHeader
        title="Is this wallet innocent?"
        tech="devil's-advocate check · starts at 0.50 (no opinion) and moves with each piece of evidence"
        icon={<ShieldQuestion className="size-4" />}
        right={<Chip tone="crimson" dot>Unlikely innocent</Chip>}
      />
      <div className="grid grid-cols-1 gap-5 px-5 pt-4 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white/[0.015] p-4 text-center">
          <ScoreRing value={INNOCENCE_SCORE} tone="moss" size={120} label={INNOCENCE_SCORE.toFixed(2)} sub="innocence" />
          <div className="k-mono mt-3 text-[12px] text-dim">
            {INNOCENCE_PRIOR.toFixed(2)} {INNOCENCE.filter((f) => f.v !== 0).map((f) => `${f.v > 0 ? '+' : '−'} ${Math.abs(f.v).toFixed(2)}`).join(' ')}
          </div>
          <p className="mt-2 text-[12.5px] leading-snug text-muted">
            We actively look for reasons this could be an ordinary person's wallet — and found very few.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FactorList title="Points against innocence" tone="crimson" icon={<X className="size-3" />} items={against} />
          <div className="space-y-4">
            <FactorList title="Points for innocence" tone="moss" icon={<Check className="size-3" />} items={supports} />
            <FactorList title="Checked, no effect" tone="neutral" icon={<Minus className="size-3" />} items={neutral} />
          </div>
        </div>
      </div>
      <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[12.5px] text-muted">
        <Building2 className="mt-0.5 size-3.5 shrink-0 text-gold" />
        A low innocence score does not prove guilt. The account holder may be a paid or tricked "money mule" — the officer should confirm through
        KYC and questioning before naming anyone.
      </div>
    </Card>
  )
}

function FactorList({
  title,
  tone,
  icon,
  items,
}: {
  title: string
  tone: 'crimson' | 'moss' | 'neutral'
  icon: React.ReactNode
  items: { plain: string; tech: string; v: number }[]
}) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] text-dim">{title}</div>
      <ul className="space-y-1.5">
        {items.map((f) => (
          <li key={f.plain} className="flex items-start gap-2.5 rounded-lg border border-line bg-white/[0.015] px-2.5 py-2">
            <span
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full"
              style={{ background: toneA(tone, 0.15), color: tone === 'neutral' ? toneHex('neutral') : toneHex(tone) }}
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] leading-snug text-text/90">{f.plain}</div>
              <div className="text-[11.5px] text-dim">{f.tech}</div>
            </div>
            <span className={cn('k-num shrink-0 text-[13px]', f.v > 0 ? 'text-moss' : f.v < 0 ? 'text-crimson' : 'text-dim')}>
              {f.v === 0 ? '0.00' : `${f.v > 0 ? '+' : '−'}${Math.abs(f.v).toFixed(2)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

