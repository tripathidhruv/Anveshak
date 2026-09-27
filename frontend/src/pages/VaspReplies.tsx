import { useEffect, useMemo, useState } from 'react'
import { Inbox, Mail, MessagesSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { getAuthToken } from '@/lib/authToken'
import { getFlaggedWallets, type BackendFlaggedWallet } from '../api/httpApi'
import { request } from '../api/client'

interface VaspWalletReply {
  id: number
  subscriberId: number
  subscriberName: string
  subscriberEmail: string | null
  flaggedWalletId: number
  flaggedWalletAddress: string
  flaggedWalletChain: string
  message: string
  repliedAt: string
}

/** Key for correlating a reply's wallet (address+chain only -- `GET /replies` never returns a
 * flagged-wallet id the schema doesn't expose) with the richer `BackendFlaggedWallet` row from
 * `GET /flagged-wallets/all`, which carries the risk score and related case IDs a reply itself
 * doesn't. */
function walletKey(address: string, chain: string): string {
  return `${address}::${chain}`
}

/**
 * Internal-only screen (docs/superpowers/specs/2026-09-27-auth-and-vasp-portal-design.md,
 * Feature 2): every reply an external exchange has left via their own public
 * `/vasp-portal/:token` link, for officers to review. Reached at `/vasp-replies`, behind
 * `RequireAuth`/`PageShell` like every other screen in the app.
 *
 * A new top-level nav destination rather than a tab bolted onto `Exchanges.tsx`: that screen
 * is built around a single exchange-attribution summary card (deposit address, FIU-IND
 * status, linked cases), not a list/tabbed layout, and a VASP reply is a different kind of
 * object entirely (an inbound message about a wallet, not a registry entry) -- giving it its
 * own nav item keeps the same one-concern-per-sidebar-entry pattern every other screen here
 * already follows, instead of reshaping Exchanges.tsx around a second, unrelated dataset.
 *
 * First real UI call to attach the officer's JWT (`Authorization: Bearer`) to a KAIZEN
 * backend request -- reuses `getAuthToken()` from `lib/authToken.ts` (Feature 1), not a new
 * token-storage mechanism.
 *
 * Task 11: each row opens a detail `Dialog` with the full (untruncated) address, chain,
 * subscriber name/email, full message and timestamp `GET /replies` returns directly, PLUS a
 * risk-score badge and related case IDs -- fields that endpoint does NOT return itself, so
 * this also fetches the officer-only `GET /flagged-wallets/all` (Task 6) once and correlates
 * by address+chain (see `walletKey` above) to fill them in. If that second call fails, or a
 * reply's wallet has no matching row (e.g. deleted), the dialog simply omits those two fields
 * rather than showing invented data (CLAUDE.md's "nothing is a black box" / honest-provenance
 * rule).
 */
export default function VaspReplies() {
  const [replies, setReplies] = useState<VaspWalletReply[] | null>(null)
  const [wallets, setWallets] = useState<BackendFlaggedWallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    Promise.allSettled([
      request<VaspWalletReply[]>('/api/v1/vasp-feed/replies', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
      token ? getFlaggedWallets(token) : Promise.reject(new Error('no token')),
    ]).then(([repliesResult, walletsResult]) => {
      if (cancelled) return
      if (repliesResult.status === 'fulfilled') {
        setReplies(repliesResult.value)
      } else {
        setError('Could not load VASP replies. Your session may have expired — try signing in again.')
      }
      // The wallet-enrichment call is best-effort -- a reply row is still useful without it,
      // so a failure here never blocks the page or overwrites the replies error above.
      if (walletsResult.status === 'fulfilled') {
        setWallets(walletsResult.value)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const walletIndex = useMemo(() => {
    const index = new Map<string, BackendFlaggedWallet>()
    for (const wallet of wallets) {
      index.set(walletKey(wallet.address, wallet.chain), wallet)
    }
    return index
  }, [wallets])

  const selectedReply = replies?.find((r) => r.id === selectedId) ?? null
  const selectedWallet = selectedReply
    ? walletIndex.get(walletKey(selectedReply.flaggedWalletAddress, selectedReply.flaggedWalletChain)) ?? null
    : null

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">VASP replies</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          DEMO DATA · messages exchanges have sent back through their own private wallet-sharing portal link.
        </p>
      </header>

      {loading && (
        <Card className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Loading replies…</p>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {error}
        </Card>
      )}

      {!loading && !error && replies && replies.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
          <IconTile color="primary" size="lg">
            <Inbox size={22} />
          </IconTile>
          <p className="text-sm">No exchange has replied through the portal yet.</p>
        </Card>
      )}

      {!loading &&
        !error &&
        replies &&
        replies.map((reply) => (
          <Card
            key={reply.id}
            className="flex cursor-pointer flex-col gap-3 p-6 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            role="button"
            tabIndex={0}
            onClick={() => setSelectedId(reply.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSelectedId(reply.id)
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <IconTile color="gold" size="sm">
                  <MessagesSquare size={16} />
                </IconTile>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-base font-bold text-foreground">
                    {reply.subscriberName}
                  </p>
                  {reply.subscriberEmail && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail size={12} />
                      {reply.subscriberEmail}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="secondary">{new Date(reply.repliedAt).toLocaleString()}</Badge>
            </div>

            <p className="rounded-xl bg-muted p-4 text-sm text-foreground">{reply.message}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Re: wallet</span>
              <span className="break-all font-[family-name:var(--font-mono)] text-foreground/80">
                {reply.flaggedWalletAddress}
              </span>
              <Badge variant="outline">{reply.flaggedWalletChain}</Badge>
            </div>
          </Card>
        ))}

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          {selectedReply && (
            <>
              <DialogHeader>
                <DialogTitle>Reply from {selectedReply.subscriberName}</DialogTitle>
                <DialogDescription>{new Date(selectedReply.repliedAt).toLocaleString()}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="break-all font-[family-name:var(--font-mono)] text-sm text-foreground">
                      {selectedReply.flaggedWalletAddress}
                    </span>
                    <Badge variant="outline">{selectedReply.flaggedWalletChain}</Badge>
                    {selectedWallet && (
                      <Badge variant={selectedWallet.riskScore >= 0.5 ? 'vermillion' : 'secondary'}>
                        Risk {(selectedWallet.riskScore * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>

                {selectedWallet && selectedWallet.caseIds.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Related cases
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedWallet.caseIds.map((caseId) => (
                        <Badge key={caseId} variant="secondary" className="font-[family-name:var(--font-mono)]">
                          {caseId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subscriber</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{selectedReply.subscriberName}</p>
                  {selectedReply.subscriberEmail && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail size={12} />
                      {selectedReply.subscriberEmail}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</p>
                  <p className="mt-1.5 rounded-xl bg-muted p-4 text-sm text-foreground">{selectedReply.message}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
