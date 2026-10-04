import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ChevronDown, Tags } from 'lucide-react'
import { Card, CardHeader, Chip, Meter, ScoreRing, toneA, toneHex, type Tone } from '@/components/kit'
import { api, errorText, type TypologyBand, type TypologyClassOut, type TypologyOut } from '@/api'
import { cn } from '@/lib/utils'

/** Crime typology → colour. Scam stays crimson (criminal path); terror indicators get violet so they never read as a verdict. */
export const TYPOLOGY_TONE: Record<string, Tone> = {
  scam: 'crimson',
  laundering: 'ember',
  ransomware: 'gold',
  darknet: 'sky',
  terror_financing: 'violet',
}
const BAND: Record<TypologyBand, { label: string; tone: Tone }> = {
  strong: { label: 'Strong', tone: 'crimson' },
  present: { label: 'Present', tone: 'gold' },
  not_indicated: { label: 'Not indicated', tone: 'neutral' },
}

/** One fetch per case, shared by every card on the screen. */
export function useTypology(caseId: string) {
  const [state, setState] = React.useState<{ data: TypologyOut | null; error: string | null }>({ data: null, error: null })
  React.useEffect(() => {
    const ac = new AbortController()
    api
      .caseTypology(caseId, ac.signal)
      .then((data) => setState({ data, error: null }))
      .catch((e) => (e as Error).name !== 'AbortError' && setState({ data: null, error: errorText(e) }))
    return () => ac.abort()
  }, [caseId])
  return state
}

/** Compact ring for verdict heroes — sits beside the risk score. */
export function TypologyRing({ data, size = 124 }: { data: TypologyOut | null; size?: number }) {
  const top = data?.classes[0]
  const tone = top ? TYPOLOGY_TONE[top.id] ?? 'crimson' : 'neutral'
  const second = data?.classes.find((c, i) => i > 0 && c.band !== 'not_indicated')
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ScoreRing value={top?.score ?? 0} tone={tone} size={size} label={top ? top.score.toFixed(2) : '··'} sub="typology" />
      <div className="max-w-[170px] text-center text-[12px] leading-snug text-muted">
        {top ? (
          <>
            Looks like <span className="text-text">{top.name.toLowerCase()}</span>
            {second && <> · also {second.name.split(' /')[0].toLowerCase()}</>}
          </>
        ) : (
          'Detecting the type of crime…'
        )}
      </div>
    </div>
  )
}

/** Full breakdown: every class, its band, and (expanded) every indicator's weight × signal. */
export function TypologyCard({ data, error }: { data: TypologyOut | null; error: string | null }) {
  const [open, setOpen] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (data && open === null) setOpen(data.primary)
  }, [data, open])

  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="What kind of crime does the money look like?"
        tech="on-chain typology · score = Σ weight × signal · click a row to see the working"
        icon={<Tags className="size-4" />}
        right={data ? <Chip tone="neutral">{data.signalsUsed} signals measured</Chip> : null}
      />
      <div className="mt-3 space-y-2 px-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-crimson/30 bg-crimson/[0.06] p-3 text-[13px] text-text">
            <AlertTriangle className="mt-0.5 size-4 text-crimson" /> {error}
          </div>
        )}
        {!data && !error && [0, 1, 2, 3, 4].map((i) => <div key={i} className="k-shimmer h-[58px] rounded-xl border border-line bg-white/[0.02]" />)}
        {data?.classes.map((c, i) => (
          <TypologyRow key={c.id} c={c} i={i} open={open === c.id} onToggle={() => setOpen(open === c.id ? '' : c.id)} />
        ))}
      </div>
      {data && <p className="mx-5 mt-3 text-[12px] leading-snug text-dim">{data.disclaimer}</p>}
    </Card>
  )
}

function TypologyRow({ c, i, open, onToggle }: { c: TypologyClassOut; i: number; open: boolean; onToggle: () => void }) {
  const tone = TYPOLOGY_TONE[c.id] ?? 'neutral'
  const band = BAND[c.band]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * i }}
      className={cn('rounded-xl border transition-colors', open ? 'border-line-2 bg-white/[0.03]' : 'border-line bg-white/[0.015]')}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: toneHex(tone), boxShadow: `0 0 8px ${toneA(tone, 0.7)}` }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('truncate text-[14px]', c.band === 'not_indicated' ? 'text-muted' : 'text-text')}>{c.name}</span>
            <Chip tone={band.tone}>{band.label}</Chip>
          </div>
          <Meter value={c.score} tone={c.band === 'not_indicated' ? 'neutral' : tone} height={c.band === 'strong' ? 6 : 4} className="mt-1.5" />
        </div>
        <span className="k-num w-11 text-right text-[16px] text-text">{c.score.toFixed(2)}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-dim transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ul className="space-y-1 px-3 pb-3 pl-8">
              {c.indicators.map((ind) => (
                <li key={ind.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[12.5px] sm:grid-cols-[1fr_120px_auto]">
                  <div className="min-w-0">
                    <div className={cn('truncate', ind.value > 0 ? 'text-text/90' : 'text-dim')}>{ind.plain}</div>
                    <div className="truncate text-[11px] text-dim">{ind.tech}</div>
                  </div>
                  <span className="k-mono hidden text-[11.5px] text-dim sm:block">
                    {ind.weight.toFixed(2)} × {ind.value.toFixed(2)}
                  </span>
                  <span className={cn('k-num w-12 text-right', ind.contribution > 0 ? 'text-text' : 'text-dim')}>+{ind.contribution.toFixed(2)}</span>
                </li>
              ))}
              <li className="flex justify-end border-t border-line pt-1.5 text-[12.5px]">
                <span className="text-muted">total</span>
                <span className="k-num ml-3 w-12 text-right text-text">{c.score.toFixed(2)}</span>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
