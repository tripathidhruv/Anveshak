import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Stamp,
  TriangleAlert,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  IconTile,
  KV,
  PageHeader,
  Reveal,
  toneA,
  toneHex,
} from '@/components/kit'
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
import { Progress } from '@/components/animate-ui/components/radix/progress'
import { CASE, EXCHANGE, ROUTE_A } from '@/data/demo'
import { short } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ARTEFACTS, CUSTODY, GENESIS, NOTICES, ROOT, STEPS, type NoticeKey } from './evidence/data'
import { NoticePaper } from './evidence/NoticePaper'

const FORMAT_ICON: Record<string, React.ReactNode> = {
  PNG: <ImageIcon />,
  CSV: <FileSpreadsheet />,
  PDF: <FileText />,
  JSON: <FileJson />,
}

function HashTag({ hash, head = 8, tail = 6, className }: { hash: string; head?: number; tail?: number; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(hash).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      title={`SHA-256 ${hash} — click to copy`}
      aria-label="Copy SHA-256 hash"
      className={cn('group inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[12.5px] text-muted hover:bg-white/[0.05] hover:text-text', className)}
    >
      <span className="k-mono">{short(hash, head, tail)}</span>
      {copied ? <Check className="size-3 text-moss" /> : <Copy className="size-3 text-dim opacity-0 transition-opacity group-hover:opacity-100" />}
    </button>
  )
}

export default function EvidencePage() {
  const [toast, setToast] = React.useState(false)
  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 4200)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <Scale className="size-3.5" /> Case {CASE.id} · {CASE.complainant} · {CASE.fir}
            </>
          }
          title="Evidence & notices"
          tech="Everything the officer takes to the exchange and to court: a sealed, tamper-evident evidence pack and pre-filled legal notices ready for review."
          actions={
            <>
              <DemoChip />
              <Button onClick={() => setToast(true)}>
                <Download /> Download evidence pack (PDF)
              </Button>
            </>
          }
        />
      </Reveal>

      {/* ── Pack contents + seal summary ── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_1fr]">
        <Reveal delay={0.05}>
          <Card className="h-full pb-3">
            <CardHeader
              title="What's in the evidence pack"
              tech="6 artefacts · each fingerprinted with SHA-256 · click a hash to copy it"
              right={<Chip tone="moss" dot>Sealed</Chip>}
            />
            <ul className="mt-2 divide-y divide-line px-3">
              {ARTEFACTS.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.025]"
                >
                  <IconTile tone={a.tone} size={34}>{FORMAT_ICON[a.format]}</IconTile>
                  <div className="min-w-[150px] flex-1">
                    <div className="flex items-center gap-2 text-[14px] text-text">
                      {a.name}
                      <span className="k-mono rounded bg-white/[0.06] px-1 text-[11px] text-muted">{a.format}</span>
                    </div>
                    <div className="truncate text-[12px] text-dim">{a.plain}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <HashTag hash={a.sha256} />
                    <span className="k-num w-14 text-right text-[13.5px] text-muted">{a.size}</span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card variant="speckle" grain className="h-full pb-4">
            <CardHeader title="Pack seal" tech="who sealed it, when, and how it is protected" icon={<Lock className="size-4" />} />
            <div className="relative px-5 pt-2">
              <KV k="Sealed" v={<span className="k-num">04 Sep 2026 · 11:47 IST</span>} />
              <KV k="Sealed by" v={`${CASE.officer}, Cyber PS Jaipur`} />
              <KV k="Method" v="SHA-256, hash-chained" />
              <KV k="Root hash" v={<HashTag hash={ROOT} head={6} tail={4} className="-mr-1" />} />
              <KV k="Total size" v={<span className="k-num">4.7 MB · 23 pages</span>} />
              <div className="mt-3 text-[12px] uppercase tracking-[0.08em] text-dim">Chain of custody</div>
              <ol className="relative mt-2 space-y-2.5 pl-4">
                <span className="absolute bottom-1 left-[3px] top-1 w-px bg-line-2" />
                {CUSTODY.map((c, i) => (
                  <li key={c.at} className="relative">
                    <span
                      className="absolute -left-4 top-1.5 size-[7px] rounded-full"
                      style={{ background: i === CUSTODY.length - 1 ? toneHex('moss') : 'rgba(255,255,255,0.3)', boxShadow: i === CUSTODY.length - 1 ? `0 0 8px ${toneA('moss', 0.8)}` : undefined }}
                    />
                    <div className="flex items-baseline gap-2 text-[13px]">
                      <span className="k-mono text-[12px] text-dim">{c.at}</span>
                      <span className="text-text/90">{c.what}</span>
                    </div>
                    <div className="pl-[42px] text-[11.5px] text-dim">{c.who}</div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* ── Hash chain ── */}
      <Reveal delay={0.1}>
        <HashChain />
      </Reveal>

      {/* ── Notice drafting + approval ── */}
      <Reveal delay={0.1}>
        <NoticeDesk />
      </Reveal>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-50 flex items-start gap-3 rounded-2xl border border-line-2 bg-[#1d1d20]/95 p-3.5 shadow-2xl backdrop-blur sm:left-auto sm:w-[380px]"
          >
            <IconTile tone="moss" size={34}><CheckCircle2 /></IconTile>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] text-text">Evidence pack prepared</div>
              <div className="k-mono truncate text-[12px] text-muted">{CASE.id}_evidence-pack.pdf · 4.7 MB · 23 pages</div>
              <div className="mt-1 text-[12px] text-dim">Demo build — the PDF file itself is generated once the backend is connected.</div>
            </div>
            <button type="button" onClick={() => setToast(false)} aria-label="Dismiss" className="rounded-md p-1 text-dim hover:bg-white/[0.06] hover:text-text">
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────── Hash chain + verify ───────── */
type Phase = 'idle' | 'running' | 'done' | 'failed'
const TAMPER_AT = 3

