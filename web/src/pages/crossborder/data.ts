/**
 * Cross-border routing — channel descriptions are generic; per-country treaty, language and
 * turnaround data is ILLUSTRATIVE and must be verified with the central authority before use.
 * All exchanges are fictional (see EXCHANGES in @/data/demo).
 */
import type { Tone } from '@/components/kit'

export type ChannelKey = 'domestic' | 'direct' | 'interpol' | 'fiu' | 'mlat'

export type Channel = {
  key: ChannelKey
  name: string
  short: string
  tech: string
  turnaround: string
  binding: string
  bindingTone: Tone
  obtains: string[]
  signatory: string
}

export const CHANNELS: Record<ChannelKey, Channel> = {
  domestic: {
    key: 'domestic',
    name: 'Domestic legal notice',
    short: 'Domestic notice',
    tech: "notice to the exchange's India nodal officer · BNSS §94 — section reference to be verified",
    turnaround: '1–3 days',
    binding: 'Binding in India',
    bindingTone: 'moss',
    obtains: ['KYC identity of the account holder', 'Full deposit and withdrawal history', 'Hold on the account balance'],
    signatory: 'Investigating officer, countersigned by the SHO',
  },
  direct: {
    key: 'direct',
    name: 'Direct compliance request',
    short: 'Direct request',
    tech: "voluntary request to the exchange's law-enforcement desk",
    turnaround: '1–5 days',
    binding: 'Voluntary — the exchange may refuse',
    bindingTone: 'gold',
    obtains: ['KYC identity of the account holder', 'Deposit and withdrawal history', 'Voluntary hold on the account'],
    signatory: 'Investigating officer, countersigned by the SHO',
  },
  interpol: {
    key: 'interpol',
    name: 'Police-to-police via INTERPOL',
    short: 'INTERPOL NCB',
    tech: "through India's INTERPOL National Central Bureau (NCB-New Delhi, CBI)",
    turnaround: 'Hours to 3 days for preservation',
    binding: 'Not binding — foreign police act under their own law',
    bindingTone: 'gold',
    obtains: ['Urgent preservation of records and funds', 'Confirmation that the account exists', 'Police intelligence on the account holder'],
    signatory: 'State nodal officer, forwarded to NCB-New Delhi',
  },
  fiu: {
    key: 'fiu',
    name: 'FIU-to-FIU intelligence exchange',
    short: 'FIU-to-FIU',
    tech: "FIU-IND ↔ the other country's financial intelligence unit · secure FIU network",
    turnaround: '2–6 weeks',
    binding: 'Not binding — intelligence only, not court evidence',
    bindingTone: 'gold',
    obtains: ['Suspicious-transaction reports on the account', 'Account and beneficiary details', 'Links to other investigations'],
    signatory: 'FIU-IND, on request from the investigating agency',
  },
  mlat: {
    key: 'mlat',
    name: 'Mutual legal assistance request',
    short: 'MLAT',
    tech: 'treaty request / letter of request via the central authority (Ministry of Home Affairs)',
    turnaround: '3–12 months',
    binding: 'Binding — executed by the foreign authority',
    bindingTone: 'moss',
    obtains: ['Certified records admissible in court', 'Compelled production of KYC and login logs', 'Freezing and confiscation orders'],
    signatory: 'Court letter of request, routed via the state government to MHA',
  },
}

export const FOREIGN_CHANNELS: ChannelKey[] = ['direct', 'interpol', 'fiu', 'mlat']

export type Juris = {
  exchangeId: string
  country: string
  code: string
  contact: 'nodal' | 'voluntary' | 'none'
  contactNote: string
  treaty: 'domestic' | 'bilateral' | 'multilateral'
  language: string | null
  eta: Partial<Record<ChannelKey, number>>
  etaNote?: Partial<Record<ChannelKey, string>>
  route: { preserve: ChannelKey; primary: ChannelKey; fallback: ChannelKey }
}

export const TREATY_LABEL: Record<Juris['treaty'], string> = {
  domestic: 'Not needed — exchange answers to Indian law',
  bilateral: 'Bilateral treaty route (illustrative)',
  multilateral: 'Multilateral convention route (illustrative)',
}

