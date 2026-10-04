import * as React from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Fingerprint, Globe2, Mail, ScanSearch, Sigma, TrendingUp } from 'lucide-react'
import { Button, Card, CardHeader, Chip, DemoChip, PageHeader, Reveal, Stat, toneHex } from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { CASE, EXCHANGE } from '@/data/demo'
import { cn } from '@/lib/utils'
import { BASE_SIGNALS, NEW_SIGNALS, REPORTS, TR_CANDIDATES, credOf } from './attributionintel/data'
import { Candidates, Eligibility, HonestyNote, HowItWorks } from './attributionintel/TravelRule'
import { Countries, Credibility, EarlyWarning, OsintScan } from './attributionintel/Osint'
import { SectionTitle } from './attributionintel/ui'

export default function AttributionIntelPage() {
  const [report, setReport] = React.useState('R-04')
  const likely = TR_CANDIDATES.filter((c) => c.verdict !== 'none').length
  const credible = REPORTS.filter((r) => credOf(r) >= 0.7).length
  const countries = new Set(REPORTS.filter((r) => r.cc !== '—' && credOf(r) >= 0.7).map((r) => r.cc)).size

  const tiles: { k: string; v: React.ReactNode; sub: string; icon: React.ReactNode; tone: 'gold' | 'sky' | 'moss' | 'ember' }[] = [
    { k: 'Compliance records likely to exist', v: <Stat value={likely} suffix={` of ${TR_CANDIDATES.length}`} className="text-[24px] text-text" />, sub: 'candidate transfers on this case', icon: <Mail />, tone: 'gold' },
    { k: 'Credible public reports', v: <Stat value={credible} suffix={` of ${REPORTS.length}`} className="text-[24px] text-text" />, sub: 'scored ≥ 0.70 credibility', icon: <ScanSearch />, tone: 'sky' },
    { k: 'Countries reporting', v: <Stat value={countries} className="text-[24px] text-text" />, sub: 'same scam script, one operator', icon: <Globe2 />, tone: 'sky' },
    { k: 'Attribution confidence', v: <span className="k-num text-[24px] text-text">0.91 → <span className="text-moss">0.95</span></span>, sub: `${EXCHANGE.name}`, icon: <TrendingUp />, tone: 'moss' },
  ]

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span className="k-mono">{CASE.id}</span>
              <span className="text-dim">·</span>
              <span>Cross-border label sources</span>
              <DemoChip />
            </>
          }
          title="Travel Rule & OSINT"
          tech="Two label sources nobody else uses: identity records that regulated exchanges already swap with each other, and scam reports that victims in other countries already posted in public."
          actions={
            <Link to="/attribution">
              <Button>
                <Fingerprint /> Back to attribution
              </Button>
            </Link>
          }
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <Reveal key={t.k} delay={0.05 + i * 0.05}>
            <Card variant="speckle" grain className="h-[112px] p-4">
              <div className="relative flex items-start justify-between gap-2">
                <span className="text-[13.5px] text-muted">{t.k}</span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-2 bg-white/[0.04] [&_svg]:size-3.5" style={{ color: toneHex(t.tone) }}>
                  {t.icon}
                </span>
              </div>
              <div className="relative mt-3">{t.v}</div>
              <div className="relative mt-0.5 truncate text-[12px] text-dim">{t.sub}</div>
            </Card>
          </Reveal>
        ))}
      </div>

      {/* ── Section A: Travel Rule ── */}
      <Reveal delay={0.1}>
        <SectionTitle
          eyebrow="Source 1 · Travel Rule cross-reference"
          title="The identity may already exist in a compliance message"
          tech="Instead of tracing hop by hop, match amount, time and address against the records that compliant exchanges must keep — then ask the right exchange for the right record."
          tone="gold"
        />
      </Reveal>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Reveal delay={0.12}>
          <HowItWorks />
        </Reveal>
        <Reveal delay={0.16}>
          <Eligibility />
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <Candidates />
      </Reveal>
      <Reveal delay={0.1}>
        <HonestyNote />
      </Reveal>

      {/* ── Section B: OSINT ── */}
      <Reveal delay={0.1}>
        <SectionTitle
          eyebrow="Source 2 · OSINT crowd intelligence"
          title="Victims abroad often name the wallet first"
          tech="Public scam-report databases, community forums and explorer comments — cross-referenced against every wallet on the trace, scored for credibility, never taken on trust."
          tone="sky"
        />
      </Reveal>
      <Reveal delay={0.12}>
        <OsintScan selected={report} onSelect={setReport} />
      </Reveal>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
        <Reveal delay={0.1}>
          <EarlyWarning />
        </Reveal>
        <Reveal delay={0.15}>
          <Countries />
        </Reveal>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.3fr]">
        <Reveal delay={0.1}>
          <Credibility selected={report} />
        </Reveal>
        <Reveal delay={0.15}>
          <Uplift />
        </Reveal>
      </div>
    </div>
  )
}

