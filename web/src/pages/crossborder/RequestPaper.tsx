import * as React from 'react'
import { CASE, ROUTE_A, ROUTE_B, type Exchange } from '@/data/demo'
import { cn } from '@/lib/utils'
import { CHANNELS, type ChannelKey, type Juris } from './data'

/** Auto-filled field — soft gold highlight so the officer can check every value KAIZEN filled in. */
function F({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('rounded-[3px] bg-gold/25 px-[3px] py-px text-zinc-900 shadow-[inset_0_-1px_0_var(--k-gold)]', className)}>{children}</span>
}

const depA = ROUTE_A.trail[ROUTE_A.trail.length - 1]
const depB = ROUTE_B.trail[ROUTE_B.trail.length - 1]

const ADDRESSEE: Record<ChannelKey, (ex: Exchange, j: Juris) => { to: string[]; subject: string; ref: string }> = {
  domestic: (ex) => ({
    to: ['The Nodal Officer (Law-Enforcement Response)', ex.name, 'India nodal office, as per FIU-IND registration'],
    subject: 'Notice to produce records and hold funds under BNSS §94',
    ref: 'CPS-JPR/N94/0417',
  }),
  direct: (ex, j) => ({
    to: ['The Law-Enforcement Response Team', `Compliance Department, ${ex.name}`, j.country],
    subject: 'Request for preservation and voluntary disclosure of account records',
    ref: 'CPS-JPR/LER/0417',
  }),
  interpol: (_ex, j) => ({
    to: ['The Head, INTERPOL National Central Bureau', 'NCB-New Delhi (CBI)', `for onward transmission to NCB ${j.country}`],
    subject: 'Request for urgent police-to-police preservation of virtual-asset account records and balances',
    ref: 'CPS-JPR/NCB/0417',
  }),
  fiu: (_ex, j) => ({
    to: ['The Director', 'Financial Intelligence Unit – India (FIU-IND)', `for exchange with the FIU of ${j.country}`],
    subject: 'Request for financial intelligence on virtual-asset accounts',
    ref: 'CPS-JPR/FIU/0417',
  }),
  mlat: (_ex, j) => ({
    to: ['The Central Authority (Criminal Matters)', 'Ministry of Home Affairs, Government of India', `through the State Government · request to ${j.country}`],
    subject: 'Summary for a request for mutual legal assistance in a criminal matter',
    ref: 'CPS-JPR/MLA/0417',
  }),
}

const ASKS: Record<ChannelKey, string[]> = {
  domestic: [
    'Place a debit freeze on the account(s) linked to the addresses below and preserve the balance.',
    'Provide KYC records, linked bank accounts, login IPs and device identifiers.',
    'Preserve all related records for 180 days and do not alert the account holder.',
  ],
  direct: [
    'Preserve all records and place a voluntary hold on the account(s) linked to the addresses below.',
    'Share KYC records, linked bank accounts and the deposit and withdrawal history, if your policy permits.',
    'Do not alert the account holder; a formal request through official channels will follow.',
  ],
  interpol: [
    'Request the competent police authority to secure preservation of the account records and balances below.',
    'Confirm whether accounts linked to these addresses exist and remain active.',
    'Share any police intelligence on the account holder, pending a formal request for evidence.',
  ],
  fiu: [
    'Seek suspicious-transaction reports and account details held by the counterpart FIU for the addresses below.',
    'Identify beneficiary bank accounts receiving withdrawals from these accounts.',
    'Note: information is requested for intelligence only and will not be produced in court without consent.',
  ],
  mlat: [
    'Obtain certified copies of KYC, login and transaction records for the accounts below, admissible in an Indian court.',
    'Restrain the balances pending confiscation proceedings.',
    'Record statements of the exchange custodian of records, if required.',
  ],
}

