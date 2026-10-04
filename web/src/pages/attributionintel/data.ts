/**
 * Travel Rule + OSINT page data — ALL SYNTHETIC.
 * Wallets, people, report excerpts and compliance records are fabricated demo data.
 * No real Travel Rule network, vendor, scam-report site or forum is named.
 */
import type { Tone } from '@/components/kit'
import { ATTRIBUTION_EVIDENCE, ROUTE_A, ROUTE_B, CASE } from '@/data/demo'

/* ───────────── Travel Rule ───────────── */

/** FATF Recommendation 16 threshold for virtual-asset transfers (USD/EUR 1,000). */
export const TR_THRESHOLD = 1000

export type CheckState = 'yes' | 'no' | 'partial' | 'na'
export type Verdict = 'full' | 'partial' | 'none'

export type IvmsLine = {
  depth: number
  k?: string
  v?: string
  /** public = also visible on the blockchain · masked = sealed until lawful request · vasp = exchange name */
  kind?: 'public' | 'masked' | 'vasp' | 'plain' | 'open' | 'close'
}

export type TrCandidate = {
  id: string
  label: string
  context: string
  fromLabel: string
  fromKind: 'exchange' | 'private'
  fromId?: string
  toLabel: string
  toId: string
  toAddr: string
  amount: number
  at: string
  date: string
  checks: { amount: [CheckState, string]; time: [CheckState, string]; address: [CheckState, string]; threshold: [CheckState, string]; compliant: [CheckState, string] }
  confidence: number
  verdict: Verdict
  holder: string
  holderNote: string
  request: string[]
  why: string
  ivms: IvmsLine[] | null
  draftTo?: string
}

const ivms = (o: {
  origName: [string, string]
  origAcct: string
  origId: string
  benName: [string, string]
  benAcct: string
  origVasp: string
  benVasp: string
  amount: string
  asset: string
  ts: string
  tx: string
}): IvmsLine[] => [
  { depth: 0, kind: 'open', v: '{' },
  { depth: 1, k: 'originator', kind: 'open', v: '{' },
  { depth: 2, k: 'naturalPerson.name.primaryIdentifier', v: o.origName[0], kind: 'masked' },
  { depth: 2, k: 'naturalPerson.name.secondaryIdentifier', v: o.origName[1], kind: 'masked' },
  { depth: 2, k: 'accountNumber', v: o.origAcct, kind: 'masked' },
  { depth: 2, k: 'nationalIdentification', v: o.origId, kind: 'masked' },
  { depth: 1, kind: 'close', v: '},' },
  { depth: 1, k: 'beneficiary', kind: 'open', v: '{' },
  { depth: 2, k: 'naturalPerson.name.primaryIdentifier', v: o.benName[0], kind: 'masked' },
  { depth: 2, k: 'naturalPerson.name.secondaryIdentifier', v: o.benName[1], kind: 'masked' },
  { depth: 2, k: 'accountNumber', v: o.benAcct, kind: 'public' },
  { depth: 1, kind: 'close', v: '},' },
  { depth: 1, k: 'originatingVASP.legalPerson.name', v: o.origVasp, kind: 'vasp' },
  { depth: 1, k: 'beneficiaryVASP.legalPerson.name', v: o.benVasp, kind: 'vasp' },
  { depth: 1, k: 'transfer', kind: 'open', v: '{' },
  { depth: 2, k: 'amount', v: o.amount, kind: 'public' },
  { depth: 2, k: 'asset', v: o.asset, kind: 'public' },
  { depth: 2, k: 'timestamp', v: o.ts, kind: 'public' },
  { depth: 2, k: 'txHash', v: o.tx, kind: 'public' },
  { depth: 1, kind: 'close', v: '}' },
  { depth: 0, kind: 'close', v: '}' },
]

const routeBDeposit = ROUTE_B.trail[5]
const routeBSender = ROUTE_B.trail[4]

