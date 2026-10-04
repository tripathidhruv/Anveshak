import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { Button, Card, CardHeader, Chip, toneA, toneHex } from '@/components/kit'
import { api, errorText, type IntakeEntity, type IntakeParseOut, type MemoryLookup } from '@/api'
import { short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ENTITY, PIPELINE } from './data'
import { HighlightedText, ScanSweep } from './parts'
import { valuesFromParse, type Draft } from './draft'

const STEP_MS = 420
const SETTLE_MS = 1100 // how long the finished highlights stay on screen before moving on

type Run = { step: number; error: string | null; parse: IntakeParseOut | null; memory: MemoryLookup | null; done: boolean }

/**
 * Transient stage: runs the real parse + national-memory lookup while the pipeline animates, then
 * hands over to "Check details" on its own. The animation never finishes ahead of the request —
 * each step only lights once the work behind it has actually happened.
 */
export function StageReading({ draft, patch, onDone, onBack }: { draft: Draft; patch: (p: Partial<Draft>) => void; onDone: () => void; onBack: () => void }) {
  const [run, setRun] = React.useState<Run>({ step: 0, error: null, parse: null, memory: null, done: false })
  const [attempt, setAttempt] = React.useState(0)
  const text = draft.text

  React.useEffect(() => {
    const ac = new AbortController()
    let step = 0
    setRun({ step: 0, error: null, parse: null, memory: null, done: false })
    const ticker = window.setInterval(() => {
      // walk Read → Understand → Validate, then hold on Normalise until the parse lands
      if (step < 3) setRun((r) => ({ ...r, step: (step = step + 1) }))
    }, STEP_MS)
    const minWalk = new Promise((r) => setTimeout(r, STEP_MS * 3.5))

    ;(async () => {
      try {
        const [parse] = await Promise.all([api.parseComplaint({ text, source: draft.ncrpAck ? 'ncrp' : 'text' }, ac.signal), minWalk])
        clearInterval(ticker)
        setRun((r) => ({ ...r, step: 4, parse }))
        const wallet = parse.fields.find((f) => f.id === 'suspectWallet')?.value
        const memory = wallet ? await api.lookupWallet(wallet, ac.signal) : null
        setRun((r) => ({ ...r, step: 5, memory, done: true }))
        patch({ parse, parsedText: text, values: valuesFromParse(parse.fields), edited: [], typology: null, memory, created: null })
        window.setTimeout(() => !ac.signal.aborted && onDone(), SETTLE_MS)
      } catch (e) {
        clearInterval(ticker)
        if ((e as Error).name === 'AbortError') return
        setRun((r) => ({ ...r, error: errorText(e) }))
      }
    })()

    return () => {
      ac.abort()
      clearInterval(ticker)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one run per mount/attempt; text is frozen while reading
  }, [attempt])

  const found = run.parse?.entities ?? []

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_1fr]">
      <Card className="relative overflow-hidden pb-4">
        <CardHeader
          title="Reading the complaint"
          tech={run.parse ? `${run.parse.language} · ${run.parse.scripts.join(' + ')} script` : 'script, language, entities, checksums'}
          right={run.done ? <Chip tone="moss" dot>Done</Chip> : run.error ? <Chip tone="crimson">Stopped</Chip> : <Chip tone="ember" dot pulse>Working</Chip>}
        />
        <div className="px-5 pt-3">
          <div className="relative max-h-[360px] overflow-auto rounded-xl border border-line bg-white/[0.02] px-4 py-3" data-lenis-prevent>
            <HighlightedText text={text} entities={found} show={Boolean(run.parse)} stagger={0.05} />
            <ScanSweep active={!run.parse && !run.error} />
          </div>

          <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Reading steps">
            {PIPELINE.map((p, i) => {
              const state = run.error && i === run.step ? 'error' : i < run.step ? 'done' : i === run.step ? 'active' : 'idle'
              return (
                <li key={p.k} className="min-w-0">
                  <div className="relative h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <motion.div
                      className={cn('absolute inset-y-0 left-0 rounded-full', state === 'error' ? 'bg-crimson' : state === 'done' ? 'bg-moss' : 'bg-ember')}
                      initial={false}
                      animate={{ width: state === 'idle' ? '0%' : state === 'active' ? '60%' : '100%' }}
                      transition={{ duration: state === 'active' ? STEP_MS / 1000 : 0.25, ease: 'easeOut' }}
                    />
                  </div>
                  <div className={cn('mt-1.5 flex items-center gap-1 truncate text-[12.5px]', state === 'idle' ? 'text-muted' : 'text-text')}>
                    {state === 'done' && <Check className="size-3 shrink-0 text-moss" strokeWidth={3} />}
                    {p.k}
                  </div>
                  <div className="hidden truncate text-[11px] text-dim sm:block">{p.tech}</div>
                </li>
              )
            })}
          </ol>

          <AnimatePresence>
            {run.error && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-crimson/30 bg-crimson/[0.07] p-3.5">
                <div className="flex items-start gap-2.5 text-[13.5px] text-text">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-crimson" />
                  <div className="min-w-0 flex-1">
                    <div>Couldn't read the complaint.</div>
                    <div className="mt-0.5 text-[12.5px] text-muted">{run.error}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ember" onClick={() => setAttempt((a) => a + 1)}>
                    <RotateCcw /> Try again
                  </Button>
                  <Button size="sm" variant="outline" onClick={onBack}>
                    <ArrowLeft /> Back to the complaint
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      <Card className="pb-4">
        <CardHeader
          title="Found so far"
          tech="each value with its confidence"
          right={<span className="k-num text-[20px] text-text">{found.length}</span>}
        />
        {found.length === 0 && !run.error ? (
          <ul className="mt-2 space-y-1.5 px-4" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="k-shimmer h-[46px] rounded-xl border border-line bg-white/[0.02]" style={{ opacity: 1 - i * 0.16 }} />
            ))}
          </ul>
        ) : (
          <ul className="mt-2 max-h-[420px] space-y-1.5 overflow-auto px-4" data-lenis-prevent>
            {found.map((e, i) => (
              <FoundRow key={e.id} e={e} i={i} />
            ))}
          </ul>
        )}
        <AnimatePresence>
          {run.done && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-moss/25 bg-moss/[0.07] px-3 py-2 text-[13px] text-text">
              <Check className="size-3.5 text-moss" strokeWidth={3} />
              Read in {Math.max(1, Math.round(run.parse?.elapsedMs ?? 0))} ms
              {run.memory?.known ? ` · wallet already known in ${run.memory.linkedCases.length} other case${run.memory.linkedCases.length === 1 ? '' : 's'}` : ''}
              <span className="ml-auto text-[12px] text-dim">opening details…</span>
            </motion.div>
          )}
        </AnimatePresence>
        {run.parse?.warnings.map((w) => (
          <p key={w} className="mx-4 mt-3 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[12.5px] text-gold">
            {w}
          </p>
        ))}
      </Card>
    </div>
  )
}

function FoundRow({ e, i }: { e: IntakeEntity; i: number }) {
  const tone = ENTITY[e.type].tone
  const val = e.normalized && (e.type === 'amount' || e.type === 'date' || e.type === 'pii') ? e.normalized : e.text
  return (
    <motion.li
      initial={{ opacity: 0, x: 18, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: i * 0.05, type: 'spring', stiffness: 380, damping: 30 }}
      className="flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2"
    >
      <span className="size-2 shrink-0 rounded-full" style={{ background: toneHex(tone), boxShadow: `0 0 8px ${toneA(tone, 0.6)}` }} />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-dim">{ENTITY[e.type].label}</div>
        <div className={cn('truncate text-[13.5px] text-text', (e.type === 'wallet' || e.type === 'hash') && 'k-mono')}>
          {e.type === 'hash' || (e.type === 'wallet' && val.length > 24) ? short(val, 10, 8) : val}
        </div>
      </div>
      <span className={cn('k-num text-[13px]', e.confidence >= 0.95 ? 'text-moss' : e.confidence >= 0.85 ? 'text-text' : 'text-gold')}>{Math.round(e.confidence * 100)}%</span>
    </motion.li>
  )
}
