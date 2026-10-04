/**
 * Smart Intake wizard state. One reducer-free hook: the draft lives in sessionStorage so an officer
 * who wanders off to another screen mid-complaint comes back to the same stage, not a blank form.
 */
import * as React from 'react'
import type { ChainId, IntakeCaseIn, IntakeCaseOut, IntakeField, IntakeFieldId, IntakeParseOut, MemoryLookup } from '@/api'

export const STAGES = [
  { key: 'complaint', label: 'Complaint', tech: 'paste · NCRP import' },
  { key: 'reading', label: 'Reading', tech: 'NER · checksums' },
  { key: 'details', label: 'Check details', tech: 'confirm · correct' },
  { key: 'links', label: 'Scam type & links', tech: 'typology · national memory' },
  { key: 'open', label: 'Open case', tech: 'case file · audit log' },
] as const
export type StageIndex = 0 | 1 | 2 | 3 | 4

export type FieldValue = { value: string; normalized: string | null }

export type Draft = {
  stage: StageIndex
  source: 'paste' | 'ncrp'
  ncrpAck: string | null
  text: string
  /** the exact text the current `parse` was produced from — differs from `text` once the officer edits it */
  parsedText: string | null
  parse: IntakeParseOut | null
  values: Partial<Record<IntakeFieldId, FieldValue>>
  edited: IntakeFieldId[]
  typology: string | null
  memory: MemoryLookup | null
  created: IntakeCaseOut | null
}

const KEY = 'kaizen.intake.draft.v1'

export const EMPTY: Draft = {
  stage: 0,
  source: 'paste',
  ncrpAck: null,
  text: '',
  parsedText: null,
  parse: null,
  values: {},
  edited: [],
  typology: null,
  memory: null,
  created: null,
}

function load(): Draft {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return EMPTY
    const d = { ...EMPTY, ...(JSON.parse(raw) as Draft) }
    // never resume inside the transient "Reading" stage — its request died with the page
    return d.stage === 1 ? { ...d, stage: 0 } : d
  } catch {
    return EMPTY
  }
}

export function useDraft() {
  const [draft, setDraft] = React.useState<Draft>(load)
  React.useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(draft))
    } catch {
      /* private mode / storage full — the wizard still works, it just won't survive a reload */
    }
  }, [draft])
  const patch = React.useCallback((p: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => {
    setDraft((d) => ({ ...d, ...(typeof p === 'function' ? p(d) : p) }))
  }, [])
  const reset = React.useCallback(() => setDraft(EMPTY), [])
  return { draft, patch, reset }
}

export const valuesFromParse = (fields: IntakeField[]): Draft['values'] =>
  Object.fromEntries(fields.map((f) => [f.id, { value: f.value, normalized: f.normalized }]))

/* ───────── validation shared by "Check details" and "Open case" ───────── */

export const REQUIRED: { id: IntakeFieldId; why: string }[] = [
  { id: 'suspectWallet', why: "the scammer's wallet — the trace starts here" },
  { id: 'incidentAt', why: 'when the money was sent — fixes the golden-hour clock' },
  { id: 'complainant', why: 'who is complaining' },
]

export function chainOf(addr: string): ChainId | null {
  const a = addr.trim()
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return 'tron'
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'ethereum'
  if (/^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a)) return 'bitcoin'
  return null
}

/** "₹12,40,000", "12.4 lakh", "1.2 crore", "230000" → rupees, or null. */
export function rupees(s: string): number | null {
  const t = s.toLowerCase().replace(/[₹,\s]|rs\.?|inr/g, '')
  const m = t.match(/^(\d+(?:\.\d+)?)(lakh|lac|l|crore|cr)?$/)
  if (!m) return null
  const n = parseFloat(m[1])
  const mult = m[2]?.startsWith('c') ? 1e7 : m[2] ? 1e5 : 1
  return Math.round(n * mult)
}

/** "14,850 USDT" → { amount: 14850, unit: 'USDT' } */
export function cryptoAmount(s: string): { amount: number; unit: string } | null {
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([A-Za-z]{2,5})?/)
  if (!m) return null
  return { amount: parseFloat(m[1]), unit: (m[2] ?? '').toUpperCase() }
}

export function missingRequired(d: Draft): typeof REQUIRED {
  const miss = REQUIRED.filter((r) => !d.values[r.id]?.value.trim())
  const money = d.values.amountInr?.value.trim() || d.values.amountCrypto?.value.trim()
  return money ? miss : [...miss, { id: 'amountInr', why: 'how much was lost — rupees or crypto' }]
}

export function walletProblem(d: Draft): string | null {
  const w = d.values.suspectWallet?.value.trim()
  if (!w) return null
  if (!chainOf(w)) return 'This does not look like a TRON, Ethereum or Bitcoin address. Check it against the screenshot.'
  return null
}

/* ───────── draft → create-case request ───────── */

export const UNIT = 'Cyber PS Jaipur'
export const OFFICER = 'SI Kavita Rathore'

/** Turns the reviewed draft into the create-case request. Returns a plain-English problem instead when something won't convert. */
export function buildRequest(d: Draft): IntakeCaseIn | string {
  const v = (id: keyof Draft['values']) => d.values[id]?.value.trim() ?? ''
  const wallet = v('suspectWallet')
  const chain = (d.values.network?.normalized as ChainId | null) ?? chainOf(wallet)
  if (!chain) return "The scammer's wallet isn't a TRON, Ethereum or Bitcoin address."
  const crypto = cryptoAmount(v('amountCrypto'))
  const inr = rupees(v('amountInr'))
  if (inr === null && !crypto) return 'Add how much was lost, in rupees or crypto.'
  const at = d.values.incidentAt?.normalized
  if (!at || Number.isNaN(Date.parse(at))) return 'Add when the money was sent.'
  const unit = crypto?.unit || (chain === 'tron' ? 'USDT' : chain === 'ethereum' ? 'ETH' : 'BTC')
  const [city, state] = v('location').split(',').map((s) => s.trim())
  return {
    complainant: v('complainant'),
    location: v('location') || city || '',
    state: state || null,
    suspectWallet: wallet,
    chain,
    asset: unit === 'USDT' ? `USDT-${chain === 'tron' ? 'TRC20' : 'ERC20'}` : unit,
    amountCrypto: crypto?.amount ?? 0,
    amountInr: inr ?? 0,
    incidentAt: at,
    fraudType: d.typology ?? d.parse?.typology.classes[0]?.name ?? 'Other / unclear',
    txHash: v('txHash') || null,
    platform: v('platform') || null,
    ncrp: d.ncrpAck,
    unit: UNIT,
    correctedFields: d.edited,
  }
}

