/**
 * Syndicate graph — page-local synthetic data. Every case, wallet and person here is fabricated.
 * Exchange ids refer to the fictional exchanges in data/demo.
 */
import type { Tone } from '@/components/kit'

export type EvidenceKey = 'hub' | 'deposit' | 'telegram' | 'timing' | 'bridge'

export const EVIDENCE: { key: EvidenceKey; plain: string; tech: string; w: number; tone: Tone }[] = [
  { key: 'hub', plain: 'Same collection wallet', tech: 'shared consolidation hub · in-degree overlap', w: 0.6, tone: 'crimson' },
  { key: 'deposit', plain: 'Same exchange deposit address', tech: 'deposit-address co-use', w: 0.5, tone: 'gold' },
  { key: 'timing', plain: 'Same sweep timing fingerprint', tech: 'sweep latency 38–47 s · value kept > 99%', w: 0.35, tone: 'ember' },
  { key: 'telegram', plain: 'Same Telegram handle pattern', tech: 'complaint text · @saffron_* handles', w: 0.3, tone: 'sky' },
  { key: 'bridge', plain: 'Same bridge route', tech: 'TRON → Ethereum via one bridge contract', w: 0.2, tone: 'violet' },
]

/** a case counts as linked when its combined link score clears this bar */
export const LINK_THRESHOLD = 0.5

export type SynCase = {
  id: string
  who: string
  city: string
  state: string
  amt: number
  filed: string
  type: string
  wallet: string
  via: EvidenceKey[]
}

export type SynWallet = { id: string; addr: string; label: string; hub: string }
export type SynHub = { id: string; addr: string; label: string; victims: number; valueINR: number; firstSeen: string; exchanges: { ex: string; weight: number; deposits: number }[] }

export type SynGraph = {
  cases: SynCase[]
  wallets: SynWallet[]
  hubs: SynHub[]
  /** per-evidence count of cases (out of the syndicate total) */
  evidenceCounts: Partial<Record<EvidenceKey, number>>
  timeline: { labels: string[]; total: number[]; auto: number[] }
  feed: { id: string; who: string; city: string; via: EvidenceKey; score: number }[]
}