function HashChain() {
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [cursor, setCursor] = React.useState(-1)
  const [tamper, setTamper] = React.useState(false)

  React.useEffect(() => {
    if (phase !== 'running') return
    const t = setTimeout(() => {
      if (tamper && cursor === TAMPER_AT) {
        setPhase('failed')
        return
      }
      if (cursor >= ARTEFACTS.length - 1) {
        setCursor(ARTEFACTS.length)
        setPhase('done')
        return
      }
      setCursor((c) => c + 1)
    }, cursor < 0 ? 150 : 480)
    return () => clearTimeout(t)
  }, [phase, cursor, tamper])

  const start = () => {
    setCursor(-1)
    setPhase('running')
  }
  const reset = () => {
    setPhase('idle')
    setCursor(-1)
  }

  const statusOf = (i: number): 'idle' | 'checking' | 'ok' | 'bad' | 'skipped' => {
    if (phase === 'idle') return 'idle'
    if (phase === 'failed') return i < TAMPER_AT ? 'ok' : i === TAMPER_AT ? 'bad' : 'skipped'
    if (phase === 'done') return 'ok'
    if (i < cursor) return 'ok'
    if (i === cursor) return 'checking'
    return 'idle'
  }

  return (
    <Card variant="glass" className="pb-5">
      <CardHeader
        title="Tamper-evident hash chain"
        tech="each block stores its own hash and the previous block's — change one byte anywhere and every later link breaks"
        right={
          <>
            <button
              type="button"
              onClick={() => {
                setTamper((t) => !t)
                reset()
              }}
              aria-pressed={tamper}
              className={cn('k-btn-ghost inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px]', tamper && 'border-crimson/40 text-crimson')}
            >
              <TriangleAlert className="size-3" /> {tamper ? 'Tampered file loaded' : 'Simulate a tampered file'}
            </button>
          </>
        }
      />
      <div className="k-scroll mt-4 overflow-x-auto px-5 pb-2">
        <div className="flex min-w-max items-stretch">
          {ARTEFACTS.map((a, i) => {
            const s = statusOf(i)
            const prev = i === 0 ? GENESIS : ARTEFACTS[i - 1].block
            const hash = tamper && i === TAMPER_AT ? 'e1469c' + a.sha256.slice(6) : a.sha256
            const tone = s === 'ok' ? 'moss' : s === 'bad' ? 'crimson' : s === 'checking' ? 'ember' : null
            const linkOk = i > 0 && statusOf(i - 1) === 'ok' && (s === 'ok' || s === 'checking')
            return (
              <React.Fragment key={a.id}>
                {i > 0 && (
                  <div className="relative flex w-8 shrink-0 items-center">
                    <div className="h-px w-full bg-line-2" />
                    <motion.div
                      className="absolute left-0 h-[2px] rounded-full"
                      initial={false}
                      animate={{ width: linkOk ? '100%' : '0%', background: toneHex('moss') }}
                      style={{ boxShadow: `0 0 8px ${toneA('moss', 0.8)}` }}
                      transition={{ duration: 0.35 }}
                    />
                    <span className={cn('absolute -right-[3px] size-1.5 rotate-45 border-r border-t', linkOk ? 'border-moss' : 'border-white/25')} />
                  </div>
                )}
                <motion.div
                  animate={{
                    borderColor: tone ? toneA(tone, 0.55) : 'rgba(255,255,255,0.08)',
                    backgroundColor: tone ? toneA(tone, s === 'checking' ? 0.08 : 0.06) : 'rgba(255,255,255,0.015)',
                    boxShadow: tone ? `0 0 22px ${toneA(tone, 0.18)}` : '0 0 0 rgba(0,0,0,0)',
                    opacity: s === 'skipped' ? 0.45 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                  className="relative w-[172px] shrink-0 rounded-xl border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="k-mono text-[11.5px] text-dim">BLOCK {i + 1}</span>
                    <span className="grid size-5 place-items-center">
                      {s === 'ok' && <Check className="size-3.5 text-moss" />}
                      {s === 'bad' && <XCircle className="size-3.5 text-crimson" />}
                      {s === 'checking' && <Loader2 className="size-3.5 animate-spin text-ember" />}
                      {(s === 'idle' || s === 'skipped') && <Link2 className="size-3.5 text-dim" />}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[13.5px] text-text">{a.name}</div>
                  <div className="text-[11.5px] text-dim">
                    {a.format} · {a.size}
                  </div>
                  <div className="mt-2.5 space-y-1 text-[11.5px]">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-dim">file</span>
                      <span className={cn('k-mono', tamper && i === TAMPER_AT ? 'text-crimson' : 'text-muted')}>{short(hash, 6, 4)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-dim">prev</span>
                      <span className="k-mono text-muted">{short(prev, 6, 4)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-dim">hash</span>
                      <span className="k-mono text-text/90">{short(a.block, 6, 4)}</span>
                    </div>
                  </div>
                </motion.div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="min-w-0 flex-1 text-[13.5px]"
          >
            {phase === 'idle' && <span className="text-muted">Recompute every hash from the files on disk and compare with the sealed chain.</span>}
            {phase === 'running' && (
              <span className="text-text/90">
                Checking block {Math.max(1, cursor + 1)} of {ARTEFACTS.length}…
              </span>
            )}
            {phase === 'done' && (
              <span className="inline-flex flex-wrap items-center gap-2 text-moss">
                <ShieldCheck className="size-4" /> All 6 artefacts match · pack sealed 04 Sep 2026 11:47 IST
              </span>
            )}
            {phase === 'failed' && (
              <span className="inline-flex flex-wrap items-center gap-2 text-crimson">
                <XCircle className="size-4" /> Mismatch in block {TAMPER_AT + 1} ({ARTEFACTS[TAMPER_AT].name}) — this pack would be rejected in court.
              </span>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center gap-2">
          {(phase === 'done' || phase === 'failed') && (
            <Button size="sm" variant="quiet" onClick={reset}>
              <RotateCcw /> Reset
            </Button>
          )}
          <Button variant="ember" onClick={start} disabled={phase === 'running'}>
            {phase === 'running' ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify integrity
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ───────── Notice drafting + approval FSM ───────── */
const STEP_ICON = [<FileText key="d" />, <UserCheck key="r" />, <Stamp key="a" />, <Send key="s" />, <CheckCircle2 key="k" />]
const STEP_LOG = [
  { at: '11:48', who: 'ANVESHAK', what: 'Draft generated from case data' },
  { at: '11:52', who: CASE.officer, what: 'Marked reviewed' },
  { at: '12:01', who: 'SP (Cyber) Vikram Solanki', what: 'Approved for sending' },
  { at: '12:03', who: 'SAHYOG', what: 'Delivered to exchange nodal officer' },
  { at: '12:03', who: EXCHANGE.name, what: 'Acknowledged receipt' },
]
const NOTICE_TYPE: Record<NoticeKey, string> = { n94: 'BNSS_94_DATA_FREEZE', n106: 'BNSS_106_SEIZURE', n63: 'BSA_63_CERTIFICATE' }
const ACK_ID: Record<NoticeKey, string> = { n94: 'SHY/ACK/2026/0904/118734', n106: 'SHY/ACK/2026/0904/118741', n63: 'SHY/ACK/2026/0904/118752' }

function NoticeDesk() {
  const [tab, setTab] = React.useState<NoticeKey>('n94')
  const [steps, setSteps] = React.useState<Record<NoticeKey, number>>({ n94: 0, n106: 0, n63: 0 })
  const [sending, setSending] = React.useState<NoticeKey | null>(null)
  const [progress, setProgress] = React.useState(0)
  const step = steps[tab]
  const notice = NOTICES.find((n) => n.key === tab)!

  const advance = (k: NoticeKey) => setSteps((s) => ({ ...s, [k]: Math.min(4, s[k] + 1) }))

  React.useEffect(() => {
    if (!sending) return
    const k = sending
    setProgress(0)
    const iv = setInterval(() => setProgress((p) => Math.min(100, p + 7)), 90)
    const t1 = setTimeout(() => {
      advance(k)
      setSending(null)
    }, 1500)
    // The acknowledgement lands ~2 s after delivery. It is deliberately not cleared when `sending`
    // flips back to null at t1; it only applies if the notice is still at "Sent" (not reset).
    setTimeout(() => setSteps((s) => (s[k] === 3 ? { ...s, [k]: 4 } : s)), 3300)
    return () => {
      clearInterval(iv)
      clearTimeout(t1)
    }
  }, [sending])

  const hub = ROUTE_A.trail[ROUTE_A.trail.length - 1]
  const payload = {
    portal: 'SAHYOG',
    notice_type: NOTICE_TYPE[tab],
    reference: notice.ref,
    case_id: CASE.id,
    ncrp_ack: CASE.ncrp,
    fir: '0312/2026 · Cyber PS Jaipur',
    recipient: { vasp: EXCHANGE.name, role: 'Nodal Officer' },
    addresses: [{ chain: 'TRON', address: hub.addr, usdt: ROUTE_A.valueCrypto }],
    evidence_pack: { sha256_root: short(ROOT, 10, 6), artefacts: 6 },
    approved_by: 'SP (Cyber), Jaipur',
    sent_at: '2026-09-04T12:03:18+05:30',
    ...(step >= 4 ? { ack_id: ACK_ID[tab] } : {}),
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.55fr_1fr]">
      <Card className="pb-5">
        <CardHeader
          title="Draft a legal notice"
          tech="pre-filled from the trace · pick the notice type, review the highlighted fields"
          right={<Chip tone="gold" dot>Draft</Chip>}
        />
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2 text-[13px] text-text/90">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-gold" />
          <span>
            <span className="font-medium text-gold">Draft for officer review — not legal advice.</span> ANVESHAK fills in facts from the case; the officer is responsible for the final wording and legal basis.
          </span>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as NoticeKey)} className="mt-3 px-5">
          <div className="k-scroll -mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="h-9 border border-line bg-white/[0.04]">
              {NOTICES.map((n) => (
                <TabsTrigger key={n.key} value={n.key} className="h-full gap-1.5 px-3 text-[13px] text-muted data-[state=active]:text-text">
                  {n.tab}
                  <span className="k-mono text-[11.5px] text-dim">{n.section}</span>
                  {steps[n.key] >= 3 && <Check className="size-3 text-moss" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {notice.verify && (
            <div className="flex items-center gap-2 rounded-lg border border-crimson/30 bg-crimson/[0.07] px-3 py-1.5 text-[12.5px] text-crimson">
              <TriangleAlert className="size-3.5 shrink-0" />
              Section reference to be verified before use — confirm §94 BNSS wording against the official text.
            </div>
          )}
          <TabsContents className="mt-2">
            {NOTICES.map((n) => (
              <TabsContent key={n.key} value={n.key}>
                <div className="rounded-xl bg-white/[0.03] p-2 md:p-4">
                  <NoticePaper kind={n.key} step={steps[n.key]} />
                </div>
              </TabsContent>
            ))}
          </TabsContents>
        </Tabs>
      </Card>

      <Card variant="glass" className="pb-5 xl:self-start">
        <CardHeader title="Approval and sending" tech={`${notice.section} · ${notice.ref}`} right={<Chip tone={step >= 4 ? 'moss' : step >= 3 ? 'sky' : 'neutral'} dot>{STEPS[step]}</Chip>} />

        {/* stepper */}
        <div className="mt-5 px-5">
          <div className="relative flex justify-between">
            <div className="absolute left-[14px] right-[14px] top-[14px] h-px bg-line-2" />
            <motion.div
              className="absolute left-[14px] top-[13.5px] h-[2px] rounded-full"
              initial={false}
              animate={{ width: `calc(${(step / (STEPS.length - 1)) * 100}% - ${(step / (STEPS.length - 1)) * 28}px)` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              style={{ background: toneHex('moss'), boxShadow: `0 0 10px ${toneA('moss', 0.7)}` }}
            />
            {STEPS.map((s, i) => {
              const done = i < step || (i === 4 && step === 4)
              const current = i === step && step < 4
              return (
                <div key={s} className="relative z-10 flex w-[56px] flex-col items-center text-center">
                  <motion.span
                    initial={false}
                    animate={{
                      backgroundColor: done ? toneA('moss', 0.18) : current ? toneA('ember', 0.16) : 'rgba(20,20,21,1)',
                      borderColor: done ? toneA('moss', 0.7) : current ? toneA('ember', 0.7) : 'rgba(255,255,255,0.12)',
                      scale: current ? 1.08 : 1,
                    }}
                    className="grid size-7 place-items-center rounded-full border [&_svg]:size-3.5"
                    style={{ color: done ? toneHex('moss') : current ? toneHex('ember') : '#5c5c62' }}
                  >
                    {done ? <Check /> : STEP_ICON[i]}
                  </motion.span>
                  <span className={cn('mt-1.5 text-[11px] leading-tight', done || current ? 'text-text/90' : 'text-dim')}>{s}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* current action */}
        <div className="mx-5 mt-5 rounded-xl border border-line bg-white/[0.02] p-3">
          <AnimatePresence mode="wait">
            <motion.div key={`${tab}-${step}-${sending ? 's' : ''}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              {sending === tab ? (
                <>
                  <div className="flex items-center gap-2 text-[13.5px] text-text">
                    <Loader2 className="size-3.5 animate-spin text-ember" /> Sending to {EXCHANGE.name} via SAHYOG…
                  </div>
                  <Progress value={progress} className="mt-2.5 h-1.5 bg-white/[0.06]" />
                  <div className="mt-1.5 text-[11.5px] text-dim">Signing payload · attaching evidence pack hash · delivering</div>
                </>
              ) : step === 0 ? (
                <ActionBlock text="The officer reads the draft and checks every highlighted field against the case file." button={<Button onClick={() => advance(tab)}><UserCheck /> Mark reviewed</Button>} />
              ) : step === 1 ? (
                <ActionBlock text="The Superintendent of Police (Cyber) approves the notice before it leaves the station." button={<Button onClick={() => advance(tab)}><Stamp /> Approve as SP</Button>} />
              ) : step === 2 ? (
                <ActionBlock text="Send the approved notice and the evidence-pack hash to the exchange's nodal officer through SAHYOG." button={<Button variant="ember" onClick={() => setSending(tab)}><Send /> Send via SAHYOG</Button>} />
              ) : step === 3 ? (
                <div className="flex items-center gap-2 text-[13.5px] text-sky">
                  <Loader2 className="size-3.5 animate-spin" /> Delivered · waiting for the exchange to acknowledge…
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 text-[14px] text-moss">
                    <CheckCircle2 className="size-4" /> Acknowledged by {EXCHANGE.name}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    Acknowledgment ID <span className="k-mono rounded bg-moss/10 px-1.5 py-0.5 text-moss">{ACK_ID[tab]}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-dim">Response due by 07 Sep 2026, 12:03 IST · SLA clock started</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* history */}
        <ol className="mt-4 space-y-1.5 px-5">
          {STEP_LOG.slice(0, step + 1).map((l, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-baseline gap-2 text-[12.5px]">
              <span className="k-mono w-9 shrink-0 text-[11.5px] text-dim">{l.at}</span>
              <span className="text-text/85">{l.what}</span>
              <span className="truncate text-[11.5px] text-dim">· {l.who}</span>
            </motion.li>
          ))}
        </ol>

        {/* payload */}
        <AnimatePresence>
          {step >= 3 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mx-5 mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="uppercase tracking-[0.08em] text-dim">SAHYOG payload</span>
                  <span className="text-dim">signed · application/json</span>
                </div>
                <pre className="k-mono k-scroll max-h-[260px] overflow-auto rounded-xl border border-line bg-[#0b0b0c] p-3 text-[12px] leading-relaxed text-muted">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {step > 0 && !sending && (
          <div className="mt-3 px-5">
            <Button size="sm" variant="quiet" onClick={() => setSteps((s) => ({ ...s, [tab]: 0 }))}>
              <RotateCcw /> Reset this notice
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function ActionBlock({ text, button }: { text: string; button: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-muted">{text}</p>
      <div className="mt-2.5">{button}</div>
    </div>
  )
}
