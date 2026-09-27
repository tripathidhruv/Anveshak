import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Link2Off, MessageSquare, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, request } from '../api/client'
import { truncateAddress } from '../utils/format'

interface PortalWallet {
  id: number
  address: string
  chain: string
  riskScore: number
  flaggedAt: string
}

interface PortalData {
  subscriberName: string
  wallets: PortalWallet[]
}

/**
 * Public VASP wallet-sharing portal (docs/superpowers/specs/2026-09-27-auth-and-vasp-portal-
 * design.md, Feature 2) -- reachable at /vasp-portal/:token with NO login. Mounted OUTSIDE
 * `RequireAuth`/`PageShell` in App.tsx: an external exchange visitor was never asked to sign
 * in, and their own opaque `access_token` (embedded in the link they were sent) is the only
 * thing that identifies them to the backend.
 *
 * DEMO DATA: every wallet shown here comes from KAIZEN's synthetic flagged-wallet feed
 * (CLAUDE.md rule 1) -- never a real case or a real exchange.
 */
export default function VaspPortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [sentIds, setSentIds] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    request<PortalData>(`/api/v1/vasp-feed/portal/${token}`)
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError('Could not load this portal link. Please try again in a moment.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function submitReply(e: FormEvent, walletId: number) {
    e.preventDefault()
    const message = (drafts[walletId] ?? '').trim()
    if (!message || submittingId !== null) return
    setSubmittingId(walletId)
    setError(null)
    try {
      await request(`/api/v1/vasp-feed/portal/${token}/reply`, {
        method: 'POST',
        body: { flaggedWalletId: walletId, message },
      })
      setSentIds((prev) => ({ ...prev, [walletId]: true }))
      setDrafts((prev) => ({ ...prev, [walletId]: '' }))
    } catch {
      setError('Could not send your reply. Please try again.')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <IconTile color="gold" size="lg">
            <ShieldAlert size={26} />
          </IconTile>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
              KAIZEN wallet-sharing portal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              DEMO DATA · a private link shared with your exchange, no sign-in required
            </p>
          </div>
        </header>

        {loading && (
          <Card className="flex flex-col items-center gap-4 p-10 text-center text-muted-foreground">
            <Spinner percent={70} label="Loading" />
            <p>Loading your flagged-wallet list…</p>
          </Card>
        )}

        {!loading && notFound && (
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <IconTile color="vermillion" size="lg">
              <Link2Off size={22} />
            </IconTile>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
              This link isn't valid
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              The portal link you followed is unknown or no longer active. Contact the KAIZEN investigating officer
              who shared it with you for a fresh link.
            </p>
          </Card>
        )}

        {!loading && !notFound && data && (
          <>
            <Card className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared with</p>
                <p className="font-[family-name:var(--font-display)] text-lg font-bold text-foreground">
                  {data.subscriberName}
                </p>
              </div>
              <Badge variant="gold">{data.wallets.length} flagged wallet{data.wallets.length === 1 ? '' : 's'}</Badge>
            </Card>

            {error && (
              <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm font-medium text-destructive">
                {error}
              </Card>
            )}

            {data.wallets.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No flagged wallets have been shared with you yet.
              </Card>
            )}

            {data.wallets.map((wallet) => {
              const highRisk = wallet.riskScore >= 0.5
              const alreadySent = sentIds[wallet.id] === true
              return (
                <Card key={wallet.id} className="flex flex-col gap-4 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-[family-name:var(--font-mono)] text-sm font-semibold text-foreground">
                        {truncateAddress(wallet.address)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{wallet.chain}</p>
                    </div>
                    <Badge variant={highRisk ? 'vermillion' : 'secondary'}>
                      Risk {(wallet.riskScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flagged {new Date(wallet.flaggedAt).toLocaleString()}
                  </p>

                  {alreadySent ? (
                    <div className="flex items-center gap-2 rounded-xl bg-moss/10 px-4 py-3 text-sm font-medium text-moss">
                      <CheckCircle2 size={16} />
                      Reply sent — KAIZEN officers can now see it.
                    </div>
                  ) : (
                    <form onSubmit={(e) => submitReply(e, wallet.id)} className="flex flex-col gap-2">
                      <label htmlFor={`reply-${wallet.id}`} className="text-xs font-medium text-foreground">
                        Reply to KAIZEN about this wallet
                      </label>
                      <textarea
                        id={`reply-${wallet.id}`}
                        rows={2}
                        placeholder="e.g. Funds frozen pending a formal request…"
                        value={drafts[wallet.id] ?? ''}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [wallet.id]: e.target.value }))}
                        className="w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="self-end"
                        disabled={submittingId !== null || !(drafts[wallet.id] ?? '').trim()}
                      >
                        <MessageSquare size={14} />
                        {submittingId === wallet.id ? 'Sending…' : 'Send reply'}
                      </Button>
                    </form>
                  )}
                </Card>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
