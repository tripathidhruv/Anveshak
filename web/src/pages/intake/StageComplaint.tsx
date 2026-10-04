import * as React from 'react'
import { motion } from 'motion/react'
import { ClipboardPaste, Database, EyeOff, FileText, Languages, ShieldCheck, Sparkles, Timer, X } from 'lucide-react'
import { Button, Card, CardHeader, Chip } from '@/components/kit'
import { Tabs, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { NCRP_QUEUE, SAMPLE_COMPLAINT } from '@/data/intakeSamples'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EntityLegend } from './parts'
import type { Draft } from './draft'

export const MIN_CHARS = 40

/** Rough live hint only — the backend makes the real call. */
function scriptHint(t: string): string | null {
  if (t.trim().length < 20) return null
  if (/[ऀ-ॿ]/.test(t)) return /[a-z]{3,}/i.test(t) ? 'Hindi + English' : 'Hindi (Devanagari)'
  return /\b(hai|ko|se|kiya|maine|mera|bhej|paisa|nahi|kripya)\b/i.test(t) ? 'Hinglish' : 'English'
}

export function StageComplaint({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const chars = draft.text.trim().length
  const hint = scriptHint(draft.text)

  React.useEffect(() => {
    if (draft.source === 'paste') ref.current?.focus({ preventScroll: true })
  }, [draft.source])

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_1fr]">
      <Card className="pb-4">
        <CardHeader
          title="What did the victim report?"
          tech="paste the complaint as written — Hindi, English or Hinglish — or pick it from the NCRP queue"
          right={hint ? <Chip tone="sky">{hint}</Chip> : null}
        />
        <div className="px-5 pt-3">
          <Tabs value={draft.source} onValueChange={(v) => patch({ source: v as Draft['source'] })}>
            <TabsList className="h-9 border border-line bg-white/[0.04]">
              <TabsTrigger value="paste" className="px-3 text-[13.5px]">
                <ClipboardPaste className="size-3.5" /> Paste text
              </TabsTrigger>
              <TabsTrigger value="ncrp" className="px-3 text-[13.5px]">
                <Database className="size-3.5" /> NCRP queue
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {draft.source === 'paste' ? (
            <motion.div key="paste" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
              <div className="relative rounded-xl border border-line bg-white/[0.02] focus-within:border-ember/50 focus-within:shadow-[0_0_0_3px_rgba(255,79,18,0.12)]">
                <textarea
                  ref={ref}
                  value={draft.text}
                  onChange={(e) => patch({ text: e.target.value, ncrpAck: null })}
                  placeholder="e.g. Namaste sir, main … se likh rahi hoon. Telegram pe ek job ka message aaya …"
                  aria-label="Complaint text"
                  rows={9}
                  className="block min-h-[220px] w-full resize-y rounded-xl bg-transparent px-4 py-3 text-[14.5px] leading-[1.75] text-text outline-none placeholder:text-dim"
                />
                {draft.text && (
                  <button
                    type="button"
                    onClick={() => {
                      patch({ text: '', ncrpAck: null })
                      ref.current?.focus()
                    }}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-dim hover:bg-white/[0.06] hover:text-text"
                    aria-label="Clear complaint text"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => patch({ text: SAMPLE_COMPLAINT, ncrpAck: null })} disabled={draft.text === SAMPLE_COMPLAINT}>
                  <Sparkles /> Use sample complaint
                </Button>
                <span className={cn('ml-auto text-[12px]', chars > 0 && chars < MIN_CHARS ? 'text-gold' : 'text-dim')}>
                  {chars < MIN_CHARS && chars > 0 ? `${MIN_CHARS - chars} more characters needed` : `${draft.text.length.toLocaleString('en-IN')} characters`}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="ncrp" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 overflow-hidden rounded-xl border border-line bg-white/[0.015]">
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2 text-[12px] text-dim">
                <span>NCRP portal · Rajasthan queue · crypto-related</span>
                <span>{NCRP_QUEUE.filter((r) => !r.caseId).length} waiting</span>
              </div>
              <ul className="divide-y divide-line" role="listbox" aria-label="NCRP complaints">
                {NCRP_QUEUE.map((r) => {
                  const selected = draft.ncrpAck === r.ack
                  const imported = Boolean(r.caseId)
                  return (
                    <li key={r.ack}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={imported}
                        onClick={() => patch({ ncrpAck: r.ack, text: r.text })}
                        className={cn(
                          'flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors',
                          selected ? 'bg-ember/[0.07] shadow-[inset_2px_0_0_var(--k-ember)]' : 'hover:bg-white/[0.03]',
                          imported && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', selected ? 'border-ember bg-ember/20' : 'border-line-2')}>
                          {selected && <motion.span layoutId="ncrp-dot" className="size-1.5 rounded-full bg-ember" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] text-text">
                            {r.who} <span className="text-dim">·</span> <span className="text-muted">{r.city}</span>
                          </div>
                          <div className="k-mono truncate text-[12px] text-dim">
                            {r.ack} · {r.cat}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="k-num text-[13.5px] text-text">{inr(r.amt)}</div>
                          <div className="text-[11.5px] text-dim">{r.at}</div>
                        </div>
                        <div className="hidden w-[118px] text-right sm:block">
                          {imported ? <Chip tone="moss">Case {r.caseId?.slice(-4)}</Chip> : selected ? <Chip tone="ember" dot>Selected</Chip> : <Chip>Waiting</Chip>}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {draft.ncrpAck && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-line">
                  <div className="flex items-center gap-1.5 px-3.5 pt-2.5 text-[12px] text-dim">
                    <FileText className="size-3.5" /> Complaint text from NCRP ack {draft.ncrpAck}
                  </div>
                  <p className="line-clamp-4 px-3.5 pb-3 pt-1 text-[13.5px] leading-relaxed text-text/80">{draft.text}</p>
                </motion.div>
              )}
              <div className="border-t border-line px-3.5 py-2 text-[12px] text-dim">Read-only import — ANVESHAK never writes back to NCRP. Records shown are synthetic.</div>
            </motion.div>
          )}
        </div>
      </Card>

      <div className="grid content-start gap-3">
        <Card className="pb-4">
          <CardHeader title="What ANVESHAK pulls out" tech="every value comes with a confidence and the reason behind it" />
          <div className="px-5 pt-3">
            <EntityLegend />
            <ul className="mt-4 space-y-3 text-[13.5px]">
              <Point icon={<Languages />} title="Reads mixed language" sub="Hindi, English and Hinglish — “shaam 7:42”, “12.4 lakh”, “is wallet pe”." />
              <Point icon={<ShieldCheck />} title="Checks every address" sub="TRON, Ethereum and Bitcoin checksums, so a typo is caught before the trace starts." />
              <Point icon={<EyeOff />} title="Masks phones and UPI IDs" sub="Masked at the moment of reading. Full values go only into the sealed evidence pack." />
              <Point icon={<Timer />} title="18 minutes of typing → seconds" sub="Manual entry time is an illustrative estimate, not a measurement." />
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Point({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line-2 bg-white/[0.04] text-muted [&_svg]:size-3.5">{icon}</span>
      <div className="min-w-0">
        <div className="text-text">{title}</div>
        <div className="text-[12.5px] leading-snug text-dim">{sub}</div>
      </div>
    </li>
  )
}