export const TR_CANDIDATES: TrCandidate[] = [
  {
    id: 'TR-1',
    label: 'Route B · last hop into the exchange',
    context: `${CASE.id} · Ethereum leg after the bridge`,
    fromLabel: 'Pass-through wallet 4 (private)',
    fromKind: 'private',
    toLabel: 'Meridian Digital Exchange',
    toId: 'meridian',
    toAddr: routeBDeposit.addr,
    amount: routeBDeposit.amt,
    at: routeBDeposit.at,
    date: '02 Sep 2026',
    checks: {
      amount: ['yes', `${routeBDeposit.amt.toLocaleString('en-IN')} USDT on-chain`],
      time: ['yes', `${routeBDeposit.at} IST, exact block time`],
      address: ['yes', 'deposit address matches'],
      threshold: ['yes', `≈ USD ${routeBDeposit.amt.toLocaleString('en-IN')} ≥ 1,000`],
      compliant: ['no', 'sender is a private wallet · Meridian not compliant'],
    },
    confidence: 0.18,
    verdict: 'none',
    holder: 'No exchange-to-exchange message',
    holderNote: `The money came from a private wallet (${routeBSender.addr.slice(0, 8)}…), not an exchange, so no Travel Rule message was sent. Meridian may hold a self-declaration from its own customer, but it is not Travel-Rule compliant.`,
    request: ['KYC of the deposit account holder — via the normal lawful notice to Meridian', 'Any self-declared "sender" note the customer gave Meridian'],
    why: 'Travel Rule only helps when both ends are exchanges. For this hop, the lawful notice on the Evidence screen is the right tool.',
    ivms: null,
  },
  {
    id: 'TR-2',
    label: 'Earlier transfer into the same deposit address',
    context: 'Same Meridian deposit address, seen 5 days before the scam',
    fromLabel: 'Kestrel Exchange',
    fromKind: 'exchange',
    fromId: 'kestrel',
    toLabel: 'Meridian Digital Exchange',
    toId: 'meridian',
    toAddr: routeBDeposit.addr,
    amount: 1250,
    at: '16:05:44',
    date: '28 Aug 2026',
    checks: {
      amount: ['na', 'different transfer — address is the join key'],
      time: ['na', 'not needed'],
      address: ['yes', 'exact deposit address'],
      threshold: ['yes', '≈ USD 1,250 ≥ 1,000'],
      compliant: ['partial', 'Kestrel compliant · Meridian not'],
    },
    confidence: 0.85,
    verdict: 'partial',
    holder: 'Kestrel Exchange (sending side)',
    holderNote: 'Before releasing a withdrawal above the threshold, Kestrel had to identify the receiving exchange. Its outbound record names Meridian as the beneficiary exchange — independent confirmation of who owns this address.',
    request: ['Name of the beneficiary exchange in Kestrel’s outbound record (confirmed: Meridian)', 'Identity of the Kestrel customer who sent 1,250 USDT here — possibly another victim', 'Beneficiary name the customer declared to Kestrel'],
    why: 'Kestrel is FIU-IND registered in India and answers in ~9 h. The sender may be an unreported victim of the same ring.',
    ivms: ivms({
      origName: ['S████', 'M██████'],
      origAcct: 'KX-██████-7716',
      origId: 'PAN ██████████',
      benName: ['V████ ████', '██'],
      benAcct: routeBDeposit.addr,
      origVasp: 'Kestrel Exchange',
      benVasp: 'Meridian Digital Exchange',
      amount: '1250.00',
      asset: 'USDT-ERC20',
      ts: '2026-08-28T16:05:41+05:30',
      tx: '0x8f3a…c19e',
    }),
    draftTo: 'Kestrel Exchange',
  },
  {
    id: 'TR-3',
    label: 'Mule cash-out between two compliant exchanges',
    context: 'SYN-07 · funded 2 hops from collection wallet',
    fromLabel: 'Kestrel Exchange',
    fromKind: 'exchange',
    fromId: 'kestrel',
    toLabel: 'Northwind Coin',
    toId: 'northwind',
    toAddr: '0x6b20f4c8e19a7d35b2',
    amount: 4980,
    at: '09:14:22',
    date: '03 Sep 2026',
    checks: {
      amount: ['yes', '4,980.00 USDT exact'],
      time: ['yes', 'message 4 s before broadcast'],
      address: ['yes', 'Northwind deposit matches'],
      threshold: ['yes', '≈ USD 4,980 ≥ 1,000'],
      compliant: ['yes', 'both exchanges compliant'],
    },
    confidence: 0.94,
    verdict: 'full',
    holder: 'Both — Kestrel (outbound) and Northwind (inbound)',
    holderNote: 'Both exchanges are Travel-Rule compliant. Kestrel holds the verified sender identity; Northwind holds the receiver identity it checked against its own KYC.',
    request: ['Verified originator name, account and ID (Kestrel)', 'Beneficiary name and Northwind account reference (Northwind)', 'Any other transfers between these two accounts in Aug–Sep 2026'],
    why: 'A full record on both sides names the mule who moved SYN-07 money — no hop-by-hop trace needed.',
    ivms: ivms({
      origName: ['P██████', 'D██'],
      origAcct: 'KX-██████-4821',
      origId: 'PAN ██████████',
      benName: ['N████ ████', 'K█████'],
      benAcct: '0x6b20f4c8e19a7d35b2',
      origVasp: 'Kestrel Exchange',
      benVasp: 'Northwind Coin',
      amount: '4980.00',
      asset: 'USDT-ERC20',
      ts: '2026-09-03T09:14:18+05:30',
      tx: '0x2d71…a804',
    }),
    draftTo: 'Northwind Coin',
  },
  {
    id: 'TR-4',
    label: 'Small top-up back to Kestrel',
    context: 'SYN-07 · same Northwind account',
    fromLabel: 'Northwind Coin',
    fromKind: 'exchange',
    fromId: 'northwind',
    toLabel: 'Kestrel Exchange',
    toId: 'kestrel',
    toAddr: '0x41a7c90be2d58f13a6',
    amount: 640,
    at: '11:20:09',
    date: '03 Sep 2026',
    checks: {
      amount: ['partial', '640 vs 638.4 after fee'],
      time: ['yes', 'within 6 s'],
      address: ['yes', 'Kestrel deposit matches'],
      threshold: ['no', '≈ USD 640 < 1,000'],
      compliant: ['yes', 'both exchanges compliant'],
    },
    confidence: 0.58,
    verdict: 'partial',
    holder: 'Northwind Coin (reduced record)',
    holderNote: 'Below the USD/EUR 1,000 threshold, exchanges still collect names and wallet addresses but are not required to verify them. Expect names only, possibly unverified.',
    request: ['Originator and beneficiary names as declared (unverified)', 'Wallet addresses on both sides'],
    why: 'Useful as corroboration of the TR-3 account pair, weak on its own.',
    ivms: ivms({
      origName: ['N████ ████', 'K█████'],
      origAcct: 'NW-██████-0937',
      origId: '— not collected below threshold',
      benName: ['P██████', 'D██'],
      benAcct: '0x41a7c90be2d58f13a6',
      origVasp: 'Northwind Coin',
      benVasp: 'Kestrel Exchange',
      amount: '640.00',
      asset: 'USDT-ERC20',
      ts: '2026-09-03T11:20:03+05:30',
      tx: '0x91c0…5be2',
    }),
    draftTo: 'Northwind Coin',
  },
  {
    id: 'TR-5',
    label: 'Transfer between two non-compliant exchanges',
    context: 'SYN-11 · loan-app network',
    fromLabel: 'Meridian Digital Exchange',
    fromKind: 'exchange',
    fromId: 'meridian',
    toLabel: 'Arcadia Markets',
    toId: 'arcadia',
    toAddr: '0x4f1c92ad07be33e5a8',
    amount: 2300,
    at: '22:47:15',
    date: '01 Sep 2026',
    checks: {
      amount: ['yes', '2,300 USDT'],
      time: ['yes', 'block time'],
      address: ['yes', 'Arcadia hot wallet'],
      threshold: ['yes', '≈ USD 2,300 ≥ 1,000'],
      compliant: ['no', 'neither exchange compliant'],
    },
    confidence: 0.05,
    verdict: 'none',
    holder: 'Nobody — no message sent',
    holderNote: 'Neither Meridian nor Arcadia takes part in Travel Rule messaging. No compliance record will exist; fall back to a lawful notice and the cross-border route.',
    request: ['Nothing to request under Travel Rule', 'Use the jurisdiction / MLAT route for Arcadia (UAE)'],
    why: 'Shows the limit honestly: non-compliant exchanges leave no compliance trail.',
    ivms: null,
  },
]

