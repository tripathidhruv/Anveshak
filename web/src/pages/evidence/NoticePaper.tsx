import * as React from 'react'
import { CASE, EXCHANGE, ROUTE_A, ROUTE_B } from '@/data/demo'
import { short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ARTEFACTS, NOTICES, ROOT, TX, type NoticeKey } from './data'

/** Auto-filled field — highlighted in soft gold so the officer sees what ANVESHAK filled in. */
function F({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('rounded-[3px] bg-gold/25 px-[3px] py-px text-zinc-900 shadow-[inset_0_-1px_0_var(--k-gold)]', className)}>{children}</span>
}

const depA = ROUTE_A.trail[ROUTE_A.trail.length - 1]
const depB = ROUTE_B.trail[ROUTE_B.trail.length - 1]

export function NoticePaper({ kind, step }: { kind: NoticeKey; step: number }) {
  const n = NOTICES.find((x) => x.key === kind)!
  const approved = step >= 2
  const sent = step >= 3

  return (
    <div className="relative overflow-hidden rounded-lg bg-stone-50 text-zinc-800 shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
      {/* watermark */}
      {!approved && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
          <span className="rotate-[-28deg] select-none text-[88px] font-bold tracking-[0.2em] text-zinc-900/[0.035] md:text-[120px]">DRAFT</span>
        </div>
      )}

      <div className="relative px-5 py-6 text-[13.5px] leading-relaxed md:px-9 md:py-8">
        {/* auto-fill legend */}
        <div className="mb-4 flex items-center gap-2 rounded-md bg-zinc-900/[0.04] px-2.5 py-1.5 text-[12px] text-zinc-600">
          <span className="size-2.5 rounded-sm bg-gold/40 ring-1 ring-gold/60" />
          Highlighted fields were auto-filled from case {CASE.id} — check each one before signing.
        </div>

        {/* letterhead */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-300 pb-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Office of the Station House Officer</div>
            <div className="text-[15.5px] font-semibold text-zinc-900">Cyber Police Station, Jaipur</div>
            <div className="text-[12px] text-zinc-500">Rajasthan Police · Cyber Crime Wing</div>
          </div>
          <div className="text-right text-[12.5px] text-zinc-600">
            <div>
              Ref: <F className="font-mono text-[12px]">{n.ref}</F>
            </div>
            <div className="mt-0.5">
              Date: <F>04 Sep 2026</F>
            </div>
          </div>
        </div>

        {/* addressee */}
        <div className="mt-4 text-[13.5px]">
          <div>To,</div>
          <div className="font-medium text-zinc-900">The Nodal Officer (Law-Enforcement Response)</div>
          <div>Compliance Department</div>
          <div>
            <F>{EXCHANGE.name}</F>
          </div>
          <div>
            Registered in <F>{EXCHANGE.jurisdiction}</F>
          </div>
        </div>

        {/* subject */}
        <div className="mt-4 text-[13.5px]">
          <span className="font-semibold text-zinc-900">Subject: </span>
          {n.title} under <F>{n.section.replace('BNSS', 'Section').replace('BSA', 'Section')}{n.section.startsWith('BNSS') ? ', Bharatiya Nagarik Suraksha Sanhita, 2023' : ', Bharatiya Sakshya Adhiniyam, 2023'}</F>
          {n.verify && <span className="ml-1 text-[11.5px] font-medium text-crimson">[section reference to be verified]</span>} — NCRP <F className="font-mono text-[12.5px]">{CASE.ncrp}</F>, <F>{CASE.fir}</F>.
        </div>

        {kind === 'n94' && <Body94 />}
        {kind === 'n106' && <Body106 />}
        {kind === 'n63' && <Body63 />}

        {/* signature */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div className="text-[13px]">
            <div className="mb-6 text-zinc-500">Yours faithfully,</div>
            <div className="font-medium text-zinc-900">
              (<F>{CASE.officer}</F>)
            </div>
            <div>Investigating Officer, Cyber PS Jaipur</div>
            <div className="text-[12px] text-zinc-500">
              Phone <F>+91 XXXXX X4821</F> · E-mail <F>io.cyber-jpr@xxxx.gov.in</F>
            </div>
          </div>
          <div className="min-w-[180px] text-right text-[12.5px]">
            {approved ? (
              <div className="inline-block rotate-[-3deg] rounded-md border-2 border-moss bg-moss/15 px-3 py-1.5 text-left text-zinc-900">
                <div className="text-[11.5px] font-bold uppercase tracking-[0.12em]">Approved</div>
                <div className="text-[12px]">SP (Cyber), Jaipur · Vikram Solanki</div>
                <div className="font-mono text-[11px]">04 Sep 2026 · 12:01 IST</div>
              </div>
            ) : (
              <div className="text-zinc-400">
                <div className="mb-1 border-b border-dashed border-zinc-400 pb-5" />
                Approval: SP (Cyber), Jaipur
              </div>
            )}
          </div>
        </div>

        {sent && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-300 pt-3 font-mono text-[11.5px] text-zinc-500">
            <span>Transmitted via SAHYOG · 04 Sep 2026 12:03:18 IST</span>
            <span>Pack root {short(ROOT, 8, 6)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function DepositTable({ seize }: { seize?: boolean }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="bg-zinc-900/[0.05] text-[11.5px] uppercase tracking-[0.06em] text-zinc-500">
            <th className="border border-zinc-300 px-2 py-1.5 font-medium">#</th>
            <th className="border border-zinc-300 px-2 py-1.5 font-medium">Chain</th>
            <th className="border border-zinc-300 px-2 py-1.5 font-medium">Deposit address</th>
            <th className="border border-zinc-300 px-2 py-1.5 font-medium">Transaction</th>
            <th className="border border-zinc-300 px-2 py-1.5 text-right font-medium">{seize ? 'Amount to hold' : 'Amount traced'}</th>
          </tr>
        </thead>
        <tbody>
          {[
            { chain: 'TRON (USDT TRC-20)', addr: depA.addr, tx: TX.routeA, amt: ROUTE_A.valueCrypto, at: depA.at },
            { chain: 'Ethereum (USDT ERC-20)', addr: depB.addr, tx: TX.routeB, amt: depB.amt, at: depB.at },
          ].map((r, i) => (
            <tr key={r.addr}>
              <td className="border border-zinc-300 px-2 py-1.5">{i + 1}</td>
              <td className="border border-zinc-300 px-2 py-1.5">{r.chain}</td>
              <td className="border border-zinc-300 px-2 py-1.5">
                <F className="font-mono text-[12px]">{r.addr}</F>
              </td>
              <td className="border border-zinc-300 px-2 py-1.5">
                <F className="font-mono text-[12px]">{short(r.tx, 8, 6)}</F>
                <div className="text-[11px] text-zinc-500">{r.at} IST, 02 Sep 2026</div>
              </td>
              <td className="border border-zinc-300 px-2 py-1.5 text-right">
                <F>{r.amt.toLocaleString('en-IN')} USDT</F>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 text-[11px] text-zinc-500">Row 2 reached Ethereum through a cross-chain bridge; link confidence <F>82%</F>.</div>
    </div>
  )
}

function Body94() {
  return (
    <>
      <p className="mt-4">Sir / Madam,</p>
      <p className="mt-2">
        This office is investigating a complaint by <F>{CASE.complainant}</F> of <F>{CASE.location}</F>, who lost <F>{CASE.amountCrypto.toLocaleString('en-IN')} USDT (≈ ₹12.4 lakh)</F> in a <F>task-based job scam</F> on <F>{CASE.incidentAt}</F>. Blockchain analysis shows the funds reached the following deposit addresses, which are attributed to your platform:
      </p>
      <DepositTable />
      <p className="mt-4 font-medium text-zinc-900">You are requested to:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>Immediately place a debit freeze on the account(s) linked to the above addresses and preserve the balance.</li>
        <li>Provide KYC records — name, identity documents, registered phone and e-mail, and linked bank accounts.</li>
        <li>Provide login IP addresses and device identifiers from <F>25 Aug 2026</F> to <F>04 Sep 2026</F>.</li>
        <li>Provide the full deposit and withdrawal history, including bank details for any rupee withdrawals.</li>
        <li>Preserve all related records for 180 days and not alert the account holder.</li>
      </ol>
      <p className="mt-3">
        Please respond within <F>72 hours</F> through the SAHYOG portal or at the e-mail address below.
      </p>
    </>
  )
}

function Body106() {
  return (
    <>
      <p className="mt-4">Sir / Madam,</p>
      <p className="mt-2">
        The digital assets listed below are suspected to be proceeds of the offence registered as <F>{CASE.fir}</F> under <F>Sections 318(4), 319(2) BNS and 66D IT Act</F>. In exercise of the power to seize property suspected to be connected with an offence, you are requested to seize and hold the following balances:
      </p>
      <DepositTable seize />
      <p className="mt-4 font-medium text-zinc-900">Specifically, please:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>Block all withdrawals, transfers and trades from the account(s) holding these balances.</li>
        <li>Confirm the seizure in writing with a balance snapshot and timestamp.</li>
        <li>Keep the assets in your custody until further orders of the competent court.</li>
      </ol>
      <p className="mt-3 text-[12.5px] text-zinc-600">
        The Investigating Officer will report this seizure to the jurisdictional Magistrate as required by law.
      </p>
    </>
  )
}

function Body63() {
  return (
    <>
      <p className="mt-4">
        I, <F>{CASE.officer}</F>, Investigating Officer, certify that the electronic records listed below were produced by the ANVESHAK analysis system from public blockchain data during its regular use, that the system was operating properly throughout, and that each record is an accurate output of that process. Each record is identified by its SHA-256 hash value.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="bg-zinc-900/[0.05] text-[11.5px] uppercase tracking-[0.06em] text-zinc-500">
              <th className="border border-zinc-300 px-2 py-1.5 font-medium">#</th>
              <th className="border border-zinc-300 px-2 py-1.5 font-medium">Record</th>
              <th className="border border-zinc-300 px-2 py-1.5 font-medium">Format / size</th>
              <th className="border border-zinc-300 px-2 py-1.5 font-medium">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {ARTEFACTS.map((a, i) => (
              <tr key={a.id}>
                <td className="border border-zinc-300 px-2 py-1.5">{i + 1}</td>
                <td className="border border-zinc-300 px-2 py-1.5">{a.name}</td>
                <td className="border border-zinc-300 px-2 py-1.5">
                  {a.format} · {a.size}
                </td>
                <td className="border border-zinc-300 px-2 py-1.5">
                  <F className="font-mono text-[11.5px]">{short(a.sha256, 12, 8)}</F>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3">
        Pack sealed on <F>04 Sep 2026, 11:47 IST</F>; hash-chain root <F className="font-mono text-[12px]">{short(ROOT, 12, 8)}</F>.
      </p>
      <p className="mt-2 text-[12.5px] text-zinc-600">
        Part A of the certificate is completed by the officer above. Part B must be completed and signed by a designated expert before the certificate is filed.
      </p>
    </>
  )
}
