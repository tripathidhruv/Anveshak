import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  Building2,
  Check,
  Clock3,
  Coins,
  FileText,
  Landmark,
  MapPin,
  Network,
  Route,
  ScanSearch,
  Send,
  ShieldAlert,
  Smartphone,
  Store,
  Wallet,
} from 'lucide-react'
import {
  Address,
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  FlowGraph,
  HeatGrid,
  IconTile,
  KV,
  PageHeader,
  Reveal,
  Sparkline,
  Stat,
  SubTabs,
  toneA,
  toneHex,
  type FlowEdge,
  type FlowNode,
  type Tone,
} from '@/components/kit'
import { CASE } from '@/data/demo'
import { inr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FIAT_STATS, FLOW_INFO, HUB, MULE_ACCOUNTS, MULE_CASES, MULE_MATRIX, SHARED_TOP } from './fiat/data'
import { MatchEngine } from './fiat/MatchEngine'

const NODES: FlowNode[] = [
  { id: 'hub', col: 0, title: 'Collection wallet', sub: 'TNh8yW…K9pR · 31,850 USDT', tone: 'crimson', icon: <Wallet />, live: true },
  { id: 'o1', col: 1, title: 'Meridian P2P #88214', sub: '11,200 USDT → ₹9.9 L', tone: 'gold', icon: <Store /> },
  { id: 'o2', col: 1, title: 'Meridian P2P #88231', sub: '8,450 USDT → ₹7.4 L', tone: 'gold', icon: <Store /> },
  { id: 'o3', col: 1, title: 'Arcadia P2P #4417', sub: '6,900 USDT → ₹6.1 L', tone: 'gold', icon: <Store /> },
  { id: 'o4', col: 1, title: 'Orbita OTC #2209', sub: '5,300 USDT → ₹4.7 L', tone: 'gold', icon: <Store /> },
  { id: 'p1', col: 2, title: 'UPI · ra****@okv', sub: '₹9,85,600 · 2m 35s', tone: 'sky', icon: <Smartphone /> },
  { id: 'p2', col: 2, title: 'IMPS · XXXX0937', sub: '₹7,43,600 · 2m 18s', tone: 'sky', icon: <Smartphone /> },
  { id: 'p3', col: 2, title: 'UPI · sm****@knk', sub: '₹6,07,200 · 3m 26s', tone: 'sky', icon: <Smartphone /> },
  { id: 'p4', col: 2, title: 'UPI · an****@nrm', sub: '₹4,66,390 · 1m 12s', tone: 'sky', icon: <Smartphone /> },
  { id: 'm1', col: 3, title: 'Sahyadri Co-op ••4821', sub: 'shared · 6 cases', tone: 'crimson', icon: <Landmark />, badge: <Chip tone="crimson">6</Chip> },
  { id: 'm2', col: 3, title: 'Vindhya Bank ••0937', sub: 'shared · 4 cases', tone: 'crimson', icon: <Landmark />, badge: <Chip tone="crimson">4</Chip> },
  { id: 'm3', col: 3, title: 'Konark SFB ••5562', sub: 'shared · 5 cases', tone: 'crimson', icon: <Landmark />, badge: <Chip tone="crimson">5</Chip> },
  { id: 'm4', col: 3, title: 'Narmada Gramin ••7714', sub: 'new account', tone: 'crimson', icon: <Landmark /> },
  { id: 'c1', col: 4, y: 0.14, title: 'ATM, Deoghar district', sub: '₹8.2 L · 41 withdrawals', tone: 'crimson', icon: <MapPin /> },
  { id: 'c2', col: 4, y: 0.5, title: 'ATM, Alwar district', sub: '₹5.9 L · 30 withdrawals', tone: 'crimson', icon: <MapPin /> },
  { id: 'c3', col: 4, y: 0.86, title: 'Onward NEFT', sub: '₹6.1 L · not yet traced', tone: 'neutral', icon: <ArrowRight />, ghost: true },
]

