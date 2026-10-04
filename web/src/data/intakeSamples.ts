/**
 * Synthetic complaints for the Smart Intake demo — every person, handle, phone, UPI ID, wallet
 * and transaction ID here is fabricated. Wallet addresses are derived from hashed seed strings so
 * their checksums pass, but they were never used on any blockchain.
 */

export const SAMPLE_TX = '7f3a9c2e41b8d06f5e1a72c94d3b8e06a5f21c7d9e4b30a8f61c2d75e9a4b318'

/** Raw Hinglish complaint as typed on the 1930 helpline / NCRP portal (primary demo case KZN-2026-0417). */
export const SAMPLE_COMPLAINT =
  'Namaste sir, main Rekha Sharma, Jaipur se likh rahi hoon. 28 Aug ko Telegram pe ek "part-time task job" ka message aaya, ' +
  '@saffron_tasks_hr naam ke HR se. Bola YouTube videos like karo aur roz ₹3,000 kamao. Pehle registration fee ₹1,500 UPI pe maanga — ' +
  'tasks.pay••••@konark pe bhej diya. Uske baad "bada task" ke naam pe bola USDT mein paisa lagao, double milega. ' +
  'Maine total 14,850 USDT is wallet pe transfer kiya: TXk99ZPWKtvn7dYqDom1KHPjujmpXKraUm. ' +
  `Last payment 02 Sep 2026, shaam 7:42 pm ko gaya. Transaction hash: ${SAMPLE_TX}. ` +
  'Total mera ₹12.4 lakh chala gaya, sab savings thi. Ab unhone group se nikaal diya aur unka number +91 98XXXX4821 band aa raha hai. Kripya madad karein.'

export type NcrpRow = { ack: string; who: string; city: string; at: string; cat: string; amt: number; text: string; caseId?: string }

/** Read-only NCRP queue (Rajasthan, crypto-related). Only the first row is the scripted demo case. */
export const NCRP_QUEUE: NcrpRow[] = [
  {
    ack: '31402260041789',
    who: 'Rekha Sharma',
    city: 'Jaipur',
    at: '04 Sep · 11:05',
    cat: 'Online financial fraud › Crypto',
    amt: 1240000,
    text: SAMPLE_COMPLAINT,
  },
  {
    ack: '31402260041802',
    who: 'Vikram Solanki',
    city: 'Surat',
    at: '04 Sep · 12:40',
    cat: 'Online financial fraud › Crypto',
    amt: 230000,
    text:
      'My name is Vikram Solanki from Surat. An Instagram page @apex_yield_club promised 4% daily returns on an investment app. ' +
      'On 01/09/2026 21:15 I sent 1.1 ETH to 0xfd6ba6bff09eb7d3a23d430b43b331fb422cc257 and the app showed fake profits. ' +
      'Withdrawal is blocked and they ask a 20% tax first. Total loss Rs 2,30,000. ' +
      'Tx: 0xe8a98e5835218db4a82c334f753febb17250ecf2bf67871cf8135de6bc865590',
  },
  {
    ack: '31402260041795',
    who: 'Neha Kapoor',
    city: 'Gurugram',
    at: '04 Sep · 12:02',
    cat: 'Online financial fraud › UPI + crypto',
    amt: 68000,
    text:
      'Main Neha Kapoor, Gurugram. Ek caller ne khud ko CBI officer bataya aur bola mere naam pe parcel mein drugs mile hain, digital arrest hoga. ' +
      'Darr ke maare maine 03 Sep 2026 dopahar 2:10 pm ko 0.0125 BTC 1KH4jh4FMkBnFgLfmjwMMM5E5ttUJujocE pe bheja. ' +
      `Kul ₹68,000 gaye. Unka number +91 70XXXX1180 tha. Hash ${'737000f43982da1187c256d8d754160ceac8d796e511755981032c6ba02d5fa0'}`,
  },
  {
    ack: '31402260041771',
    who: 'Arun Menon',
    city: 'Kochi',
    at: '04 Sep · 09:18',
    cat: 'Online financial fraud › Crypto',
    amt: 860000,
    text: '',
    caseId: 'KZN-2026-0416',
  },
]
