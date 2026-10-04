import * as React from 'react'
import { useCountdown, toneHex, type Tone } from '@/components/kit'
import { CASE, EXCHANGES, SYNDICATES, type CaseStatus, type Chain } from '@/data/demo'
import type { CaseSummary } from '@/api'
import { mmss } from '@/lib/format'
import { cn } from '@/lib/utils'

export type CaseRow = CaseSummary

export const STATUS_TONE: Record<CaseStatus, Tone> = {
  Intake: 'sky',
  Tracing: 'ember',
  Traced: 'gold',
  'Notice sent': 'white',
  Frozen: 'moss',
  Closed: 'neutral',
}

export const CHAIN_TONE: Record<Chain, Tone> = { TRON: 'crimson', Ethereum: 'sky', Bitcoin: 'gold' }

/** Golden hour = money still moving between wallets with ≤ 60 min before it reaches an exchange / cash-out. */
export const inGoldenHour = (c: CaseRow) => c.recover === 'moving' && c.goldenMin !== null && c.goldenMin <= 60

/** Lower = more urgent. Live-money cases first by minutes left, then everything else newest-first. */
export function urgency(c: CaseRow, idx: number): number {
  // an untraced complaint could be in its golden hour right now — rank it with the live ones
  if (c.status === 'Intake' && c.goldenMin === null) return 30
  if (c.goldenMin !== null && (c.recover === 'moving' || c.recover === 'at_rest')) return c.goldenMin
  if (c.goldenMin !== null && c.recover === 'at_exchange') return 1000 + c.goldenMin
  return 100000 + idx
}

const POOL: Record<Chain, string[]> = {
  TRON: ['TQm7bK3xF9jH2nL6pV4sD', 'TPd4wS8cM1kR5tY9nB3gH', 'TLr3cV7nK2pW9sD4mQ8xF', 'TJw6hN1qB8vR3kM5cY7pT'],
  Ethereum: ['0x9e4b8f07a2c6d13e5b', '0x5d2a71c4e8f09b36a1'],
  Bitcoin: ['bc1q7m3xk9d2v8wq4sr6tn', 'bc1q4h8pn2x6rk9dz3mw7c'],
}

/** Synthetic suspect wallet per case (ANV-2026-0417 uses the canonical one). */
export function walletFor(c: CaseRow): string {
  if (c.wallet) return c.wallet
  if (c.id === CASE.id) return CASE.suspectWallet
  const n = Number(c.id.slice(-2))
  const pool = POOL[c.chain]
  return pool[n % pool.length]
}

export const exchangeOf = (c: CaseRow) => EXCHANGES.find((e) => e.id === c.exchange)
export const syndicateOf = (c: CaseRow) => SYNDICATES.find((s) => s.id === c.syndicate)

/** Live recoverability badge. `t0` is the page-mount time so countdowns survive row re-mounts. */
export function RecoverBadge({ c, t0, size = 'row' }: { c: CaseRow; t0: number; size?: 'row' | 'lg' }) {
  const [start] = React.useState(() => Math.max(0, Math.round((c.goldenMin ?? 0) * 60 - (Date.now() - t0) / 1000)))
  const left = useCountdown(start, c.goldenMin !== null)
  const big = size === 'lg'

  if (c.recover === 'frozen')
    return <State tone="moss" big={big} title="Frozen" sub="funds held at the exchange" />
  if (c.recover === 'lost') return <State tone="neutral" big={big} title="Cashed out" sub="beyond on-chain recovery" />
  // no trace yet → we don't know where the money is, so there is no honest countdown to show
  if (c.goldenMin === null && (c.recover === 'moving' || c.recover === 'at_rest'))
    return <State tone="sky" big={big} title="Not traced yet" sub="start the trace to find the money" />
  if (c.recover === 'at_exchange')
    return <State tone="gold" big={big} title="At exchange" sub={c.goldenMin !== null ? `freeze window ${mmss(left)}` : 'send notice to freeze'} />

  if (left <= 0) return <State tone="neutral" big={big} title="Window passed" sub="money may have moved on — re-run the trace" />
  const urgent = left < 30 * 60
  const tone: Tone = urgent ? 'ember' : 'gold'
  const total = Math.max(60, (c.goldenMin ?? 60)) * 60
  return (
    <div className="min-w-0">
      <div className={cn('k-mono whitespace-nowrap', big ? 'text-[20px]' : 'text-[14px]')} style={{ color: toneHex(tone) }}>
        {mmss(left)} <span className={cn('font-sans text-dim', big ? 'text-[13.5px]' : 'text-[12px]')}>to act</span>
      </div>
      <div className={cn('mt-1 h-[3px] overflow-hidden rounded-full bg-white/[0.06]', big ? 'w-full' : 'w-[110px]')}>
        <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${(left / total) * 100}%`, background: toneHex(tone) }} />
      </div>
      <div className="mt-0.5 text-[11.5px] text-dim">{c.recover === 'moving' ? 'moving between wallets' : 'resting in a wallet'}</div>
    </div>
  )
}

function State({ tone, title, sub, big }: { tone: Tone; title: string; sub: string; big: boolean }) {
  return (
    <div className="min-w-0">
      <div className={cn('flex items-center gap-1.5 whitespace-nowrap', big ? 'text-[16px]' : 'text-[13.5px]')} style={{ color: tone === 'neutral' ? '#a1a1a6' : toneHex(tone) }}>
        <span className="size-1.5 rounded-full" style={{ background: toneHex(tone) }} />
        {title}
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-dim">{sub}</div>
    </div>
  )
}

export function Monogram({ c, size = 30 }: { c: CaseRow; size?: number }) {
  const ex = exchangeOf(c)
  if (!ex) return <span className="text-[12.5px] text-dim">—</span>
  return (
    <span
      className="k-num grid shrink-0 place-items-center rounded-lg border border-line-2 bg-white/[0.04] text-[12px]"
      style={{ width: size, height: size, color: toneHex(ex.tone) }}
      title={ex.name}
    >
      {ex.monogram}
    </span>
  )
}