const EDGES: FlowEdge[] = [
  { from: 'hub', to: 'o1', weight: 0.9, animated: true },
  { from: 'hub', to: 'o2', weight: 0.7, animated: true },
  { from: 'hub', to: 'o3', weight: 0.55, animated: true },
  { from: 'hub', to: 'o4', weight: 0.45, animated: true },
  { from: 'o1', to: 'p1', weight: 0.9, animated: true },
  { from: 'o2', to: 'p2', weight: 0.7, animated: true },
  { from: 'o3', to: 'p3', weight: 0.55, animated: true },
  { from: 'o4', to: 'p4', weight: 0.45, animated: true },
  { from: 'p1', to: 'm1', weight: 0.9, animated: true },
  { from: 'p2', to: 'm2', weight: 0.7, animated: true },
  { from: 'p3', to: 'm3', weight: 0.55, animated: true },
  { from: 'p4', to: 'm4', weight: 0.45, animated: true },
  { from: 'm1', to: 'c1', weight: 0.8, animated: true },
  { from: 'm3', to: 'c1', weight: 0.4, animated: true },
  { from: 'm2', to: 'c2', weight: 0.6, animated: true },
  { from: 'm4', to: 'c2', weight: 0.3, animated: true },
  { from: 'm1', to: 'c3', weight: 0.3, dashed: true },
  { from: 'm3', to: 'c3', weight: 0.3, dashed: true },
]

const TILES: { k: string; v: React.ReactNode; s: string; tone: Tone; spark: number[]; icon: React.ReactNode }[] = [
  {
    k: 'Traced into mule bank accounts',
    v: <Stat value={FIAT_STATS.tracedINR / 1e5} prefix="₹" suffix=" L" decimals={1} />,
    s: `across ${FIAT_STATS.muleAccounts} accounts at 4 banks`,
    tone: 'crimson',
    spark: [2, 5, 7, 11, 16, 19, 24, 28, 31, 35, 38.6],
    icon: <Landmark />,
  },
  {
    k: 'P2P orders matched to a bank credit',
    v: (
      <span className="k-num">
        {FIAT_STATS.ordersMatched}
        <span className="text-dim">/{FIAT_STATS.ordersTotal}</span>
      </span>
    ),
    s: '88% · 2 need review, 1 awaiting statement',
    tone: 'moss',
    spark: [3, 6, 9, 11, 14, 16, 18, 20, 21, 23],
    icon: <Check />,
  },
  {
    k: 'Median gap, crypto sale → bank credit',
    v: <span className="k-num">2m 40s</span>,
    s: 'P2P buyers pay within minutes',
    tone: 'sky',
    spark: [210, 180, 175, 190, 160, 150, 170, 155, 160, 158],
    icon: <Clock3 />,
  },
  {
    k: 'Cases sharing these mule accounts',
    v: <Stat value={FIAT_STATS.sharedCases} />,
    s: 'one freeze request helps all of them',
    tone: 'gold',
    spark: [1, 1, 2, 3, 3, 5, 6, 7, 8, 9],
    icon: <Network />,
  },
]