export function RequestPaper({ channel, exchange, juris, preserve }: { channel: ChannelKey; exchange: Exchange; juris: Juris; preserve?: boolean }) {
  const a = ADDRESSEE[channel](exchange, juris)
  const c = CHANNELS[channel]
  return (
    <div className="relative overflow-hidden rounded-lg bg-stone-50 text-zinc-800 shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
      <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
        <span className="rotate-[-28deg] select-none text-[80px] font-bold tracking-[0.2em] text-zinc-900/[0.035] md:text-[110px]">DRAFT</span>
      </div>
      <div className="relative px-5 py-6 text-[13.5px] leading-relaxed md:px-8 md:py-7">
        <div className="mb-4 flex items-center gap-2 rounded-md bg-zinc-900/[0.04] px-2.5 py-1.5 text-[12px] text-zinc-600">
          <span className="size-2.5 shrink-0 rounded-sm bg-gold/40 ring-1 ring-gold/60" />
          Highlighted fields were auto-filled from case {CASE.id} — check each one before signing.
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-300 pb-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Office of the Station House Officer</div>
            <div className="text-[15.5px] font-semibold text-zinc-900">Cyber Police Station, Jaipur</div>
            <div className="text-[12px] text-zinc-500">Rajasthan Police · Cyber Crime Wing</div>
          </div>
          <div className="text-right text-[12.5px] text-zinc-600">
            <div>
              Ref: <F className="font-mono text-[12px]">{a.ref}</F>
            </div>
            <div className="mt-0.5">
              Date: <F>03 Oct 2026</F>
            </div>
            {preserve && <div className="mt-1 inline-block rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-50">Urgent · preservation</div>}
          </div>
        </div>

        <div className="mt-4">
          <div>To,</div>
          {a.to.map((l, i) => (
            <div key={l} className={i === 0 ? 'font-medium text-zinc-900' : undefined}>
              {i === 1 || (i === 2 && channel === 'direct') ? <F>{l}</F> : l}
            </div>
          ))}
        </div>

        <div className="mt-4 text-[14.5px]">
          <span className="font-semibold text-zinc-900">Subject: </span>
          {preserve ? 'Request for urgent preservation of records and balances' : a.subject}
          {channel === 'domestic' && <span className="ml-1 text-[12.5px] font-medium text-crimson">[section reference to be verified]</span>} — <F>{CASE.fir}</F>, NCRP <F className="font-mono text-[13.5px]">{CASE.ncrp}</F>.
        </div>

        <p className="mt-3">Sir / Madam,</p>
        <p className="mt-2">
          This office is investigating a complaint by <F>{CASE.complainant}</F> of <F>{CASE.location}</F>, who lost <F>{CASE.amountCrypto.toLocaleString('en-IN')} USDT (≈ ₹12.4 lakh)</F> in a <F>task-based job scam</F> on <F>{CASE.incidentAt}</F>. Blockchain analysis shows the funds reached deposit addresses attributed to <F>{exchange.name}</F> ({juris.country}):
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-zinc-900/[0.05] text-[12px] uppercase tracking-[0.06em] text-zinc-500">
                <th className="border border-zinc-300 px-2 py-1 font-medium">Chain</th>
                <th className="border border-zinc-300 px-2 py-1 font-medium">Deposit address</th>
                <th className="border border-zinc-300 px-2 py-1 text-right font-medium">Amount · time (IST)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { chain: 'TRON (USDT)', addr: depA.addr, amt: ROUTE_A.valueCrypto, at: depA.at },
                { chain: 'Ethereum (USDT)', addr: depB.addr, amt: depB.amt, at: depB.at },
              ].map((r) => (
                <tr key={r.addr}>
                  <td className="border border-zinc-300 px-2 py-1">{r.chain}</td>
                  <td className="border border-zinc-300 px-2 py-1">
                    <F className="break-all font-mono text-[12.5px]">{r.addr}</F>
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 text-right">
                    <F>{r.amt.toLocaleString('en-IN')} USDT</F> · {r.at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 font-medium text-zinc-900">{preserve ? 'Pending a formal request, you are requested to:' : 'You are requested to:'}</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          {(preserve
            ? [
                'Preserve all account, KYC, login and transaction records linked to the addresses above.',
                'Prevent withdrawal of the balances while the binding request is prepared.',
                'Confirm preservation in writing; do not alert the account holder.',
              ]
            : ASKS[channel]
          ).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
        {(juris.language && channel === 'mlat') || (juris.language && channel === 'interpol') ? (
          <p className="mt-2 text-[12.5px] text-zinc-500">
            A translation into <F>{juris.language}</F> will accompany this request (illustrative — verify with the central authority).
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-5 text-zinc-500">Yours faithfully,</div>
            <div className="font-medium text-zinc-900">
              (<F>{CASE.officer}</F>)
            </div>
            <div>Investigating Officer, Cyber PS Jaipur</div>
            <div className="text-[12.5px] text-zinc-500">
              Phone <F>+91 XXXXX X4821</F>
            </div>
          </div>
          <div className="min-w-[170px] text-right text-[13px] text-zinc-400">
            <div className="mb-1 border-b border-dashed border-zinc-400 pb-5" />
            Signatory: {c.signatory}
          </div>
        </div>
      </div>
    </div>
  )
}
