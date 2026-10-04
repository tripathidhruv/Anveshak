import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, MessagesSquare, Reply, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { clearAuthToken, clearGuestMode, getAuthToken } from '@/lib/authToken'
import { useAuthStore } from '@/store/authStore'
import { getFlaggedWallets, getVaspReplies } from '../api/mock'
import { getFlaggedWallets as getFlaggedWalletsHttp, type BackendFlaggedWallet } from '../api/httpApi'

/** `getFlaggedWallets` isn't part of the shared `AnveshakApi` mock/real switch -- same pattern as
 * `FlaggedWallets.tsx`/`VaspReplies.tsx` (the officer-only equivalents this screen's data is
 * modeled on). This is the Exchange role's real landing page, replacing the "coming soon"
 * placeholder `App.tsx` shipped with -- an external exchange contact's view of the wallets
 * flagged against their platform and their own past replies through the wallet-sharing portal. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchFlaggedWallets: (token: string) => Promise<BackendFlaggedWallet[]> = USE_MOCK
  ? getFlaggedWallets
  : getFlaggedWalletsHttp

interface ReplyRow {
  id: number
  flaggedWalletAddress: string
  flaggedWalletChain: string
  message: string
  repliedAt: string
}

export default function ExchangePortal() {
  const navigate = useNavigate()
  const clearIdentity = useAuthStore((s) => s.clear)
  const email = useAuthStore((s) => s.email)

  const [wallets, setWallets] = useState<BackendFlaggedWallet[] | null>(null)
  const [replies, setReplies] = useState<ReplyRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<BackendFlaggedWallet | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    if (!token) {
      setError('Your session may have expired — try signing in again.')
      return
    }
    Promise.all([fetchFlaggedWallets(token), USE_MOCK ? getVaspReplies() : Promise.resolve([])])
      .then(([walletsResult, repliesResult]) => {
        if (cancelled) return
        setWallets(walletsResult)
        setReplies(repliesResult)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load your flagged wallets. Your session may have expired — try signing in again.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleLogout() {
    clearAuthToken()
    clearGuestMode()
    clearIdentity()
    navigate('/login', { replace: true })
  }

  /** Sends a reply about the selected flagged wallet. The real backend's reply endpoint
   * (`POST /vasp-feed/portal/{token}/reply`) is keyed off a subscriber's opaque access token
   * from the public, no-login wallet-sharing portal (`VaspPortal.tsx`) -- the internal,
   * role-based Exchange login this page belongs to has no such token and never had backend
   * wiring built for it, so this appends the new reply to local state only (DEMO DATA, same as
   * every other value on this page) rather than call an endpoint that doesn't exist for this
   * login path. */
  function sendReply() {
    if (!replyTarget || !draft.trim()) return
    setSending(true)
    setTimeout(() => {
      setReplies((prev) => [
        ...(prev ?? []),
        {
          id: (prev?.length ?? 0) + 1,
          flaggedWalletAddress: replyTarget.address,
          flaggedWalletChain: replyTarget.chain,
          message: draft.trim(),
          repliedAt: new Date().toISOString(),
        },
      ])
      setSending(false)
      setDraft('')
      setReplyTarget(null)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
            Exchange portal
          </h1>
          <p className="text-sm text-muted-foreground">
            DEMO DATA · {email ? `Signed in as ${email}` : 'Wallets flagged against your platform'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Log out"
          title="Log out"
          onClick={handleLogout}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-vermillion"
        >
          <LogOut size={16} />
        </button>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        {error && (
          <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
            {error}
          </Card>
        )}

        {!error && (
          <>
            <Card className="flex flex-col gap-4 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                Flagged wallets
              </h2>
              {!wallets ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center text-muted-foreground">
                  <Spinner percent={70} label="Loading" />
                  <p>Loading flagged wallets…</p>
                </div>
              ) : wallets.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                  <IconTile color="vermillion">
                    <ShieldAlert size={20} />
                  </IconTile>
                  <p>No wallets have been flagged against your platform yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Address
                        </th>
                        <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Chain
                        </th>
                        <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Risk
                        </th>
                        <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Flagged
                        </th>
                        <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <span className="sr-only">Reply</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallets.map((wallet) => {
                        const highRisk = wallet.riskScore >= 0.5
                        return (
                          <tr key={`${wallet.address}::${wallet.chain}`}>
                            <td className="border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">
                              <span className="break-all">{wallet.address}</span>
                            </td>
                            <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">
                              {wallet.chain}
                            </td>
                            <td className="whitespace-nowrap border-b border-border px-3 py-3">
                              <Badge variant={highRisk ? 'vermillion' : 'secondary'}>
                                {(wallet.riskScore * 100).toFixed(0)}%
                              </Badge>
                            </td>
                            <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-muted-foreground">
                              {new Date(wallet.flaggedAt).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap border-b border-border px-3 py-3">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setDraft('')
                                  setReplyTarget(wallet)
                                }}
                              >
                                <Reply size={14} /> Reply
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                Your replies
              </h2>
              {!replies ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center text-muted-foreground">
                  <Spinner percent={70} label="Loading" />
                  <p>Loading replies…</p>
                </div>
              ) : replies.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                  <IconTile color="primary">
                    <MessagesSquare size={20} />
                  </IconTile>
                  <p>You haven&rsquo;t replied to any flagged wallet yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {replies.map((reply) => (
                    <div key={reply.id} className="rounded-xl bg-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="break-all font-[family-name:var(--font-mono)] text-foreground/80">
                          {reply.flaggedWalletAddress}
                        </span>
                        <Badge variant="outline">{reply.flaggedWalletChain}</Badge>
                        <span>{new Date(reply.repliedAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Dialog open={replyTarget != null} onOpenChange={(open) => !open && setReplyTarget(null)}>
        <DialogContent>
          {replyTarget && (
            <>
              <DialogHeader>
                <DialogTitle>Reply about this wallet</DialogTitle>
                <DialogDescription>
                  <span className="break-all font-[family-name:var(--font-mono)]">{replyTarget.address}</span>
                  {' · '}
                  {replyTarget.chain}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <textarea
                  autoFocus
                  rows={4}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. We've located this wallet's deposit history and frozen the associated account."
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setReplyTarget(null)} disabled={sending}>
                    Cancel
                  </Button>
                  <Button onClick={sendReply} disabled={sending || !draft.trim()}>
                    {sending ? 'Sending…' : 'Send reply'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
