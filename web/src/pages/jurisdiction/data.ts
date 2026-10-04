/**
 * FIR dedup & routing — page-local synthetic data. All FIRs, people, handles and UPI ids are fabricated
 * (banks in UPI handles are fictional; numbers are masked).
 */

/** tile cartogram of India: r = row, c = column (roughly geographic) */
export const TILES: { code: string; name: string; r: number; c: number }[] = [
  { code: 'JK', name: 'Jammu & Kashmir', r: 0, c: 2 },
  { code: 'LA', name: 'Ladakh', r: 0, c: 3 },
  { code: 'PB', name: 'Punjab', r: 1, c: 1 },
  { code: 'HP', name: 'Himachal Pradesh', r: 1, c: 2 },
  { code: 'UK', name: 'Uttarakhand', r: 1, c: 3 },
  { code: 'AR', name: 'Arunachal Pradesh', r: 1, c: 7 },
  { code: 'RJ', name: 'Rajasthan', r: 2, c: 0 },
  { code: 'HR', name: 'Haryana', r: 2, c: 1 },
  { code: 'DL', name: 'Delhi', r: 2, c: 2 },
  { code: 'UP', name: 'Uttar Pradesh', r: 2, c: 3 },
  { code: 'BR', name: 'Bihar', r: 2, c: 4 },
  { code: 'SK', name: 'Sikkim', r: 2, c: 5 },
  { code: 'AS', name: 'Assam', r: 2, c: 6 },
  { code: 'NL', name: 'Nagaland', r: 2, c: 7 },
  { code: 'GJ', name: 'Gujarat', r: 3, c: 0 },
  { code: 'MP', name: 'Madhya Pradesh', r: 3, c: 1 },
  { code: 'CG', name: 'Chhattisgarh', r: 3, c: 2 },
  { code: 'JH', name: 'Jharkhand', r: 3, c: 3 },
  { code: 'WB', name: 'West Bengal', r: 3, c: 4 },
  { code: 'ML', name: 'Meghalaya', r: 3, c: 6 },
  { code: 'MN', name: 'Manipur', r: 3, c: 7 },
  { code: 'MH', name: 'Maharashtra', r: 4, c: 1 },
  { code: 'TG', name: 'Telangana', r: 4, c: 2 },
  { code: 'OD', name: 'Odisha', r: 4, c: 3 },
  { code: 'TR', name: 'Tripura', r: 4, c: 6 },
  { code: 'MZ', name: 'Mizoram', r: 4, c: 7 },
  { code: 'GA', name: 'Goa', r: 5, c: 1 },
  { code: 'KA', name: 'Karnataka', r: 5, c: 2 },
  { code: 'AP', name: 'Andhra Pradesh', r: 5, c: 3 },
  { code: 'KL', name: 'Kerala', r: 6, c: 2 },
  { code: 'TN', name: 'Tamil Nadu', r: 6, c: 3 },
]

/** SYN-07 complaints per state — 38 across 11 states */
export const COMPLAINTS: Record<string, number> = { RJ: 9, KL: 5, PB: 4, BR: 4, UP: 4, TG: 3, MH: 3, KA: 2, GJ: 2, HR: 1, WB: 1 }

export type Fir = {
  id: string
  no: string
  ps: string
  state: string
  victim: string
  date: string
  amt: number
  type: string
  cluster: boolean
  ids: { wallet: string; hub: string; telegram: string; upi: string; deposit: string; phone: string }
}

const HUB = 'TNh8yW5vC2mQ7fL4xK9pR'
const MER = 'TBx1eM9nT7hG3sV5cW2kL'

