/**
 * Synthetic stand-in for the backend (VITE_USE_MOCK unset / true). It returns the scripted demo
 * extraction for the sample complaint only — it does not pretend to read arbitrary text.
 * Shapes match `types.ts` exactly, so switching to the real backend changes no screen.
 */
import { CASES } from '@/data/demo'
import { SAMPLE_COMPLAINT, SAMPLE_TX } from '@/data/intakeSamples'
import type { KaizenApi } from './index'
import type { CaseSummary, EntityType, IntakeEntity, IntakeField, IntakeParseOut, MemoryLookup } from './types'

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

const SUSPECT = 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm'

function ent(id: string, type: EntityType, text: string, confidence: number, reason: string, extra: Partial<IntakeEntity> = {}): IntakeEntity {
  const start = SAMPLE_COMPLAINT.indexOf(text)
  return { id, type, text, start, end: start + text.length, confidence, reason, normalized: null, chain: null, warnings: [], ...extra }
}

const ENTITIES: IntakeEntity[] = [
  ent('e1', 'date', '28 Aug', 0.72, 'Day and month with no year — 2026 assumed from the later full date.', { normalized: '2026-08-28' }),
  ent('e2', 'handle', 'Telegram', 0.8, 'Messaging platform named just before a handle.'),
  ent('e3', 'handle', '@saffron_tasks_hr', 0.96, '“@” handle written right after the word “Telegram”.', { normalized: 'telegram:@saffron_tasks_hr' }),
  ent('e4', 'amount', '₹3,000', 0.9, 'Rupee sign + number — the promised daily payout, not a loss.', { normalized: '3000 INR' }),
  ent('e5', 'amount', '₹1,500', 0.93, 'Rupee sign + number after “registration fee”.', { normalized: '1500 INR' }),
  ent('e6', 'pii', 'tasks.pay••••@konark', 0.88, 'Pattern name@bank after “UPI pe” — a UPI ID. Kept masked.', { normalized: 'ta•••••@konark' }),
  ent('e7', 'amount', '14,850 USDT', 0.98, 'Number followed by “USDT”.', { normalized: '14850 USDT' }),
  ent('e8', 'wallet', SUSPECT, 0.99, 'Starts with “T”, Base58 only, 34 characters, checksum passes → TRON network.', { normalized: SUSPECT, chain: 'tron' }),
  ent('e9', 'date', '02 Sep 2026, shaam 7:42 pm', 0.93, '“shaam” (evening) + 7:42 pm → 19:42 IST.', { normalized: '2026-09-02T19:42:00+05:30' }),
  ent('e10', 'hash', SAMPLE_TX, 0.99, '64 hexadecimal characters with no “0x” — the TRON transaction-ID format.', { normalized: SAMPLE_TX, chain: 'tron' }),
  ent('e11', 'amount', '₹12.4 lakh', 0.95, '“12.4 lakh” → ₹12,40,000. Largest rupee amount, read as the total loss.', { normalized: '1240000 INR' }),
  ent('e12', 'pii', '+91 98XXXX4821', 0.9, '“+91” followed by a 10-digit mobile number. Kept masked.', { normalized: '+91 XXXXXX4821' }),
]

