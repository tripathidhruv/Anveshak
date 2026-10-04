import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Building2, Check, Eye, FileText, Lock, Mail, Network, ShieldCheck, Wallet, X, AlertTriangle } from 'lucide-react'
import { Address, Button, Card, CardHeader, Chip, FlowGraph, KV, Meter, toneA, toneHex, type FlowEdge, type FlowNode, type Tone } from '@/components/kit'
import { CASE, EXCHANGES } from '@/data/demo'
import { cn } from '@/lib/utils'
import { IVMS_FIELDS, TR_CANDIDATES, TR_THRESHOLD, type IvmsLine, type TrCandidate, type Verdict } from './data'
import { CheckMark, Select, Slider } from './ui'

export const VERDICT: Record<Verdict, { tone: Tone; label: string }> = {
  full: { tone: 'moss', label: 'Full record should exist' },
  partial: { tone: 'gold', label: 'Partial record may exist' },
  none: { tone: 'crimson', label: 'No record will exist' },
}

/* ───────────── How the Travel Rule works ───────────── */
const FLOW_NODES: FlowNode[] = [
  { id: 'send', col: 0, y: 0.5, title: 'Sending exchange', sub: 'checks its own customer', tone: 'gold', icon: <Building2 /> },
  { id: 'msg', col: 1, y: 0.08, title: 'Compliance message', sub: 'IVMS101 · private', tone: 'white', icon: <Mail /> },
  { id: 'chain', col: 1, y: 0.92, title: 'Crypto transfer', sub: 'on the blockchain · public', tone: 'teal', icon: <Network />, live: true },
  { id: 'recv', col: 2, y: 0.5, title: 'Receiving exchange', sub: 'keeps the record', tone: 'gold', icon: <Building2 /> },
]
const FLOW_EDGES: FlowEdge[] = [
  { from: 'send', to: 'msg', tone: 'white', dashed: true, weight: 0.3, label: 'identity' },
  { from: 'msg', to: 'recv', tone: 'white', dashed: true, weight: 0.3 },
  { from: 'send', to: 'chain', tone: 'teal', weight: 0.6, animated: true, label: 'money' },
  { from: 'chain', to: 'recv', tone: 'teal', weight: 0.6, animated: true },
]

const WHERE: Record<(typeof IVMS_FIELDS)[number]['where'], { tone: Tone; label: string; icon: React.ReactNode }> = {
  public: { tone: 'teal', label: 'Public on the blockchain', icon: <Eye className="size-3" /> },
  inferred: { tone: 'gold', label: 'Worked out by ANVESHAK', icon: <Building2 className="size-3" /> },
  sealed: { tone: 'neutral', label: 'Sealed until lawful request', icon: <Lock className="size-3" /> },
}