/** IVMS101 fields — what exists in the message vs what the officer can see now. */
export const IVMS_FIELDS: { field: string; tech: string; where: 'public' | 'sealed' | 'inferred' }[] = [
  { field: 'Sender’s name', tech: 'originator.naturalPerson.name', where: 'sealed' },
  { field: 'Sender’s account reference', tech: 'originator.accountNumber', where: 'sealed' },
  { field: 'Sender’s ID number or address', tech: 'nationalIdentification / geographicAddress', where: 'sealed' },
  { field: 'Receiver’s name (as declared)', tech: 'beneficiary.naturalPerson.name', where: 'sealed' },
  { field: 'Receiving wallet address', tech: 'beneficiary.accountNumber', where: 'public' },
  { field: 'Amount and coin', tech: 'transfer.amount · asset', where: 'public' },
  { field: 'Time sent (to the second)', tech: 'transfer.timestamp', where: 'public' },
  { field: 'Which two exchanges', tech: 'originatingVASP · beneficiaryVASP', where: 'inferred' },
]

/* ───────────── OSINT crowd intelligence ───────────── */

export type SourceKind = 'Public scam-report database A' | 'Public scam-report database B' | 'Community forum' | 'Public explorer comments'

export const SOURCES: { id: SourceKind; size: string; tone: Tone }[] = [
  { id: 'Public scam-report database A', size: '1.9 M reports', tone: 'sky' },
  { id: 'Public scam-report database B', size: '640 K reports', tone: 'sky' },
  { id: 'Community forum', size: '3 boards · 210 K posts', tone: 'violet' },
  { id: 'Public explorer comments', size: '4.2 M address notes', tone: 'teal' },
]

