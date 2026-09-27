import { useEffect, useState } from 'react'
import { Inbox, Mail, MessagesSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { getAuthToken } from '@/lib/authToken'
import { request } from '../api/client'
import { truncateAddress } from '../utils/format'

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
 */
export default function VaspReplies() {
  const [replies, setReplies] = useState<VaspWalletReply[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    request<VaspWalletReply[]>('/api/v1/vasp-feed/replies', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((result) => {
        if (cancelled) return
        setReplies(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load VASP replies. Your session may have expired — try signing in again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
          <Card key={reply.id} className="flex flex-col gap-3 p-6">
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

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Re: wallet</span>
              <span className="font-[family-name:var(--font-mono)] text-foreground/80">
                {truncateAddress(reply.flaggedWalletAddress)}
              </span>
              <Badge variant="outline">{reply.flaggedWalletChain}</Badge>
            </div>
          </Card>
        ))}
    </div>
  )
}
