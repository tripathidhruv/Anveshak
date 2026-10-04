/**
 * Exchange Compliance — page-local synthetic data.
 * All notices, exchanges and amounts are fabricated demo data.
 */
import type { Tone } from '@/components/kit'
import { EXCHANGES, type Exchange } from '@/data/demo'

export type NoticeStatus = 'awaiting' | 'reminded' | 'responded' | 'breached' | 'escalated'

export type Notice = {
  id: string
  caseId: string
  victim: string
  exchange: string
  type: 'Freeze + KYC request' | 'Freeze request' | 'KYC disclosure'
  sentAt: string
  /** hours since the notice was sent, at page load */
  ageHrs: number
  /** hours the exchange took to reply (responded notices only) */
  repliedHrs?: number
  status: NoticeStatus
  freezeINR: number
  wallets: number
  outcome?: string
}

/** Statutory response window and escalation ladder (days since notice). */
export const WINDOW_HRS = 72
export const LADDER: { day: number; title: string; sub: string; tone: Tone }[] = [
  { day: 0, title: 'Notice sent', sub: 'freeze + KYC request', tone: 'gold' },
  { day: 3, title: 'Automated reminder', sub: 'if no reply in 72 h', tone: 'ember' },
  { day: 7, title: 'Escalate to FIU-IND', sub: 'regulator copied', tone: 'crimson' },
  { day: 10, title: 'Recommend blocking', sub: 'IT Act · draft', tone: 'crimson' },
]
export const LADDER_MAX_DAY = 11

export const NOTICES: Notice[] = [
  { id: 'NTC-2026-0931', caseId: 'KZN-2026-0417', victim: 'Rekha Sharma', exchange: 'meridian', type: 'Freeze + KYC request', sentAt: '04 Sep, 12:10', ageHrs: 19.7, status: 'awaiting', freezeINR: 1240000, wallets: 2 },
  { id: 'NTC-2026-0929', caseId: 'KZN-2026-0416', victim: 'Arun Menon', exchange: 'meridian', type: 'Freeze request', sentAt: '03 Sep, 14:52', ageHrs: 41.2, status: 'awaiting', freezeINR: 860000, wallets: 1 },
  { id: 'NTC-2026-0927', caseId: 'KZN-2026-0415', victim: 'Fatima Qureshi', exchange: 'northwind', type: 'KYC disclosure', sentAt: '03 Sep, 09:30', ageHrs: 46.5, repliedHrs: 18, status: 'responded', freezeINR: 2150000, wallets: 3, outcome: 'KYC shared · 2 accounts frozen' },
  { id: 'NTC-2026-0924', caseId: 'KZN-2026-0412', victim: 'Harpreet Gill', exchange: 'meridian', type: 'Freeze + KYC request', sentAt: '01 Sep, 16:05', ageHrs: 88.4, status: 'breached', freezeINR: 655000, wallets: 2 },
  { id: 'NTC-2026-0913', caseId: 'KZN-2026-0406', victim: 'Sunita Yadav', exchange: 'meridian', type: 'Freeze request', sentAt: '02 Sep, 00:40', ageHrs: 61.3, status: 'awaiting', freezeINR: 760000, wallets: 1 },
  { id: 'NTC-2026-0920', caseId: 'KZN-2026-0410', victim: 'Meera Joshi', exchange: 'orbita', type: 'Freeze + KYC request', sentAt: '28 Aug, 11:20', ageHrs: 178.6, status: 'escalated', freezeINR: 2890000, wallets: 4 },
  { id: 'NTC-2026-0918', caseId: 'KZN-2026-0414', victim: 'S. Balaji', exchange: 'kestrel', type: 'Freeze request', sentAt: '03 Sep, 18:02', ageHrs: 37.9, repliedHrs: 6, status: 'responded', freezeINR: 430000, wallets: 1, outcome: 'Account frozen · ₹4.3 L held' },
  { id: 'NTC-2026-0915', caseId: 'KZN-2026-0411', victim: 'Ankit Verma', exchange: 'arcadia', type: 'KYC disclosure', sentAt: '25 Aug, 21:15', ageHrs: 244.9, status: 'escalated', freezeINR: 312000, wallets: 1 },
  { id: 'NTC-2026-0911', caseId: 'KZN-2026-0408', victim: 'Deepa Rao', exchange: 'kestrel', type: 'Freeze request', sentAt: '01 Sep, 10:45', ageHrs: 93.3, repliedHrs: 4, status: 'responded', freezeINR: 1120000, wallets: 2, outcome: 'Account frozen · ₹11.2 L held' },
  { id: 'NTC-2026-0905', caseId: 'KZN-2026-0407', victim: 'Rohit Das', exchange: 'orbita', type: 'Freeze request', sentAt: '30 Aug, 22:30', ageHrs: 130.2, status: 'breached', freezeINR: 540000, wallets: 1 },
]

export function ex(id: string): Exchange {
  return EXCHANGES.find((e) => e.id === id)!
}

/* ── Exchange scorecard ── */
export type Graded = Exchange & { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; freezeRate: number; speed: number }

/** grade = 40% on-time rate + 30% freezes honoured + 30% speed (120 h or slower = 0) */
export function gradeExchanges(): Graded[] {
  return EXCHANGES.map((e) => {
    const freezeRate = e.freezesHonoured / e.noticesReceived
    const speed = 1 - Math.min(e.avgResponseHrs, 120) / 120
    const score = 0.4 * e.slaHitRate + 0.3 * freezeRate + 0.3 * speed
    const grade: Graded['grade'] = score >= 0.85 ? 'A' : score >= 0.7 ? 'B' : score >= 0.55 ? 'C' : score >= 0.4 ? 'D' : 'F'
    return { ...e, score, grade, freezeRate, speed }
  }).sort((a, b) => b.score - a.score)
}

export const GRADE_TONE: Record<Graded['grade'], Tone> = { A: 'moss', B: 'moss', C: 'neutral', D: 'crimson', F: 'crimson' }

/* ── Response-time trend (hours to first reply, daily) ── */
export const TREND_LABELS = Array.from({ length: 21 }, (_, i) => String(i + 1))
export const KESTREL_HRS = [11, 10, 12, 9, 10, 8, 9, 11, 8, 7, 9, 8, 10, 7, 8, 9, 7, 6, 8, 7, 6]
export const MERIDIAN_HRS = [44, 49, 47, 52, 50, 55, 58, 54, 61, 57, 63, 60, 66, 62, 64, 69, 65, 70, 68, 72, 71]