/* ───────────── How the two sources move attribution confidence ───────────── */
function Uplift() {
  const [on, setOn] = React.useState<Record<string, boolean>>({ tr: true, osint: true })
  const baseMiss = BASE_SIGNALS.reduce((p, s) => p * (1 - s.w * s.c), 1)
  const base = 1 - baseMiss
  const active = NEW_SIGNALS.filter((s) => on[s.key])
  const miss = active.reduce((p, s) => p * (1 - s.w * s.c), baseMiss)
  const p = 1 - miss
  return (
    <Card variant="glass" className="h-full pb-5">
      <CardHeader
        title={`How these two sources raise confidence that it’s ${EXCHANGE.name}`}
        tech="weighted noisy-OR · P = 1 − Π (1 − wᵢ · cᵢ) · same model as the Attribution screen"
        right={<Sigma className="size-4 text-muted" />}
      />
      <div className="px-5 pt-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="text-[12.5px] text-dim">On-chain signals only</div>
            <div className="k-num text-[30px] leading-none text-muted">{base.toFixed(2)}</div>
          </div>
          <div className="pb-1 text-[18px] text-dim">→</div>
          <div>
            <div className="text-[12.5px] text-dim">With Travel Rule + OSINT</div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={p.toFixed(3)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn('k-num text-[30px] leading-none', active.length ? 'text-moss' : 'text-muted')}
              >
                {p.toFixed(2)}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="ml-auto pb-1 text-right text-[12.5px] text-muted">
            chance it’s <span className="text-text">not</span> Meridian:{' '}
            <span className="k-mono text-text">{(baseMiss * 100).toFixed(1)}%</span> → <span className="k-mono text-moss">{(miss * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead>
              <tr className="text-[12px] text-dim">
                <th className="py-1 pr-2 font-normal">Signal</th>
                <th className="px-2 py-1 text-right font-normal">c</th>
                <th className="px-2 py-1 text-right font-normal">w</th>
                <th className="py-1 pl-2 text-right font-normal">1 − w·c</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {BASE_SIGNALS.map((s) => (
                <tr key={s.label} className="text-muted">
                  <td className="max-w-[260px] truncate py-1.5 pr-2" title={s.label}>{s.label}</td>
                  <td className="k-mono px-2 text-right">{s.c.toFixed(2)}</td>
                  <td className="k-mono px-2 text-right">{s.w.toFixed(2)}</td>
                  <td className="k-mono pl-2 text-right">{(1 - s.w * s.c).toFixed(3)}</td>
                </tr>
              ))}
              {NEW_SIGNALS.map((s) => (
                <tr key={s.key} className={cn('transition-opacity', !on[s.key] && 'opacity-40')}>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2.5">
                      <Switch
                        checked={on[s.key]}
                        onCheckedChange={(v) => setOn((o) => ({ ...o, [s.key]: v }))}
                        aria-label={`Include ${s.key === 'tr' ? 'Travel Rule' : 'OSINT'} signal`}
                        className="data-[state=checked]:bg-moss data-[state=unchecked]:bg-white/[0.1]"
                      />
                      <div className="min-w-0">
                        <div className="text-text/90">{s.label}</div>
                        <div className="text-[11.5px] text-dim">{s.tech}</div>
                      </div>
                    </div>
                  </td>
                  <td className="k-mono px-2 text-right" style={{ color: toneHex(s.tone) }}>{s.c.toFixed(2)}</td>
                  <td className="k-mono px-2 text-right text-text/85">{s.w.toFixed(2)}</td>
                  <td className="k-mono pl-2 text-right text-text">{(1 - s.w * s.c).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="k-mono mt-3 overflow-x-auto rounded-xl border border-line bg-black/30 px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
          <div className="whitespace-nowrap">
            P = 1 − {baseMiss.toFixed(4)}
            {active.map((s) => (
              <span key={s.key}> × {(1 - s.w * s.c).toFixed(3)}</span>
            ))}{' '}
            = 1 − {miss.toFixed(4)} = <span className="text-moss">{p.toFixed(3)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tone="gold">Travel Rule: confirmed by yes/no query, identities sealed</Chip>
          <Chip tone="sky">OSINT: weight capped at 0.25</Chip>
        </div>
        <p className="mt-2 text-[12px] leading-snug text-dim">
          Weights wᵢ discount signals that overlap with what we already know. Crowd reports are capped low because they can be wrong or planted. Toggle a source to see its effect.
        </p>
      </div>
    </Card>
  )
}
