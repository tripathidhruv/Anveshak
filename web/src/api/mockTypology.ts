/**
 * Mock of backend/app/typology: the same classes, indicators and weights, scored from the demo
 * case's synthetic signals. Kept separate from mock.ts because it is a small model, not canned JSON.
 */
import type { TypologyBand, TypologyOut } from './types'

type Def = { id: string; name: string; indicators: [id: string, plain: string, tech: string, weight: number][] }

const DEFS: Def[] = [
  {
    id: 'scam',
    name: 'Fraud / scam',
    indicators: [
      ['sweep_signature', 'Money left within seconds with ~99% kept', 'hold < 60 s, kept ≥ 99%', 0.3],
      ['consolidation', "Many victims' money pooled in one wallet", 'fan-in ≥ 5 senders', 0.25],
      ['fresh_wallet', 'Receiving wallet created hours before the scam', 'first activity < 24 h', 0.15],
      ['victim_complaints', 'Linked victim complaints', 'national memory matches', 0.2],
      ['fast_cashout', 'Reached an exchange within the hour', 'first hop → exchange < 60 min', 0.1],
    ],
  },
  {
    id: 'ransomware',
    name: 'Ransomware',
    indicators: [
      ['round_usd_inbound', 'Many one-off payments in round dollar amounts', 'USD-round inbound ratio', 0.3],
      ['new_payer_wallets', 'Payers are brand-new wallets', 'payer age < 7 days', 0.15],
      ['btc_payments', 'Paid in Bitcoin', 'chain = bitcoin', 0.15],
      ['ransomware_list_match', 'Address on a public ransomware list', 'OFAC CYBER2 / ransomware feeds', 0.4],
    ],
  },
  {
    id: 'darknet',
    name: 'Darknet market activity',
    indicators: [
      ['market_exposure', 'Deposits into known darknet-market wallets', 'label exposure', 0.45],
      ['escrow_pattern', 'Hold-and-release escrow timing', 'hold 1–14 days, then release', 0.2],
      ['mixer_exposure', 'Funds pass through a mixer', 'mixer share of value', 0.2],
      ['many_small_purchases', 'Many small purchase-sized payments', 'median payment < $200', 0.15],
    ],
  },
  {
    id: 'terror_financing',
    name: 'Terror-financing indicators',
    indicators: [
      ['sanctions_proximity', 'Within 3 hops of a UN/OFAC terror-listed wallet', 'risk diffusion, decay per hop', 0.45],
      ['donation_pattern', 'Many small donor-style payments', 'many senders, small equal sums', 0.25],
      ['osint_mention', 'Named in public reports', 'OSINT credibility ≥ 0.7', 0.2],
      ['cross_border_stablecoin', 'Stablecoin moved across borders', 'USDT to a foreign VASP', 0.1],
    ],
  },
  {
    id: 'laundering',
    name: 'Layering / other suspicious patterns',
    indicators: [
      ['bridge_hop', 'Hopped to another blockchain', 'bridge in → bridge out', 0.25],
      ['mixer_entry', 'Entered a mixer', 'known mixer contract', 0.25],
      ['peel_chain', 'Peel chain (small amounts shaved off each hop)', '≥ 3 hops losing 1–10%', 0.2],
      ['structuring', 'Amounts kept just under reporting thresholds', 'clustered below limits', 0.15],
      ['round_trip', 'Money sent out and back (wash)', 'A → … → A within 72 h', 0.15],
    ],
  },
]

/** Signals measured on the demo case ANV-2026-0417 (synthetic). */
const DEMO_SIGNALS: Record<string, number> = {
  sweep_signature: 1,
  consolidation: 1,
  fresh_wallet: 0.9,
  victim_complaints: 1,
  fast_cashout: 0.8,
  round_usd_inbound: 0.2,
  new_payer_wallets: 0.4,
  mixer_exposure: 0.4,
  many_small_purchases: 0.1,
  donation_pattern: 0.1,
  cross_border_stablecoin: 0.7,
  bridge_hop: 1,
  mixer_entry: 1,
  peel_chain: 0.6,
  structuring: 0.2,
}

const band = (s: number): TypologyBand => (s >= 0.7 ? 'strong' : s >= 0.4 ? 'present' : 'not_indicated')
const r3 = (n: number) => Math.round(n * 1000) / 1000

export function scoreTypology(signals: Record<string, number> = DEMO_SIGNALS): TypologyOut {
  const classes = DEFS.map((d) => {
    const indicators = d.indicators.map(([id, plain, tech, weight]) => {
      const value = signals[id] ?? 0
      return { id, plain, tech, weight, value, contribution: r3(weight * value) }
    })
    const score = r3(Math.min(1, indicators.reduce((a, i) => a + i.contribution, 0)))
    return { id: d.id, name: d.name, score, band: band(score), indicators }
  }).sort((a, b) => b.score - a.score)
  return {
    primary: classes[0].id,
    classes,
    disclaimer:
      'Typology is an investigative indication from on-chain behaviour, not a finding that an offence occurred. Terror-financing is shown only as indicators and needs specialist review before any action.',
    signalsUsed: Object.values(signals).filter((v) => v > 0).length,
  }
}