export const FIRS: Fir[] = [
  {
    id: 'rj1', no: 'FIR 0312/2026', ps: 'Cyber PS Jaipur', state: 'RJ', victim: 'Rekha Sharma', date: '04 Sep', amt: 1240000, type: 'Task-based job scam', cluster: true,
    ids: { wallet: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', hub: HUB, telegram: '@saffron_hr_desk', upi: 'taskpay.07XXXX@sahyadri', deposit: MER, phone: '+91 XXXXX X4821' },
  },
  {
    id: 'kl1', no: 'FIR 1187/2026', ps: 'Cyber PS Kochi City', state: 'KL', victim: 'Arun Menon', date: '04 Sep', amt: 860000, type: 'Investment app scam', cluster: true,
    ids: { wallet: 'TLq6dV1rB8nC4yH7mK2sF', hub: HUB, telegram: '@saffron_hr_desk', upi: 'earnhubXXXX@vindhya', deposit: MER, phone: '+91 XXXXX X4821' },
  },
  {
    id: 'pb1', no: 'FIR 0456/2026', ps: 'Cyber PS Ludhiana', state: 'PB', victim: 'Harpreet Gill', date: '02 Sep', amt: 655000, type: 'Investment app scam', cluster: true,
    ids: { wallet: 'TLq6dV1rB8nC4yH7mK2sF', hub: HUB, telegram: '@saffron_tasks_07', upi: 'earnhubXXXX@vindhya', deposit: MER, phone: '+91 XXXXX X7310' },
  },
  {
    id: 'br1', no: 'FIR 0733/2026', ps: 'Cyber PS Patna', state: 'BR', victim: 'Sunita Yadav', date: '30 Aug', amt: 760000, type: 'Task-based job scam', cluster: true,
    ids: { wallet: 'TFw3kN7pX5gD9sL1vR6bM', hub: HUB, telegram: '@saffron_hr_desk', upi: 'taskpay.07XXXX@sahyadri', deposit: MER, phone: '+91 XXXXX X7310' },
  },
  {
    id: 'tg1', no: 'FIR 2041/2026', ps: 'Cyber Crime PS Hyderabad', state: 'TG', victim: 'Deepa Rao', date: '31 Aug', amt: 1120000, type: 'Task-based job scam', cluster: true,
    ids: { wallet: 'TRj8sH2mQ4cV6nB9xP3dK', hub: HUB, telegram: '@saffron_tasks_07', upi: 'quickgigXXXX@konark', deposit: 'TMk2rV7nD4sH9wB1cQ5pX', phone: '+91 XXXXX X4821' },
  },
  {
    id: 'rj0', no: 'FIR 0241/2026', ps: 'Cyber PS Jaipur', state: 'RJ', victim: 'Mohan Lal Saini', date: '12 Aug', amt: 515000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', hub: HUB, telegram: '@saffron_hr_desk', upi: 'taskpay.07XXXX@sahyadri', deposit: MER, phone: '+91 XXXXX X4821' },
  },
  {
    id: 'rj2', no: 'FIR 0298/2026', ps: 'Cyber PS Kota', state: 'RJ', victim: 'Manoj Tiwari', date: '29 Aug', amt: 390000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', hub: HUB, telegram: '@saffron_hr_desk', upi: 'taskpay.07XXXX@sahyadri', deposit: MER, phone: '+91 XXXXX X4821' },
  },
  {
    id: 'up1', no: 'FIR 0919/2026', ps: 'Cyber PS Lucknow', state: 'UP', victim: 'Fatima Qureshi', date: '03 Sep', amt: 2150000, type: 'Pig-butchering (romance)', cluster: false,
    ids: { wallet: '0x5d2e9b14c7a8f03e61', hub: '0x8b17c4e92fa05d3b76', telegram: '@saffron_tasks_07', upi: '—', deposit: '0x5e09b4d2c871af3e60', phone: '+91 XXXXX X9902' },
  },
  {
    id: 'mh1', no: 'FIR 1402/2026', ps: 'Cyber PS Nagpur', state: 'MH', victim: 'Vikram Patil', date: '27 Aug', amt: 342000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TFw3kN7pX5gD9sL1vR6bM', hub: HUB, telegram: '@saffron_hr_desk', upi: 'quickgigXXXX@konark', deposit: MER, phone: '+91 XXXXX X7310' },
  },
  {
    id: 'ka1', no: 'FIR 0677/2026', ps: 'CEN PS Mysuru', state: 'KA', victim: 'Lakshmi Iyer', date: '01 Sep', amt: 268000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TLq6dV1rB8nC4yH7mK2sF', hub: HUB, telegram: '@saffron_tasks_07', upi: 'earnhubXXXX@vindhya', deposit: MER, phone: '+91 XXXXX X7310' },
  },
  {
    id: 'gj1', no: 'FIR 0533/2026', ps: 'Cyber PS Surat', state: 'GJ', victim: 'Pooja Chauhan', date: '28 Aug', amt: 214000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TFw3kN7pX5gD9sL1vR6bM', hub: HUB, telegram: '@saffron_hr_desk', upi: 'taskpay.07XXXX@sahyadri', deposit: MER, phone: '+91 XXXXX X4821' },
  },
  {
    id: 'hr1', no: 'FIR 0388/2026', ps: 'Cyber PS Gurugram', state: 'HR', victim: 'Kunal Saxena', date: '02 Oct', amt: 455000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm', hub: HUB, telegram: '@saffron_hr_desk', upi: 'taskpay.07XXXX@sahyadri', deposit: MER, phone: '+91 XXXXX X4821' },
  },
  {
    id: 'wb1', no: 'FIR 0761/2026', ps: 'Cyber PS Howrah', state: 'WB', victim: 'Rafiq Ansari', date: '01 Oct', amt: 187000, type: 'Task-based job scam', cluster: false,
    ids: { wallet: 'TRj8sH2mQ4cV6nB9xP3dK', hub: HUB, telegram: '@saffron_tasks_07', upi: 'quickgigXXXX@konark', deposit: 'TMk2rV7nD4sH9wB1cQ5pX', phone: '+91 XXXXX X9902' },
  },
]

export type IdKey = keyof Fir['ids'] | 'type'

export const ID_FIELDS: { key: IdKey; plain: string; tech: string; w: number; mono: boolean }[] = [
  { key: 'hub', plain: 'Collection wallet', tech: 'consolidation hub address', w: 0.28, mono: true },
  { key: 'wallet', plain: 'Scam wallet', tech: 'first-hop receiving address', w: 0.22, mono: true },
  { key: 'deposit', plain: 'Exchange deposit address', tech: 'VASP deposit address', w: 0.16, mono: true },
  { key: 'telegram', plain: 'Telegram handle', tech: 'from complaint text (NER)', w: 0.14, mono: true },
  { key: 'upi', plain: 'UPI id for "registration fee"', tech: 'fiat on-ramp identifier', w: 0.1, mono: true },
  { key: 'phone', plain: 'Scammer phone number', tech: 'masked · from complaint', w: 0.06, mono: true },
  { key: 'type', plain: 'How the scam worked', tech: 'modus operandi class', w: 0.04, mono: false },
]

export function firValue(f: Fir, k: IdKey): string {
  return k === 'type' ? f.type : f.ids[k]
}

export function similarity(a: Fir, b: Fir): number {
  return ID_FIELDS.reduce((s, f) => s + (firValue(a, f.key) === firValue(b, f.key) && firValue(a, f.key) !== '—' ? f.w : 0), 0)
}

export const ROUTING_STEPS = [
  { t: 'Merge 5 FIRs into one case file', d: 'ANV-SYN07-M01 · evidence de-duplicated' },
  { t: 'Route to I4C nodal officer', d: 'Indian Cyber Crime Coordination Centre · inter-state desk' },
  { t: 'One consolidated notice to Meridian', d: 'covers 27 deposits · draft for officer review' },
  { t: 'Share results back to 10 states', d: 'each cell gets the reply + its victims’ share' },
]