/** Credibility weights — crowd reports can be wrong or malicious, so every report is scored. */
export const CRED_WEIGHTS = [
  { key: 'onchain', plain: 'Matches what the blockchain shows', tech: 'claimed amount/date ↔ real inbound transfer', w: 0.4 },
  { key: 'corro', plain: 'Other victims say the same thing', tech: 'independent reports with same script', w: 0.3 },
  { key: 'detail', plain: 'Specific, first-hand detail', tech: 'amount, date, script steps present', w: 0.2 },
  { key: 'recency', plain: 'Recent report', tech: 'decay over 90 days', w: 0.1 },
] as const

export type CredKey = (typeof CRED_WEIGHTS)[number]['key']

export type Report = {
  id: string
  wallet: string
  source: SourceKind
  country: string
  cc: string
  date: string
  lang: string
  amount: string
  excerpt: string
  keywords: string[]
  s: Record<CredKey, number>
  onchainNote: string
  discarded?: boolean
}

export const credOf = (r: Report) => CRED_WEIGHTS.reduce((a, f) => a + f.w * r.s[f.key], 0)

const SCAMMER = CASE.suspectWallet
const HUB = ROUTE_A.trail[4].addr
const W2 = ROUTE_A.trail[2].addr
const VICTIM = ROUTE_A.trail[0].addr
const DEP_ETH = routeBDeposit.addr

