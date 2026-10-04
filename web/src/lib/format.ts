/** ₹ in Indian grouping, compact (L / Cr) when large. */
export function inr(n: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  const { compact = true, decimals } = opts
  if (compact && Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(decimals ?? 2)} Cr`
  if (compact && Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(decimals ?? 1)} L`
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

export function num(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function usdt(n: number): string {
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} USDT`
}

/** TXk9mR4p…sD6fH */
export function short(addr: string, head = 6, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function pct(x: number, decimals = 0): string {
  return `${(x * 100).toFixed(decimals)}%`
}

/** 125 -> "2m 05s" */
export function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(r).padStart(2, '0')}s`
}
