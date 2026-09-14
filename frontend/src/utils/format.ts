const inrFormatter = new Intl.NumberFormat('en-IN')

/** Formats a number as Indian-grouped rupees, e.g. formatINR(1240000) -> "₹12,40,000" */
export function formatINR(n: number): string {
  return `₹${inrFormatter.format(Math.round(n))}`
}

/** Truncates a wallet/contract address to its first 4 and last 4 characters, e.g. "TXk9…q2aZ" */
export function truncateAddress(addr: string): string {
  if (addr.length <= 9) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

/** Formats a duration in seconds into a short human-readable string, e.g. "42s", "5m 12s", "1h 03m" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`

  const minutes = Math.floor(s / 60)
  const remSeconds = s % 60
  if (minutes < 60) {
    return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return `${hours}h ${String(remMinutes).padStart(2, '0')}m`
}
