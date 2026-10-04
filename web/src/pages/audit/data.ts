/**
 * Audit Ledger — page-local synthetic custody log for case ANV-2026-0417.
 * Hashes are computed for real (lightweight 64-bit demo hash standing in for SHA-256),
 * so the tamper simulation genuinely breaks the chain.
 */
import type { Tone } from '@/components/kit'

export type ActionType = 'intake' | 'analysis' | 'evidence' | 'review' | 'legal'

export type Actor = { id: string; name: string; role: string; tone: Tone; initials: string }

export const ACTORS: Actor[] = [
  { id: 'ncrp', name: 'NCRP portal', role: 'system intake', tone: 'neutral', initials: 'NP' },
  { id: 'kavita', name: 'SI Kavita Rathore', role: 'investigating officer', tone: 'white', initials: 'KR' },
  { id: 'engine', name: 'ANVESHAK engine', role: 'automated analysis', tone: 'ember', initials: 'KZ' },
  { id: 'arjun', name: 'Insp. Arjun Bhatia', role: 'reviewing officer', tone: 'white', initials: 'AB' },
  { id: 'sp', name: 'SP Neha Kulkarni', role: 'SP approval', tone: 'moss', initials: 'NK' },
  { id: 'meridian', name: 'Meridian Digital Exchange', role: 'exchange (external)', tone: 'gold', initials: 'MD' },
]

export const ACTION_LABEL: Record<ActionType, string> = {
  intake: 'Intake',
  analysis: 'Analysis',
  evidence: 'Evidence',
  review: 'Review',
  legal: 'Legal notice',
}

export type Entry = {
  n: number
  date: string
  time: string
  actor: string
  type: ActionType
  action: string
  object: string
  detail: string
}

export const RAW: Entry[] = [
  { n: 1, date: '04 Sep', time: '11:05:12', actor: 'ncrp', type: 'intake', action: 'Complaint received', object: 'NCRP 31402260041789', detail: 'Rekha Sharma, Jaipur · loss reported ₹12.4 L' },
  { n: 2, date: '04 Sep', time: '11:18:40', actor: 'kavita', type: 'intake', action: 'Case opened', object: 'ANV-2026-0417', detail: 'FIR 0312/2026 · Cyber PS Jaipur' },
  { n: 3, date: '04 Sep', time: '11:21:03', actor: 'engine', type: 'analysis', action: 'Trace completed', object: 'TXk9mR…D6fH', detail: '6 hops in 41 s · ends at an exchange deposit address' },
  { n: 4, date: '04 Sep', time: '11:21:09', actor: 'engine', type: 'analysis', action: 'Risk scored', object: 'TXk9mR…D6fH', detail: 'HIGH 0.87 · 6 factors · weights v14' },
  { n: 5, date: '04 Sep', time: '11:21:15', actor: 'engine', type: 'analysis', action: 'Exchange attributed', object: 'TBx1eM…W2kL', detail: 'Meridian Digital Exchange · confidence 0.91' },
  { n: 6, date: '04 Sep', time: '11:31:52', actor: 'kavita', type: 'evidence', action: 'Amount confirmed', object: 'Bank statement', detail: '14,850 USDT ≈ ₹12.4 L · Vindhya Bank XXXX4821' },
  { n: 7, date: '04 Sep', time: '11:40:26', actor: 'kavita', type: 'evidence', action: 'Evidence pack generated', object: 'EP-0417-v1', detail: '18 pages · file fingerprint recorded' },
  { n: 8, date: '04 Sep', time: '11:52:10', actor: 'arjun', type: 'review', action: 'Evidence reviewed', object: 'EP-0417-v1', detail: 'Countersigned · 2 comments resolved' },
  { n: 9, date: '04 Sep', time: '12:06:33', actor: 'sp', type: 'legal', action: 'Notice approved', object: 'NTC-2026-0931', detail: 'Freeze + KYC request · officer-reviewed draft' },
  { n: 10, date: '04 Sep', time: '12:10:02', actor: 'engine', type: 'legal', action: 'Notice dispatched', object: 'NTC-2026-0931', detail: 'To Meridian compliance desk · 72 h window starts' },
  { n: 11, date: '04 Sep', time: '12:50:47', actor: 'meridian', type: 'legal', action: 'Delivery acknowledged', object: 'NTC-2026-0931', detail: 'Receipt confirmed via exchange portal' },
  { n: 12, date: '04 Sep', time: '13:02:19', actor: 'kavita', type: 'evidence', action: 'Evidence exported', object: 'EP-0417-v1', detail: 'Court copy · PDF + JSON bundle' },
  { n: 13, date: '05 Sep', time: '09:14:55', actor: 'engine', type: 'analysis', action: 'Linked to syndicate', object: 'SYN-07', detail: 'Shared collection wallet TNh8yW…K9pR · 38 cases' },
  { n: 14, date: '05 Sep', time: '10:31:08', actor: 'arjun', type: 'review', action: 'Feedback verdict', object: 'RV-1184', detail: 'Attribution to Meridian accepted' },
]

export const TAMPER_ENTRY = 6
export const TAMPERED_DETAIL = '4,850 USDT ≈ ₹4.1 L · Vindhya Bank XXXX4821'
export const GENESIS = '0000000000000000'

/** cyrb53-style 64-bit hash → 16 hex chars (demo stand-in for SHA-256). */
export function hash64(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

export function contentOf(e: Entry): string {
  return [e.n, e.date, e.time, e.actor, e.action, e.object, e.detail].join('|')
}

/** The chain as it was sealed: each entry stores its own hash and the previous entry's hash. */
export type Sealed = Entry & { hash: string; prev: string }
export const SEALED: Sealed[] = (() => {
  let prev = GENESIS
  return RAW.map((e) => {
    const hash = hash64(contentOf(e) + prev)
    const s = { ...e, hash, prev }
    prev = hash
    return s
  })
})()

/** Root printed in the case diary at the daily seal. */
export const SEALED_ROOT = SEALED[SEALED.length - 1].hash

export type Check = { ok: boolean; reason?: 'altered' | 'upstream'; recomputed: string }

/** Replay the chain from genesis; any change propagates to every later entry. */
export function verify(entries: Sealed[]): Check[] {
  let prev = GENESIS
  let broken = false
  return entries.map((e) => {
    const recomputed = hash64(contentOf(e) + prev)
    const ok = recomputed === e.hash && !broken
    const reason: Check['reason'] = ok ? undefined : broken ? 'upstream' : 'altered'
    if (!ok) broken = true
    prev = recomputed
    return { ok, reason, recomputed }
  })
}