const FIELDS: IntakeField[] = [
  { id: 'suspectWallet', label: "Scammer's wallet", value: SUSPECT, normalized: SUSPECT, confidence: 0.99, reason: 'Starts with “T”, Base58 only, 34 characters, checksum passes → TRON network.', sources: ['text'], entityIds: ['e8'] },
  { id: 'network', label: 'Network and coin', value: 'TRON · USDT (TRC-20)', normalized: 'tron', confidence: 0.97, reason: 'Wallet format says TRON; the word “USDT” on TRON means the TRC-20 token.', sources: ['text'], entityIds: ['e7', 'e8'] },
  { id: 'amountCrypto', label: 'Amount sent (crypto)', value: '14,850 USDT', normalized: '14850', confidence: 0.98, reason: 'Number followed by “USDT” in the text.', sources: ['text'], entityIds: ['e7'] },
  { id: 'amountInr', label: 'Amount lost (rupees)', value: '₹12,40,000', normalized: '1240000', confidence: 0.95, reason: '“12.4 lakh” → ₹12,40,000. Cross-check: 14,850 USDT × ₹83.5 ≈ ₹12.4 L.', sources: ['text'], entityIds: ['e11'] },
  { id: 'txHash', label: 'Transaction ID', value: SAMPLE_TX, normalized: SAMPLE_TX, confidence: 0.99, reason: '64 hexadecimal characters with no “0x” prefix — the TRON transaction-ID format.', sources: ['text'], entityIds: ['e10'] },
  { id: 'incidentAt', label: 'When the money was sent', value: '02 Sep 2026, 19:42 IST', normalized: '2026-09-02T19:42:00+05:30', confidence: 0.93, reason: '“shaam 7:42 pm” + “02 Sep 2026” → 19:42 IST. The latest date in the complaint.', sources: ['text'], entityIds: ['e9'] },
  { id: 'platform', label: 'Where the scammer made contact', value: 'Telegram · @saffron_tasks_hr', normalized: 'telegram:@saffron_tasks_hr', confidence: 0.96, reason: 'An “@…” handle written right after the word “Telegram”.', sources: ['text'], entityIds: ['e2', 'e3'] },
  { id: 'upi', label: 'UPI ID used', value: 'ta•••••@konark', normalized: 'ta•••••@konark', confidence: 0.88, reason: 'Pattern “name@bank” after “UPI pe”. Masked — the full ID goes only into the evidence pack.', sources: ['text'], entityIds: ['e6'] },
  { id: 'phone', label: "Scammer's phone number", value: '+91 XXXXXX4821', normalized: '+91 XXXXXX4821', confidence: 0.9, reason: '“+91” followed by a 10-digit mobile number. Masked here.', sources: ['text'], entityIds: ['e12'] },
  { id: 'complainant', label: 'Complainant', value: 'Rekha Sharma', normalized: 'Rekha Sharma', confidence: 0.9, reason: 'Self-introduction “main Rekha Sharma”.', sources: ['text'], entityIds: [] },
  { id: 'location', label: 'Location', value: 'Jaipur, Rajasthan', normalized: 'Jaipur, Rajasthan', confidence: 0.92, reason: '“Jaipur se” — a known city, mapped to its state.', sources: ['text'], entityIds: [] },
  { id: 'typology', label: 'Type of scam', value: 'Task-based job scam', normalized: 'task_job', confidence: 0.91, reason: 'Triggered by “part-time task job”, “YouTube videos like”, “registration fee”, “bada task”.', sources: ['text'], entityIds: [] },
  { id: 'victimWallet', label: "Victim's own wallet", value: '', normalized: null, confidence: 0, reason: 'Not in the complaint. Ask the complainant, or KAIZEN reads it from the transaction during the trace.', sources: [], entityIds: [] },
]

const SAMPLE_RESULT: Omit<IntakeParseOut, 'elapsedMs'> = {
  language: 'hinglish',
  scripts: ['latin'],
  entities: ENTITIES,
  fields: FIELDS,
  chain: 'tron',
  warnings: [],
  typology: {
    top: 'task_job',
    classes: [
      { id: 'task_job', name: 'Task-based job scam', p: 0.91 },
      { id: 'investment', name: 'Investment app scam', p: 0.06 },
      { id: 'pig_butchering', name: 'Pig-butchering (romance)', p: 0.03 },
    ],
    triggers: [
      { phrase: 'part-time task job', weight: 0.34, classId: 'task_job' },
      { phrase: 'YouTube videos like karo', weight: 0.21, classId: 'task_job' },
      { phrase: 'registration fee', weight: 0.17, classId: 'task_job' },
      { phrase: 'bada task', weight: 0.12, classId: 'task_job' },
      { phrase: 'double milega', weight: 0.07, classId: 'investment' },
    ],
    disclaimer: 'A suggestion only — the officer confirms the category in the FIR.',
  },
}

const DISCLAIMER = 'Links come from earlier submissions and shared downstream wallets. A lead to verify, not proof.'

