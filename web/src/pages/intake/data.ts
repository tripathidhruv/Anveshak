/** Smart Intake — display metadata only. The complaint samples live in `data/intakeSamples.ts`. */
import type { Tone } from '@/components/kit'
import type { EntityType, IntakeFieldId } from '@/api'

export const ENTITY: Record<EntityType, { tone: Tone; label: string }> = {
  wallet: { tone: 'crimson', label: 'Wallet' },
  amount: { tone: 'gold', label: 'Amount' },
  hash: { tone: 'teal', label: 'Transaction ID' },
  handle: { tone: 'violet', label: 'Platform / handle' },
  date: { tone: 'sky', label: 'Date & time' },
  pii: { tone: 'neutral', label: 'Phone / UPI (masked)' },
}

/** The reading pipeline. The first four run inside `/intake/parse`; "Match" is the national-memory lookup. */
export const PIPELINE = [
  { k: 'Read', tech: 'script + language detect' },
  { k: 'Understand', tech: 'Hinglish entity extraction' },
  { k: 'Validate', tech: 'address checksums · formats' },
  { k: 'Normalise', tech: 'USDT · INR · IST' },
  { k: 'Match', tech: 'national memory lookup' },
]

export type FieldKind = 'text' | 'mono' | 'datetime'

export const FIELD_GROUPS: { title: string; tech: string; fields: { id: IntakeFieldId; tone: Tone; kind: FieldKind; hint?: string }[] }[] = [
  {
    title: 'The money',
    tech: 'what the trace needs',
    fields: [
      { id: 'suspectWallet', tone: 'crimson', kind: 'mono', hint: 'T… (TRON), 0x… (Ethereum) or 1… / 3… / bc1… (Bitcoin)' },
      { id: 'network', tone: 'teal', kind: 'text' },
      { id: 'amountCrypto', tone: 'gold', kind: 'text', hint: 'e.g. 14,850 USDT' },
      { id: 'amountInr', tone: 'gold', kind: 'text', hint: 'e.g. ₹12,40,000 or 12.4 lakh' },
      { id: 'txHash', tone: 'teal', kind: 'mono' },
      { id: 'incidentAt', tone: 'sky', kind: 'datetime' },
    ],
  },
  {
    title: "The scammer's contact",
    tech: 'masked at ingest · full values only in the evidence pack',
    fields: [
      { id: 'platform', tone: 'violet', kind: 'text', hint: 'e.g. Telegram · @handle' },
      { id: 'phone', tone: 'neutral', kind: 'text' },
      { id: 'upi', tone: 'neutral', kind: 'text' },
    ],
  },
  {
    title: 'The complainant',
    tech: 'from the complaint and NCRP record',
    fields: [
      { id: 'complainant', tone: 'sky', kind: 'text' },
      { id: 'location', tone: 'sky', kind: 'text', hint: 'City, State' },
      { id: 'victimWallet', tone: 'sky', kind: 'mono', hint: "Optional — the trace can read it from the transaction" },
    ],
  },
]

/** Labels for fields the backend may omit (e.g. officer added a value the parser never saw). */
export const FIELD_LABEL: Record<IntakeFieldId, string> = {
  suspectWallet: "Scammer's wallet",
  network: 'Network and coin',
  amountCrypto: 'Amount sent (crypto)',
  amountInr: 'Amount lost (rupees)',
  txHash: 'Transaction ID',
  incidentAt: 'When the money was sent',
  platform: 'Where the scammer made contact',
  upi: 'UPI ID used',
  phone: "Scammer's phone number",
  complainant: 'Complainant',
  location: 'Location',
  typology: 'Type of scam',
  victimWallet: "Victim's own wallet",
}
