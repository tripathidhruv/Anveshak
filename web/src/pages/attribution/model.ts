import type { Tone } from '@/components/kit'
import { ATTRIBUTION_EVIDENCE, RISK } from '@/data/demo'

/* ───────────── Attribution: weighted noisy-OR ─────────────
 * Each signal i says "this is Meridian" with confidence c_i. The signals are not independent
 * (a hot-wallet sweep and an inverted-index hit partly see the same thing), so each one is
 * discounted by an independence weight w_i before combining:
 *     P = 1 − Π (1 − w_i · c_i)
 */
export const EVIDENCE_WEIGHTS = [0.7, 0.55, 0.4, 0.3]

export const EVIDENCE = ATTRIBUTION_EVIDENCE.map((e, i) => {
  const w = EVIDENCE_WEIGHTS[i] ?? 0.3
  return { ...e, w, miss: 1 - w * e.conf }
})

export const ATTRIBUTION_P = 1 - EVIDENCE.reduce((p, e) => p * e.miss, 1)

export const CANDIDATES: { name: string; monogram: string; tone: Tone; p: number; why: string }[] = [
  { name: 'Meridian Digital Exchange', monogram: 'MD', tone: 'gold', p: 0.91, why: 'All four signals agree — deposit pattern, hot-wallet sweep, index hit and explorer tag.' },
  { name: 'Northwind Coin', monogram: 'NW', tone: 'sky', p: 0.06, why: 'Shares one hot-wallet, but deposit addresses are never reused this way and no index hit.' },
  { name: 'Kestrel Exchange', monogram: 'KX', tone: 'moss', p: 0.02, why: 'Similar sweep timing only. Kestrel confirmed via API that the address is not theirs.' },
  { name: 'Unattributed / private wallet', monogram: '?', tone: 'neutral', p: 0.01, why: 'A private wallet cannot explain 340 deposit-like transfers from unrelated senders.' },
]

/* ───────────── Risk: weight × signal strength ───────────── */
export type RiskInputs = {
  sweepSec: number
  victims: number
  keptPct: number
  registered: boolean
  ageIdx: number
}

export const BASE_INPUTS: RiskInputs = { sweepSec: 42, victims: 38, keptPct: 99.9, registered: false, ageIdx: 0 }

export const AGE_STOPS = [
  { label: '3 hours', s: 0.6 },
  { label: '1 day', s: 0.4 },
  { label: '1 week', s: 0.2 },
  { label: '1 month', s: 0.08 },
  { label: '1 year', s: 0 },
]

export const SWEEP_MAX = 6 * 3600
export const NOTICE_THRESHOLD = 0.6

const clamp = (x: number) => Math.max(0, Math.min(1, x))

/** Signal strength 0..1 for each of the six risk factors (same order as RISK.factors). */
export function strengths(i: RiskInputs): number[] {
  return [
    clamp(1 - Math.log(Math.max(i.sweepSec, 1) / 35) / Math.log(SWEEP_MAX / 35)), // sweep latency
    clamp(Math.log(Math.max(i.victims, 1)) / Math.log(52)), // consolidation in-degree
    clamp((i.keptPct - 60) / (99.9 - 60)), // value preservation
    i.registered ? 0 : 1, // VASP compliance
    AGE_STOPS[i.ageIdx]?.s ?? 0, // wallet age
    0.6, // zero counter-flow (fixed in this what-if)
  ]
}

export function contributions(i: RiskInputs) {
  const s = strengths(i)
  return RISK.factors.map((f, k) => ({ ...f, s: s[k], c: f.w * s[k] }))
}

export function score(i: RiskInputs): number {
  return contributions(i).reduce((a, f) => a + f.c, 0)
}

export function fmtDuration(sec: number): string {
  if (sec < 90) return `${Math.round(sec)} s`
  if (sec < 3600) return `${Math.round(sec / 60)} min`
  const h = sec / 3600
  return `${h < 10 ? h.toFixed(1).replace(/\.0$/, '') : Math.round(h)} h`
}

/* ───────────── Rules vs ML (gated) ───────────── */
export const ML_BASE = 0.12
export const SHAP: { plain: string; tech: string; v: number }[] = [
  { plain: 'Speed of the sweep', tech: 'sweep_latency_s', v: 0.27 },
  { plain: 'Victims feeding one wallet', tech: 'hub_in_degree', v: 0.2 },
  { plain: 'Value kept per hop', tech: 'value_ratio_mean', v: 0.12 },
  { plain: 'Brand-new wallet', tech: 'wallet_age_h', v: 0.07 },
  { plain: 'Unregistered exchange', tech: 'vasp_fiu_flag', v: 0.05 },
]

/* ───────────── Innocence check ───────────── */
export const INNOCENCE_PRIOR = 0.5
export const INNOCENCE: { plain: string; tech: string; v: number }[] = [
  { plain: 'No history before the scam — wallet appeared 3 hours earlier', tech: 'first_seen − incident = −3 h', v: -0.12 },
  { plain: 'Funds left in 42 seconds — nothing was ever spent or held', tech: 'holding time p50 = 42 s', v: -0.13 },
  { plain: 'Never received salary-like or regular monthly inflows', tech: 'periodicity score 0.00', v: -0.1 },
  { plain: 'Every counterparty is already flagged in other complaints', tech: '38 / 38 senders reported', v: -0.07 },
  { plain: 'Never paid a merchant, bill or utility', tech: 'merchant-category hits 0', v: -0.02 },
  { plain: 'Did not use a mixer or privacy tool', tech: 'mixer exposure 0%', v: 0.04 },
  { plain: 'Not a known merchant or payment processor', tech: 'merchant registry · no match', v: 0 },
  { plain: 'Not on any sanctions list', tech: 'UN + national lists · no match', v: 0 },
]
export const INNOCENCE_SCORE = INNOCENCE_PRIOR + INNOCENCE.reduce((a, f) => a + f.v, 0)
