import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, CircleDashed, Pencil } from 'lucide-react'
import { Card, CardHeader, Chip, Meter, toneHex, type Tone } from '@/components/kit'
import type { IntakeFieldId } from '@/api'
import { short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FIELD_GROUPS, FIELD_LABEL, type FieldKind } from './data'
import { HighlightedText } from './parts'
import { chainOf, missingRequired, REQUIRED, type Draft, type FieldValue } from './draft'

const LOW = 0.9

/** ISO with offset → value for <input type="datetime-local"> (IST wall-clock). */
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '')
const fmtIst = (local: string) => {
  const d = new Date(`${local}:00+05:30`)
  return Number.isNaN(d.getTime())
    ? local
    : `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`
}

export function StageDetails({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void }) {
  const parse = draft.parse!
  const [focus, setFocus] = React.useState<string[]>([])
  const fieldMeta = React.useMemo(() => Object.fromEntries(parse.fields.map((f) => [f.id, f])), [parse])
  const entityById = React.useMemo(() => Object.fromEntries(parse.entities.map((e) => [e.id, e])), [parse])
  const missing = missingRequired(draft)
  const all = FIELD_GROUPS.flatMap((g) => g.fields)
  const found = all.filter((f) => draft.values[f.id]?.value.trim()).length
  const toCheck = all.filter((f) => {
    const v = draft.values[f.id]?.value.trim()
    return v && !draft.edited.includes(f.id) && (fieldMeta[f.id]?.confidence ?? 1) < LOW
  }).length

  const save = (id: IntakeFieldId, next: FieldValue) =>
    patch((d) => {
      const values = { ...d.values, [id]: next }
      // a corrected wallet may be on another chain — keep "Network and coin" in step with it
      const c = id === 'suspectWallet' ? chainOf(next.value) : null
      if (c && c !== d.values.network?.normalized) values.network = { value: NETWORK[c], normalized: c }
      return { values, edited: d.edited.includes(id) ? d.edited : [...d.edited, id] }
    })

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.2fr]">
      <div className="xl:sticky xl:top-4 xl:self-start">
        <Card className="pb-4">
          <CardHeader title="The complaint" tech="hover a detail on the right to see where it came from" right={<Chip tone="sky">{parse.language}</Chip>} />
          <div className="mx-5 mt-3 max-h-[52vh] overflow-auto rounded-xl border border-line bg-white/[0.02] px-4 py-3" data-lenis-prevent>
            <HighlightedText text={draft.parsedText ?? draft.text} entities={parse.entities} show focus={focus} stagger={0} />
          </div>
          <div className="mx-5 mt-3 grid grid-cols-3 gap-2 text-center">
            <Tally n={found} of={all.length} label="found" tone="moss" />
            <Tally n={toCheck} label="worth a second look" tone={toCheck ? 'gold' : 'neutral'} />
            <Tally n={missing.length} label="still needed" tone={missing.length ? 'crimson' : 'neutral'} />
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {missing.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-2xl border border-crimson/30 bg-crimson/[0.06] px-4 py-3 text-[13.5px]">
                <div className="flex items-center gap-2 text-text">
                  <CircleDashed className="size-4 text-crimson" /> Needed before the case can open
                </div>
                <ul className="mt-1.5 space-y-0.5 pl-6 text-[12.5px] text-muted">
                  {missing.map((m) => (
                    <li key={m.id}>
                      <span className="text-text/90">{FIELD_LABEL[m.id]}</span> — {m.why}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {FIELD_GROUPS.map((g, gi) => (
          <motion.div key={g.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + gi * 0.08, type: 'spring', stiffness: 260, damping: 28 }}>
            <Card className="pb-2">
              <CardHeader title={g.title} tech={g.tech} />
              <div className="mt-1 divide-y divide-line px-3">
                {g.fields.map((f, i) => {
                  const meta = fieldMeta[f.id]
                  const v = draft.values[f.id] ?? { value: '', normalized: null }
                  const warnings = (meta?.entityIds ?? []).flatMap((id) => entityById[id]?.warnings ?? [])
                  return (
                    <FieldRow
                      key={f.id}
                      i={gi * 6 + i}
                      label={meta?.label ?? FIELD_LABEL[f.id]}
                      tone={f.tone}
                      kind={f.kind}
                      hint={f.hint}
                      v={v}
                      conf={meta?.confidence ?? 0}
                      reason={meta?.reason ?? ''}
                      warnings={warnings}
                      required={REQUIRED.some((r) => r.id === f.id) || ((f.id === 'amountInr' || f.id === 'amountCrypto') && missing.some((m) => m.id === 'amountInr'))}
                      edited={draft.edited.includes(f.id)}
                      onFocus={(on) => setFocus(on ? meta?.entityIds ?? [] : [])}
                      onSave={(next) => save(f.id, next)}
                      onConfirm={() => patch((d) => ({ edited: d.edited.includes(f.id) ? d.edited : [...d.edited, f.id] }))}
                      problem={f.id === 'suspectWallet' && v.value.trim() && !chainOf(v.value) ? 'Not a valid TRON, Ethereum or Bitcoin address format.' : null}
                    />
                  )
                })}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const NETWORK: Record<string, string> = { tron: 'TRON · USDT (TRC-20)', ethereum: 'Ethereum', bitcoin: 'Bitcoin' }

function Tally({ n, of, label, tone }: { n: number; of?: number; label: string; tone: Tone }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-2 py-2">
      <div className="k-num text-[20px]" style={{ color: tone === 'neutral' ? 'var(--k-dim)' : toneHex(tone) }}>
        {n}
        {of !== undefined && <span className="text-[13px] text-dim">/{of}</span>}
      </div>
      <div className="text-[11.5px] leading-tight text-dim">{label}</div>
    </div>
  )
}

function FieldRow({
  i,
  label,
  tone,
  kind,
  hint,
  v,
  conf: rawConf,
  reason,
  warnings,
  required,
  edited,
  problem,
  onFocus,
  onSave,
  onConfirm,
}: {
  i: number
  label: string
  tone: Tone
  kind: FieldKind
  hint?: string
  v: FieldValue
  conf: number
  reason: string
  warnings: string[]
  required: boolean
  edited: boolean
  problem: string | null
  onFocus: (on: boolean) => void
  onSave: (next: FieldValue) => void
  onConfirm: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const missing = !v.value.trim()
  const conf = edited ? 1 : rawConf
  const low = !missing && !edited && rawConf < LOW

  const start = () => {
    setDraft(kind === 'datetime' ? toLocalInput(v.normalized) : v.value)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const t = draft.trim()
    if (kind === 'datetime') {
      if (t && t !== toLocalInput(v.normalized)) onSave({ value: fmtIst(t), normalized: `${t}:00+05:30` })
      return
    }
    if (t !== v.value.trim()) onSave({ value: t, normalized: t || null })
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 + i * 0.03 }}
      className={cn('-mx-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.02]', missing && required && 'bg-crimson/[0.035]')}
      onMouseEnter={() => onFocus(true)}
      onMouseLeave={() => onFocus(false)}
      onFocusCapture={() => onFocus(true)}
      onBlurCapture={() => onFocus(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: toneHex(tone) }} />
            <span className="truncate">{label}</span>
            {required && <span className="text-[11px] text-crimson/80">required</span>}
          </div>
          <div className="mt-1 min-h-[26px]">
            {editing ? (
              <input
                autoFocus
                type={kind === 'datetime' ? 'datetime-local' : 'text'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setEditing(false)
                }}
                aria-label={`Edit ${label}`}
                placeholder={hint}
                className={cn(
                  'h-8 w-full rounded-lg border border-ember/50 bg-white/[0.04] px-2.5 text-[14px] text-text outline-none [color-scheme:dark] placeholder:text-dim',
                  kind === 'mono' && 'k-mono',
                )}
              />
            ) : (
              <button
                type="button"
                onClick={start}
                className={cn(
                  'group inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[14.5px] outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ember/50',
                  missing ? 'border border-dashed text-muted' : 'text-text',
                  missing && (required ? 'border-crimson/40' : 'border-line-2'),
                )}
                title="Click to correct"
              >
                <span className={cn('truncate', kind === 'mono' && 'k-mono')}>
                  {missing ? (required ? 'Needed — click to add' : 'Not in complaint — click to add') : kind === 'mono' && v.value.length > 40 ? short(v.value, 12, 10) : v.value}
                </span>
                <Pencil className="size-3 shrink-0 text-dim opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            )}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-dim">{edited ? 'Confirmed or corrected by the officer — recorded in the audit log.' : reason}</div>
          {[...(problem ? [problem] : []), ...(edited ? [] : warnings)].map((w) => (
            <div key={w} className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-gold">
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
        <div className="w-[96px] shrink-0 pt-0.5 text-right">
          <div className={cn('k-num text-[14px]', missing ? 'text-dim' : conf >= 0.95 ? 'text-moss' : low ? 'text-gold' : 'text-text')}>{missing ? '—' : `${Math.round(conf * 100)}%`}</div>
          <Meter key={`${conf}-${missing}`} value={missing ? 0 : conf} tone={missing ? 'neutral' : conf >= 0.95 ? 'moss' : 'gold'} height={4} className="mt-1" />
          {low ? (
            <button type="button" onClick={onConfirm} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-gold/30 px-1.5 py-0.5 text-[11.5px] text-gold hover:bg-gold/10">
              <Check className="size-3" strokeWidth={3} /> Looks right
            </button>
          ) : (
            <div className="mt-1 text-[11px] text-dim">{edited ? <span className="text-sky">officer</span> : missing ? '' : 'from text'}</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