export const REPORTS: Report[] = [
  // scammer's wallet — 3 reports, same "Telegram part-time job" script
  { id: 'R-01', wallet: SCAMMER, source: 'Public scam-report database A', country: 'Philippines', cc: 'PH', date: '03 Sep 2026', lang: 'Tagalog · auto-translated', amount: '400 USDT', excerpt: 'Recruiter on Telegram said I only need to like videos for commission. After 3 tasks they asked 400 USDT to "unlock VIP" and sent this address.', keywords: ['part-time job', 'like videos', 'unlock VIP'], s: { onchain: 1, corro: 0.9, detail: 0.85, recency: 1 }, onchainNote: '400 USDT inbound on 03 Sep 10:12 matches' },
  { id: 'R-02', wallet: SCAMMER, source: 'Community forum', country: 'United Kingdom', cc: 'UK', date: '05 Sep 2026', lang: 'English', amount: '1,150 USDT', excerpt: 'Part-time job through Telegram. Got two small payouts first, then had to top up 1,150 USDT to withdraw. Same wallet as the post above.', keywords: ['part-time job', 'small payouts first', 'pay to withdraw'], s: { onchain: 1, corro: 0.9, detail: 0.8, recency: 1 }, onchainNote: '1,150 USDT inbound on 02 Sep 23:40 matches' },
  { id: 'R-03', wallet: SCAMMER, source: 'Public scam-report database B', country: 'Nigeria', cc: 'NG', date: '06 Sep 2026', lang: 'English', amount: '260 USDT', excerpt: 'They called it merchant tasks. Paid 260 USDT to this TRC20 address, then told my account is frozen until I pay tax.', keywords: ['merchant tasks', 'tax to withdraw'], s: { onchain: 0.7, corro: 0.8, detail: 0.6, recency: 1 }, onchainNote: '255 USDT inbound on 04 Sep — close, not exact' },
  // collection hub — 11 reports
  { id: 'R-04', wallet: HUB, source: 'Public scam-report database A', country: 'Philippines', cc: 'PH', date: '26 Aug 2026', lang: 'Tagalog · auto-translated', amount: '780 USDT', excerpt: 'Telegram "online job" group. My deposit address changed every time, but my cousin followed them all to this one wallet.', keywords: ['online job', 'Telegram group', 'address changes'], s: { onchain: 0.9, corro: 1, detail: 0.8, recency: 0.9 }, onchainNote: 'Hub received from 3 wallets she named' },
  { id: 'R-05', wallet: HUB, source: 'Community forum', country: 'Indonesia', cc: 'ID', date: '27 Aug 2026', lang: 'Bahasa Indonesia · auto-translated', amount: '1,020 USDT', excerpt: 'Task app asked for a "credit score repair" deposit of 1,020 USDT. The explorer shows the money collected here with many others.', keywords: ['task app', 'credit score repair'], s: { onchain: 0.9, corro: 1, detail: 0.75, recency: 0.9 }, onchainNote: '1,020 USDT reached hub via 2 hops' },
  { id: 'R-06', wallet: HUB, source: 'Public explorer comments', country: 'United Kingdom', cc: 'UK', date: '29 Aug 2026', lang: 'English', amount: '—', excerpt: 'Collection wallet for a Telegram task scam. Dozens of inbound transfers of a few hundred USDT each, swept out in one go.', keywords: ['collection wallet', 'task scam'], s: { onchain: 1, corro: 1, detail: 0.5, recency: 0.9 }, onchainNote: 'Description matches hub behaviour exactly' },
  { id: 'R-07', wallet: HUB, source: 'Public scam-report database B', country: 'Kenya', cc: 'KE', date: '30 Aug 2026', lang: 'English', amount: '610 USDT', excerpt: 'Hired for an "app rating" job. Paid three deposits totalling 610 USDT, never got anything back.', keywords: ['app rating job', 'three deposits'], s: { onchain: 0.8, corro: 1, detail: 0.7, recency: 0.9 }, onchainNote: '3 transfers summing 610 USDT traced in' },
  { id: 'R-08', wallet: HUB, source: 'Public scam-report database A', country: 'United Arab Emirates', cc: 'AE', date: '01 Sep 2026', lang: 'English', amount: '2,300 USDT', excerpt: 'My "mentor" on Telegram made me do combo tasks. Each combo needed a bigger deposit. Lost 2,300 USDT in total.', keywords: ['combo tasks', 'mentor', 'bigger deposit'], s: { onchain: 0.85, corro: 1, detail: 0.8, recency: 0.95 }, onchainNote: '2,300 USDT reached hub via 3 hops' },
  { id: 'R-09', wallet: HUB, source: 'Community forum', country: 'United States', cc: 'US', date: '03 Sep 2026', lang: 'English', amount: '900 USDT', excerpt: 'Same script as everyone in this thread — like videos, VIP tier, pay to withdraw. Funds end up in this wallet.', keywords: ['like videos', 'VIP tier', 'pay to withdraw'], s: { onchain: 0.7, corro: 1, detail: 0.55, recency: 1 }, onchainNote: 'Plausible 900 USDT inbound, sender unconfirmed' },
  { id: 'R-10', wallet: HUB, source: 'Public scam-report database B', country: 'Malaysia', cc: 'MY', date: '04 Sep 2026', lang: 'Malay · auto-translated', amount: '450 USDT', excerpt: 'Part-time job, told to rate hotels. 450 USDT gone after the "VIP upgrade".', keywords: ['part-time job', 'rate hotels', 'VIP upgrade'], s: { onchain: 0.8, corro: 1, detail: 0.7, recency: 1 }, onchainNote: '450 USDT inbound via 2 hops' },
  { id: 'R-11', wallet: HUB, source: 'Public scam-report database A', country: 'Philippines', cc: 'PH', date: '31 Aug 2026', lang: 'English', amount: '320 USDT', excerpt: 'Telegram task group again. Asked 320 USDT to "reset" my task level.', keywords: ['task level', 'reset fee'], s: { onchain: 0.8, corro: 1, detail: 0.6, recency: 0.9 }, onchainNote: '320 USDT inbound via 2 hops' },
  { id: 'R-12', wallet: HUB, source: 'Community forum', country: 'Philippines', cc: 'PH', date: '02 Sep 2026', lang: 'Tagalog · auto-translated', amount: '1,400 USDT', excerpt: 'Like-and-subscribe job, then VIP deposits. My sister lost 1,400 USDT.', keywords: ['like videos', 'VIP deposits'], s: { onchain: 0.6, corro: 1, detail: 0.5, recency: 1 }, onchainNote: 'Second-hand account; amount unconfirmed' },
  { id: 'R-13', wallet: HUB, source: 'Public scam-report database B', country: 'Indonesia', cc: 'ID', date: '05 Sep 2026', lang: 'Bahasa Indonesia · auto-translated', amount: '700 USDT', excerpt: 'Online task job, deposit needed to withdraw salary. 700 USDT.', keywords: ['task job', 'deposit to withdraw'], s: { onchain: 0.8, corro: 1, detail: 0.55, recency: 1 }, onchainNote: '700 USDT inbound via 2 hops' },
  { id: 'R-14', wallet: HUB, source: 'Public explorer comments', country: 'United Kingdom', cc: 'UK', date: '06 Sep 2026', lang: 'English', amount: '—', excerpt: 'Linked to the task-scam ring flagged on several forums. Do not send funds.', keywords: ['task-scam ring'], s: { onchain: 0.9, corro: 1, detail: 0.35, recency: 1 }, onchainNote: 'Consistent with hub, no new facts' },
  // weaker / wrong reports — shown so the scoring is visible
  { id: 'R-15', wallet: DEP_ETH, source: 'Public explorer comments', country: 'Unknown', cc: '—', date: '30 Aug 2026', lang: 'English', amount: '—', excerpt: 'This is a Meridian deposit address. Scammers told me to cash out through Meridian and they ignored my emails.', keywords: ['Meridian', 'cash out'], s: { onchain: 0.8, corro: 0.5, detail: 0.6, recency: 0.9 }, onchainNote: 'Address behaves like an exchange deposit' },
  { id: 'R-16', wallet: W2, source: 'Community forum', country: 'United Kingdom', cc: 'UK', date: '05 Sep 2026', lang: 'English', amount: '—', excerpt: 'Found this address in the scam transaction chain, not sure if it is theirs.', keywords: [], s: { onchain: 0.6, corro: 0.2, detail: 0.3, recency: 1 }, onchainNote: 'Is on the chain, but no first-hand loss' },
  { id: 'R-17', wallet: VICTIM, source: 'Public scam-report database B', country: 'Unknown', cc: '—', date: '06 Sep 2026', lang: 'English', amount: '14,850 USDT', excerpt: 'SCAMMER WALLET!! report everywhere', keywords: [], s: { onchain: 0, corro: 0, detail: 0.1, recency: 1 }, onchainNote: 'Contradicts chain: this wallet SENT the money — it is the victim’s', discarded: true },
]