export default function FiatPage() {
  // lifted so switching tabs keeps what the officer picked
  const [flowSel, setFlowSel] = React.useState('m1')
  const [matchSel, setMatchSel] = React.useState('r1')
  const [freezeSent, setFreezeSent] = React.useState(false)
  const [, setParams] = useSearchParams()
  const openFreeze = () =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('tab', 'freeze')
        return n
      },
      { replace: true },
    )

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span className="k-mono">{CASE.id}</span>
              <span className="text-dim">·</span>
              <span>Collection wallet</span>
              <Address addr={HUB} chain="TRON" className="py-0 text-[12.5px]" />
              <DemoChip />
            </>
          }
          title="Rupee Exit Trail"
          tech="Where the stolen crypto became rupees. ANVESHAK pairs each crypto sale on a P2P desk with the bank credit it caused — following the money past the exchange, into mule accounts and out at ATMs."
          actions={
            <>
              <Link to="/attribution">
                <Button>
                  <ScanSearch /> Attribution & risk
                </Button>
              </Link>
              <button
                type="button"
                onClick={openFreeze}
                className="k-btn-ghost inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[14px] font-medium hover:bg-raise"
              >
                <FileText className="size-3.5" /> Bank freeze draft
              </button>
            </>
          }
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map((t, i) => (
          <Reveal key={t.k} delay={0.04 + i * 0.04}>
            <Card variant="speckle" grain className="h-[128px] p-4">
              <div className="relative flex items-start justify-between gap-2">
                <div className="text-[13px] leading-snug text-muted">{t.k}</div>
                <IconTile tone={t.tone} size={28} className="[&_svg]:size-3.5">
                  {t.icon}
                </IconTile>
              </div>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[24px] leading-none text-text">{t.v}</div>
                  <div className="mt-1.5 truncate text-[12px] text-dim">{t.s}</div>
                </div>
                <Sparkline data={t.spark} tone={t.tone} width={78} height={34} />
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <SubTabs
        tabs={[
          {
            key: 'route',
            label: 'Wallet to ATM',
            icon: Route,
            render: () => (
              <div className="space-y-3">
                <HowItLeaves />
                <FlowCard sel={flowSel} setSel={setFlowSel} />
              </div>
            ),
          },
          {
            key: 'match',
            label: 'Sale ↔ bank credit',
            icon: ArrowLeftRight,
            badge: `${FIAT_STATS.ordersMatched}/${FIAT_STATS.ordersTotal}`,
            render: () => <MatchEngine sel={matchSel} onSel={setMatchSel} />,
          },
          {
            key: 'mules',
            label: 'Shared mule accounts',
            icon: Landmark,
            badge: SHARED_TOP.length,
            render: (go) => <MuleNetwork onFreeze={() => go('freeze')} />,
          },
          {
            key: 'freeze',
            label: 'Freeze request',
            icon: FileText,
            render: () => <FreezeDraft sent={freezeSent} onSend={() => setFreezeSent(true)} />,
          },
        ]}
      />
    </div>
  )
}

