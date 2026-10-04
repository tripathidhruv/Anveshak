import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  CheckCircle2,
  Download,
  FileLock2,
  Fingerprint,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Unlink,
  Users,
  X,
} from 'lucide-react'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DemoChip,
  IconTile,
  Meter,
  PageHeader,
  Reveal,
  SubTabs,
  toneA,
  toneHex,
  type Tone,
} from '@/components/kit'
import { Switch } from '@/components/animate-ui/components/radix/switch'
import { cn } from '@/lib/utils'
import {
  ACTION_LABEL,
  ACTORS,
  SEALED,
  SEALED_ROOT,
  TAMPERED_DETAIL,
  TAMPER_ENTRY,
  verify,
  type ActionType,
  type Sealed,
} from './audit/data'

const sh = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`
const actorOf = (id: string) => ACTORS.find((a) => a.id === id)!
type RowState = 'idle' | 'checking' | 'ok' | 'bad'

export default function AuditPage() {
  const [tampered, setTampered] = React.useState(false)
  const [walk, setWalk] = React.useState(-1)
  const [verifying, setVerifying] = React.useState(false)
  const [actor, setActor] = React.useState<string>('all')
  const [type, setType] = React.useState<ActionType | 'all'>('all')
  const [exported, setExported] = React.useState(false)
  const timer = React.useRef<number | null>(null)

  const entries: Sealed[] = React.useMemo(
    () => SEALED.map((e) => (tampered && e.n === TAMPER_ENTRY ? { ...e, detail: TAMPERED_DETAIL } : e)),
    [tampered],
  )
  const checks = React.useMemo(() => verify(entries), [entries])
  const total = entries.length
  const firstBad = checks.findIndex((c) => !c.ok)
  const finished = walk >= total && !verifying
  const verifiedCount = firstBad === -1 ? total : firstBad
  const recomputedRoot = checks[checks.length - 1].recomputed

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }
  const runVerify = React.useCallback(() => {
    stop()
    setWalk(0)
    setVerifying(true)
    timer.current = window.setInterval(() => setWalk((w) => Math.min(w + 1, SEALED.length)), 140)
  }, [])
  React.useEffect(() => stop, [])
  React.useEffect(() => {
    if (verifying && walk >= SEALED.length) {
      stop()
      setVerifying(false)
    }
  }, [walk, verifying])

  const firstRender = React.useRef(true)
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    runVerify()
  }, [tampered, runVerify])

  const stateOf = (i: number): RowState => (i < walk ? (checks[i].ok ? 'ok' : 'bad') : verifying && i === walk ? 'checking' : 'idle')
  const matches = (e: Sealed) => (actor === 'all' || e.actor === actor) && (type === 'all' || e.type === type)

  const custody = ACTORS.map((a) => {
    const mine = entries.filter((e) => e.actor === a.id)
    return { ...a, count: mine.length, first: mine[0], last: mine[mine.length - 1] }
  }).filter((a) => a.count > 0)

  const ledgerCard = (
    <Reveal delay={0.1}>
      <Card className="h-full pb-4">
        <CardHeader
          title="Custody log"
          tech="hash-chained · each entry stores the fingerprint of the one before it"
          right={
            <span className="hidden text-[12px] text-dim sm:inline">
              {actor !== 'all' || type !== 'all' ? 'filtered entries dimmed, chain kept whole' : 'oldest first'}
            </span>
          }
        />
        <ol className="mt-4 space-y-2 px-3 sm:px-4">
          {entries.map((e, i) => {
            const st = stateOf(i)
            const next = i < entries.length - 1 ? stateOf(i + 1) : null
            const a = actorOf(e.actor)
            const isTamperRow = tampered && e.n === TAMPER_ENTRY
            const brokenHere = st === 'bad' && i === firstBad
            const lineTone = next === 'bad' ? 'crimson' : next === 'ok' ? 'moss' : null
            return (
              <motion.li
                key={e.n}
                animate={{ opacity: matches(e) ? 1 : 0.32 }}
                transition={{ duration: 0.3 }}
                className="relative pl-9 sm:pl-10"
              >
                {/* connector to next entry */}
                {i < entries.length - 1 && (
                  <span
                    className="absolute left-[13px] top-[24px] w-[2px] rounded-full transition-colors duration-300 sm:left-[15px]"
                    style={{
                      height: 'calc(100% + 8px)',
                      background: lineTone ? toneHex(lineTone) : 'rgba(255,255,255,0.1)',
                      boxShadow: lineTone ? `0 0 8px ${toneA(lineTone, 0.6)}` : undefined,
                      opacity: next === 'bad' && i + 1 !== firstBad ? 0.55 : 1,
                    }}
                  />
                )}
                {/* broken-link marker on the incoming link */}
                <AnimatePresence>
                  {brokenHere && i > 0 && (
                    <motion.span
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-[9px] left-[5px] z-20 grid size-[18px] place-items-center rounded-full border border-crimson/60 bg-[#1a0d0d] text-crimson sm:left-[7px]"
                      aria-label="broken link"
                    >
                      <Unlink className="size-2.5" />
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* node */}
                <motion.span
                  className="absolute left-[5px] top-[16px] z-10 grid size-[18px] place-items-center rounded-full border-2 sm:left-[7px]"
                  animate={{
                    borderColor: st === 'ok' ? toneHex('moss') : st === 'bad' ? toneHex('crimson') : st === 'checking' ? toneHex('ember') : 'rgba(255,255,255,0.18)',
                    backgroundColor: st === 'ok' ? toneA('moss', 0.2) : st === 'bad' ? toneA('crimson', 0.2) : '#141415',
                    scale: st === 'checking' ? 1.25 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  {st === 'ok' && <Check className="size-2.5 text-moss" strokeWidth={3} />}
                  {st === 'bad' && <X className="size-2.5 text-crimson" strokeWidth={3} />}
                </motion.span>

                <motion.div
                  animate={{
                    borderColor: st === 'bad' ? toneA('crimson', brokenHere ? 0.55 : 0.25) : st === 'checking' ? toneA('ember', 0.45) : 'rgba(255,255,255,0.07)',
                    backgroundColor: st === 'bad' ? toneA('crimson', brokenHere ? 0.1 : 0.04) : 'rgba(255,255,255,0.015)',
                  }}
                  transition={{ duration: 0.3 }}
                  className="rounded-xl border px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="k-mono text-[12.5px] text-dim">#{String(e.n).padStart(2, '0')}</span>
                    <span className="text-[14px] text-text">{e.action}</span>
                    <span className="k-mono rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[12px] text-muted">{e.object}</span>
                    <span className="ml-auto k-mono text-[12px] text-dim">
                      {e.date} · {e.time}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <span
                      className="k-num grid size-5 shrink-0 place-items-center rounded-full text-[8.5px]"
                      style={{ background: toneA(a.tone === 'white' ? 'neutral' : a.tone, 0.18), color: a.tone === 'white' ? '#f4f4f5' : toneHex(a.tone) }}
                    >
                      {a.initials}
                    </span>
                    <span className="text-text/85">{a.name}</span>
                    <span className="text-dim">·</span>
                    <span className={cn('text-muted', isTamperRow && 'text-crimson underline decoration-crimson/60 decoration-dashed underline-offset-2')}>{e.detail}</span>
                    {isTamperRow && <Chip tone="crimson">edited directly in the database</Chip>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                    <span className="k-mono text-dim">
                      prev <span className="text-muted">{sh(e.prev)}</span>
                    </span>
                    <span className="k-mono text-dim">
                      hash <span className={st === 'bad' ? 'text-crimson line-through decoration-crimson/70' : st === 'ok' ? 'text-moss' : 'text-muted'}>{sh(e.hash)}</span>
                    </span>
                    {st === 'bad' && (
                      <span className="k-mono text-crimson">
                        recomputed {sh(checks[i].recomputed)}
                      </span>
                    )}
                    <span className="ml-auto">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span key={st} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="inline-block">
                          {st === 'ok' && <Chip tone="moss">Verified</Chip>}
                          {st === 'bad' && <Chip tone="crimson" solid={brokenHere}>{checks[i].reason === 'altered' ? 'Hash mismatch' : `Broken — depends on #${String(firstBad + 1).padStart(2, '0')}`}</Chip>}
                          {st === 'checking' && <Chip tone="ember" dot pulse>Checking</Chip>}
                          {st === 'idle' && <span className="text-dim">{ACTION_LABEL[e.type]}</span>}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </div>
                </motion.div>
              </motion.li>
            )
          })}
        </ol>
      </Card>
    </Reveal>
  )

  const checkCard = (
    <Reveal delay={0.15}>
      <Card variant="glass" className="pb-4">
        <CardHeader title="Check the chain" tech="replays every fingerprint from the first entry" />
        <div className="px-5 pt-3">
          <Button variant="ember" className="w-full" onClick={runVerify} disabled={verifying}>
            {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            {verifying ? `Checking entry ${Math.min(walk + 1, total)} of ${total}…` : 'Verify chain'}
          </Button>

          <AnimatePresence mode="wait" initial={false}>
            {finished && (
              <motion.div
                key={firstBad === -1 ? 'ok' : 'bad'}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: toneA(firstBad === -1 ? 'moss' : 'crimson', 0.4),
                  background: toneA(firstBad === -1 ? 'moss' : 'crimson', 0.08),
                }}
              >
                {firstBad === -1 ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-moss" /> : <Unlink className="mt-0.5 size-4 shrink-0 text-crimson" />}
                <div>
                  <div className={cn('k-num text-[15.5px]', firstBad === -1 ? 'text-moss' : 'text-crimson')}>
                    {firstBad === -1 ? `Chain intact · ${total}/${total}` : `Hash mismatch from entry #${firstBad + 1} onward`}
                  </div>
                  <div className="mt-0.5 text-[12.5px] leading-snug text-muted">
                    {firstBad === -1
                      ? 'Every entry matches its fingerprint. This log can go to court as-is.'
                      : `${verifiedCount} of ${total} entries verified. Entry #${firstBad + 1} was changed after it was written — everything after it can no longer be trusted.`}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-white/[0.02] px-3">
            <div className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
              <span className="text-muted">Sealed root</span>
              <span className="k-mono text-text">{sh(SEALED_ROOT)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
              <span className="text-muted">Recomputed now</span>
              <span className={cn('k-mono', !finished ? 'text-dim' : recomputedRoot === SEALED_ROOT ? 'text-moss' : 'text-crimson')}>
                {finished ? sh(recomputedRoot) : '— not checked —'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-dashed border-crimson/30 bg-crimson/[0.04] px-3 py-2.5">
            <label htmlFor="tamper" className="cursor-pointer">
              <div className="text-[13.5px] text-text">Simulate tampering</div>
              <div className="mt-0.5 text-[12px] leading-snug text-dim">
                Quietly changes the amount in entry #{TAMPER_ENTRY} from 14,850 to 4,850 USDT — as a corrupt insider might.
              </div>
            </label>
            <Switch
              id="tamper"
              checked={tampered}
              onCheckedChange={setTampered}
              className="mt-0.5 data-[state=checked]:bg-crimson data-[state=unchecked]:bg-white/[0.12]"
              aria-label="Simulate tampering with entry 6"
            />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-dim">
            <Lock className="mt-px size-3 shrink-0" />
            Each fingerprint covers the entry's text plus the previous fingerprint, so changing one word breaks every link after it. Demo uses a lightweight 64-bit hash; production uses SHA-256.
          </p>
        </div>
      </Card>
    </Reveal>
  )

  const filterCard = (
    <Reveal delay={0.2}>
      <Card className="pb-4">
        <CardHeader
          title="Filter the log"
          tech="by who acted and what kind of action"
          right={
            (actor !== 'all' || type !== 'all') && (
              <button
                onClick={() => {
                  setActor('all')
                  setType('all')
                }}
                className="k-btn-ghost inline-flex h-7 items-center rounded-lg px-2.5 text-[12.5px]"
              >
                Clear
              </button>
            )
          }
        />
        <div className="px-5 pt-3">
          <div className="text-[12px] text-dim">Actor</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <FilterPill on={actor === 'all'} onClick={() => setActor('all')}>
              Everyone
            </FilterPill>
            {ACTORS.map((a) => (
              <FilterPill key={a.id} on={actor === a.id} onClick={() => setActor(actor === a.id ? 'all' : a.id)}>
                {a.name.replace('Meridian Digital Exchange', 'Meridian')}
              </FilterPill>
            ))}
          </div>
          <div className="mt-3 text-[12px] text-dim">Action type</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <FilterPill on={type === 'all'} onClick={() => setType('all')}>
              All
            </FilterPill>
            {(Object.keys(ACTION_LABEL) as ActionType[]).map((t) => (
              <FilterPill key={t} on={type === t} onClick={() => setType(type === t ? 'all' : t)}>
                {ACTION_LABEL[t]}
              </FilterPill>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => setExported(true)}>
            <AnimatePresence mode="popLayout" initial={false}>
              {exported ? (
                <motion.span key="d" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 text-moss">
                  <Check /> Custody log ready · ANV-2026-0417
                </motion.span>
              ) : (
                <motion.span key="e" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="inline-flex items-center gap-1.5">
                  <Download /> Export custody log (PDF + JSON)
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </Card>
    </Reveal>
  )

  const custodyCard = (go: (key: string) => void) => (
    <Reveal delay={0.25}>
      <Card className="pb-4">
        <CardHeader title="Who touched the evidence" tech="custody summary · first and last action" />
        <ul className="mt-3 space-y-2.5 px-5">
          {custody.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setActor(c.id)
                  setType('all')
                  go('log')
                }}
                title="Show this person's entries in the custody log"
                className="flex w-full items-center gap-2.5 rounded-lg text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04]"
              >
                <span
                  className="k-num grid size-7 shrink-0 place-items-center rounded-full text-[11px]"
                  style={{ background: toneA(c.tone === 'white' ? 'neutral' : c.tone, 0.18), color: c.tone === 'white' ? '#f4f4f5' : toneHex(c.tone) }}
                >
                  {c.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] text-text">{c.name}</span>
                    <span className="k-num shrink-0 text-[13.5px] text-text">{c.count}</span>
                  </div>
                  <div className="truncate text-[11.5px] text-dim">
                    {c.role} · {c.first.date} {c.first.time.slice(0, 5)}
                    {c.count > 1 && ` → ${c.last.date} ${c.last.time.slice(0, 5)}`}
                  </div>
                </div>
              </button>
              <Meter value={c.count / total} max={0.4} tone={c.tone === 'white' ? 'neutral' : c.tone} height={3} className="mt-1.5" />
            </li>
          ))}
        </ul>
      </Card>
    </Reveal>
  )

  return (
    <div className="space-y-4">
      <Reveal>
        <PageHeader
          eyebrow={
            <>
              <span>Chain of custody · ANV-2026-0417</span>
              <DemoChip />
            </>
          }
          title="Audit Ledger"
          tech="Every action on a case — by an officer, the engine or an exchange — is written once and chained to the entry before it. If anyone edits history, the chain breaks and shows exactly where."
          actions={<Chip tone="moss" dot>Sealed daily at 18:00 IST</Chip>}
        />
      </Reveal>

      {/* ── stat tiles ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { k: 'Entries in this case', v: String(total), sub: 'append-only · nothing deleted', icon: <FileLock2 />, tone: 'neutral' as Tone },
          { k: 'People and systems', v: String(custody.length), sub: '3 officers · engine · exchange · portal', icon: <Users />, tone: 'neutral' as Tone },
          {
            k: 'Chain status',
            v: !finished ? (verifying ? 'Checking…' : 'Not checked') : firstBad === -1 ? 'Intact' : 'Broken',
            sub: finished ? `${verifiedCount}/${total} entries verified` : 'press “Verify chain”',
            icon: finished && firstBad !== -1 ? <ShieldAlert /> : <ShieldCheck />,
            tone: (finished ? (firstBad === -1 ? 'moss' : 'crimson') : 'neutral') as Tone,
          },
          { k: 'Last sealed root', v: sh(SEALED_ROOT), sub: 'printed in case diary · 05 Sep 18:00', icon: <Fingerprint />, tone: 'neutral' as Tone, mono: true },
        ].map((s, i) => (
          <Reveal key={s.k} delay={0.05 + i * 0.05}>
            <Card variant="speckle" grain className="h-[112px] p-4">
              <div className="relative flex items-center gap-2">
                <IconTile tone={s.tone === 'neutral' ? undefined : s.tone} size={28} className="[&_svg]:size-3.5">
                  {s.icon}
                </IconTile>
                <span className="truncate text-[13.5px] text-muted">{s.k}</span>
              </div>
              <div className="relative mt-3.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={s.v}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className={cn('truncate leading-none', s.mono ? 'k-mono text-[17px]' : 'k-num text-[22px]')}
                    style={{ color: s.tone === 'neutral' ? '#f4f4f5' : toneHex(s.tone) }}
                  >
                    {s.v}
                  </motion.div>
                </AnimatePresence>
                <div className="mt-1.5 truncate text-[12px] text-dim">{s.sub}</div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <SubTabs
        tabs={[
          {
            key: 'log',
            label: 'Is the record intact?',
            icon: ShieldCheck,
            badge: finished ? (firstBad === -1 ? 'intact' : 'broken') : undefined,
            render: () => (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                {ledgerCard}
                <div className="space-y-3">
                  {checkCard}
                  {filterCard}
                </div>
              </div>
            ),
          },
          {
            key: 'custody',
            label: 'Who touched the evidence',
            icon: Users,
            badge: custody.length,
            render: (go) => (
              <div className="max-w-2xl space-y-3">
                <p className="text-[13.5px] text-muted">Everyone who acted on this case, with their first and last action. Pick a name to see only their entries in the log.</p>
                {custodyCard(go)}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-7 items-center rounded-lg border px-2.5 text-[12.5px] transition-colors',
        on ? 'border-ember/45 bg-ember/[0.12] text-text' : 'border-line-2 bg-white/[0.02] text-muted hover:bg-white/[0.05] hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