const KNOWN: MemoryLookup = {
  address: SUSPECT,
  chain: 'tron',
  known: true,
  firstSeen: '2026-08-21T16:05:00+05:30',
  submissionCount: 3,
  linkedCases: [
    { caseId: 'KZN-2026-0416', relation: 'same_wallet', city: 'Kochi', state: 'Kerala', amountInr: 860000, reportedAt: '2026-09-03T09:18:00+05:30' },
    { caseId: 'KZN-2026-0412', relation: 'same_wallet', city: 'Ludhiana', state: 'Punjab', amountInr: 655000, reportedAt: '2026-08-29T14:40:00+05:30' },
    { caseId: 'KZN-2026-0406', relation: 'one_hop', city: 'Patna', state: 'Bihar', amountInr: 760000, reportedAt: '2026-08-21T16:05:00+05:30' },
  ],
  syndicate: { id: 'SYN-07', name: 'Telegram task-scam ring “Saffron Desk”', caseCount: 38, stateCount: 11, valueInr: 47000000, confidence: 0.93, hub: 'TNh8yW5vC2mQ7fL4xK9pR' },
  provenance: [
    { at: '2026-09-03T09:18:00+05:30', unit: 'Cyber PS Kochi', state: 'Kerala', event: 'submitted', detail: 'Named as the receiving wallet in KZN-2026-0416' },
    { at: '2026-08-29T14:40:00+05:30', unit: 'Cyber PS Ludhiana', state: 'Punjab', event: 'submitted', detail: 'Named as the receiving wallet in KZN-2026-0412' },
    { at: '2026-08-21T16:05:00+05:30', unit: 'Cyber PS Patna', state: 'Bihar', event: 'linked', detail: 'One hop from the wallet in KZN-2026-0406' },
  ],
  disclaimer: DISCLAIMER,
}

const unknown = (address: string): MemoryLookup => ({
  address,
  chain: null,
  known: false,
  firstSeen: null,
  submissionCount: 0,
  linkedCases: [],
  syndicate: null,
  provenance: [],
  disclaimer: DISCLAIMER,
})

/* Cases opened through Smart Intake this session — kept in sessionStorage so the queue still shows them after a reload. */
const CREATED_KEY = 'kaizen.mock.createdCases.v1'
function created(): CaseSummary[] {
  try {
    return JSON.parse(sessionStorage.getItem(CREATED_KEY) ?? '[]') as CaseSummary[]
  } catch {
    return []
  }
}
function remember(c: CaseSummary) {
  try {
    sessionStorage.setItem(CREATED_KEY, JSON.stringify([c, ...created()]))
  } catch {
    /* storage unavailable — the case just won't survive a reload */
  }
}
const CHAIN_NAME = { tron: 'TRON', ethereum: 'Ethereum', bitcoin: 'Bitcoin' } as const

export const mockApi: KaizenApi = {
  async parseComplaint({ text }, signal) {
    const t0 = performance.now()
    await wait(700, signal)
    if (text.trim() === SAMPLE_COMPLAINT) return { ...SAMPLE_RESULT, elapsedMs: Math.round(performance.now() - t0) }
    return {
      ...SAMPLE_RESULT,
      entities: [],
      chain: null,
      fields: FIELDS.map((f) => ({ ...f, value: '', normalized: null, confidence: 0, sources: [], entityIds: [], reason: 'Demo mode reads only the sample complaint.' })),
      typology: { ...SAMPLE_RESULT.typology, top: 'other', classes: [{ id: 'other', name: 'Other / unclear', p: 1 }], triggers: [] },
      warnings: ['Demo mode reads only the sample complaint. Start the backend and set VITE_USE_MOCK=false to read any text.'],
      elapsedMs: Math.round(performance.now() - t0),
    }
  },
  async createCaseFromIntake(body) {
    await wait(650)
    const caseId = `KZN-2026-${String(418 + created().length).padStart(4, '0')}`
    const known = body.suspectWallet === SUSPECT
    const [city, state = ''] = body.location.split(',').map((s) => s.trim())
    remember({
      id: caseId,
      who: body.complainant,
      city,
      state,
      amt: body.amountInr,
      chain: CHAIN_NAME[body.chain],
      status: 'Intake',
      risk: null,
      recover: 'moving',
      goldenMin: null, // unknown until the trace finds where the money sits
      syndicate: known ? 'SYN-07' : undefined,
      type: body.fraudType,
      wallet: body.suspectWallet,
      filed: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      isNew: true,
    })
    return {
      caseId,
      ncrp: body.ncrp ?? '31402260041789',
      createdAt: new Date().toISOString(),
      memory: known ? KNOWN : unknown(body.suspectWallet),
      auditHash: 'a3f9c1e07b5d4e2f8c6a1b9d0e7f3c5a2b8d4e6f1a3c5e7b9d0f2a4c6e8b1d3f',
    }
  },
  async lookupWallet(address, signal) {
    await wait(450, signal)
    return address.trim() === SUSPECT ? KNOWN : unknown(address.trim())
  },
  async memoryStats() {
    return { wallets: 214806, cases: 18342, events: 402117, states: 28, syndicates: 41 }
  },
  async listCases() {
    await wait(250)
    return [...created(), ...CASES]
  },
}
