import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowRight, Check, FolderKanban, Loader2, Plus, ShieldCheck } from 'lucide-react'
import { Button, Card, CardHeader, Chip, KV, toneA } from '@/components/kit'
import { api, errorText } from '@/api'
import { short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildRequest, OFFICER, UNIT, type Draft } from './draft'

export function StageOpen({ draft, patch, onReset }: { draft: Draft; patch: (p: Partial<Draft>) => void; onReset: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const req = buildRequest(draft)
  const created = draft.created

  const create = async () => {
    if (typeof req === 'string') return setError(req)
    setBusy(true)
    setError(null)
    try {
      patch({ created: await api.createCaseFromIntake(req) })
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const m = draft.memory
  const rows: [string, React.ReactNode][] = typeof req === 'string' ? [] : [
    ['Complainant', `${req.complainant} · ${req.location}`],
    ["Scammer's wallet", <span key="w" className="k-mono">{short(req.suspectWallet, 10, 8)}</span>],
    ['Network', draft.values.network?.value || req.chain],
    ['Amount lost', [draft.values.amountInr?.value, draft.values.amountCrypto?.value].filter(Boolean).join(' · ')],
    ['When', draft.values.incidentAt?.value],
    ['Scam type', req.fraudType],
    ['Contact', draft.values.platform?.value || '—'],
  ]

  return (
    <AnimatePresence mode="wait" initial={false}>
      {created ? (
        <Success key="ok" draft={draft} onTrace={() => navigate('/trace')} onQueue={() => navigate(`/cases?case=${created.caseId}`)} onReset={onReset} />
      ) : (
        <motion.div key="review" exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }} transition={{ duration: 0.3 }} className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr]">
          <Card className="pb-5">
            <CardHeader title="Case file preview" tech="what will be written — check it once more" right={<Chip>Draft</Chip>} />
            <div className="mx-5 mt-3 rounded-xl border border-line bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-[12.5px] text-muted">New case number</div>
                  <div className="k-num text-[24px] text-dim">KZN-2026-····</div>
                </div>
                <div className="text-right text-[12px] text-dim">
                  {UNIT} · {OFFICER}
                  {draft.ncrpAck && <div className="k-mono">NCRP ack {draft.ncrpAck}</div>}
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {rows.map(([k, val], i) => (
                  <motion.div key={k} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                    <KV k={k} v={val} />
                  </motion.div>
                ))}
              </div>
            </div>
            {draft.edited.length > 0 && (
              <p className="mx-5 mt-3 text-[12.5px] text-sky">
                {draft.edited.length} value{draft.edited.length === 1 ? '' : 's'} confirmed or corrected by you — recorded in the audit log with your name.
              </p>
            )}
          </Card>

          <Card className="pb-5">
            <CardHeader title="Open the case" tech="creates the case file, joins the national memory, writes the audit log" />
            <ul className="mt-3 space-y-2.5 px-5 text-[13.5px]">
              {[
                { ok: typeof req !== 'string', t: 'All required details present', sub: typeof req === 'string' ? req : 'wallet, amount, time and complainant' },
                { ok: Boolean(draft.values.network?.value), t: `Network: ${draft.values.network?.value || 'unknown'}`, sub: 'the trace picks the matching chain adapter' },
                { ok: true, t: m?.known ? `Linked to ${m.syndicate?.id ?? `${m.linkedCases.length} earlier cases`}` : 'New wallet for the national memory', sub: m?.known ? 'the trace starts from the known collection wallet' : 'future complaints will match it instantly' },
                { ok: true, t: 'FIR fields pre-filled', sub: 'a draft for officer review — nothing is filed automatically' },
              ].map((r, i) => (
                <motion.li key={r.t} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="flex items-start gap-2.5">
                  <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', r.ok ? 'border-moss/50 bg-moss/15 text-moss' : 'border-crimson/50 bg-crimson/15 text-crimson')}>
                    {r.ok ? <Check className="size-2.5" strokeWidth={3} /> : <AlertTriangle className="size-2.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-text">{r.t}</div>
                    <div className="text-[12px] text-dim">{r.sub}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
            <div className="px-5">
              <Button variant="ember" className="mt-5 h-11 w-full text-[15px]" disabled={busy || typeof req === 'string'} onClick={create}>
                {busy ? <Loader2 className="animate-spin" /> : <FolderKanban />}
                {busy ? 'Opening case…' : 'Create case'}
              </Button>
              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex items-start gap-1.5 text-[12.5px] text-crimson">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" /> {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <p className="mt-2 text-center text-[12px] text-dim">You can still go back and change anything until you press this.</p>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Success({ draft, onTrace, onQueue, onReset }: { draft: Draft; onTrace: () => void; onQueue: () => void; onReset: () => void }) {
  const c = draft.created!
  const traceRef = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    const t = setTimeout(() => traceRef.current?.focus({ preventScroll: true }), 900)
    return () => clearTimeout(t)
  }, [])
  const prior = c.memory.linkedCases.length

  return (
    <motion.div key="ok" initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
      <Card variant="glass" className="relative overflow-hidden px-6 pb-7 pt-8 text-center">
        {/* burst rings */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="pointer-events-none absolute left-1/2 top-[64px] size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border"
            style={{ borderColor: toneA('moss', 0.5) }}
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 5 + i * 1.5, opacity: 0 }}
            transition={{ delay: 0.15 + i * 0.18, duration: 1.4, ease: 'easeOut' }}
          />
        ))}
        <motion.div
          className="relative mx-auto grid size-16 place-items-center rounded-full border border-moss/50 bg-moss/15 text-moss"
          style={{ boxShadow: `0 0 40px ${toneA('moss', 0.35)}` }}
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.1 }}
        >
          <Check className="size-8" strokeWidth={3} />
        </motion.div>
        <div className="relative mt-5 text-[14px] text-muted">Case opened</div>
        <div className="k-num relative mt-1 flex justify-center text-[38px] leading-none text-text sm:text-[46px]" aria-label={c.caseId}>
          {c.caseId.split('').map((ch, i) => (
            <motion.span key={i} initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.35 + i * 0.035, type: 'spring', stiffness: 380, damping: 26 }}>
              {ch}
            </motion.span>
          ))}
        </div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="relative mt-3 flex flex-wrap justify-center gap-1.5">
          <Chip tone="moss" dot>
            In the case queue
          </Chip>
          <Chip tone={prior ? 'crimson' : 'sky'}>{prior ? `Linked to ${prior} earlier case${prior === 1 ? '' : 's'}` : 'Added to national memory'}</Chip>
          <Chip>
            <ShieldCheck className="size-3" /> Audit #{c.auditHash.slice(0, 8)}
          </Chip>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }} className="relative mx-auto mt-6 flex max-w-[520px] flex-col justify-center gap-2 sm:flex-row">
          <Button ref={traceRef} variant="ember" className="h-11 px-5 text-[15px]" onClick={onTrace}>
            Start the trace <ArrowRight />
          </Button>
          <Button variant="outline" className="h-11" onClick={onQueue}>
            <FolderKanban /> See the case queue
          </Button>
          <Button variant="quiet" className="h-11" onClick={onReset}>
            <Plus /> New complaint
          </Button>
        </motion.div>
        <p className="relative mt-4 text-[12px] text-dim">
          {draft.values.complainant?.value} · NCRP ack {c.ncrp} · the trace usually finishes in under a minute (illustrative).
        </p>
      </Card>
    </motion.div>
  )
}