export const JURIS: Record<string, Juris> = {
  meridian: {
    exchangeId: 'meridian',
    country: 'Seychelles',
    code: 'SC',
    contact: 'voluntary',
    contactNote: 'Yes — voluntary law-enforcement desk, replies in ~61 h',
    treaty: 'multilateral',
    language: null,
    eta: { direct: 2.5, interpol: 2, fiu: 30, mlat: 180 },
    route: { preserve: 'interpol', primary: 'direct', fallback: 'mlat' },
  },
  kestrel: {
    exchangeId: 'kestrel',
    country: 'India',
    code: 'IN',
    contact: 'nodal',
    contactNote: 'Registered nodal officer in India',
    treaty: 'domestic',
    language: null,
    eta: { domestic: 0.4, fiu: 14 },
    route: { preserve: 'domestic', primary: 'domestic', fallback: 'fiu' },
  },
  northwind: {
    exchangeId: 'northwind',
    country: 'Singapore',
    code: 'SG',
    contact: 'nodal',
    contactNote: 'Registered with FIU-IND · India nodal officer on file',
    treaty: 'bilateral',
    language: null,
    eta: { domestic: 1, fiu: 21, mlat: 120 },
    etaNote: { mlat: 'only if records held abroad are refused' },
    route: { preserve: 'domestic', primary: 'domestic', fallback: 'mlat' },
  },
  arcadia: {
    exchangeId: 'arcadia',
    country: 'UAE',
    code: 'AE',
    contact: 'none',
    contactNote: 'No — answers 21% of requests, ~96 h when it does',
    treaty: 'bilateral',
    language: 'Arabic',
    eta: { direct: 14, interpol: 3, fiu: 28, mlat: 150 },
    etaNote: { direct: 'often ignored' },
    route: { preserve: 'interpol', primary: 'fiu', fallback: 'mlat' },
  },
  halcyon: {
    exchangeId: 'halcyon',
    country: 'India',
    code: 'IN',
    contact: 'nodal',
    contactNote: 'Registered nodal officer in India',
    treaty: 'domestic',
    language: null,
    eta: { domestic: 0.6, fiu: 14 },
    route: { preserve: 'domestic', primary: 'domestic', fallback: 'fiu' },
  },
  orbita: {
    exchangeId: 'orbita',
    country: 'Estonia',
    code: 'EE',
    contact: 'none',
    contactNote: 'No — answers 12% of requests, ~120 h when it does',
    treaty: 'multilateral',
    language: 'Estonian',
    eta: { direct: 21, interpol: 2, fiu: 25, mlat: 210 },
    etaNote: { direct: 'often ignored' },
    route: { preserve: 'interpol', primary: 'fiu', fallback: 'mlat' },
  },
}

export type CheckItem = { id: string; label: string; tech: string; auto?: boolean }

/** Checklist for a route — union of what each channel on it needs. */
export function checklistFor(j: Juris, urgent: boolean): CheckItem[] {
  const ch = new Set<ChannelKey>([j.route.primary, j.route.fallback, ...(urgent ? [j.route.preserve] : [])])
  const foreign = j.treaty !== 'domestic'
  const items: CheckItem[] = []
  if (urgent) items.push({ id: 'preserve', label: 'Preservation request sent first', tech: 'stops deletion or withdrawal while the slower request runs' })
  items.push({ id: 'summary', label: 'One-page case summary in English', tech: 'facts, offence, amount, timeline', auto: true })
  items.push({ id: 'hashes', label: 'Wallet addresses and transaction hashes', tech: 'exported from the trace · both routes', auto: true })
  items.push({ id: 'cert', label: 'Evidence-pack certificate', tech: 'certificate for electronic records · section reference to be verified', auto: true })
  if (ch.has('domestic')) items.push({ id: 'nodal', label: "Notice addressed to the exchange's India nodal officer", tech: 'from the FIU-IND registration record' })
  if (foreign) items.push({ id: 'fir', label: 'FIR and complaint copy, translated into English', tech: 'certified translation' })
  if (foreign && j.language) items.push({ id: 'lang', label: `Translation into ${j.language}`, tech: 'may be required by the requested country (illustrative)' })
  if (ch.has('interpol')) items.push({ id: 'ncb', label: 'Request routed through the state nodal officer to NCB-New Delhi', tech: 'police-to-police channel' })
  if (ch.has('fiu')) items.push({ id: 'fiuform', label: 'Request form to FIU-IND quoting the case reference', tech: 'FIU-to-FIU exchange' })
  if (ch.has('mlat')) {
    items.push({ id: 'dual', label: 'Dual-criminality statement', tech: 'the offence is a crime in both countries' })
    if (j.treaty === 'multilateral') items.push({ id: 'recip', label: 'Assurance of reciprocity', tech: 'India will assist the other country in a similar case' })
    items.push({ id: 'lor', label: 'Letter of request signed by the court', tech: 'binding request' })
    items.push({ id: 'mha', label: 'Forwarded via the state government to MHA', tech: 'central authority for criminal matters' })
  }
  return items
}

/** Days → readable ETA */
export function etaText(d: number): string {
  if (d < 1) return `${Math.round(d * 24)} h`
  if (d < 30) return `${d % 1 === 0 ? d : d.toFixed(1)} day${d === 1 ? '' : 's'}`
  return `~${Math.round(d / 30)} month${Math.round(d / 30) === 1 ? '' : 's'}`
}