/* ───────────────────────── How scam money leaves crypto ───────────────────────── */
function HowItLeaves() {
  const steps: { t: string; s: string; tone: Tone; icon: React.ReactNode }[] = [
    { t: 'Scammer sells USDT', s: 'on a P2P desk, not a bank withdrawal', tone: 'crimson', icon: <Coins /> },
    { t: 'A "buyer" pays rupees', s: 'by UPI or IMPS, outside the exchange', tone: 'gold', icon: <Smartphone /> },
    { t: 'Into a mule account', s: 'rented or opened in someone else\'s name', tone: 'sky', icon: <Landmark /> },
    { t: 'Cashed out', s: 'ATM withdrawals or onward transfers', tone: 'crimson', icon: <Banknote /> },
  ]
  return (
    <Card variant="glass" className="p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[14.5px] font-medium text-text/90">How scam money actually leaves crypto in India</div>
          <div className="text-[12.5px] text-dim">P2P off-ramp · crypto leg + bank leg</div>
        </div>
        <Chip tone="ember" dot>
          Only ANVESHAK follows the bank leg
        </Chip>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {steps.map((st, i) => (
          <React.Fragment key={st.t}>
            {i > 0 && (
              <div className="relative hidden items-center justify-center lg:flex">
                {i === 1 ? (
                  <div className="flex flex-col items-center gap-1 px-1">
                    <span className="h-6 w-px border-l border-dashed border-white/30" />
                    <span className="whitespace-nowrap rounded-full border border-line-2 bg-[#141415] px-2 py-0.5 text-[11px] text-muted">
                      Other tools stop here
                    </span>
                    <span className="h-6 w-px border-l border-dashed border-white/30" />
                  </div>
                ) : (
                  <ArrowRight className="size-4 text-dim" />
                )}
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.12 }}
              className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', i === 0 ? 'border-line bg-white/[0.02]' : 'border-ember/20 bg-ember/[0.04]')}
            >
              <IconTile tone={st.tone} size={32}>
                {st.icon}
              </IconTile>
              <div className="min-w-0">
                <div className="text-[14px] text-text">{st.t}</div>
                <div className="text-[12px] leading-snug text-dim">{st.s}</div>
              </div>
            </motion.div>
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-dim lg:hidden">Other tools stop after step 1. ANVESHAK continues into the bank leg.</p>
    </Card>
  )
}

/* ───────────────────────── Flow graph + side panel ───────────────────────── */
function FlowCard({ sel, setSel }: { sel: string; setSel: (id: string) => void }) {
  const info = FLOW_INFO[sel]
  const node = NODES.find((n) => n.id === sel)!
  return (
    <Card className="pb-4">
      <CardHeader
        title="From wallet to ATM — the full exit route"
        tech="crypto leg (on-chain + desk records) joined to bank leg (statements) · 4 of 23 matched orders shown"
        right={
          <div className="hidden items-center gap-3 text-[12px] text-muted md:flex">
            {(
              [
                ['crimson', 'Criminal-controlled'],
                ['gold', 'P2P desk'],
                ['sky', 'Rupee payment'],
              ] as [Tone, string][]
            ).map(([t, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: toneHex(t) }} />
                {l}
              </span>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-3 px-3 pt-3 2xl:grid-cols-[minmax(0,1fr)_300px] 2xl:px-5">
        <div className="k-scroll overflow-x-auto">
          <div className="min-w-[940px]">
            <div className="mb-1 grid grid-cols-5 px-2 text-[11.5px] text-dim">
              {['Wallet', 'P2P sell order', 'Rupee payment', 'Mule account', 'Cash-out'].map((c, i) => (
                <span key={c} className={cn(i === 0 ? 'text-left' : i === 4 ? 'text-right' : 'text-center')}>
                  {c}
                </span>
              ))}
            </div>
            <FlowGraph nodes={NODES} edges={EDGES} height={460} nodeWidth={164} nodeHeight={56} selected={sel} onSelect={setSel} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={sel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border border-line-2 bg-black/20 p-4"
            style={{ boxShadow: `inset 0 1px 0 ${toneA(node.tone, 0.25)}` }}
          >
            <div className="flex items-center gap-3">
              <IconTile tone={node.tone}>{node.icon}</IconTile>
              <div className="min-w-0">
                <div className="text-[12px]" style={{ color: toneHex(node.tone === 'neutral' ? 'white' : node.tone) }}>
                  {info.kind}
                </div>
                <div className="truncate text-[14.5px] font-medium text-text">{node.title}</div>
                <div className="text-[12px] text-dim">{info.tech}</div>
              </div>
            </div>
            <div className="mt-3 divide-y divide-line">
              {info.rows.map(([k, v]) => (
                <KV key={k} k={k} v={k === 'Address' ? <Address addr={v} chain="TRON" /> : <span className="k-mono text-[13px]">{v}</span>} />
              ))}
            </div>
            {info.note && <p className="mt-3 rounded-lg border border-line bg-white/[0.02] p-2.5 text-[12.5px] leading-snug text-muted">{info.note}</p>}
            <p className="mt-3 text-[11.5px] text-dim">Click any card in the graph to inspect it. Bank details are masked; full records arrive via lawful request.</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  )
}

/* ───────────────────────── Mule network ───────────────────────── */
function MuleNetwork({ onFreeze }: { onFreeze: () => void }) {
  const accent: Record<string, Tone> = {}
  MULE_MATRIX[0].forEach((v, c) => {
    if (v > 0) accent[`0-${c}`] = 'ember'
  })
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="One mule account, many victims"
        tech="cases × mule accounts · cell brightness = share of that case's rupees"
        right={<Chip tone="crimson" dot>{SHARED_TOP.length} accounts in 4+ cases</Chip>}
      />
      <div className="grid grid-cols-1 gap-5 px-5 pt-4 lg:grid-cols-[auto_1fr]">
        <div className="k-scroll overflow-x-auto">
          <HeatGrid
            data={MULE_MATRIX}
            tone="crimson"
            cell={15}
            gap={4}
            rowLabels={MULE_CASES.map((c) => c.replace('ANV-2026-', '#'))}
            colLabels={MULE_ACCOUNTS.map((a) => a.acct.slice(-2))}
            accent={accent}
            title={(r, c, v) =>
              v > 0
                ? `${MULE_CASES[r]} → ${MULE_ACCOUNTS[c].bank} ••${MULE_ACCOUNTS[c].acct} · ${Math.round(v * 100)}% of fiat exit`
                : `${MULE_CASES[r]} · no link to ••${MULE_ACCOUNTS[c].acct}`
            }
          />
          <div className="mt-2 flex items-center gap-3 text-[11.5px] text-dim">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-ember" /> this case ({CASE.id.replace('ANV-2026-', '#')})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-crimson/70" /> other cases
            </span>
          </div>
        </div>
        <div>
          <div className="text-[12.5px] text-dim">Most-shared accounts</div>
          <ul className="mt-2 space-y-2">
            {SHARED_TOP.map((a, i) => (
              <motion.li
                key={a.acct}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.015] px-3 py-2"
              >
                <IconTile tone="crimson" size={30} className="[&_svg]:size-3.5">
                  <Landmark />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] text-text">
                    {a.bank} <span className="k-mono text-muted">XXXX{a.acct}</span>
                  </div>
                  <div className="text-[12px] text-dim">{a.cases} cases · ~{inr(a.inr)} received</div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: a.cases }).map((_, k) => (
                    <span key={k} className="h-4 w-1 rounded-full bg-crimson" style={{ opacity: 0.4 + (k / a.cases) * 0.6 }} />
                  ))}
                </div>
              </motion.li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-snug text-dim">
            Freezing <span className="text-text">XXXX4821</span> alone would cover money from 6 victims in at least 5 states.
          </p>
          <button type="button" onClick={onFreeze} className="mt-2 flex items-center gap-1.5 text-[13.5px] text-text/90 hover:text-text">
            Bank freeze draft <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ───────────────────────── Freeze request draft ───────────────────────── */
function FreezeDraft({ sent, onSend }: { sent: boolean; onSend: () => void }) {
  return (
    <Card variant="glass" className="mx-auto max-w-[880px] pb-5" id="freeze">
      <CardHeader
        title="Bank account freeze request"
        tech="pre-filled from matched evidence pairs · Sahyadri Co-operative Bank"
        icon={<Building2 className="size-4" />}
        right={<Chip tone="gold" dot>Draft</Chip>}
      />
      <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/[0.06] px-3 py-2 text-[12.5px] text-gold">
        <ShieldAlert className="size-3.5 shrink-0" />
        Draft for officer review — not legal advice. Section reference to be verified.
      </div>
      <div className="mx-5 mt-3 rounded-xl border border-line bg-black/25 p-4 text-[13.5px] leading-relaxed text-text/85">
        <div className="text-[12px] text-dim">To</div>
        <div>The Nodal Officer, Sahyadri Co-operative Bank</div>
        <div className="mt-2 text-[12px] text-dim">Subject</div>
        <div>Request to debit-freeze account XXXX4821 — {CASE.id}, {CASE.fir}</div>
        <div className="mt-3 space-y-2">
          <p>
            In connection with the above case of cyber fraud reported by the complainant from {CASE.location}, analysis of cryptocurrency
            peer-to-peer sale records shows that proceeds of the offence were paid into account <b>XXXX4821</b> in{' '}
            <b>two credits totalling ₹12,76,000</b> on 02 Sep 2026 (UTR 4021••••8812 at 20:00:47 and UTR 4021••••3391 at 20:43:59 IST).
          </p>
          <p>
            You are requested to place a debit freeze on the account and preserve KYC documents, statements from 01 Jul 2026, ATM CCTV for
            withdrawals listed in Annexure B, and device/IP logs, under{' '}
            <span className="rounded bg-gold/10 px-1 text-gold">[BNSS section — to be verified by officer]</span>.
          </p>
          <p className="text-muted">Annexure A: 2 matched evidence pairs (score 1.00 each). Annexure B: 41 ATM withdrawals, Deoghar district.</p>
        </div>
        <div className="mt-3 text-[12.5px] text-muted">
          {CASE.officer}, Cyber PS Jaipur · signature pending
        </div>
      </div>
      <div className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[300px] text-[12px] leading-snug text-dim">
          Bank statements arrive via lawful request; in this prototype they are simulated.
        </p>
        <Button onClick={onSend} disabled={sent}>
          {sent ? <Check /> : <Send />}
          {sent ? `Sent to ${CASE.officer} for review` : 'Send to officer for review'}
        </Button>
      </div>
    </Card>
  )
}