export function HowItWorks() {
  return (
    <Card variant="glass" className="h-full pb-5">
      <CardHeader
        title="Exchanges already swap sender identity — we find which record to ask for"
        tech="FATF Recommendation 16 (Travel Rule) · transfers ≥ USD/EUR 1,000 between regulated exchanges"
        right={<Chip tone="gold">Label source 1</Chip>}
      />
      <div className="px-5">
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
          When one regulated exchange sends crypto above the threshold to another, it must also send the{' '}
          <span className="text-text">sender’s and receiver’s identity</span> through a Travel Rule messaging network. So for a transfer between
          two compliant exchanges, the identity <span className="text-text">already exists</span> in a compliance message. ANVESHAK matches the three
          fields that are also public on the blockchain — <span className="text-teal">amount, time and receiving address</span> — to point the officer at
          the exact record, instead of tracing hop by hop.
        </p>
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[580px]">
            <FlowGraph nodes={FLOW_NODES} edges={FLOW_EDGES} height={188} nodeWidth={184} nodeHeight={54} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {IVMS_FIELDS.map((f) => {
            const w = WHERE[f.where]
            return (
              <div key={f.field} className="flex items-center gap-2.5 border-b border-line py-1.5">
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-md"
                  style={{ background: toneA(w.tone, 0.12), color: toneHex(w.tone) }}
                >
                  {w.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-text/90">{f.field}</div>
                  <div className="truncate text-[11.5px] text-dim">{f.tech}</div>
                </div>
                <span className={cn('shrink-0 text-[11.5px]', f.where === 'sealed' ? 'text-dim' : f.where === 'public' ? 'text-teal' : 'text-gold')}>{w.label}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-dim">
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-teal" /> 3 public fields = the join key</span>
          <span className="inline-flex items-center gap-1.5"><Lock className="size-3" /> 4 identity fields stay sealed — ANVESHAK never sees them</span>
        </div>
      </div>
    </Card>
  )
}

/* ───────────── Eligibility checker ───────────── */
type Reason = { ok: boolean | 'warn'; text: string }

const PARTY_OPTIONS = [
  ...EXCHANGES.map((e) => ({ value: e.id, label: `${e.name}${e.fiuRegistered ? '' : ' (not compliant)'}` })),
  { value: 'private', label: 'Private wallet (no exchange)' },
]

function evaluate(amount: number, from: string, to: string): { verdict: Verdict; reasons: Reason[]; holders: string[] } {
  const ex = (id: string) => EXCHANGES.find((e) => e.id === id)
  const s = ex(from)
  const r = ex(to)
  const reasons: Reason[] = []
  const holders: string[] = []
  if (s && r && s.id === r.id) {
    return {
      verdict: 'none',
      reasons: [{ ok: false, text: `Same exchange on both sides — an internal ledger move inside ${s.name}. No message, and nothing on the blockchain.` }, { ok: 'warn', text: 'Ask the exchange for its internal transfer log instead.' }],
      holders: [],
    }
  }
  if (!s) {
    reasons.push({ ok: false, text: 'No sending exchange — the Travel Rule starts at the sending exchange, so no message is created.' })
    if (r?.fiuRegistered) {
      reasons.push({ ok: 'warn', text: `${r.name} may hold its customer’s self-declaration about where the money came from.` })
      holders.push(`${r.name} (self-declaration)`)
    }
    return { verdict: r?.fiuRegistered ? 'partial' : 'none', reasons, holders }
  }
  if (!s.fiuRegistered) {
    reasons.push({ ok: false, text: `${s.name} is not Travel-Rule compliant, so it sends no message.` })
    return { verdict: 'none', reasons, holders }
  }
  reasons.push({ ok: true, text: `${s.name} is compliant — it must identify its customer and the receiving side.` })
  holders.push(`${s.name} (outbound)`)
  let verdict: Verdict = 'full'
  if (!r) {
    reasons.push({ ok: 'warn', text: 'Receiver is a private wallet — no message is sent, but the sender keeps a record of the declared receiver.' })
    verdict = 'partial'
  } else if (!r.fiuRegistered) {
    reasons.push({ ok: 'warn', text: `${r.name} is not compliant — only ${s.name}’s outbound record will exist, naming ${r.name} as the receiver.` })
    verdict = 'partial'
  } else {
    reasons.push({ ok: true, text: `${r.name} is compliant — it keeps the inbound record and checks the receiver against its own KYC.` })
    holders.push(`${r.name} (inbound)`)
  }
  if (amount < TR_THRESHOLD) {
    reasons.push({ ok: 'warn', text: `Below USD/EUR 1,000 — names and wallet addresses are collected but not verified.` })
    if (verdict === 'full') verdict = 'partial'
  } else {
    reasons.push({ ok: true, text: `≈ USD ${amount.toLocaleString('en-IN')} is above the USD/EUR 1,000 threshold — full, verified identity required.` })
  }
  return { verdict, reasons, holders }
}

export function Eligibility() {
  const [amount, setAmount] = React.useState(1776)
  const [from, setFrom] = React.useState('kestrel')
  const [to, setTo] = React.useState('northwind')
  const { verdict, reasons, holders } = evaluate(amount, from, to)
  const v = VERDICT[verdict]
  const id = React.useId()
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Will a compliance record exist?" tech="eligibility check · amount × sending × receiving exchange" right={<Chip tone={v.tone} dot>{verdict === 'full' ? 'Yes' : verdict === 'partial' ? 'Partly' : 'No'}</Chip>} />
      <div className="space-y-4 px-5 pt-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[12.5px] text-dim">Amount sent</span>
            <span className="k-num text-[18px] text-text">
              {amount.toLocaleString('en-IN')} <span className="text-[12.5px] text-muted">USDT ≈ USD</span>
            </span>
          </div>
          <Slider min={0} max={5000} step={10} value={amount} onChange={setAmount} tone={amount >= TR_THRESHOLD ? 'moss' : 'gold'} ariaLabel="Amount sent in USDT" marker={{ at: TR_THRESHOLD, label: 'threshold 1,000' }} />
        </div>
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
          <Select id={`${id}f`} label="Sending side" value={from} onChange={setFrom} options={PARTY_OPTIONS} />
          <ArrowRight className="mx-auto mb-2 hidden size-4 text-dim sm:block" />
          <Select id={`${id}t`} label="Receiving side" value={to} onChange={setTo} options={PARTY_OPTIONS} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={verdict + from + to + (amount >= TR_THRESHOLD ? 'a' : 'b')}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="rounded-xl border p-3"
            style={{ borderColor: toneA(v.tone, 0.25), background: `linear-gradient(180deg, ${toneA(v.tone, 0.08)}, transparent)` }}
          >
            <div className="flex items-center gap-2 text-[14.5px] font-medium" style={{ color: toneHex(v.tone) }}>
              {verdict === 'full' ? <ShieldCheck className="size-4" /> : verdict === 'partial' ? <AlertTriangle className="size-4" /> : <X className="size-4" />}
              {v.label}
            </div>
            <ul className="mt-2 space-y-1.5">
              {reasons.map((r) => (
                <li key={r.text} className="flex items-start gap-2 text-[13px] leading-snug text-muted">
                  <span className={cn('mt-0.5 shrink-0', r.ok === true ? 'text-moss' : r.ok === 'warn' ? 'text-gold' : 'text-crimson')}>
                    {r.ok === true ? <Check className="size-3.5" /> : r.ok === 'warn' ? <AlertTriangle className="size-3.5" /> : <X className="size-3.5" />}
                  </span>
                  {r.text}
                </li>
              ))}
            </ul>
            {holders.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-dim">
                Ask: {holders.map((h) => <Chip key={h} tone="gold">{h}</Chip>)}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <p className="text-[12px] leading-snug text-dim">“Compliant” here uses FIU-IND registration as a stand-in. Confirm each exchange’s actual Travel Rule status before relying on it.</p>
      </div>
    </Card>
  )
}

/* ───────────── Candidate matches ───────────── */
export function Candidates() {
  const [sel, setSel] = React.useState('TR-3')
  const c = TR_CANDIDATES.find((x) => x.id === sel)!
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.55fr_1fr]">
      <Card className="h-full">
        <CardHeader
          title="Transfers where a compliance record may already exist"
          tech={`candidate matches · ${CASE.id} Ethereum leg + SYN-07 exchange-to-exchange transfers`}
          right={<span className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]">{TR_CANDIDATES.length} candidates</span>}
        />
        <div className="mt-3 overflow-x-auto px-3 pb-3">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-left">
            <thead>
              <tr className="text-[12px] text-dim">
                <th className="px-2 py-1 font-normal">Transfer</th>
                <th className="px-2 py-1 font-normal">Amount · time</th>
                <th className="px-2 py-1 text-center font-normal" title="Amount on-chain matches the record">Amount</th>
                <th className="px-2 py-1 text-center font-normal" title="Timestamp within window">Time</th>
                <th className="px-2 py-1 text-center font-normal" title="Receiving address matches">Address</th>
                <th className="px-2 py-1 text-center font-normal" title="Above USD/EUR 1,000">≥ 1,000</th>
                <th className="px-2 py-1 text-center font-normal" title="Both sides are compliant exchanges">Both exch.</th>
                <th className="px-2 py-1 font-normal">Record likely</th>
              </tr>
            </thead>
            <tbody>
              {TR_CANDIDATES.map((r) => {
                const on = r.id === sel
                const v = VERDICT[r.verdict]
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSel(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSel(r.id)
                      }
                    }}
                    tabIndex={0}
                    aria-selected={on}
                    className={cn('cursor-pointer outline-none transition-colors [&>td]:py-2.5 focus-visible:[&>td]:bg-white/[0.05]', on ? '[&>td]:bg-white/[0.055]' : 'hover:[&>td]:bg-white/[0.025]')}
                  >
                    <td className="rounded-l-xl px-2">
                      <div className="flex items-center gap-2">
                        <span className="k-mono shrink-0 text-[12px] text-dim">{r.id}</span>
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] text-text">{r.label}</div>
                          <div className="flex items-center gap-1 truncate text-[12px] text-muted">
                            {r.fromKind === 'private' ? <Wallet className="size-3 text-teal" /> : <Building2 className="size-3 text-gold" />}
                            {r.fromLabel} <ArrowRight className="size-3 text-dim" /> <span className="text-gold">{r.toLabel}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2">
                      <div className="k-num text-[14px] text-text">{r.amount.toLocaleString('en-IN')} USDT</div>
                      <div className="k-mono text-[11.5px] text-dim">{r.date.slice(0, 6)} · {r.at}</div>
                    </td>
                    <td className="px-2 text-center"><CheckMark s={r.checks.amount[0]} note={r.checks.amount[1]} /></td>
                    <td className="px-2 text-center"><CheckMark s={r.checks.time[0]} note={r.checks.time[1]} /></td>
                    <td className="px-2 text-center"><CheckMark s={r.checks.address[0]} note={r.checks.address[1]} /></td>
                    <td className="px-2 text-center"><CheckMark s={r.checks.threshold[0]} note={r.checks.threshold[1]} /></td>
                    <td className="px-2 text-center"><CheckMark s={r.checks.compliant[0]} note={r.checks.compliant[1]} /></td>
                    <td className="rounded-r-xl px-2">
                      <div className="flex items-center gap-2">
                        <Meter value={r.confidence} tone={v.tone} className="w-16" height={5} />
                        <span className="k-num w-8 text-[13.5px]" style={{ color: toneHex(v.tone) }}>{Math.round(r.confidence * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 px-2 text-[12px] text-dim">“Record likely” = probability a matching compliance record exists, from the five checks. It is not a match on identity — ANVESHAK cannot see identities.</p>
        </div>
      </Card>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={c.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }} className="min-w-0">
          <CandidateDetail c={c} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function CandidateDetail({ c }: { c: TrCandidate }) {
  const v = VERDICT[c.verdict]
  const [draft, setDraft] = React.useState(false)
  return (
    <Card className="h-full pb-4">
      <CardHeader title={c.label} tech={`${c.id} · ${c.context}`} right={<Chip tone={v.tone} dot>{v.label.split(' ').slice(0, 2).join(' ')}</Chip>} />
      <div className="px-5 pt-2">
        <KV k="Who holds it" v={<span className="text-gold">{c.holder}</span>} />
        <KV k="Receiving address" v={<Address addr={c.toAddr} chain="Ethereum" />} />
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.holderNote}</p>

        {c.ivms ? (
          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-dim">
              <span>What the record looks like · IVMS101 (values masked)</span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-teal" />public</span>
                <span className="inline-flex items-center gap-1"><Lock className="size-2.5" />sealed</span>
              </span>
            </div>
            <IvmsBlock lines={c.ivms} />
          </div>
        ) : (
          <div className="k-dashed mt-3 flex items-start gap-2.5 p-3 text-[13px] leading-snug text-muted">
            <X className="mt-0.5 size-4 shrink-0 text-crimson" />
            <span>No compliance message exists for this transfer. {c.why}</span>
          </div>
        )}

        <div className="mt-3 text-[12.5px] text-dim">What the officer can request</div>
        <ul className="mt-1 space-y-1">
          {c.request.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[13px] text-text/85">
              <Check className="mt-0.5 size-3 shrink-0 text-moss" /> {r}
            </li>
          ))}
        </ul>
        {c.ivms && <p className="mt-2 text-[12.5px] text-muted">{c.why}</p>}

        {c.draftTo && (
          <div className="mt-3">
            <Button size="sm" onClick={() => setDraft((d) => !d)} aria-expanded={draft}>
              <FileText /> {draft ? 'Hide draft request' : `Draft request to ${c.draftTo}`}
            </Button>
            <AnimatePresence initial={false}>
              {draft && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-2 rounded-xl border border-line-2 bg-white/[0.02] p-3 text-[13px] leading-relaxed text-text/85">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip tone="gold">Draft for officer review — not legal advice</Chip>
                    </div>
                    To the Compliance Officer, {c.draftTo}: In connection with {CASE.fir} ({CASE.id}), you are requested under BNSS §94{' '}
                    <span className="text-gold">(section reference to be verified)</span> to produce the Travel Rule record (IVMS101) for the transfer of{' '}
                    <span className="k-mono">{c.amount.toLocaleString('en-IN')} USDT</span> on {c.date} at {c.at} IST to address{' '}
                    <span className="k-mono">{c.toAddr}</span>, including originator and beneficiary details held by you.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Card>
  )
}

function IvmsBlock({ lines }: { lines: IvmsLine[] }) {
  return (
    <pre className="k-mono max-h-[260px] overflow-auto rounded-xl border border-line bg-black/40 p-3 text-[12px] leading-[1.65]">
      {lines.map((l, i) => (
        <div key={i} style={{ paddingLeft: l.depth * 12 }} className="whitespace-pre">
          {l.k && <span className="text-dim">"{l.k}": </span>}
          {l.kind === 'open' || l.kind === 'close' ? (
            <span className="text-muted">{l.v}</span>
          ) : (
            <>
              <span
                className={cn(
                  l.kind === 'public' && 'text-teal',
                  l.kind === 'vasp' && 'text-gold',
                  l.kind === 'masked' && 'text-text/60',
                )}
              >
                "{l.v}"
              </span>
              {l.kind === 'masked' && <Lock className="ml-1 inline size-2.5 text-dim" />}
              <span className="text-muted">,</span>
            </>
          )}
        </div>
      ))}
    </pre>
  )
}

export function HonestyNote() {
  return (
    <Card className="flex flex-wrap items-start gap-3 p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-moss/10 text-moss">
        <ShieldCheck className="size-4" />
      </span>
      <div className="min-w-[220px] flex-1 text-[13.5px] leading-relaxed text-muted">
        <span className="text-text">ANVESHAK does not access Travel Rule messages.</span> It works only from public blockchain data, tells the officer that a
        record <em>should</em> exist and which exchange holds it, and drafts the request. Identity fields reach the officer only through the exchange’s
        reply to a lawful request. Record likelihoods are estimates — an exchange may be non-compliant in practice.
      </div>
    </Card>
  )
}