export const OSINT_WALLETS: { addr: string; role: string; tone: Tone }[] = [
  { addr: HUB, role: 'Collection wallet (hub)', tone: 'crimson' },
  { addr: SCAMMER, role: "Scammer's wallet", tone: 'crimson' },
  { addr: DEP_ETH, role: 'Exchange deposit · Ethereum', tone: 'gold' },
  { addr: W2, role: 'Pass-through wallet 2', tone: 'teal' },
  { addr: VICTIM, role: "Victim's wallet", tone: 'sky' },
  { addr: ROUTE_A.trail[3].addr, role: 'Pass-through wallet 3', tone: 'teal' },
]

/** Timeline Aug 20 → Sep 6: cumulative public reports vs Indian complaints that later traced to the hub. */
export const TL_LABELS = ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '1', '2', '3', '4', '5', '6']
export const TL_PUBLIC = [0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 4, 5, 6, 7, 9, 10, 12, 14]
export const TL_INDIA = [14, 15, 17, 18, 19, 21, 22, 24, 25, 27, 28, 30, 32, 33, 34, 36, 37, 38]
export const TL_FIRST = 6
export const TL_REKHA = 15

/* ───────────── Attribution uplift (weighted noisy-OR, same model as the Attribution screen) ───────────── */
const BASE_W = [0.7, 0.55, 0.4, 0.3]
export const BASE_SIGNALS = ATTRIBUTION_EVIDENCE.map((e, i) => ({ label: e.label, tech: e.tech, c: e.conf, w: BASE_W[i] ?? 0.3 }))
export const NEW_SIGNALS = [
  { key: 'tr', label: 'Kestrel’s outbound compliance record names Meridian as the receiving exchange', tech: 'Travel Rule · counterparty exchange · yes/no confirmation, identities sealed', c: 0.85, w: 0.35, tone: 'gold' as Tone },
  { key: 'osint', label: 'A public explorer comment names Meridian as the scammers’ cash-out platform', tech: 'OSINT · credibility 0.68 · consistent with deposit behaviour on-chain', c: 0.68, w: 0.25, tone: 'sky' as Tone },
] as const
