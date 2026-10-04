import * as React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlertTriangle, Check, Link2, Radar, RotateCcw, Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, Chip, IconTile, Meter, toneA, toneHex } from '@/components/kit'
import { api, errorText, type MemoryLookup } from '@/api'
import { inr, short } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Draft } from './draft'

const RELATION: Record<string, string> = { same_wallet: 'Paid the same wallet', one_hop: 'One hop away', shared_hub: 'Same collection wallet' }

export function StageLinks({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const t = draft.parse!.typology
  const chosen = draft.typology ?? t.classes[0]?.name ?? 'Other / unclear'
  const wallet = draft.values.suspectWallet?.value.trim() ?? ''
  const stale = !draft.memory || draft.memory.address !== wallet
  const [state, setState] = React.useState<{ loading: boolean; error: string | null }>({ loading: stale, error: null })
  const [attempt, setAttempt] = React.useState(0)

  // The officer may have corrected the wallet on the previous stage — ask the national memory again.
  React.useEffect(() => {
    if (!stale || !wallet) return
    const ac = new AbortController()
    setState({ loading: true, error: null })
    api
      .lookupWallet(wallet, ac.signal)
      .then((memory) => {
        patch({ memory })
        setState({ loading: false, error: null })
      })
      .catch((e) => (e as Error).name !== 'AbortError' && setState({ loading: false, error: errorText(e) }))
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, attempt])

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1.25fr]">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="h-full pb-5">
          <CardHeader title="What kind of scam is this?" tech="typology classifier · keyword + phrase weights" right={<Chip tone="ember">{Math.round((t.classes[0]?.p ?? 0) * 100)}% sure</Chip>} />
          <div className="px-5 pt-3">
            <div className="text-[12.5px] text-muted">Pick the category for the FIR — ANVESHAK's best guess is selected.</div>
            <div className="mt-2 space-y-1.5" role="radiogroup" aria-label="Scam category">
              {t.classes.map((c, i) => {
                const on = chosen === c.name
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => patch({ typology: c.name })}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className={cn('relative w-full rounded-xl border px-3 py-2.5 text-left transition-colors', on ? 'border-ember/50' : 'border-line hover:border-line-2 hover:bg-white/[0.02]')}
                  >
                    {on && <motion.span layoutId="typology-pick" className="absolute inset-0 rounded-xl bg-ember/[0.07]" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <div className="relative flex items-center justify-between gap-2 text-[14px]">
                      <span className="flex items-center gap-2">
                        <span className={cn('grid size-4 place-items-center rounded-full border', on ? 'border-ember bg-ember' : 'border-line-2')}>{on && <Check className="size-2.5 text-white" strokeWidth={4} />}</span>
                        <span className={on ? 'text-text' : 'text-muted'}>{c.name}</span>
                      </span>
                      <span className="k-num text-text">{Math.round(c.p * 100)}%</span>
                    </div>
                    <Meter value={c.p} tone={i === 0 ? 'ember' : 'neutral'} height={i === 0 ? 6 : 4} className="relative mt-2" />
                  </motion.button>
                )
              })}
            </div>
            {t.triggers.length > 0 && (
              <>
                <div className="mt-4 text-[12.5px] text-muted">Words that pushed the score</div>
                <div className="mt-2 space-y-1.5">
                  {t.triggers.map((tr, i) => (
                    <motion.div key={tr.phrase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 + i * 0.05 }} className="flex items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate text-text/85">“{tr.phrase}”</span>
                      <div className="w-16">
                        <Meter value={tr.weight} max={Math.max(...t.triggers.map((x) => x.weight))} tone="ember" height={4} />
                      </div>
                      <span className="k-mono w-10 text-right text-[12.5px] text-ember">+{tr.weight.toFixed(2)}</span>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
            <p className="mt-3 text-[12px] text-dim">{t.disclaimer}</p>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card variant="glass" className="h-full pb-5">
          <CardHeader
            title="Has India seen this wallet before?"
            tech="SAHYOG national memory · every wallet ever submitted, with where it came from"
            right={state.loading ? <Chip tone="ember" dot pulse>Checking</Chip> : draft.memory?.known ? <Chip tone="crimson" dot pulse>Match found</Chip> : draft.memory ? <Chip tone="moss">First report</Chip> : null}
          />
          <div className="px-5 pt-3">
            {state.error ? (
              <div className="rounded-xl border border-crimson/30 bg-crimson/[0.07] p-3.5 text-[13.5px]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 text-crimson" /> <span>Couldn't reach the national memory. {state.error}</span>
                </div>
                <Button size="sm" variant="outline" className="mt-2.5" onClick={() => setAttempt((a) => a + 1)}>
                  <RotateCcw /> Try again
                </Button>
                <p className="mt-2 text-[12px] text-dim">You can still open the case — the check runs again when the trace starts.</p>
              </div>
            ) : state.loading || !draft.memory ? (
              <div className="k-shimmer h-[260px] rounded-xl border border-line bg-white/[0.02]" />
            ) : draft.memory.known ? (
              <Known m={draft.memory} />
            ) : (
              <div className="k-dashed flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
                <IconTile tone="moss" size={40}>
                  <Sparkles />
                </IconTile>
                <div className="max-w-[340px] text-[14px] text-text">No earlier report names this wallet anywhere in India.</div>
                <p className="max-w-[360px] text-[12.5px] leading-snug text-muted">
                  When you open the case it joins the national memory, so the next complaint about <span className="k-mono">{short(wallet, 6, 4)}</span> — from any state — is matched instantly.
                </p>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

function Known({ m }: { m: MemoryLookup }) {
  const s = m.syndicate
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[230px_1fr]">
        <LinkBurst m={m} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="k-num text-[30px] leading-none text-text">{m.linkedCases.length}</span>
            <span className="text-[13.5px] text-muted">earlier case{m.linkedCases.length === 1 ? '' : 's'} already name this wallet</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {m.linkedCases.map((l, i) => (
              <motion.li key={l.caseId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
                <Link to="/cases" className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-3 py-2 hover:border-line-2 hover:bg-white/[0.04]">
                  <span className={cn('size-1.5 shrink-0 rounded-full', l.relation === 'same_wallet' ? 'bg-crimson' : 'bg-gold')} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-text">
                      {l.caseId} <span className="text-dim">·</span> <span className="text-muted">{l.city}, {l.state}</span>
                    </div>
                    <div className="text-[12px] text-dim">{RELATION[l.relation] ?? l.relation}</div>
                  </div>
                  <span className="k-num text-[13.5px] text-text">{inr(l.amountInr)}</span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
      {s && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-4 rounded-xl border border-crimson/25 bg-crimson/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <IconTile tone="crimson" size={32}>
              <Link2 />
            </IconTile>
            <div className="min-w-0 text-[13.5px] leading-snug text-text/90">
              Money from this wallet flows on to collection wallet <span className="k-mono text-crimson">{short(s.hub)}</span>, which belongs to syndicate <span className="text-text">{s.id}</span> — {s.name}.
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link to="/network/syndicates">
                  <Chip tone="crimson" dot>
                    {s.id} · {s.caseCount} cases
                  </Chip>
                </Link>
                <Chip>{s.stateCount} states</Chip>
                <Chip tone="gold">{inr(s.valueInr)} stolen</Chip>
                <Chip>{Math.round(s.confidence * 100)}% link confidence</Chip>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-dim">
        <Radar className="mt-px size-3.5 shrink-0" /> {m.disclaimer} No complainant names leave their state — the memory holds case numbers, units and amounts only.
      </p>
    </motion.div>
  )
}

/** The new complaint's wallet in the middle, earlier cases around it — lines draw in as each link is found. */
function LinkBurst({ m }: { m: MemoryLookup }) {
  const W = 230
  const c = W / 2
  const r = 82
  const nodes = m.linkedCases.slice(0, 6).map((l, i, a) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / a.length
    return { ...l, x: c + r * Math.cos(ang), y: c + r * Math.sin(ang) }
  })
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="mx-auto w-full max-w-[230px]" role="img" aria-label={`Wallet linked to ${nodes.length} earlier cases`}>
      <defs>
        <radialGradient id="lb-core">
          <stop offset="0%" stopColor={toneHex('crimson')} stopOpacity="0.55" />
          <stop offset="100%" stopColor={toneHex('crimson')} stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      {nodes.map((n, i) => (
        <motion.path
          key={`l${n.caseId}`}
          d={`M${c},${c} Q${(c + n.x) / 2 + (n.y - c) * 0.18},${(c + n.y) / 2 - (n.x - c) * 0.18} ${n.x},${n.y}`}
          fill="none"
          stroke={n.relation === 'same_wallet' ? toneHex('crimson') : toneHex('gold')}
          strokeWidth={1.6}
          strokeDasharray={n.relation === 'one_hop' ? '4 4' : undefined}
          style={{ filter: `drop-shadow(0 0 4px ${toneA(n.relation === 'same_wallet' ? 'crimson' : 'gold', 0.7)})` }}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.12, duration: 0.6, ease: 'easeOut' }}
        />
      ))}
      <circle cx={c} cy={c} r={36} fill="url(#lb-core)" />
      <motion.circle cx={c} cy={c} r={13} style={{ fill: 'var(--k-solid)' }} stroke={toneHex('crimson')} strokeWidth={2} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }} />
      <motion.circle cx={c} cy={c} r={13} fill="none" stroke={toneHex('crimson')} initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} style={{ transformOrigin: `${c}px ${c}px` }} />
      {nodes.map((n, i) => (
        <motion.g key={n.caseId} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.55 + i * 0.12, type: 'spring', stiffness: 380, damping: 20 }} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
          <circle cx={n.x} cy={n.y} r={8} style={{ fill: 'var(--k-solid)' }} stroke={n.relation === 'same_wallet' ? toneHex('crimson') : toneHex('gold')} strokeWidth={1.5} />
          <text x={n.x} y={n.y + (n.y > c ? 22 : -14)} textAnchor="middle" className="fill-[#8b8b90] text-[10px]">
            {n.caseId.slice(-4)}
          </text>
        </motion.g>
      ))}
      <text x={c} y={c + 4} textAnchor="middle" className="fill-[#f4f4f5] text-[9px] font-semibold">
        NEW
      </text>
    </svg>
  )
}