export const GRAPHS: Record<string, SynGraph> = {
  'SYN-07': {
    cases: [
      { id: 'ANV-2026-0417', who: 'Rekha Sharma', city: 'Jaipur', state: 'RJ', amt: 1240000, filed: '04 Sep', type: 'Task-based job scam', wallet: 'w1', via: ['hub', 'deposit', 'timing', 'telegram'] },
      { id: 'ANV-2026-0391', who: 'Neha Bhatt', city: 'Dehradun', state: 'UK', amt: 284000, filed: '22 Aug', type: 'Task-based job scam', wallet: 'w1', via: ['hub'] },
      { id: 'ANV-2026-0416', who: 'Arun Menon', city: 'Kochi', state: 'KL', amt: 860000, filed: '04 Sep', type: 'Investment app scam', wallet: 'w2', via: ['hub', 'timing', 'deposit'] },
      { id: 'ANV-2026-0412', who: 'Harpreet Gill', city: 'Ludhiana', state: 'PB', amt: 655000, filed: '02 Sep', type: 'Investment app scam', wallet: 'w2', via: ['hub', 'deposit'] },
      { id: 'ANV-2026-0406', who: 'Sunita Yadav', city: 'Patna', state: 'BR', amt: 760000, filed: '30 Aug', type: 'Task-based job scam', wallet: 'w3', via: ['deposit', 'telegram'] },
      { id: 'ANV-2026-0398', who: 'Vikram Patil', city: 'Nagpur', state: 'MH', amt: 342000, filed: '27 Aug', type: 'Task-based job scam', wallet: 'w3', via: ['telegram', 'timing'] },
      { id: 'ANV-2026-0408', who: 'Deepa Rao', city: 'Hyderabad', state: 'TG', amt: 1120000, filed: '31 Aug', type: 'Task-based job scam', wallet: 'w4', via: ['hub', 'timing'] },
      { id: 'ANV-2026-0415', who: 'Fatima Qureshi', city: 'Lucknow', state: 'UP', amt: 2150000, filed: '03 Sep', type: 'Pig-butchering (romance)', wallet: 'w5', via: ['bridge', 'timing', 'telegram'] },
    ],
    wallets: [
      { id: 'w1', addr: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', label: 'Scam wallet A', hub: 'h1' },
      { id: 'w2', addr: 'TLq6dV1rB8nC4yH7mK2sF', label: 'Scam wallet B', hub: 'h1' },
      { id: 'w3', addr: 'TFw3kN7pX5gD9sL1vR6bM', label: 'Scam wallet C', hub: 'h1' },
      { id: 'w4', addr: 'TRj8sH2mQ4cV6nB9xP3dK', label: 'Scam wallet D', hub: 'h1' },
      { id: 'w5', addr: '0x5d2e9b14c7a8f03e61', label: 'Scam wallet E · ETH', hub: 'h2' },
    ],
    hubs: [
      {
        id: 'h1',
        addr: 'TNh8yW5vC2mQ7fL4xK9pR',
        label: 'Collection wallet',
        victims: 38,
        valueINR: 41290000,
        firstSeen: '11 Aug 2026',
        exchanges: [
          { ex: 'meridian', weight: 0.9, deposits: 27 },
          { ex: 'kestrel', weight: 0.35, deposits: 6 },
        ],
      },
      {
        id: 'h2',
        addr: '0x8b17c4e92fa05d3b76',
        label: 'Collection wallet · ETH',
        victims: 9,
        valueINR: 5710000,
        firstSeen: '19 Aug 2026',
        exchanges: [{ ex: 'northwind', weight: 0.55, deposits: 8 }],
      },
    ],
    evidenceCounts: { hub: 31, deposit: 27, timing: 34, telegram: 19, bridge: 8 },
    timeline: {
      labels: ['11 Aug', '15', '19', '23', '27', '31', '4 Sep', '8', '12', '16', '20', '24', '28', '2 Oct'],
      total: [1, 2, 4, 7, 9, 13, 16, 20, 23, 27, 30, 33, 36, 38],
      auto: [0, 0, 1, 3, 5, 8, 11, 15, 18, 22, 25, 28, 31, 33],
    },
    feed: [
      { id: 'NCRP 31402260047731', who: 'Kunal Saxena', city: 'Gurugram', via: 'hub', score: 0.91 },
      { id: 'NCRP 31402260047702', who: 'Lakshmi Iyer', city: 'Mysuru', via: 'deposit', score: 0.84 },
      { id: 'NCRP 31402260047688', who: 'Rafiq Ansari', city: 'Howrah', via: 'timing', score: 0.71 },
      { id: 'NCRP 31402260047653', who: 'Pooja Chauhan', city: 'Surat', via: 'telegram', score: 0.66 },
      { id: 'NCRP 31402260047611', who: 'Manoj Tiwari', city: 'Kota', via: 'hub', score: 0.89 },
      { id: 'NCRP 31402260047598', who: 'Ayesha Khan', city: 'Bhopal', via: 'deposit', score: 0.8 },
    ],
  },
  'SYN-03': {
    cases: [
      { id: 'ANV-2026-0413', who: 'Priya Nair', city: 'Bengaluru', state: 'KA', amt: 1780000, filed: '02 Sep', type: 'Task-based job scam', wallet: 'w1', via: ['hub', 'deposit'] },
      { id: 'ANV-2026-0410', who: 'Meera Joshi', city: 'Pune', state: 'MH', amt: 2890000, filed: '01 Sep', type: 'Pig-butchering (romance)', wallet: 'w1', via: ['hub', 'timing', 'telegram'] },
      { id: 'ANV-2026-0388', who: 'Sandeep Kulkarni', city: 'Mumbai', state: 'MH', amt: 4120000, filed: '20 Aug', type: 'Pig-butchering (romance)', wallet: 'w2', via: ['hub', 'deposit', 'timing'] },
      { id: 'ANV-2026-0372', who: 'Ritu Malhotra', city: 'Delhi', state: 'DL', amt: 1560000, filed: '11 Aug', type: 'Pig-butchering (romance)', wallet: 'w2', via: ['telegram', 'timing'] },
      { id: 'ANV-2026-0365', who: 'George Thomas', city: 'Thrissur', state: 'KL', amt: 980000, filed: '06 Aug', type: 'Investment app scam', wallet: 'w3', via: ['deposit', 'bridge'] },
      { id: 'ANV-2026-0351', who: 'Anjali Desai', city: 'Vadodara', state: 'GJ', amt: 2210000, filed: '28 Jul', type: 'Pig-butchering (romance)', wallet: 'w3', via: ['hub'] },
    ],
    wallets: [
      { id: 'w1', addr: 'TCs4nM8kP2wR6dX9vB3hL', label: 'Scam wallet A', hub: 'h1' },
      { id: 'w2', addr: 'TJe7qH1mV5rN3sK8cW2pD', label: 'Scam wallet B', hub: 'h1' },
      { id: 'w3', addr: 'TYu2bF6xL9nD4mQ7tR1sG', label: 'Scam wallet C', hub: 'h1' },
    ],
    hubs: [
      {
        id: 'h1',
        addr: 'TRw2pD9kH5sM3nV8cF1qL',
        label: 'Collection wallet',
        victims: 17,
        valueINR: 31200000,
        firstSeen: '02 Jul 2026',
        exchanges: [
          { ex: 'orbita', weight: 0.8, deposits: 12 },
          { ex: 'halcyon', weight: 0.4, deposits: 5 },
        ],
      },
    ],
    evidenceCounts: { hub: 14, deposit: 11, timing: 12, telegram: 7, bridge: 3 },
    timeline: {
      labels: ['2 Jul', '9', '16', '23', '30', '6 Aug', '13', '20', '27', '3 Sep', '10', '17', '24', '1 Oct'],
      total: [1, 2, 2, 4, 5, 6, 8, 9, 11, 13, 14, 15, 16, 17],
      auto: [0, 0, 0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13],
    },
    feed: [
      { id: 'NCRP 31402260047720', who: 'Shalini Menon', city: 'Kozhikode', via: 'hub', score: 0.86 },
      { id: 'NCRP 31402260047671', who: 'Varun Kapoor', city: 'Chandigarh', via: 'telegram', score: 0.63 },
      { id: 'NCRP 31402260047640', who: 'Nisha Pillai', city: 'Navi Mumbai', via: 'deposit', score: 0.78 },
    ],
  },
  'SYN-11': {
    cases: [
      { id: 'ANV-2026-0407', who: 'Rohit Das', city: 'Kolkata', state: 'WB', amt: 540000, filed: '31 Aug', type: 'Loan app extortion', wallet: 'w1', via: ['hub', 'deposit'] },
      { id: 'ANV-2026-0394', who: 'Sabina Begum', city: 'Guwahati', state: 'AS', amt: 210000, filed: '24 Aug', type: 'Loan app extortion', wallet: 'w1', via: ['hub', 'telegram'] },
      { id: 'ANV-2026-0386', who: 'Abhishek Ranjan', city: 'Ranchi', state: 'JH', amt: 165000, filed: '23 Aug', type: 'Loan app extortion', wallet: 'w2', via: ['deposit', 'timing'] },
      { id: 'ANV-2026-0383', who: 'Tanmay Pradhan', city: 'Bhubaneswar', state: 'OD', amt: 320000, filed: '21 Aug', type: 'Loan app extortion', wallet: 'w2', via: ['hub'] },
    ],
    wallets: [
      { id: 'w1', addr: '0x2a9f3c71d8e04b5a6c', label: 'Scam wallet A · ETH', hub: 'h1' },
      { id: 'w2', addr: '0x7c14e8b2f09a3d6e51', label: 'Scam wallet B · ETH', hub: 'h1' },
    ],
    hubs: [
      {
        id: 'h1',
        addr: '0x4f1c92ad07be33e5a8',
        label: 'Collection wallet · ETH',
        victims: 9,
        valueINR: 6400000,
        firstSeen: '21 Aug 2026',
        exchanges: [{ ex: 'arcadia', weight: 0.7, deposits: 9 }],
      },
    ],
    evidenceCounts: { hub: 7, deposit: 6, timing: 4, telegram: 3, bridge: 0 },
    timeline: {
      labels: ['21 Aug', '24', '27', '30', '2 Sep', '5', '8', '11', '14', '17', '20', '23', '26', '29'],
      total: [1, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8, 8, 9, 9],
      auto: [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7],
    },
    feed: [{ id: 'NCRP 31402260047705', who: 'Prakash Mahato', city: 'Dhanbad', via: 'deposit', score: 0.74 }],
  },
  'SYN-02': {
    cases: [
      { id: 'ANV-2026-0379', who: 'Col. (retd) R. Bhatia', city: 'Chandigarh', state: 'CH', amt: 3400000, filed: '18 Aug', type: 'Digital arrest', wallet: 'w1', via: ['hub', 'timing'] },
      { id: 'ANV-2026-0362', who: 'Usha Krishnan', city: 'Coimbatore', state: 'TN', amt: 2750000, filed: '04 Aug', type: 'Digital arrest', wallet: 'w1', via: ['hub', 'deposit'] },
      { id: 'ANV-2026-0340', who: 'Dinesh Agarwal', city: 'Jodhpur', state: 'RJ', amt: 1900000, filed: '20 Jul', type: 'Digital arrest', wallet: 'w2', via: ['deposit', 'telegram'] },
    ],
    wallets: [
      { id: 'w1', addr: 'TPr5vK2nH8dM4wS1cX7qB', label: 'Scam wallet A', hub: 'h1' },
      { id: 'w2', addr: 'TWa9mF3bL6xR2nD8sV4kJ', label: 'Scam wallet B', hub: 'h1' },
    ],
    hubs: [
      {
        id: 'h1',
        addr: 'TGm6vB2nQ8xK4hR7pL3wD',
        label: 'Collection wallet',
        victims: 6,
        valueINR: 9800000,
        firstSeen: '14 Jun 2026',
        exchanges: [{ ex: 'northwind', weight: 0.6, deposits: 5 }],
      },
    ],
    evidenceCounts: { hub: 4, deposit: 4, timing: 3, telegram: 2, bridge: 0 },
    timeline: {
      labels: ['14 Jun', '21', '28', '5 Jul', '12', '19', '26', '2 Aug', '9', '16', '23', '30', '6 Sep', '13'],
      total: [1, 1, 2, 2, 2, 3, 3, 4, 5, 5, 6, 6, 6, 6],
      auto: [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 4],
    },
    feed: [],
  },
}

/** combined probability that a case belongs, from the evidence types still switched on (noisy-OR) */
export function linkScore(keys: EvidenceKey[], on: Record<EvidenceKey, boolean>): number {
  let miss = 1
  EVIDENCE.forEach((e) => {
    if (on[e.key] && keys.includes(e.key)) miss *= 1 - e.w
  })
  return 1 - miss
}
